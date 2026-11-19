// Loads one DepthWizard job folder (README section 5.3):
//   metadata.json, heightmap16.png, texture.png, [objects_scene.json]
import { decode } from 'fast-png';

async function fetchChecked(url, what) {
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`Could not reach ${url} (${what}). Is the server running / CORS enabled?`);
  }
  const type = res.headers.get('content-type') || '';
  // dev/preview servers answer unknown paths with index.html and HTTP 200
  if (!res.ok || type.includes('text/html')) throw new Error(`${what} not found at ${url}`);
  return res;
}

export function resolveBase(params) {
  const api = (params.get('api') || 'http://localhost:8000').replace(/\/$/, '');
  let base = params.get('base');
  if (!base && params.get('job')) base = `${api}/files/${encodeURIComponent(params.get('job'))}/`;
  if (!base) base = './demo/';
  return base.endsWith('/') ? base : base + '/';
}

export async function loadJob(base, onProgress = () => {}, params = null) {
  const jobId = params?.get('job');
  const api = (params?.get('api') || 'http://localhost:8000').replace(/\/$/, '');

  // If a backend job ID is provided, check and poll the backend until complete
  if (jobId) {
    let attempts = 0;
    while (attempts < 60) {
      try {
        const stRes = await fetch(`${api}/status/${encodeURIComponent(jobId)}`);
        if (stRes.ok) {
          const st = await stRes.json();
          if (st.status === 'done') {
            break;
          } else if (st.status === 'failed') {
            throw new Error(`Pipeline failed: ${st.error || 'Unknown error'}`);
          } else {
            onProgress(`Running AI depth & terrain pipeline (${st.status})…`);
            await new Promise((r) => setTimeout(r, 1500));
            attempts++;
            continue;
          }
        }
      } catch (err) {
        if (err.message && err.message.includes('Pipeline failed')) throw err;
        break; // Server might not have status or endpoint, proceed to fetch direct files
      }
      break;
    }
  }

  onProgress('Reading metadata…');
  const metaRes = await fetchChecked(base + 'metadata.json', 'metadata.json');
  let meta;
  try { meta = await metaRes.json(); }
  catch { throw new Error(`metadata.json at ${base} is not valid JSON`); }
  if (!meta.terrain || meta.terrain.min_elevation_m == null || meta.terrain.max_elevation_m == null) {
    throw new Error('metadata.json is missing terrain.min_elevation_m / terrain.max_elevation_m');
  }

  onProgress('Decoding 16-bit heightmap…');
  const hmRes = await fetchChecked(base + 'heightmap16.png', 'heightmap16.png');
  const hm = decode(new Uint8Array(await hmRes.arrayBuffer()));
  if (!hm.width || !hm.height) throw new Error('heightmap16.png could not be decoded');

  // objects are optional; a missing file must never break the terrain
  let objects = null;
  try {
    const r = await fetch(base + 'objects_scene.json');
    const type = r.headers.get('content-type') || '';
    if (r.ok && !type.includes('text/html')) objects = await r.json();
  } catch { /* optional */ }

  return { meta, hm, textureUrl: base + 'texture.png', objects };
}
