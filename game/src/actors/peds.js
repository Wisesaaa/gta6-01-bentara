// Pedestrians: 20 people walking the sidewalks between random corners. A
// gunshot nearby makes them flee — they run away from the sound for a few
// seconds, then go back to strolling.
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

  for (let i = 0; i < PED_COUNT; i += 1) {
    const h = new Human(scene, rng, 'ped');
    const c = randomCorner();
    h.setPos(c.x, c.z);
    h.target = randomCorner();
    h.fleeTimer = 0;
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
        p.target = randomCorner();
        continue;
      }
      p.face(Math.atan2(dx, dz));
      p.walk(dt, 1.6);
    }
  }

  return { peds, step, fleeFrom };
}
