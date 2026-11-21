"""
backend/jobs.py  –  thread-safe in-process job registry.

Each entry:
  status    : "queued" | "running" | "done" | "failed"
  error     : str | None
  output_dir: str | None   (absolute path once done)
  meta      : dict | None  (metadata.json content, cached on done)

State lives only in memory; a process restart resets it.
That is intentional for a development server.
"""
import threading

_store: dict[str, dict] = {}
_lock = threading.Lock()


def create_job(job_id: str) -> None:
    with _lock:
        _store[job_id] = {
            "status": "queued",
            "error": None,
            "output_dir": None,
            "meta": None,
        }


def set_running(job_id: str) -> None:
    with _lock:
        if job_id in _store:
            _store[job_id]["status"] = "running"


def set_done(job_id: str, output_dir: str, meta: dict | None = None) -> None:
    with _lock:
        if job_id in _store:
            _store[job_id].update(
                status="done",
                output_dir=output_dir,
                meta=meta,
            )


def set_failed(job_id: str, error: str) -> None:
    with _lock:
        if job_id in _store:
            _store[job_id].update(
                status="failed",
                error=error,
            )


def get_job(job_id: str) -> dict | None:
    """Return a shallow copy of the job entry, or None if not found."""
    with _lock:
        entry = _store.get(job_id)
        return dict(entry) if entry is not None else None
