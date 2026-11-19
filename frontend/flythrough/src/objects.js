import * as THREE from 'three';

/**
 * Builds scene objects from objects_scene.json (README 5.3).
 * Local frame: origin = SW corner, x east (m), z north (m), y relative to min elevation.
 * Everything is built in metres and the group is scaled vertically by the terrain exaggeration.
 */
export function buildObjects(scene, terrain) {
  const group = new THREE.Group();
  if (!scene || !Array.isArray(scene.objects)) return group;
  const { W, D } = terrain;
  const toWorld = (x, zNorth) => [x - W / 2, D / 2 - zNorth];

  const wall = new THREE.MeshLambertMaterial({ color: 0xe0d9c8 });
  const trunk = new THREE.MeshLambertMaterial({ color: 0x5b4332 });
  const leaf = new THREE.MeshLambertMaterial({ color: 0x2f6b34 });
  const road = new THREE.MeshLambertMaterial({ color: 0x3a3a3e, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  let count = 0;

  for (const o of scene.objects) {
    try {
      if (o.class === 'building' && Array.isArray(o.footprint_xz) && o.footprint_xz.length >= 3) {
        const shape = new THREE.Shape();
        o.footprint_xz.forEach(([x, zn], i) => {
          const [wx, wz] = toWorld(x, zn);
          if (i === 0) shape.moveTo(wx, -wz); else shape.lineTo(wx, -wz);   // rotation below maps shape-y -> -z
        });
        const geo = new THREE.ExtrudeGeometry(shape, { depth: o.height_m ?? 10, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(geo, wall);
        m.position.y = o.base_y ?? 0;
        group.add(m); count++;
      } else if (o.class === 'tree' && Array.isArray(o.position_xz)) {
        const [wx, wz] = toWorld(o.position_xz[0], o.position_xz[1]);
        const h = o.height_m ?? 8, cr = o.crown_radius_m ?? 2.5;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(cr * 0.12, cr * 0.18, h * 0.35, 6), trunk);
        t.position.set(wx, (o.base_y ?? 0) + h * 0.175, wz);
        const c = new THREE.Mesh(new THREE.ConeGeometry(cr, h * 0.8, 8), leaf);
        c.position.set(wx, (o.base_y ?? 0) + h * 0.6, wz);
        group.add(t, c); count++;
      } else if (o.class === 'road' && Array.isArray(o.path_xz) && o.path_xz.length >= 2) {
        const pts = o.path_xz.map(([x, zn]) => toWorld(x, zn));
        const half = (o.width_m ?? 6) / 2;
        const pos = [], idx = [];
        pts.forEach(([x, z], i) => {
          const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
          let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
          for (const s of [-1, 1]) {
            const px = x + -tz * half * s, pz = z + tx * half * s;
            const h = terrain.heightAt(px, pz);
            pos.push(px, (h ?? 0) / terrain.exag + 0.4, pz);           // metres; group scale restores exaggeration
          }
          if (i > 0) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx); g.computeVertexNormals();
        group.add(new THREE.Mesh(g, road)); count++;
      }
    } catch { /* unknown / malformed objects are ignored, per the contract */ }
  }
  group.userData.count = count;
  group.scale.y = terrain.exag;
  return group;
}
