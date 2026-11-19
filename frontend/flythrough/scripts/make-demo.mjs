// Generates a synthetic terrain in the DepthWizard output contract
// (heightmap16.png, texture.png, metadata.json, objects_scene.json)
// so the viewer runs without the ML/DEM pipeline.
//   node scripts/make-demo.mjs [--if-missing]
import { encode } from 'fast-png';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'public', 'demo');
if (process.argv.includes('--if-missing') && fs.existsSync(path.join(outDir, 'metadata.json'))) {
  process.exit(0);
}
fs.mkdirSync(outDir, { recursive: true });

// ---- seeded value noise -------------------------------------------------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261119);
const G = 256;
const lattice = Float32Array.from({ length: G * G }, () => rnd());
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const h = (i, j) => lattice[((j & (G - 1)) * G) + (i & (G - 1))];
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
function fbm(x, y, oct = 6) {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { v += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5; }
  return v;
}

// ---- heightfield --------------------------------------------------------
const N = 513;                 // heightmap size
const WORLD_M = 20000;         // 20 km square
const MIN_E = 120, MAX_E = 980; // metres
const h = new Float32Array(N * N);
let lo = Infinity, hi = -Infinity;
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), v = j / (N - 1);
    const base = fbm(u * 3.2 + 4.1, v * 3.2 + 9.7);
    const ridge = 1 - Math.abs(2 * fbm(u * 6 + 30, v * 6 + 11, 5) - 1);
    const valley = Math.exp(-Math.pow((v - 0.5 - 0.18 * Math.sin(u * 6.5)) * 5.5, 2));
    let e = base * 0.7 + ridge * ridge * 0.45 - valley * 0.35;
    h[j * N + i] = e;
    lo = Math.min(lo, e); hi = Math.max(hi, e);
  }
}
const elev = new Float32Array(N * N);
for (let k = 0; k < h.length; k++) elev[k] = MIN_E + ((h[k] - lo) / (hi - lo)) * (MAX_E - MIN_E);

const hm16 = new Uint16Array(N * N);
for (let k = 0; k < elev.length; k++) {
  hm16[k] = Math.round(((elev[k] - MIN_E) / (MAX_E - MIN_E)) * 65535);
}
fs.writeFileSync(path.join(outDir, 'heightmap16.png'),
  encode({ width: N, height: N, data: hm16, depth: 16, channels: 1 }));

// ---- texture (hypsometric tint + hillshade, 1024 px) ---------------------
const T = 1024;
const tex = new Uint8Array(T * T * 3);
const sample = (u, v) => {
  const x = Math.min(N - 1.001, Math.max(0, u * (N - 1)));
  const y = Math.min(N - 1.001, Math.max(0, v * (N - 1)));
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = elev[yi * N + xi], b = elev[yi * N + xi + 1];
  const c = elev[(yi + 1) * N + xi], d = elev[(yi + 1) * N + xi + 1];
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
};
const ramp = [
  [0.00, [58, 98, 52]], [0.25, [96, 132, 64]], [0.45, [158, 150, 92]],
  [0.65, [128, 104, 78]], [0.85, [168, 160, 152]], [1.00, [244, 244, 246]],
];
function color(t) {
  for (let k = 1; k < ramp.length; k++) {
    if (t <= ramp[k][0]) {
      const [t0, c0] = ramp[k - 1], [t1, c1] = ramp[k];
      const f = (t - t0) / (t1 - t0);
      return c0.map((c, q) => c + (c1[q] - c) * f);
    }
  }
  return ramp[ramp.length - 1][1];
}
const cell = WORLD_M / (N - 1);
for (let j = 0; j < T; j++) {
  for (let i = 0; i < T; i++) {
    const u = i / (T - 1), v = j / (T - 1);
    const e = sample(u, v);
    const d = 1 / (N - 1);
    const dx = (sample(u + d, v) - sample(u - d, v)) / (2 * cell);
    const dy = (sample(u, v + d) - sample(u, v - d)) / (2 * cell); // +v = south
    // light from north-west
    const nx = -dx, ny = -dy, nz = 1, len = Math.hypot(nx, ny, nz);
    const lx = -0.5, ly = -0.6, lz = 0.62, ll = Math.hypot(lx, ly, lz);
    const shade = Math.max(0, (nx * lx + ny * ly + nz * lz) / (len * ll));
    const c = color((e - MIN_E) / (MAX_E - MIN_E));
    const grain = 0.94 + 0.12 * vnoise(u * 400, v * 400);
    const s = (0.45 + 0.75 * shade) * grain;
    const o = (j * T + i) * 3;
    tex[o] = Math.min(255, c[0] * s);
    tex[o + 1] = Math.min(255, c[1] * s);
    tex[o + 2] = Math.min(255, c[2] * s);
  }
}
fs.writeFileSync(path.join(outDir, 'texture.png'),
  encode({ width: T, height: T, data: tex, depth: 8, channels: 3 }));

// ---- metadata (README section 5.3) ---------------------------------------
const meta = {
  job_id: 'demo',
  input_georeferenced: true,
  crs: 'EPSG:32643',
  extent: { min_x: 0, min_y: 0, max_x: WORLD_M, max_y: WORLD_M },
  width: N,
  height: N,
  pixel_size_m: WORLD_M / (N - 1),
  terrain: {
    source: 'synthetic demo',
    resolution_m: WORLD_M / (N - 1),
    vertical_reference: 'n/a (synthetic)',
    min_elevation_m: MIN_E,
    max_elevation_m: MAX_E,
  },
  objects: { source: 'dummy', model: null, count: 0, classes: ['building', 'tree'], height_meaning: 'height above local ground, metres' },
  derived: { top_elevation: 'terrain ground elevation + height_above_ground_m' },
  evaluation: { terrain: null, object_height: null },
};

// ---- objects_scene.json (README section 5.3) -----------------------------
// local frame: x east (m), z north (m) from SW corner, y relative to min elevation
const groundAt = (xe, zn) => sample(xe / WORLD_M, 1 - zn / WORLD_M) - MIN_E;
const objects = [];
const r2 = mulberry32(7);
let tries = 0;
while (objects.length < 70 && tries++ < 4000) {
  const x = 1500 + r2() * (WORLD_M - 3000), z = 1500 + r2() * (WORLD_M - 3000);
  const g = groundAt(x, z);
  const gx = groundAt(x + 60, z) - groundAt(x - 60, z);
  const gz = groundAt(x, z + 60) - groundAt(x, z - 60);
  if (Math.hypot(gx, gz) / 120 > 0.12 || g > 320) continue; // flat, low ground only
  if (objects.length < 24) {
    const w = 25 + r2() * 45, d = 25 + r2() * 45;
    objects.push({
      id: `b_${String(objects.length + 1).padStart(4, '0')}`, class: 'building',
      footprint_xz: [[x, z], [x + w, z], [x + w, z + d], [x, z + d]],
      base_y: g, height_m: 8 + r2() * 40,
    });
  } else {
    objects.push({
      id: `t_${String(objects.length + 1).padStart(4, '0')}`, class: 'tree',
      position_xz: [x, z], base_y: g, height_m: 8 + r2() * 12, crown_radius_m: 3 + r2() * 4,
    });
  }
}
objects.push({
  id: 'r_0001', class: 'road', width_m: 8,
  path_xz: Array.from({ length: 40 }, (_, k) => {
    const u = k / 39;
    return [2000 + u * 16000, 9000 + 2500 * Math.sin(u * 5)];
  }),
});
meta.objects.count = objects.length;
fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(meta, null, 2));
fs.writeFileSync(path.join(outDir, 'objects_scene.json'),
  JSON.stringify({ origin_crs: 'EPSG:32643', objects }, null, 2));
console.log(`demo written to ${outDir} (${objects.length} objects)`);
