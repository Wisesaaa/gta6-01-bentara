// Collectibles: golden wayang idols and radio tapes scattered on the
// sidewalks. Walk or drive over one to collect it — cash plus REP, with a
// HUD counter. The cheapest real depth in the game: a reason to explore
// every street, visible in the source outline and in the screenshots.
import * as THREE from 'three';
import { COLLECTIBLES } from './config.js';
import { pick, rr } from './rng.js';
import { roadLines, LOCATIONS } from './city.js';
import { dist } from './mathx.js';

const IDOL_COLOR = 0xffd75e;
const TAPE_COLOR = 0x1f6b74;

export function createCollectibles(scene, city, rng, hooks) {
  const items = [];
  const group = new THREE.Group();
  scene.add(group);
  const lines = roadLines();

  function sidewalkSpot() {
    // Near a named place half the time (so the collectibles read as a
    // tour of the city), on a random sidewalk corner the other half.
    if (rng() < 0.5) {
      const names = Object.keys(LOCATIONS);
      const L = LOCATIONS[pick(rng, names)];
      return { x: L.x + rr(rng, -14, 14), z: L.z + rr(rng, -14, 14) };
    }
    const line = pick(rng, lines);
    const along = rr(rng, -180, 180);
    const side = rng() < 0.5 ? -11.5 : 11.5;
    return rng() < 0.5 ? { x: line + side, z: along } : { x: along, z: line + side };
  }

  function buildItem(kind, x, z) {
    const g = new THREE.Group();
    if (kind === 'idol') {
      const gold = new THREE.MeshLambertMaterial({ color: IDOL_COLOR, emissive: 0x6a5a00 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.3), gold);
      body.position.y = 0.85;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.3), gold);
      head.position.y = 1.5;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 4), gold);
      crown.position.y = 1.9;
      crown.rotation.y = Math.PI / 4;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.6), new THREE.MeshLambertMaterial({ color: 0x6b4a2f }));
      base.position.y = 0.09;
      g.add(body, head, crown, base);
    } else {
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.12), new THREE.MeshLambertMaterial({ color: TAPE_COLOR }));
      shell.position.y = 0.8;
      const label = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.02), new THREE.MeshBasicMaterial({ color: 0xffd75e }));
      label.position.set(0, 0.8, 0.07);
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), new THREE.MeshBasicMaterial({ color: 0xe8e4da }));
      reel.rotation.x = Math.PI / 2;
      reel.position.set(-0.14, 0.8, 0.07);
      const reel2 = reel.clone();
      reel2.position.x = 0.14;
      g.add(shell, label, reel, reel2);
    }
    // A soft gold ring on the ground marks the pickup radius.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 24),
      new THREE.MeshBasicMaterial({ color: IDOL_COLOR, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    g.add(ring);
    g.position.set(x, 0, z);
    group.add(g);
    return { kind, x, z, mesh: g, taken: false, bob: rr(rng, 0, Math.PI * 2) };
  }

  for (let i = 0; i < COLLECTIBLES.count; i += 1) {
    const kind = rng() < 0.4 ? 'idol' : 'tape';
    const s = sidewalkSpot();
    items.push(buildItem(kind, s.x, s.z));
  }

  let collected = 0;
  let earned = 0;

  function update(dt, t, px, pz) {
    for (const item of items) {
      if (item.taken) continue;
      // Gentle bob + spin so the eye catches them from the chase camera.
      item.mesh.rotation.y += dt * 1.2;
      item.mesh.position.y = Math.sin(t * 2 + item.bob) * 0.12;
      if (dist(px, pz, item.x, item.z) < COLLECTIBLES.pickupRadius) {
        item.taken = true;
        item.mesh.visible = false;
        collected += 1;
        const value = item.kind === 'idol' ? COLLECTIBLES.idolValue : COLLECTIBLES.tapeValue;
        earned += value;
        if (hooks.onCollect) hooks.onCollect(item, value);
      }
    }
  }

  function nearest(px, pz) {
    let best = null;
    let bestD = Infinity;
    for (const item of items) {
      if (item.taken) continue;
      const d = dist(px, pz, item.x, item.z);
      if (d < bestD) { bestD = d; best = item; }
    }
    return best;
  }

  function remaining() {
    return items.filter((i) => !i.taken);
  }

  return {
    items, update, nearest, remaining,
    get collected() { return collected; },
    get total() { return items.length; },
    get earned() { return earned; },
  };
}
