"""
backend/main.py -- FastAPI server for DepthWizard.

Provides REST API endpoints for:
  - Uploading satellite imagery and DEMs
  - Asynchronous background pipeline execution
  - Real-time job status polling
  - Serving georeferenced output assets to the Three.js 3D flythrough frontend
"""
import os
import re
import uuid
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from backend import jobs
from pipeline.pipeline import run_pipeline

PROJECT_ROOT = Path(__file__).resolve().parent.parent
UPLOADS_DIR = PROJECT_ROOT / "data" / "uploads"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"
SAMPLES_DIR = PROJECT_ROOT / "data" / "samples"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="DepthWizard API",
    description="Geodetically Anchored AI Monocular Depth & 3D Terrain Engine",
    version="1.0.0"
)

# -----------------------------------------------------------------------------
# Security: CORS configuration
# Allows frontend (Vite/Three.js dev server on :5173 or local viewers) to fetch
# assets without cross-origin blocks.
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Regex to prevent directory traversal and injection in parameters
JOB_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-]{3,64}$")
SAFE_FILENAME_REGEX = re.compile(r"^[a-zA-Z0-9_\.\-]{1,128}$")
ALLOWED_EXTENSIONS = {".tif", ".tiff", ".png", ".jpg", ".jpeg"}
ALLOWED_DOWNLOAD_EXTENSIONS = {".png", ".json", ".tif", ".tiff", ".geojson"}


def _validate_job_id(job_id: str) -> str:
    if not JOB_ID_REGEX.match(job_id):
        raise HTTPException(status_code=400, detail="Invalid job_id format.")
    return job_id


def _validate_filename(filename: str) -> str:
    if not SAFE_FILENAME_REGEX.match(filename) or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename format.")
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_DOWNLOAD_EXTENSIONS:
        raise HTTPException(status_code=403, detail="File extension not allowed for download.")
    return filename


def _run_pipeline_worker(
    job_id: str,
    image_path: str,
    dem_path: Optional[str],
    output_dir: str,
    use_dummy_objects: bool
):
    """Background worker that calls pipeline.run_pipeline."""
    try:
        jobs.set_running(job_id)
        meta = run_pipeline(
            image_path=image_path,
            dem_path=dem_path,
            output_dir=output_dir,
            use_dummy_objects=use_dummy_objects,
            job_id=job_id
        )
        jobs.set_done(job_id, output_dir=output_dir, meta=meta)
        print(f"[backend] Job {job_id} successfully completed.")
    except Exception as exc:
        print(f"[backend] Job {job_id} failed: {exc}")
        jobs.set_failed(job_id, error=str(exc))


# -----------------------------------------------------------------------------
# REST Endpoints
# -----------------------------------------------------------------------------

@app.get("/")
def root():
    return {
        "service": "DepthWizard API",
        "status": "online",
        "endpoints": {
            "upload": "POST /upload",
            "status": "GET /status/{job_id}",
            "result": "GET /result/{job_id}",
            "files": "GET /files/{job_id}/{filename}",
            "jobs": "GET /jobs"
        }
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/jobs")
def list_jobs():
    """List available jobs on the server."""
    discovered = []
    # Check outputs directory
    if OUTPUTS_DIR.exists():
        for item in OUTPUTS_DIR.iterdir():
            if item.is_dir() and JOB_ID_REGEX.match(item.name):
                has_meta = (item / "metadata.json").is_file()
                has_hm = (item / "heightmap16.png").is_file()
                if has_meta and has_hm:
                    job_entry = jobs.get_job(item.name)
                    status = job_entry["status"] if job_entry else "done"
                    discovered.append({
                        "job_id": item.name,
                        "status": status,
                        "view_url": f"http://localhost:5173/?job={item.name}&api=http://localhost:8000"
                    })
    return {"jobs": discovered}


@app.post("/upload")
async def upload_files(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    dem: Optional[UploadFile] = File(None),
    use_dummy_objects: bool = Form(False)
):
    """
    Accepts georeferenced satellite image and optional DEM.
    Saves files securely and spawns async pipeline processing.
    """
    # Validate extension
    image_ext = Path(image.filename or "").suffix.lower()
    if image_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported image type '{image_ext}'. Allowed: {ALLOWED_EXTENSIONS}")

    if dem and dem.filename:
        dem_ext = Path(dem.filename).suffix.lower()
        if dem_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported DEM type '{dem_ext}'. Allowed: {ALLOWED_EXTENSIONS}")

    job_id = uuid.uuid4().hex[:12]
    job_upload_dir = UPLOADS_DIR / job_id
    job_output_dir = OUTPUTS_DIR / job_id
    job_upload_dir.mkdir(parents=True, exist_ok=True)
    job_output_dir.mkdir(parents=True, exist_ok=True)

    # Save uploaded image safely
    saved_image_path = job_upload_dir / f"image{image_ext}"
    with open(saved_image_path, "wb") as f:
        shutil_copy = True
        while True:
            chunk = await image.read(1024 * 1024)  # 1MB chunks
            if not chunk:
                break
            f.write(chunk)

    saved_dem_path = None
    if dem and dem.filename:
        dem_ext = Path(dem.filename).suffix.lower()
        saved_dem_path = job_upload_dir / f"dem{dem_ext}"
        with open(saved_dem_path, "wb") as f:
            while True:
                chunk = await dem.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)

    jobs.create_job(job_id)

    background_tasks.add_task(
        _run_pipeline_worker,
        job_id=job_id,
        image_path=str(saved_image_path),
        dem_path=str(saved_dem_path) if saved_dem_path else None,
        output_dir=str(job_output_dir),
        use_dummy_objects=use_dummy_objects
    )

    return {
        "job_id": job_id,
        "status": "queued",
        "flythrough_url": f"http://localhost:5173/?job={job_id}&api=http://localhost:8000"
    }


@app.get("/status/{job_id}")
def get_job_status(job_id: str):
    """Check processing status: queued, running, done, or failed."""
    _validate_job_id(job_id)
    entry = jobs.get_job(job_id)

    if not entry:
        # Check if job exists directly on disk
        meta_file = OUTPUTS_DIR / job_id / "metadata.json"
        if meta_file.is_file():
            return {"job_id": job_id, "status": "done", "error": None}
        raise HTTPException(status_code=404, detail="Job not found.")

    return {
        "job_id": job_id,
        "status": entry.get("status", "unknown"),
        "error": entry.get("error")
    }


@app.get("/result/{job_id}")
def get_job_result(job_id: str):
    """Returns metadata.json when pipeline execution is complete."""
    _validate_job_id(job_id)
    entry = jobs.get_job(job_id)

    if entry and entry.get("status") == "failed":
        raise HTTPException(status_code=500, detail=f"Job execution failed: {entry.get('error')}")

    meta_file = OUTPUTS_DIR / job_id / "metadata.json"
    if not meta_file.is_file():
        raise HTTPException(status_code=404, detail="Job results not ready or job does not exist.")

    import json
    with open(meta_file, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/files/{job_id}/{filename}")
def serve_output_file(job_id: str, filename: str):
    """
    Serves output files (heightmap16.png, texture.png, metadata.json, objects_scene.json).
    Guarded against directory traversal attacks.
    """
    _validate_job_id(job_id)
    _validate_filename(filename)

    base_dir = (OUTPUTS_DIR / job_id).resolve()
    target_path = (base_dir / filename).resolve()

    # Vulnerability guard: ensure path is strictly within job's output directory
    if not str(target_path).startswith(str(base_dir)):
        raise HTTPException(status_code=403, detail="Access denied: invalid file path.")

    if not target_path.is_file():
        # Fallback check: if demo data is requested or sample fallback
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found for job '{job_id}'.")

    ext = target_path.suffix.lower()
    media_types = {
        ".png": "image/png",
        ".json": "application/json",
        ".geojson": "application/geo+json",
        ".tif": "image/tiff",
        ".tiff": "image/tiff",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(target_path),
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"}
    )
