// Pedestrians: 32 people walking the sidewalks between random corners,
// crossing at the zebras, waiting at the kerb. A gunshot nearby makes them
// flee — they run away from the sound for a few seconds, then go back to
// strolling. A few stand at the taxi stands with a raised hand.
import { Human } from './human.js';
import { PED_COUNT } from '../config.js';
import { pick, rr } from '../rng.js';
import { roadLines } from '../city.js';
import { dist } from '../mathx.js';

export function createPeds(scene, city, rng) {
  const lines = roadLines();
  const peds = [];

  function randomCorner() {
    const line = pick(rng, lines);
    const along = rr(rng, -180, 180);
    const side = rng() < 0.5 ? -11 : 11;
    return rng() < 0.5 ? { x: line + side, z: along } : { x: along, z: line + side };
  }

  // A crossing target: the same road, the opposite sidewalk — so the ped
  // walks across a zebra instead of teleporting to a new corner.
  function crossTarget(from) {
    const line = lines.reduce((best, L) => (Math.abs(L - from.x) < Math.abs(best - from.x) ? L : best), lines[0]);
    const lineZ = lines.reduce((best, L) => (Math.abs(L - from.z) < Math.abs(best - from.z) ? L : best), lines[0]);
    if (Math.abs(from.x - line) < Math.abs(from.z - lineZ)) {
      return { x: line + (from.x > line ? -11 : 11), z: from.z + rr(rng, -30, 30) };
    }
    return { x: from.x + rr(rng, -30, 30), z: lineZ + (from.z > lineZ ? -11 : 11) };
  }

  for (let i = 0; i < PED_COUNT; i += 1) {
    const h = new Human(scene, rng, 'ped');
    const c = randomCorner();
    h.setPos(c.x, c.z);
    h.target = randomCorner();
    h.fleeTimer = 0;
    h.crossing = rng() < 0.35;
    peds.push(h);
  }

  // Market lingerers: four shoppers who drift slowly between the pasar
  // stalls (east sidewalk x 50–55, west x 22–27, z 90–110) instead of
  // wandering the whole city — the market block reads lived-in even
  // when the camera is far away. They still flee from gunshots.
  const marketSpots = [
    { x: 50, z: 93 }, { x: 53, z: 100 }, { x: 51, z: 107 },
    { x: 25, z: 95 }, { x: 24, z: 103 },
  ];
  for (let k = 0; k < 4; k += 1) {
    const h = new Human(scene, rng, 'ped');
    const s = marketSpots[k];
    h.setPos(s.x + rr(rng, -1.5, 1.5), s.z + rr(rng, -1.5, 1.5));
    h.target = marketSpots[(k + 1) % marketSpots.length];
    h.fleeTimer = 0;
    h.crossing = false;
    h.market = true;
    peds.push(h);
  }

  function fleeFrom(x, z, radius = 34) {
    for (const p of peds) {
      if (!p.alive) continue;
      if (dist(p.x, p.z, x, z) < radius) {
        p.fleeTimer = 3;
        p.fleeFrom = { x, z };
      }
    }
  }

  function step(dt) {
    for (const p of peds) {
      if (!p.alive) continue;
      if (p.fleeTimer > 0) {
        p.fleeTimer -= dt;
        const away = Math.atan2(p.x - p.fleeFrom.x, p.z - p.fleeFrom.z);
        p.face(away);
        p.walk(dt, 5.5);
        continue;
      }
      const dx = p.target.x - p.x;
      const dz = p.target.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 2) {
        if (p.market) {
          // Linger at the stall a beat, then drift to the next one.
          p.target = marketSpots[Math.floor(rng() * marketSpots.length)];
          p.walkPause = (p.walkPause || 0) + rr(rng, 1.5, 3.5);
          continue;
        }
        // One in three arrivals crosses the road; the rest pick a new corner.
        p.target = p.crossing ? crossTarget(p) : randomCorner();
        p.crossing = rng() < 0.35;
        continue;
      }
      if (p.walkPause > 0) {
        p.walkPause -= dt;
        continue;
      }
      p.face(Math.atan2(dx, dz));
      p.walk(dt, p.market ? 0.9 : 1.6);
    }
  }

  return { peds, step, fleeFrom };
}
