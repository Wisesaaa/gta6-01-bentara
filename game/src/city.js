// City layout: 5x5 blocks, 56 m blocks, 18 m roads, 388 m across.
// Road centrelines sit at -185, -111, -37, 37, 111, 185 on both axes;
// block centres at -148, -74, 0, 74, 148. The marina water lies south of z = -194.
import { CITY } from './config.js';
import { pick, rr } from './rng.js';
import { PALETTE } from './config.js';

// Every named place in the game. Missions reference these names only — never
// raw coordinates, so a typo fails loudly instead of stalling a mission.
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
      // Subdivide each block into a 2x2 yard of buildings with a courtyard gap.
      // Never build over a named location: a mission point inside a wall can
      // never be reached, and the player would stall there forever.
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
        const tall = h > 24;
        const building = {
          x: cx, z: cz, w, d, h,
          color: pick(rng, PALETTE.building),
          trim: pick(rng, PALETTE.buildingTrim),
          tall,
        };
        block.buildings.push(building);
        buildings.push(building);
        solids.push({ minX: building.x - w / 2, maxX: building.x + w / 2, minZ: building.z - d / 2, maxZ: building.z + d / 2, h });
      }
      blocks.push(block);
    }
  }
  // The marina pier and the tower are landmarks, not just boxes. The tower is
  // 18 m wide so the plaza point (r 11) stays reachable from its edge.
  const tower = { x: 0, z: 0, w: 18, d: 18, h: 52, color: 0xcfc0a0, trim: 0x5f6b62, tall: true, landmark: true };
  buildings.push(tower);
  solids.push({ minX: -9, maxX: 9, minZ: -9, maxZ: 9, h: 52 });
  return { blocks, buildings, solids, tower };
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
