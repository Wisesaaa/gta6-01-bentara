// Checkpoint race: five gates around the grid, start at Plaza Menara.
// Drive through each gold ring in order against the clock; beat par and
// the payout doubles. A second side activity on top of taxi fares, built
// on the same beacon-and-radius shape as the missions. The standings
// (top-3 lap times, best first) persist in the save, so a rival can chase
// them across sessions.
import * as THREE from 'three';
import { RACE } from './config.js';
import { rr } from './rng.js';
import { loc, roadLines } from './city.js';
import { dist } from './mathx.js';

export function createRace(scene, city, rng, hooks) {
  let gates = [];
  let active = false;
  let gateIndex = 0;
  let timer = 0;
  let best = null;
  let runs = 0;
  let records = [];

  const start = loc('towerConcourse');

  // Gold rings standing on the road, big enough to drive through.
  function ringMesh(x, z) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.5, 0.35, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd75e }),
    );
    ring.position.set(x, 4.5, z);
    ring.rotation.y = Math.PI / 2;
    scene.add(ring);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 4.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a3a38 }),
    );
    post.position.set(x - 4.5, 2.25, z);
    scene.add(post);
    const post2 = post.clone();
    post2.position.x = x + 4.5;
    scene.add(post2);
    return { ring, post, post2, x, z, passed: false };
  }

  function layGates() {
    const lines = roadLines();
    const picks = [];
    while (picks.length < RACE.gates) {
      const line = lines[Math.floor(rng() * lines.length)];
      const along = rr(rng, -150, 150);
      const spot = rng() < 0.5 ? { x: line, z: along } : { x: along, z: line };
      if (dist(spot.x, spot.z, start.x, start.z) < 40) continue;
      if (picks.some((p) => dist(p.x, p.z, spot.x, spot.z) < 60)) continue;
      picks.push(spot);
    }
    // Order the gates by distance from the start so the route flows.
    picks.sort((a, b) => dist(a.x, a.z, start.x, start.z) - dist(b.x, b.z, start.x, start.z));
    gates = picks.map((p) => ringMesh(p.x, p.z));
    gates.forEach((g) => { g.ring.visible = false; g.post.visible = false; g.post2.visible = false; });
  }

  layGates();

  function startRace() {
    if (active) return false;
    active = true;
    gateIndex = 0;
    timer = 0;
    gates.forEach((g, i) => {
      g.passed = false;
      const show = i === 0;
      g.ring.visible = show;
      g.post.visible = show;
      g.post2.visible = show;
    });
    if (hooks.onStart) hooks.onStart(gates[0]);
    return true;
  }

  function finishRace() {
    active = false;
    runs += 1;
    const beatPar = timer <= RACE.parSeconds;
    const paid = beatPar ? RACE.reward * 2 : RACE.reward;
    // Standings: top-3 lap times, best first, kept across sessions.
    records.push(timer);
    records.sort((a, b) => a - b);
    records = records.slice(0, 3);
    best = records[0];
    gates.forEach((g) => { g.ring.visible = false; g.post.visible = false; g.post2.visible = false; });
    if (hooks.onFinish) hooks.onFinish({ time: timer, paid, beatPar });
    return paid;
  }

  function update(dt, ctx) {
    if (!active) return;
    timer += dt;
    const g = gates[gateIndex];
    if (!g) { finishRace(); return; }
    if (dist(ctx.px, ctx.pz, g.x, g.z) < 5.5) {
      g.passed = true;
      g.ring.visible = false;
      g.post.visible = false;
      g.post2.visible = false;
      gateIndex += 1;
      if (hooks.onGate) hooks.onGate(gateIndex, gates.length, timer);
      if (gateIndex >= gates.length) { finishRace(); return; }
      const next = gates[gateIndex];
      next.ring.visible = true;
      next.post.visible = true;
      next.post2.visible = true;
    }
  }

  function nearStart(px, pz) {
    return !active && dist(px, pz, start.x, start.z) < 10;
  }

  return {
    update, startRace, nearStart,
    get active() { return active; },
    get gateIndex() { return gateIndex; },
    get gateCount() { return gates.length; },
    get nextGate() { return active ? gates[gateIndex] || null : null; },
    get timer() { return timer; },
    get best() { return best; },
    get runs() { return runs; },
    get records() { return records.slice(); },
    // Restore the standings from a save (validated: finite numbers, top 3).
    setRecords(arr) {
      if (!Array.isArray(arr)) return;
      records = arr.filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((a, b) => a - b).slice(0, 3);
      best = records.length ? records[0] : null;
    },
    get start() { return start; },
  };
}
