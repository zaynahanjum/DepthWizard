import './style.css';
import * as THREE from 'three';
import { loadJob, resolveBase } from './loader.js';
import { Terrain } from './terrain.js';
import { Flight } from './flight.js';
import { buildObjects } from './objects.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

function fail(err) {
  console.error(err);
  $('loading').classList.add('error');
  $('loading-msg').innerHTML = `<strong>Could not load the terrain</strong><br>${String(err.message || err)}<br><br>` +
    `<span class="muted small">Open with <code>?base=./demo/</code>, <code>?base=/data/</code> or <code>?job=&lt;job_id&gt;&amp;api=http://localhost:8000</code></span>`;
}

async function main() {
  const base = resolveBase(params);
  const api = (params.get('api') || 'http://localhost:8000').replace(/\/$/, '');
  $('job').textContent = params.get('job') ? `job ${params.get('job')}` : base.replace(/^\.\//, '');
  const { meta, hm, textureUrl, objects } = await loadJob(base, (m) => { $('loading-msg').textContent = m; }, params);

  $('loading-msg').textContent = 'Building terrain mesh…';
  await new Promise((r) => requestAnimationFrame(r));

  // ---- renderer / scene ---------------------------------------------------
  const canvas = $('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const maxGrid = Number(params.get('maxgrid')) || 1024;
  const terrain = new Terrain(meta, hm, { maxGrid });
  const span = Math.max(terrain.W, terrain.D);

  const scene = new THREE.Scene();
  const horizon = new THREE.Color('#cfe0ec');
  scene.fog = new THREE.Fog(horizon, span * 0.55, span * 2.4);
  scene.add(new THREE.HemisphereLight(0xdfeaf5, 0x59624f, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.8);
  sun.position.set(-0.5, 0.8, -0.6);
  scene.add(sun);
  scene.add(terrain.mesh);

  const camera = new THREE.PerspectiveCamera(60, 1, Math.max(1, span * 0.00005), span * 3);
  scene.add(camera);

  // sensible default exaggeration: make relief read as ~6% of the width
  const autoExag = Math.min(15, Math.max(1, Math.round((span * 0.06) / terrain.relief * 2) / 2));
  const exag0 = Number(params.get('exag')) || autoExag;
  terrain.setExaggeration(exag0);

  // ---- texture loading ---------------------------------------------------
  // The texture loads asynchronously. While it is pending we disable the
  // "Satellite texture" option so the user gets clear feedback, and
  // re-enable + auto-switch to it the moment it arrives.
  const texOpt = $('view-mode').querySelector('option[value="texture"]');
  if (texOpt) { texOpt.disabled = true; texOpt.textContent = 'Satellite texture (loading…)'; }

  new THREE.TextureLoader().load(
    textureUrl,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      terrain.setTexture(tex);
      // Re-enable the option now that the texture is ready
      if (texOpt) { texOpt.disabled = false; texOpt.textContent = 'Satellite texture'; }
      // Switch to texture mode and sync the dropdown
      terrain.setMode('texture');
      $('view-mode').value = 'texture';
    },
    undefined,
    () => {
      // texture.png genuinely missing – keep the option disabled with a note
      terrain.setTexture(null);
      if (texOpt) { texOpt.textContent = 'Satellite texture (unavailable)'; }
      $('view-mode').value = 'elevation';
      console.warn('texture.png missing: using elevation colours');
    },
  );

  // ---- objects ----------------------------------------------------------
  let objGroup = null;
  function rebuildObjects() {
    if (objGroup) { scene.remove(objGroup); objGroup.traverse((o) => o.geometry && o.geometry.dispose()); }
    objGroup = buildObjects(objects, terrain);
    objGroup.visible = $('show-objects').checked;
    scene.add(objGroup);
    $('obj-count').textContent = objGroup.userData.count ? `(${objGroup.userData.count})` : '(none in this job)';
  }

  // ---- flight -----------------------------------------------------------
  const flight = new Flight(camera, canvas, terrain);
  flight.onModeChange = (m) => {
    document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    $('play').style.display = m === 'auto' ? '' : 'none';
    $('hud-help').textContent = {
      auto: 'Flythrough: drag the mouse, scroll or press W A S D to take control · click terrain to measure',
      free: 'Drag to look · scroll = forward/back · W A S D move · Q/E or Space down/up · Shift = fast · click to measure',
      orbit: 'Drag to orbit · right-drag to pan · scroll to zoom · click terrain to measure',
    }[m];
  };
  flight.onModeChange('auto');

  // ---- measuring --------------------------------------------------------
  const pts = [];                                      // {x, z}
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffb84d, depthTest: false });
  const markers = [new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), markerMat), new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), markerMat)];
  markers.forEach((m) => { m.renderOrder = 20; m.visible = false; m.frustumCulled = false; scene.add(m); });
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffb84d, depthTest: false }));
  line.renderOrder = 19; line.visible = false; line.frustumCulled = false; scene.add(line);

  const fmt = (v, d = 1) => v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
  const dist = (m) => (m >= 1000 ? `${fmt(m / 1000, 2)} km` : `${fmt(m, 0)} m`);
  function refreshMeasure() {
    const w = pts.map((p) => new THREE.Vector3(p.x, terrain.heightAt(p.x, p.z) ?? 0, p.z));
    markers.forEach((m, i) => { m.visible = i < w.length; if (w[i]) m.position.copy(w[i]); });
    line.visible = w.length === 2;
    if (w.length === 2) { lineGeo.setFromPoints(w); }
    if (!w.length) { $('measure').textContent = 'No point selected'; return; }
    const e = w.map((p) => terrain.elevationFromY(p.y));
    let txt = `A: ${fmt(e[0])} m elevation`;
    if (w.length === 2) {
      const dh = e[1] - e[0], hd = Math.hypot(w[1].x - w[0].x, w[1].z - w[0].z);
      const sd = Math.hypot(hd, dh), ang = Math.atan2(dh, hd) * 180 / Math.PI;
      txt += `\nB: ${fmt(e[1])} m elevation\nΔ height: ${dh >= 0 ? '+' : ''}${fmt(dh)} m\nHorizontal: ${dist(hd)}\nSlope distance: ${dist(sd)}\nSlope: ${fmt(Math.abs(ang))}° (${fmt(Math.abs(hd ? (dh / hd) * 100 : 0))}%)`;
    }
    $('measure').textContent = txt;
  }
  flight.onClick = (cx, cy) => {
    const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, camera);
    const hit = terrain.pick(rc.ray.origin, rc.ray.direction, camera.far);
    if (!hit) return;
    if (pts.length >= 2) pts.length = 0;
    pts.push({ x: hit.x, z: hit.z });
    refreshMeasure();
  };
  $('clear-measure').onclick = () => { pts.length = 0; refreshMeasure(); };

  // ---- UI wiring ---------------------------------------------------------
  const exagEl = $('exag');
  exagEl.value = exag0; exagEl.max = Math.max(30, Math.ceil(exag0 * 2));
  $('exag-out').textContent = `${exag0}×`;
  const clrEl = $('clear');
  clrEl.min = 20; clrEl.max = Math.round(span * 0.05); clrEl.step = Math.max(1, Math.round(span * 0.0005));
  clrEl.value = Math.round(flight.clearance);
  const clrLabel = () => { $('clear-out').textContent = `${Math.round(flight.clearance)} (≈${Math.round(flight.clearance / terrain.exag)} m true)`; };
  clrLabel();

  document.querySelectorAll('#modes button').forEach((b) => (b.onclick = () => flight.setMode(b.dataset.mode)));
  $('play').onclick = () => { flight.playing = !flight.playing; $('play').textContent = flight.playing ? 'Pause' : 'Play'; };
  $('reset').onclick = () => { flight.reset(); $('play').textContent = 'Pause'; };
  $('speed').oninput = (e) => { flight.speedMul = Number(e.target.value); $('speed-out').textContent = `${flight.speedMul}×`; };
  clrEl.oninput = (e) => { flight.clearance = Number(e.target.value); clrLabel(); };
  clrEl.onchange = () => { flight.buildPath(); flight.u = flight.nearestU(camera.position); };
  exagEl.oninput = (e) => { terrain.setExaggeration(Number(e.target.value)); $('exag-out').textContent = `${e.target.value}×`; clrLabel(); };
  exagEl.onchange = () => { rebuildObjects(); flight.buildPath(); flight.u = flight.nearestU(camera.position); refreshMeasure(); };
  $('view-mode').onchange = (e) => {
    const requested = e.target.value;
    const actual = terrain.setMode(requested);
    // If the texture was pending and user chose 'texture', setMode returns
    // 'elevation' but _pendingTexture is set — keep the dropdown showing
    // 'texture' as a promise that it will switch once loaded.
    if (requested !== 'texture') e.target.value = actual;
  };
  $('show-objects').onchange = (e) => { if (objGroup) objGroup.visible = e.target.checked; };

  // Give keyboard focus back to the scene after using a panel control so
  // W A S D keep working.  IMPORTANT: skip <select> elements – blurring a
  // select immediately after its 'change' event prevents the browser from
  // committing the new value on some platforms, which is what made the
  // "Satellite texture" dropdown option appear to do nothing.
  const releaseFocus = (e) => {
    if (e && e.target && e.target.tagName === 'SELECT') return;   // ← let selects keep focus until blur naturally
    setTimeout(() => { const a = document.activeElement; if (a && a !== document.body && a.tagName !== 'SELECT') a.blur(); }, 80);
  };
  $('panel').addEventListener('change', releaseFocus);
  $('panel').addEventListener('click', releaseFocus);
  $('panel').addEventListener('pointerup', releaseFocus);

  // exaggeration changed -> path and objects must follow
  terrain.setExaggeration(exag0);
  flight.buildPath();
  rebuildObjects();

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // ---- loop ---------------------------------------------------------------
  let last = performance.now();
  let hudT = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    flight.update(dt);
    const k = camera.position.distanceTo(markers[0].position) * 0.008;
    markers[0].scale.setScalar(Math.max(k, 0.5));
    markers[1].scale.setScalar(Math.max(camera.position.distanceTo(markers[1].position) * 0.008, 0.5));
    hudT += dt;
    if (hudT > 0.1) {
      hudT = 0;
      const g = terrain.heightAt(camera.position.x, camera.position.z) ?? 0;
      $('hud-alt').textContent = `Alt ${fmt(terrain.elevationFromY(camera.position.y), 0)} m · AGL ${fmt((camera.position.y - g) / terrain.exag, 0)} m`;
    }
    renderer.render(scene, camera);
  });

  $('loading').classList.add('hidden');
  $('panel').classList.remove('hidden');
  $('hud').classList.remove('hidden');

  // handy for debugging in the console and for automated checks
  window.dw = { terrain, flight, camera, renderer, scene, meta };

  // ---- upload modal & server jobs -----------------------------------------
  setupUploadModal(api);
}

function setupUploadModal(api) {
  const modal = $('modal-upload');
  const btnOpen = $('btn-open-upload');
  const btnClose = $('btn-close-modal');
  const form = $('upload-form');
  const feedback = $('upload-feedback');
  const jobsList = $('server-jobs-list');

  if (!modal || !btnOpen) return;

  async function refreshServerJobs() {
    if (!jobsList) return;
    jobsList.innerHTML = 'Connecting to server…';
    try {
      const res = await fetch(`${api}/jobs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.jobs || !data.jobs.length) {
        jobsList.innerHTML = '<span class="muted">No server jobs found yet. Upload an image above to start.</span>';
        return;
      }
      jobsList.innerHTML = data.jobs.map((j) => `
        <div class="job-item">
          <span><strong>${j.job_id}</strong> <small class="muted">(${j.status})</small></span>
          <a href="?job=${encodeURIComponent(j.job_id)}&api=${encodeURIComponent(api)}">Open 3D ↗</a>
        </div>
      `).join('');
    } catch {
      jobsList.innerHTML = `<span class="muted small">Backend not reached at ${api}. Start with <code>uvicorn backend.main:app</code></span>`;
    }
  }

  btnOpen.onclick = () => {
    modal.classList.remove('hidden');
    feedback.textContent = '';
    refreshServerJobs();
  };

  btnClose.onclick = () => {
    modal.classList.add('hidden');
  };

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const imgInput = $('input-image');
    const demInput = $('input-dem');
    if (!imgInput.files || !imgInput.files[0]) {
      feedback.textContent = 'Please select a satellite image.';
      return;
    }

    const formData = new FormData();
    formData.append('image', imgInput.files[0]);
    if (demInput.files && demInput.files[0]) {
      formData.append('dem', demInput.files[0]);
    }

    const btnSubmit = $('btn-submit-upload');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Uploading to server…';
    feedback.textContent = 'Uploading file to DepthWizard backend…';

    try {
      const res = await fetch(`${api}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Upload failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      feedback.innerHTML = `<strong>Job ${data.job_id} queued!</strong> Launching 3D flythrough…`;
      setTimeout(() => {
        location.href = `?job=${encodeURIComponent(data.job_id)}&api=${encodeURIComponent(api)}`;
      }, 800);
    } catch (err) {
      console.error(err);
      feedback.textContent = `Error: ${err.message}`;
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Process with AI & 3D View';
    }
  };
}

main().catch(fail);
