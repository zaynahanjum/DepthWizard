from pathlib import Path
from uuid import uuid4
from dotenv import load_dotenv

import rasterio
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.jobs import create_job, update_job, get_job, list_jobs
from backend.pipeline_runner import run_pipeline

load_dotenv()

app = FastAPI(
    title="DepthWizard API",
    description="Calibrating AI Depth Models with Real-World Geographic Constraints",
    version="1.0.0"
)

# Enable CORS so frontend (Three.js / React / HTML on any host or port) can connect without issues.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Project directories
PROJECT_ROOT = Path(__file__).resolve().parent.parent
UPLOADS_DIR = PROJECT_ROOT / "data" / "uploads"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)


def process_job(job_id: str, image_path: str, output_dir: str):
    """Run the processing pipeline for one job."""
    try:
        update_job(job_id, "running")

        metadata = run_pipeline(
            image_path=image_path,
            output_dir=output_dir,
        )

        update_job(
            job_id,
            "done",
            metadata=metadata,
        )

    except Exception as error:
        update_job(
            job_id,
            "failed",
            error=str(error),
        )
        print(f"Job {job_id} failed: {error}")


@app.get("/")
def home():
    """Health check / API status endpoint."""
    return {
        "name": "DepthWizard API",
        "status": "online",
        "message": "DepthWizard backend is ready.",
    }


@app.post("/upload", status_code=202)
async def upload_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload a georeferenced satellite GeoTIFF and start the pipeline.
    Returns 202 Accepted with the assigned job_id.
    """
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()

    if extension not in [".tif", ".tiff"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload a GeoTIFF (.tif or .tiff).",
        )

    job_id = str(uuid4())
    job_upload_dir = UPLOADS_DIR / job_id
    job_output_dir = OUTPUTS_DIR / job_id

    job_upload_dir.mkdir(parents=True, exist_ok=True)
    image_path = job_upload_dir / "satellite.tif"

    # Save uploaded file in chunks
    try:
        with open(image_path, "wb") as destination:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                destination.write(chunk)
    finally:
        await file.close()

    # Validate that the file is a readable GeoTIFF with CRS and >= 3 bands (RGB)
    try:
        with rasterio.open(image_path) as image:
            if image.crs is None:
                raise ValueError("The GeoTIFF contains no Coordinate Reference System (CRS).")
            if image.count < 3:
                raise ValueError("The GeoTIFF must contain at least 3 color bands (RGB).")
    except Exception as error:
        image_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid satellite GeoTIFF: {error}",
        )

    # Register the job
    job = create_job(
        job_id=job_id,
        image_path=str(image_path),
        output_dir=str(job_output_dir),
    )

    # Queue the background processing
    background_tasks.add_task(
        process_job,
        job_id,
        str(image_path),
        str(job_output_dir),
    )

    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Image uploaded successfully. Processing pipeline started.",
    }


@app.get("/status/{job_id}")
def job_status(job_id: str):
    """Return the current processing status of a job."""
    job = get_job(job_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Job {job_id} not found.",
        )

    return {
        "job_id": job_id,
        "status": job["status"],
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at"),
        "error": job.get("error"),
    }


@app.get("/result/{job_id}")
def job_result(job_id: str):
    """Return the result metadata for a completed job."""
    job = get_job(job_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Job {job_id} not found.",
        )

    if job["status"] == "failed":
        raise HTTPException(
            status_code=500,
            detail=f"Job failed during processing: {job.get('error')}",
        )

    if job["status"] != "done":
        raise HTTPException(
            status_code=409,
            detail=f"Job is still {job['status']}. Please retry when completed.",
        )

    metadata_path = OUTPUTS_DIR / job_id / "metadata.json"
    if not metadata_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Result metadata file not found.",
        )

    # Return the metadata object
    if job.get("metadata"):
        return job["metadata"]

    import json
    with open(metadata_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/files/{job_id}/{filename}")
def download_file(job_id: str, filename: str):
    """Download a generated output file for a job."""
    job = get_job(job_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Job {job_id} not found.",
        )

    # Prevent directory traversal attacks
    if Path(filename).name != filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename specified.",
        )

    file_path = OUTPUTS_DIR / job_id / filename

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"File '{filename}' not found for job {job_id}.",
        )

    # Determine media type
    ext = file_path.suffix.lower()
    media_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".tif": "image/tiff",
        ".tiff": "image/tiff",
        ".json": "application/json",
        ".geojson": "application/geo+json",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=media_type,
    )


@app.get("/jobs")
def get_all_jobs():
    """List all registered jobs and their current statuses."""
    all_jobs = list_jobs()
    return [
        {
            "job_id": j["job_id"],
            "status": j["status"],
            "created_at": j.get("created_at"),
            "updated_at": j.get("updated_at"),
            "error": j.get("error"),
        }
        for j in all_jobs
    ]
