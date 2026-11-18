// City layout: 5x5 blocks, 56 m blocks, 18 m roads, 388 m across.
// Road centrelines sit at -185, -111, -37, 37, 111, 185 on both axes;
// block centres at -148, -74, 0, 74, 148. The marina water lies south of z = -194.
import { CITY } from './config.js';
import { pick, rr } from './rng.js';
import { PALETTE } from './config.js';

// Every named place in the game. Missions reference these names only — never
// raw coordinates, so a typo fails loudly instead of stalling a mission.
// Taxi stands and race gates reuse the same table.
export const LOCATIONS = {
  marina: { x: -6, z: -170, r: 7, label: 'Marina Bentara' },
  shophouseRow: { x: -70, z: -140, r: 8, label: 'Deret Ruko' },
  northRowStall: { x: 42, z: 96, r: 9, label: 'Kios Baris Utara' },
  arterialJunction: { x: 0, z: 140, r: 10, label: 'Simpang Arteri' },
  industrialYard: { x: 120, z: 74, r: 10, label: 'Kawasan Industri' },
  eastSafehouse: { x: 150, z: -60, r: 9, label: 'Safehouse Timur' },
  towerConcourse: { x: 0, z: 0, r: 11, label: 'Plaza Menara' },
  hospital: { x: -37, z: -111, r: 6, label: 'Rumah Sakit' },
};

// Where taxi passengers wait: the busy places, so a fare is never a long
// dead drive to the middle of nowhere.
export const TAXI_STANDS = ['towerConcourse', 'marina', 'northRowStall', 'hospital', 'arterialJunction', 'industrialYard'];

// Throws on an unknown name: a silent NaN is what once hid a dead mission.
export function loc(name) {
  const found = LOCATIONS[name];
  if (!found) throw new Error(`unknown location: ${name}`);
  return found;
}

export function roadLines() {
  const lines = [];
  for (let i = 0; i <= CITY.blocks; i += 1) {
    lines.push(-CITY.half + CITY.road / 2 + i * CITY.pitch);
  }
  return lines;
}

export function blockCentres() {
  const centres = [];
  for (let i = 0; i < CITY.blocks; i += 1) {
    centres.push(-CITY.half + CITY.road + CITY.block / 2 + i * CITY.pitch);
  }
  return centres;
}

// A random point on a road (for traffic, peds and collectibles), and a
// random sidewalk point beside one (for peds and collectibles).
export function randomRoadPoint(rng) {
  const lines = roadLines();
  const line = pick(rng, lines);
  const along = rr(rng, -180, 180);
  return rng() < 0.5 ? { x: line, z: along } : { x: along, z: line };
}

export function randomSidewalkPoint(rng) {
  const lines = roadLines();
  const line = pick(rng, lines);
  const along = rr(rng, -180, 180);
  const side = rng() < 0.5 ? -11.5 : 11.5;
  return rng() < 0.5 ? { x: line + side, z: along } : { x: along, z: line + side };
}

function subdivideBlock(rng, bx, bz) {
  // Subdivide a block into a 2x2 yard of buildings with a courtyard gap.
  // Never build over a named location: a mission point inside a wall can
  // never be reached, and the player would stall there forever.
  const buildings = [];
  const n = rng() < 0.5 ? 4 : 2;
  const spots = n === 4
    ? [[-14, -14], [14, -14], [-14, 14], [14, 14]]
    : [[0, -14], [0, 14]];
  for (const [ox, oz] of spots) {
    const w = rr(rng, 16, 24);
    const d = rr(rng, 16, 24);
    const h = rr(rng, 8, 34);
    const cx = bx + ox;
    const cz = bz + oz;
    let coversLocation = false;
    for (const L of Object.values(LOCATIONS)) {
      if (Math.abs(L.x - cx) < w / 2 + 4 && Math.abs(L.z - cz) < d / 2 + 4) { coversLocation = true; break; }
    }
    if (coversLocation) continue;
    buildings.push({
      x: cx, z: cz, w, d, h,
      color: pick(rng, PALETTE.building),
      trim: pick(rng, PALETTE.buildingTrim),
      tall: h > 24,
    });
  }
  return buildings;
}

// Build the city from a seeded rng: blocks, buildings inside them, and the
// solid AABBs bullets and bodies collide with.
export function buildCity(rng) {
  const centres = blockCentres();
  const blocks = [];
  const solids = [];
  const buildings = [];
  for (const bx of centres) {
    for (const bz of centres) {
      const block = { x: bx, z: bz, buildings: [] };
      // The plaza block (0,0) stays open: the tower stands alone there.
      if (bx === 0 && bz === 0) { blocks.push(block); continue; }
      const made = subdivideBlock(rng, bx, bz);
      for (const b of made) {
        block.buildings.push(b);
        buildings.push(b);
        solids.push({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, h: b.h });
      }
      blocks.push(block);
    }
  }
  // The marina pier and the tower are landmarks, not just boxes. The tower is
  // 18 m wide so the plaza point (r 11) stays reachable from its edge.
  const tower = { x: 0, z: 0, w: 18, d: 18, h: 52, color: 0xcfc0a0, trim: 0x5f6b62, tall: true, landmark: true };
  buildings.push(tower);
  solids.push({ minX: -9, maxX: 9, minZ: -9, maxZ: 9, h: 52 });
  return { blocks, buildings, solids, tower, rng };
}

// Is a ground point inside any solid (walls stop feet, wheels and bullets)?
export function hitsSolid(city, x, z, pad = 0) {
  for (const s of city.solids) {
    if (x > s.minX - pad && x < s.maxX + pad && z > s.minZ - pad && z < s.maxZ + pad) return s;
  }
  return null;
}

// Clamp a point to the drivable/walkable city bounds.
export function clampToCity(x, z) {
  const m = CITY.half - 2;
  return { x: Math.max(-m, Math.min(m, x)), z: Math.max(-m, Math.min(m, z)) };
}
