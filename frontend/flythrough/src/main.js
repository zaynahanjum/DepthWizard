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
  $('job').textContent = params.get('job') ? `job ${params.get('job')}` : base.replace(/^\.\//, '');
  const { meta, hm, textureUrl, objects } = await loadJob(base, (m) => { $('loading-msg').textContent = m; });

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

  new THREE.TextureLoader().load(
    textureUrl,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      terrain.setTexture(tex);
      $('view-mode').value = terrain.mode;
    },
    undefined,
    () => { terrain.setTexture(null); $('view-mode').value = 'elevation'; console.warn('texture.png missing: using elevation colours'); },
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
      auto: 'Flythrough: press any movement key (W A S D) to take control · click terrain to measure',
      free: 'W A S D move · Q/E or Space down/up · Shift = fast · drag to look · click terrain to measure',
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
  $('view-mode').onchange = (e) => { const m = terrain.setMode(e.target.value); e.target.value = m; };
  $('show-objects').onchange = (e) => { if (objGroup) objGroup.visible = e.target.checked; };

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
}

main().catch(fail);
