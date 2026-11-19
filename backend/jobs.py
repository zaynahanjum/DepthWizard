import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

# In-memory dictionary storing job tracking information.
jobs = {}
jobs_lock = Lock()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUTS_DIR = PROJECT_ROOT / "outputs"


def create_job(job_id: str, image_path: str, output_dir: str) -> dict:
    """Register a newly uploaded image as a queued job."""
    now = datetime.now(timezone.utc).isoformat()
    job = {
        "job_id": job_id,
        "status": "queued",
        "image_path": str(image_path),
        "output_dir": str(output_dir),
        "created_at": now,
        "updated_at": now,
        "error": None,
        "metadata": None,
    }

    with jobs_lock:
        jobs[job_id] = job

    return job.copy()


def update_job(job_id: str, status: str, **kwargs) -> dict:
    """Update a job's status and additional fields."""
    with jobs_lock:
        if job_id not in jobs:
            raise KeyError(f"Job not found: {job_id}")

        jobs[job_id].update(kwargs)
        jobs[job_id]["status"] = status
        jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
        return jobs[job_id].copy()


def get_job(job_id: str):
    """
    Retrieve information about a job.
    If not in memory, attempts to recover from disk if metadata.json exists.
    """
    with jobs_lock:
        job = jobs.get(job_id)
        if job is not None:
            return job.copy()

    # Fallback: check if the job exists on disk (e.g. after server restart)
    job_dir = OUTPUTS_DIR / job_id
    metadata_file = job_dir / "metadata.json"
    if metadata_file.is_file():
        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)
            recovered_job = {
                "job_id": job_id,
                "status": "done",
                "image_path": str(job_dir / "intermediate" / "satellite.tif"),
                "output_dir": str(job_dir),
                "created_at": None,
                "updated_at": None,
                "error": None,
                "metadata": metadata,
            }
            with jobs_lock:
                jobs[job_id] = recovered_job
            return recovered_job.copy()
        except Exception:
            pass

    return None


def list_jobs() -> list:
    """Return a list of all known jobs."""
    with jobs_lock:
        job_list = [j.copy() for j in jobs.values()]

    # Also discover any output dirs on disk not currently in memory
    known_ids = {j["job_id"] for j in job_list}
    if OUTPUTS_DIR.exists():
        for item in OUTPUTS_DIR.iterdir():
            if item.is_dir() and item.name not in known_ids and (item / "metadata.json").is_file():
                recovered = get_job(item.name)
                if recovered:
                    job_list.append(recovered)

    # Sort newest first if created_at is available
    job_list.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return job_list
