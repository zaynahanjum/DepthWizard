import * as THREE from 'three';

/** World size in metres (x = east, z = south, y = up). */
export function computeWorldSize(meta) {
  const e = meta.extent;
  let w, d;
  if (e && e.max_x > e.min_x && e.max_y > e.min_y) {
    w = e.max_x - e.min_x; d = e.max_y - e.min_y;
    if (String(meta.crs || '').includes('4326')) {          // degrees -> metres
      const lat = ((e.max_y + e.min_y) / 2) * Math.PI / 180;
      w = w * 111320 * Math.cos(lat); d = d * 110540;
    }
  } else {
    const ps = meta.pixel_size_m || 1;
    w = meta.width * ps; d = meta.height * ps;
  }
  return { w, d };
}

const lerp3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
function ramp(stops, t) {
  t = Math.min(1, Math.max(0, t));
  for (let k = 1; k < stops.length; k++) {
    if (t <= stops[k][0]) {
      const [t0, c0] = stops[k - 1], [t1, c1] = stops[k];
      return lerp3(c0, c1, (t - t0) / (t1 - t0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}
const ELEV_RAMP = [
  [0.00, [0.20, 0.42, 0.24]], [0.25, [0.40, 0.58, 0.28]], [0.50, [0.70, 0.66, 0.40]],
  [0.72, [0.52, 0.40, 0.30]], [0.88, [0.74, 0.72, 0.70]], [1.00, [0.97, 0.97, 0.98]],
];
const SLOPE_RAMP = [
  [0.00, [0.22, 0.60, 0.30]], [0.25, [0.80, 0.82, 0.25]], [0.55, [0.95, 0.55, 0.15]], [1.00, [0.80, 0.12, 0.12]],
];

export class Terrain {
  constructor(meta, hm, { maxGrid = 1024 } = {}) {
    const { w, d } = computeWorldSize(meta);
    this.W = w; this.D = d;
    this.minE = meta.terrain.min_elevation_m;
    this.maxE = meta.terrain.max_elevation_m;
    this.relief = Math.max(1e-6, this.maxE - this.minE);

    const s = Math.min(1, maxGrid / Math.max(hm.width, hm.height));
    const gw = Math.max(2, Math.round(hm.width * s));
    const gh = Math.max(2, Math.round(hm.height * s));
    this.gw = gw; this.gh = gh;
    this.cellX = w / (gw - 1); this.cellZ = d / (gh - 1);

    // metres above the minimum elevation (NOT exaggerated)
    const maxv = Math.pow(2, hm.depth) - 1;
    const ch = hm.channels || 1;
    this.rel = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      const sy = Math.round(j * (hm.height - 1) / (gh - 1));
      for (let i = 0; i < gw; i++) {
        const sx = Math.round(i * (hm.width - 1) / (gw - 1));
        this.rel[j * gw + i] = (hm.data[(sy * hm.width + sx) * ch] / maxv) * this.relief;
      }
    }

    this.exag = 1;
    this.mode = 'texture';
    this.texture = null;

    const n = gw * gh;
    const pos = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const k = j * gw + i;
        pos[k * 3] = (i / (gw - 1) - 0.5) * w;
        pos[k * 3 + 2] = (j / (gh - 1) - 0.5) * d;
        uv[k * 2] = i / (gw - 1);
        uv[k * 2 + 1] = 1 - j / (gh - 1);
      }
    }
    const idx = new Uint32Array((gw - 1) * (gh - 1) * 6);
    let q = 0;
    for (let j = 0; j < gh - 1; j++) {
      for (let i = 0; i < gw - 1; i++) {
        const a = j * gw + i, b = a + 1, c = a + gw, e = c + 1;
        idx[q++] = a; idx[q++] = c; idx[q++] = b;   // counter-clockwise seen from +y
        idx[q++] = b; idx[q++] = c; idx[q++] = e;
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.geometry.setIndex(new THREE.BufferAttribute(idx, 1));

    this.material = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.setExaggeration(1);
  }

  setTexture(tex) {
    this.texture = tex;
    if (!tex && this.mode === 'texture') this.mode = 'elevation';
    this.setMode(this.mode);
  }

  setMode(mode) {
    if (mode === 'texture' && !this.texture) mode = 'elevation';
    this.mode = mode;
    const textured = mode === 'texture';
    this.material.map = textured ? this.texture : null;
    this.material.vertexColors = !textured;
    this.material.color.set(0xffffff);
    this.material.needsUpdate = true;
    if (!textured) this._updateColors();
    return mode;
  }

  /** central-difference gradient in metres per metre (un-exaggerated) */
  _grad(i, j) {
    const { gw, gh, rel } = this;
    const il = Math.max(i - 1, 0), ir = Math.min(i + 1, gw - 1);
    const ju = Math.max(j - 1, 0), jd = Math.min(j + 1, gh - 1);
    return [
      (rel[j * gw + ir] - rel[j * gw + il]) / ((ir - il) * this.cellX),
      (rel[jd * gw + i] - rel[ju * gw + i]) / ((jd - ju) * this.cellZ),
    ];
  }

  setExaggeration(k) {
    this.exag = k;
    const { gw, gh, rel } = this;
    const pos = this.geometry.attributes.position.array;
    const nor = this.geometry.attributes.normal.array;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const idx = j * gw + i;
        pos[idx * 3 + 1] = rel[idx] * k;
        const [gx, gz] = this._grad(i, j);
        const nx = -gx * k, nz = -gz * k, len = Math.hypot(nx, 1, nz);
        nor[idx * 3] = nx / len; nor[idx * 3 + 1] = 1 / len; nor[idx * 3 + 2] = nz / len;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    if (this.mode !== 'texture') this._updateColors();
  }

  _updateColors() {
    const { gw, gh, rel } = this;
    const col = this.geometry.attributes.color.array;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const idx = j * gw + i;
        let c;
        if (this.mode === 'slope') {
          const [gx, gz] = this._grad(i, j);
          const deg = Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
          c = ramp(SLOPE_RAMP, deg / 45);
        } else {
          c = ramp(ELEV_RAMP, rel[idx] / this.relief);
        }
        col[idx * 3] = c[0]; col[idx * 3 + 1] = c[1]; col[idx * 3 + 2] = c[2];
      }
    }
    this.geometry.attributes.color.needsUpdate = true;
  }

  /** exaggerated world-space height at (x, z), or null outside the terrain */
  heightAt(x, z) {
    const fx = (x / this.W + 0.5) * (this.gw - 1);
    const fz = (z / this.D + 0.5) * (this.gh - 1);
    if (fx < 0 || fz < 0 || fx > this.gw - 1 || fz > this.gh - 1) return null;
    const i = Math.min(Math.floor(fx), this.gw - 2), j = Math.min(Math.floor(fz), this.gh - 2);
    const tx = fx - i, tz = fz - j, r = this.rel, g = this.gw;
    const a = r[j * g + i], b = r[j * g + i + 1], c = r[(j + 1) * g + i], d = r[(j + 1) * g + i + 1];
    return (a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz) * this.exag;
  }

  /** true elevation in metres for a world-space y */
  elevationFromY(y) { return this.minE + y / this.exag; }

  /** ray-march the heightfield; returns THREE.Vector3 or null */
  pick(origin, dir, maxDist) {
    const step = Math.min(this.cellX, this.cellZ) * 0.5;
    const p = new THREE.Vector3();
    let prevT = 0;
    for (let t = 0; t <= maxDist; t += step) {
      p.copy(dir).multiplyScalar(t).add(origin);
      const h = this.heightAt(p.x, p.z);
      if (h !== null && p.y <= h) {
        let lo = prevT, hi = t;
        for (let it = 0; it < 24; it++) {
          const mid = (lo + hi) / 2;
          p.copy(dir).multiplyScalar(mid).add(origin);
          const hm = this.heightAt(p.x, p.z);
          if (hm !== null && p.y <= hm) hi = mid; else lo = mid;
        }
        p.copy(dir).multiplyScalar(hi).add(origin);
        const hh = this.heightAt(p.x, p.z);
        if (hh !== null) p.y = hh;
        return p.clone();
      }
      prevT = t;
    }
    return null;
  }
}
