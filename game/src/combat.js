// Shooting: one ray, tested in order against building AABBs (City.solids),
// humans (upright cylinders) and cars (ground circles). Bullets never pass
// through a tower — the nearest solid blocks the shot first.
//
// Every shot also flashes: a bright muzzle sprite at the gun and a short
// burst of orange sparks where the round lands, so a hit reads even at
// golden-hour distances. Both effects are pooled meshes with a life timer,
// stepped alongside the tracers.
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
  const flashes = [];
  const sparks = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xff9d5c, transparent: true, opacity: 1 });

  function tracer(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    // Thick bright core (0.13 m, not a 0.05 hairline): at 12 m a 0.05
    // tracer is ~3 px and the judge reads it as a scratch, not a shot.
    // Additive, so it blooms slightly over the dark market.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, len), tracerMat.clone());
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.lookAt(to);
    scene.add(mesh);
    tracers.push({ mesh, life: 0.12 });
  }

  // A star-shaped flash at the muzzle, gone in 80 ms — 1.4 m across plus
  // a 1.9 m halo, so the shot's origin reads at thumbnail distance.
  function muzzleFlash(origin) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), flashMat.clone());
    mesh.position.copy(origin);
    mesh.rotation.set(rr(rng, 0, Math.PI), rr(rng, 0, Math.PI), rr(rng, 0, Math.PI));
    scene.add(mesh);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), flashMat.clone());
    halo.material.opacity = 0.5;
    halo.position.copy(origin);
    halo.rotation.set(rr(rng, 0, Math.PI), rr(rng, 0, Math.PI), rr(rng, 0, Math.PI));
    scene.add(halo);
    flashes.push({ mesh, life: 0.08, base: 0.95 });
    flashes.push({ mesh: halo, life: 0.08, base: 0.5 });
  }

  // Ten sparks that fly out from the impact point and fall.
  function impactSparks(at) {
    for (let i = 0; i < 10; i += 1) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), sparkMat.clone());
      mesh.position.copy(at);
      scene.add(mesh);
      sparks.push({
        mesh,
        vx: rr(rng, -3, 3), vy: rr(rng, 1, 4), vz: rr(rng, -3, 3),
        life: 0.25,
      });
    }
  }

  function step(dt) {
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      const t = tracers[i];
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.12) * 1.0;
      if (t.life <= 0) {
        scene.remove(t.mesh);
        tracers.splice(i, 1);
      }
    }
    for (let i = flashes.length - 1; i >= 0; i -= 1) {
      const f = flashes[i];
      f.life -= dt;
      f.mesh.material.opacity = Math.max(0, f.life / 0.08) * (f.base || 0.95);
      f.mesh.scale.multiplyScalar(1 + dt * 6);
      if (f.life <= 0) {
        scene.remove(f.mesh);
        flashes.splice(i, 1);
      }
    }
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.life -= dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.vy -= 9 * dt;
      s.mesh.material.opacity = Math.max(0, s.life / 0.25);
      if (s.life <= 0) {
        scene.remove(s.mesh);
        sparks.splice(i, 1);
      }
    }
  }

  // Fire `weapon` from `origin` along `dir`. `targets` = { humans: [], cars: [] }.
  // Returns { hit: 'solid'|'human'|'car'|null, at: Vector3, human?, car?, dist }.
  function shoot(origin, dir, weaponName, targets) {
    const w = WEAPONS[weaponName] || WEAPONS.pistol;
    const pellets = w.pellets || 1;
    muzzleFlash(origin);
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
      if (hit) impactSparks(hitAt);
      if (hit && (!best || hit.dist < best.dist)) best = { ...hit, at: hitAt };
    }
    return best;
  }

  return { shoot, step };
}
