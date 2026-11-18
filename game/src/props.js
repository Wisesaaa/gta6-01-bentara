// Breakable street props: crates, market stalls, hydrants, signs. Smashing one
// hides its mesh, throws debris, adds a bill line and a little heat.
import * as THREE from 'three';
import { rr, pick } from './rng.js';

const KINDS = {
  crate: { label: 'Peti kayu', price: 15, w: 1.2, h: 1.2, d: 1.2, color: 0x8a6a3f },
  stall: { label: 'Kios pasar', price: 40, w: 2.6, h: 2.4, d: 2.0, color: 0xb85c38 },
  hydrant: { label: 'Hidran', price: 25, w: 0.6, h: 0.9, d: 0.6, color: 0xc23b2e },
  sign: { label: 'Papan nama', price: 60, w: 2.2, h: 1.4, d: 0.25, color: 0x3f5a78 },
};

export function createProps(scene, city, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const props = [];
  const debris = [];

  // Scatter props along road edges, clear of the driving lanes.
  const spots = [];
  for (let i = 0; i < 46; i += 1) {
    const road = pick(rng, [-185, -111, -37, 37, 111, 185]);
    const along = rr(rng, -180, 180);
    const side = rng() < 0.5 ? -7.5 : 7.5;
    if (rng() < 0.5) spots.push({ x: road + side, z: along });
    else spots.push({ x: along, z: road + side });
  }
  const kindNames = Object.keys(KINDS);
  for (const s of spots) {
    if (window.__bentaraNoProps) break;
    const kind = pick(rng, kindNames);
    const def = KINDS[kind];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(def.w, def.h, def.d),
      new THREE.MeshLambertMaterial({ color: def.color }),
    );
    mesh.position.set(s.x, def.h / 2, s.z);
    mesh.rotation.y = rr(rng, 0, Math.PI);
    mesh.castShadow = true;
    group.add(mesh);
    props.push({ kind, label: def.label, price: def.price, x: s.x, z: s.z, mesh, broken: false });
  }

  function breakProp(prop, bill, onHeat) {
    if (prop.broken) return false;
    prop.broken = true;
    prop.mesh.visible = false;
    // Debris: a few small tumbling boxes that fade out over a second.
    for (let i = 0; i < 4; i += 1) {
      const bit = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x8a6a3f }),
      );
      bit.position.set(prop.x + rr(rng, -0.5, 0.5), 0.6, prop.z + rr(rng, -0.5, 0.5));
      group.add(bit);
      debris.push({ mesh: bit, vx: rr(rng, -2, 2), vz: rr(rng, -2, 2), life: 1 });
    }
    if (bill) bill.add(prop.label, prop.price);
    if (onHeat) onHeat(0.2);
    return true;
  }

  function step(dt) {
    for (let i = debris.length - 1; i >= 0; i -= 1) {
      const d = debris[i];
      d.life -= dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.position.y = Math.max(0.15, d.mesh.position.y - 2 * dt);
      d.mesh.rotation.x += dt * 4;
      if (d.life <= 0) {
        group.remove(d.mesh);
        debris.splice(i, 1);
      }
    }
  }

  function nearestUnbroken(x, z, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const p of props) {
      if (p.broken) continue;
      const dx = p.x - x;
      const dz = p.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  return { props, breakProp, step, nearestUnbroken };
}
