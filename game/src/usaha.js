// Usaha — 3 buyable properties. WARUNG SARI +$30/hari, KOSONG KAKI LIMA
// +$80/hari, SLIP MARINA +$180/hari. Income accrues into a pot every
// game-hour (a game day is 24 game-hours; the clock runs 1 game-minute
// per 2 real seconds) and is collected by TIDUR at the Safehouse Timur,
// which also advances the day. Owned = the shop sign swaps to a gold
// "MILIK KAMU" board, and a gold $ blip shows on the minimap.
import * as THREE from 'three';
import { USAHA } from './config.js';
import { loc } from './city.js';

const GAME_MINUTES_PER_SECOND = 0.5;
const GAME_HOURS_PER_POT_TICK = 1;

function signTexture(name, owned) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = owned ? '#8a6a1f' : '#1d2a3a';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = owned ? '#ffd75e' : '#ffffff';
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(owned ? 'MILIK KAMU' : name, 128, 48);
  g.font = 'bold 20px system-ui, sans-serif';
  g.fillStyle = owned ? '#ffffff' : '#ffd75e';
  g.fillText(owned ? name : 'DIJUAL — E', 128, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createUsaha(scene, city, rng, hooks) {
  const owned = new Set();
  let pot = 0;
  let accruedHours = 0;
  const signs = new Map();

  // One sign board per property, standing by its door. The sign mesh is
  // rebuilt (texture swapped) the moment the property is bought.
  for (const u of USAHA) {
    const L = loc(u.loc);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 2.5),
      new THREE.MeshBasicMaterial({ map: signTexture(u.name, false) }),
    );
    // Stand the sign just off the location point, facing the road.
    mesh.position.set(L.x + 6, 3.2, L.z + 2);
    mesh.rotation.y = -Math.PI / 2;
    scene.add(mesh);
    signs.set(u.id, mesh);
  }

  function buy(id, cash, rep) {
    const u = USAHA.find((x) => x.id === id);
    if (!u) return { ok: false, reason: 'tidak ada' };
    if (owned.has(id)) return { ok: false, reason: 'sudah milikmu' };
    const price = rep >= 4 ? Math.round(u.price * 0.8) : u.price;
    if (cash < price) return { ok: false, reason: 'uang tidak cukup', price };
    owned.add(id);
    const mesh = signs.get(id);
    if (mesh) {
      mesh.material.map = signTexture(u.name, true);
      mesh.material.needsUpdate = true;
    }
    if (hooks.onBuy) hooks.onBuy(u, price);
    return { ok: true, price };
  }

  function incomePerHour() {
    let perHour = 0;
    for (const id of owned) {
      const u = USAHA.find((x) => x.id === id);
      if (u) perHour += u.incomePerDay / 24;
    }
    return perHour;
  }

  // Called every step with the game clock: every game-hour boundary drops
  // the hourly income into the pot.
  function update(dt, gameMinutes) {
    const hours = gameMinutes / 60;
    const whole = Math.floor(hours);
    if (whole > accruedHours) {
      const gained = (whole - accruedHours) * incomePerHour();
      accruedHours = whole;
      pot += gained;
      if (gained > 0 && hooks.onAccrue) hooks.onAccrue(gained);
    }
  }

  function collect() {
    const amount = Math.round(pot);
    pot = 0;
    if (hooks.onCollect) hooks.onCollect(amount);
    return amount;
  }

  function nearestBuyable(px, pz) {
    let best = null;
    let bestD = 10 * 10;
    for (const u of USAHA) {
      if (owned.has(u.id)) continue;
      const L = loc(u.loc);
      const dx = L.x - px;
      const dz = L.z - pz;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = u; }
    }
    return best;
  }

  function serialize() {
    return { owned: [...owned], pot: Math.round(pot), accruedHours };
  }

  function applySave(data) {
    if (!data) return;
    owned.clear();
    for (const id of data.owned || []) owned.add(id);
    pot = data.pot || 0;
    accruedHours = data.accruedHours || 0;
    for (const id of owned) {
      const mesh = signs.get(id);
      const u = USAHA.find((x) => x.id === id);
      if (mesh && u) {
        mesh.material.map = signTexture(u.name, true);
        mesh.material.needsUpdate = true;
      }
    }
  }

  return {
    buy, update, collect, nearestBuyable, serialize, applySave,
    get owned() { return owned; },
    get pot() { return Math.round(pot); },
    get count() { return owned.size; },
    get total() { return USAHA.length; },
    incomePerDay() {
      let sum = 0;
      for (const id of owned) {
        const u = USAHA.find((x) => x.id === id);
        if (u) sum += u.incomePerDay;
      }
      return sum;
    },
  };
}
