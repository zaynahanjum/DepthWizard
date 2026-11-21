/**
 * DepthWizard Frontend - Centralized API Client
 * Connects to the FastAPI backend at http://127.0.0.1:8000
 */

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export const FLYTHROUGH_BASE_URL = (
  process.env.NEXT_PUBLIC_FLYTHROUGH_URL || "http://localhost:5173"
).replace(/\/$/, "");

/**
 * Upload satellite GeoTIFF image and optional DEM to start pipeline
 * @param {FormData} formData - Contains 'image', optional 'dem', and 'use_dummy_objects'
 * @returns {Promise<{job_id: string, status: string, flythrough_url?: string}>}
 */
export async function uploadImagery(formData) {
  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Upload failed with status code ${res.status}`
    );
  }

  return await res.json();
}

/**
 * Poll job processing status
 * @param {string} jobId
 * @returns {Promise<{job_id: string, status: 'queued'|'running'|'done'|'failed', error?: string}>}
 */
export async function getJobStatus(jobId) {
  const res = await fetch(`${API_BASE_URL}/status/${jobId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Status check failed with status ${res.status}`
    );
  }

  return await res.json();
}

/**
 * Get completed job result (metadata.json)
 * @param {string} jobId
 * @returns {Promise<object>}
 */
export async function getJobResult(jobId) {
  const res = await fetch(`${API_BASE_URL}/result/${jobId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to fetch results for job ${jobId}`
    );
  }

  return await res.json();
}

/**
 * Construct direct download/serve URL for a generated artifact
 * @param {string} jobId
 * @param {string} filename
 * @returns {string}
 */
export function getFileUrl(jobId, filename) {
  return `${API_BASE_URL}/files/${jobId}/${encodeURIComponent(filename)}`;
}

/**
 * Fetch and parse objects.geojson for a job
 * @param {string} jobId
 * @param {string} filename - Defaults to 'objects.geojson'
 * @returns {Promise<object>}
 */
export async function fetchGeoJson(jobId, filename = "objects.geojson") {
  const url = getFileUrl(jobId, filename);
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to load GeoJSON file: ${filename}`);
  }

  return await res.json();
}

/**
 * Fetch and parse objects_scene.json for a job
 * @param {string} jobId
 * @returns {Promise<object>}
 */
export async function fetchSceneJson(jobId) {
  const url = getFileUrl(jobId, "objects_scene.json");
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    return null; // Scene json might be optional or generated in combine step
  }

  return await res.json();
}

/**
 * List recent jobs discovered by the backend
 * @returns {Promise<Array<{job_id: string, status: string, view_url: string}>>}
 */
export async function listRecentJobs() {
  try {
    const res = await fetch(`${API_BASE_URL}/jobs`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.jobs || [];
  } catch (e) {
    return [];
  }
}

/**
 * Check backend health/reachability
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      cache: "no-store",
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}
