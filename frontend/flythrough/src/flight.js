import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Camera rigs: 'auto' (terrain-following spline flythrough), 'free' (WASD + drag-look), 'orbit'. */
export class Flight {
  constructor(camera, dom, terrain) {
    this.camera = camera;
    this.dom = dom;
    this.t = terrain;
    this.mode = 'auto';
    this.playing = true;
    this.speedMul = 1;
    this.clearance = Math.max(60, terrain.W * 0.006);
    this.minClear = camera.near * 3;
    this.u = 0;
    this._look = null;
    this.keys = new Set();
    this.yaw = 0; this.pitch = 0;
    this.onModeChange = () => {};
    this.onClick = () => {};

    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.enabled = false;
    this.controls.maxPolarAngle = Math.PI * 0.499;

    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => this.keys.clear());
    this._pointer(dom);
    this.buildPath();
  }

  get baseSpeed() { return this.t.W / 120; }      // m/s at 1x: a loop takes a few minutes

  // ---- path -------------------------------------------------------------
  buildPath() {
    const { W, D } = this.t;
    const N = 720, clr = this.clearance;
    const xs = new Float32Array(N), zs = new Float32Array(N);
    const ground = new Float32Array(N), y = new Float32Array(N);
    const r = clr * 2;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      xs[k] = W * (0.34 * Math.cos(a) + 0.06 * Math.cos(3 * a + 0.7));
      zs[k] = D * (0.34 * Math.sin(a) + 0.06 * Math.sin(2 * a + 1.3));
      let m = this.t.heightAt(xs[k], zs[k]) ?? 0;
      for (let q = 0; q < 8; q++) {
        const h = this.t.heightAt(xs[k] + Math.cos(q * Math.PI / 4) * r, zs[k] + Math.sin(q * Math.PI / 4) * r);
        if (h !== null && h > m) m = h;
      }
      ground[k] = this.t.heightAt(xs[k], zs[k]) ?? 0;
      y[k] = m + clr;
    }
    const smooth = (arr, win) => {
      const out = new Float32Array(N), half = win >> 1;
      for (let k = 0; k < N; k++) {
        let s = 0;
        for (let o = -half; o <= half; o++) s += arr[(k + o + N) % N];
        out[k] = s / (2 * half + 1);
      }
      return out;
    };
    let ys = y;
    for (let p = 0; p < 3; p++) ys = smooth(ys, 31);
    for (let k = 0; k < N; k++) ys[k] = Math.max(ys[k], ground[k] + clr * 0.5);
    ys = smooth(ys, 9);

    const pts = [];
    for (let k = 0; k < N; k += 4) pts.push(new THREE.Vector3(xs[k], ys[k], zs[k]));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.curve.arcLengthDivisions = 2000;
    this.length = this.curve.getLength();
  }

  nearestU(pos) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < 360; k++) {
      const p = this.curve.getPointAt(k / 360), d = p.distanceToSquared(pos);
      if (d < bd) { bd = d; best = k / 360; }
    }
    return best;
  }

  // ---- modes ------------------------------------------------------------
  setMode(mode) {
    if (mode === this.mode) return;
    this.controls.enabled = false;
    if (mode === 'free') {
      const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.yaw = e.y; this.pitch = e.x;
    } else if (mode === 'orbit') {
      const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
      const hit = this.t.pick(this.camera.position, dir, this.camera.far);
      this.controls.target.copy(hit || new THREE.Vector3(0, 0, 0));
      this.controls.enabled = true;
      this.controls.update();
    } else if (mode === 'auto') {
      this.u = this.nearestU(this.camera.position);
      this._look = null;
    }
    this.mode = mode;
    this.onModeChange(mode);
  }

  reset() {
    this.u = 0; this._look = null; this.playing = true;
    this.mode = 'auto'; this.controls.enabled = false;
    this.onModeChange('auto');
  }

  // ---- input ------------------------------------------------------------
  _key(e, down) {
    const tag = (e.target && e.target.tagName) || '';
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) && e.code !== 'Escape') return;
    if (down) {
      if (MOVE_KEYS.has(e.code)) {
        if (this.mode !== 'free') this.setMode('free');
        e.preventDefault();
      }
      this.keys.add(e.code);
    } else this.keys.delete(e.code);
  }

  _pointer(dom) {
    let down = null;
    dom.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY }; });
    dom.addEventListener('pointermove', (e) => {
      if (!down || !(e.buttons & 1)) return;
      if (this.mode === 'free') {
        this.yaw -= (e.clientX - down.lx) * 0.0025;
        this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - (e.clientY - down.ly) * 0.0025));
      }
      down.lx = e.clientX; down.ly = e.clientY;
    });
    window.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 5 && performance.now() - down.t < 500 && e.target === dom) this.onClick(e.clientX, e.clientY);
      down = null;
    });
  }

  // ---- per-frame ----------------------------------------------------------
  update(dt) {
    dt = Math.min(dt, 0.1);
    const cam = this.camera;
    if (this.mode === 'auto') {
      if (this.playing) this.u = (this.u + (this.baseSpeed * this.speedMul * dt) / this.length) % 1;
      const pos = this.curve.getPointAt(this.u);
      const lookDist = Math.max(this.clearance * 5, this.t.W * 0.015);
      const ahead = this.curve.getPointAt((this.u + lookDist / this.length) % 1);
      ahead.y -= this.clearance * 0.35;                     // gentle downward gaze
      if (!this._look) this._look = ahead.clone();
      else this._look.lerp(ahead, 1 - Math.exp(-dt * 3));
      const g = this.t.heightAt(pos.x, pos.z);
      if (g !== null) pos.y = Math.max(pos.y, g + this.minClear);
      cam.position.copy(pos);
      cam.lookAt(this._look);
    } else if (this.mode === 'free') {
      const speed = this.baseSpeed * 1.5 * this.speedMul * (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 4 : 1);
      const k = this.keys;
      const turn = 1.6 * dt;
      if (k.has('ArrowLeft')) this.yaw += turn;
      if (k.has('ArrowRight')) this.yaw -= turn;
      if (k.has('ArrowUp')) this.pitch = Math.min(1.5, this.pitch + turn);
      if (k.has('ArrowDown')) this.pitch = Math.max(-1.5, this.pitch - turn);
      cam.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const v = new THREE.Vector3();
      if (k.has('KeyW')) v.add(fwd);
      if (k.has('KeyS')) v.sub(fwd);
      if (k.has('KeyD')) v.add(right);
      if (k.has('KeyA')) v.sub(right);
      if (k.has('KeyE') || k.has('Space')) v.y += 1;
      if (k.has('KeyQ')) v.y -= 1;
      if (v.lengthSq() > 0) cam.position.addScaledVector(v.normalize(), speed * dt);
      const lim = 0.6;
      cam.position.x = Math.max(-this.t.W * lim, Math.min(this.t.W * lim, cam.position.x));
      cam.position.z = Math.max(-this.t.D * lim, Math.min(this.t.D * lim, cam.position.z));
      const g = this.t.heightAt(cam.position.x, cam.position.z);
      if (g !== null) cam.position.y = Math.max(cam.position.y, g + this.minClear);
    } else {
      this.controls.update();
    }
  }
}
