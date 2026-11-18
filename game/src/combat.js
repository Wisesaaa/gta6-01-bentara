// Shooting: one ray, tested in order against building AABBs (City.solids),
// humans (upright cylinders) and cars (ground circles). Bullets never pass
// through a tower — the nearest solid blocks the shot first.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { rr } from './rng.js';

// Slab test of a ray against an axis-aligned box on the ground plane.
function rayAabb(ox, oy, oz, dx, dy, dz, minX, maxX, minZ, maxZ, h) {
  let tmin = 0;
  let tmax = Infinity;
  const axes = [
    [ox, dx, minX, maxX],
    [oy, dy, 0, h],
    [oz, dz, minZ, maxZ],
  ];
  for (const [o, d, mn, mx] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < mn || o > mx) return Infinity;
    } else {
      let t1 = (mn - o) / d;
      let t2 = (mx - o) / d;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

export function createCombat(scene, city, rng) {
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });

  function tracer(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), tracerMat.clone());
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.lookAt(to);
    scene.add(mesh);
    tracers.push({ mesh, life: 0.09 });
  }

  function step(dt) {
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      const t = tracers[i];
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      if (t.life <= 0) {
        scene.remove(t.mesh);
        tracers.splice(i, 1);
      }
    }
  }

  // Fire `weapon` from `origin` along `dir`. `targets` = { humans: [], cars: [] }.
  // Returns { hit: 'solid'|'human'|'car'|null, at: Vector3, human?, car?, dist }.
  function shoot(origin, dir, weaponName, targets) {
    const w = WEAPONS[weaponName] || WEAPONS.pistol;
    const pellets = w.pellets || 1;
    let best = null;
    for (let p = 0; p < pellets; p += 1) {
      const spread = w.spread;
      const d = new THREE.Vector3(
        dir.x + rr(rng, -spread, spread),
        dir.y + rr(rng, -spread, spread),
        dir.z + rr(rng, -spread, spread),
      ).normalize();
      let bestT = w.range;
      let hit = null;
      const end = new THREE.Vector3().copy(origin).addScaledVector(d, w.range);
      // Buildings first: the nearest solid caps the ray.
      for (const s of city.solids) {
        const t = rayAabb(origin.x, origin.y, origin.z, d.x, d.y, d.z, s.minX, s.maxX, s.minZ, s.maxZ, s.h);
        if (t < bestT) { bestT = t; hit = { hit: 'solid', dist: t }; }
      }
      // Humans: closest approach of the ray to their upright axis.
      for (const h of targets.humans || []) {
        if (!h.alive) continue;
        const ox = h.x - origin.x;
        const oz = h.z - origin.z;
        const along = ox * d.x + oz * d.z;
        if (along < 0 || along > bestT) continue;
        const cx = origin.x + d.x * along;
        const cz = origin.z + d.z * along;
        const cy = origin.y + d.y * along;
        const dd = Math.hypot(cx - h.x, cz - h.z);
        if (dd < 0.55 && cy > 0 && cy < 1.9) { bestT = along; hit = { hit: 'human', human: h, dist: along }; }
      }
      // Cars: ground circle + roof height.
      for (const c of targets.cars || []) {
        if (c.health <= 0) continue;
        const ox = c.x - origin.x;
        const oz = c.z - origin.z;
        const along = ox * d.x + oz * d.z;
        if (along < 0 || along > bestT) continue;
        const cx = origin.x + d.x * along;
        const cz = origin.z + d.z * along;
        const cy = origin.y + d.y * along;
        if (Math.hypot(cx - c.x, cz - c.z) < 2.3 && cy > 0 && cy < 1.6) {
          bestT = along; hit = { hit: 'car', car: c, dist: along };
        }
      }
      const hitAt = new THREE.Vector3().copy(origin).addScaledVector(d, bestT);
      tracer(origin, hitAt);
      if (hit && (!best || hit.dist < best.dist)) best = { ...hit, at: hitAt };
    }
    return best;
  }

  return { shoot, step };
}
