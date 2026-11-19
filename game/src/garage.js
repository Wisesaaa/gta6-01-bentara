// Garage "Bengkel Roda Jaya" — vehicle ownership + upgrades. Five cars to
// buy (MURAI 110 starter → SRIWIJAYA LIMO), the player's CEMPAKA GT owned
// from the start (a gift from Pak Wira), and two steal-unlocks: PANTHERA
// (steal a police cruiser) and KANCIL (steal the gang car in mission 7).
// Per-car upgrades: MESIN (top speed), BAN (grip), TURBO (boost meter,
// Shift = NOS, needs REP 2). Respray changes colour and clears heat.
// Owned cars park on the safehouse forecourt; the menu is a DOM overlay
// opened with E at the bengkel (Kawasan Industri).
import * as THREE from 'three';
import { GARAGE_CARS, GARAGE_UPGRADES, RESPRAY_PRICE, SHOP_DISCOUNT_REP, SHOP_DISCOUNT } from './config.js';
import { Car } from './actors/car.js';
import { loc } from './city.js';
import { pick } from './rng.js';

const PAINTS = [0xb8442f, 0x2f6b8a, 0xd8a13a, 0x2f6b4f, 0xe8e4da, 0x3a3a38, 0x7a2f2f, 0x1f6b74];

function boardTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2a3a';
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffd75e';
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('BENGKEL RODA JAYA', 256, 44);
  g.font = 'bold 22px system-ui, sans-serif';
  g.fillStyle = '#ffffff';
  const rows = GARAGE_CARS.filter((d) => d.price !== null);
  rows.forEach((d, i) => {
    g.fillText(`${d.name} — $${d.price.toLocaleString('en-US')}`, 256, 84 + i * 32);
  });
  g.fillStyle = '#ffd75e';
  g.font = '18px system-ui, sans-serif';
  g.fillText('E — Buka bengkel', 256, 240);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGarage(scene, city, rng, hooks) {
  const owned = new Set(['cempaka']);
  const upgrades = {};
  const colors = {};
  for (const d of GARAGE_CARS) {
    upgrades[d.id] = { engine: 0, grip: 0, turbo: 0 };
    colors[d.id] = d.color;
  }
  let current = 'cempaka';
  const parkedOwned = [];
  let board = null;

  function def(id) { return GARAGE_CARS.find((d) => d.id === id); }
  function priceFor(amount, rep) {
    if (rep >= SHOP_DISCOUNT_REP) return Math.round(amount * (1 - SHOP_DISCOUNT));
    return amount;
  }

  function perfFor(id) {
    const d = def(id);
    const u = upgrades[id] || { engine: 0, grip: 0, turbo: 0 };
    return {
      topSpeed: d.topSpeed * (1 + 0.08 * u.engine),
      grip: d.grip * (1 + 0.10 * u.grip),
      turbo: u.turbo,
    };
  }

  function buy(id, cash, rep) {
    const d = def(id);
    if (!d || d.price === null) return { ok: false, reason: 'tidak dijual' };
    if (owned.has(id)) return { ok: false, reason: 'sudah milikmu' };
    const price = priceFor(d.price, rep);
    if (cash < price) return { ok: false, reason: 'uang tidak cukup', price };
    owned.add(id);
    if (hooks.onBuy) hooks.onBuy(d, price);
    parkOwnedCar(id);
    return { ok: true, price };
  }

  function upgrade(id, kind, cash, rep) {
    const d = def(id);
    if (!d || !owned.has(id)) return { ok: false, reason: 'bukan mobilmu' };
    const spec = GARAGE_UPGRADES[kind];
    const level = upgrades[id][kind];
    if (level >= spec.prices.length) return { ok: false, reason: 'sudah maks' };
    if (kind === 'turbo' && spec.needsRep && rep < spec.needsRep) {
      return { ok: false, reason: `butuh REP ${spec.needsRep} (NITRO)` };
    }
    const price = priceFor(spec.prices[level], rep);
    if (cash < price) return { ok: false, reason: 'uang tidak cukup', price };
    upgrades[id][kind] = level + 1;
    if (hooks.onUpgrade) hooks.onUpgrade(d, kind, level + 1, price);
    return { ok: true, price, level: level + 1 };
  }

  function respray(id, cash, rep) {
    const d = def(id);
    if (!d || !owned.has(id)) return { ok: false, reason: 'bukan mobilmu' };
    const price = priceFor(RESPRAY_PRICE, rep);
    if (cash < price) return { ok: false, reason: 'uang tidak cukup', price };
    const next = pick(rng, PAINTS.filter((p) => p !== colors[id]));
    colors[id] = next;
    if (hooks.onRespray) hooks.onRespray(d, price);
    return { ok: true, price, color: next };
  }

  function unlockSteal(kind) {
    const d = GARAGE_CARS.find((x) => x.steal === kind);
    if (!d || owned.has(d.id)) return null;
    owned.add(d.id);
    if (hooks.onStealUnlock) hooks.onStealUnlock(d);
    parkOwnedCar(d.id);
    return d;
  }

  // Owned cars park on the safehouse forecourt (roadside by the east
  // arterial), so the garage is visible in the world, not just in a menu.
  function parkOwnedCar(id) {
    const d = def(id);
    const E = loc('eastSafehouse');
    const spots = [[179, -44], [179, -58], [179, -72], [179, -86], [179, -100]];
    const taken = parkedOwned.length;
    if (taken >= spots.length) return null;
    const [x, z] = spots[taken];
    const car = new Car(scene, rng, { name: d.name, kind: d.kind, x, z, heading: Math.PI / 2, color: colors[id] });
    car.garageId = id;
    car.perf = perfFor(id);
    parkedOwned.push(car);
    return car;
  }

  function buildBoard() {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 4.5),
      new THREE.MeshBasicMaterial({ map: boardTexture() }),
    );
    mesh.position.set(170, 3.4, -52);
    mesh.rotation.y = -Math.PI / 2;
    scene.add(mesh);
    board = mesh;
    return mesh;
  }

  function ownedList() {
    return GARAGE_CARS.filter((d) => owned.has(d.id));
  }

  function serialize() {
    return {
      owned: [...owned], current,
      upgrades: JSON.parse(JSON.stringify(upgrades)),
      colors: { ...colors },
    };
  }

  function applySave(data) {
    if (!data) return;
    owned.clear();
    for (const id of data.owned || ['cempaka']) owned.add(id);
    current = data.current || 'cempaka';
    if (data.upgrades) {
      for (const id of Object.keys(data.upgrades)) {
        if (upgrades[id]) upgrades[id] = { ...upgrades[id], ...data.upgrades[id] };
      }
    }
    if (data.colors) {
      for (const id of Object.keys(data.colors)) {
        if (colors[id] !== undefined) colors[id] = data.colors[id];
      }
    }
    for (const id of owned) {
      if (id !== 'cempaka') parkOwnedCar(id);
    }
  }

  return {
    buy, upgrade, respray, unlockSteal, perfFor, ownedList, serialize, applySave, buildBoard,
    def, priceFor, parkOwnedCar,
    get current() { return current; },
    set current(id) { if (owned.has(id)) current = id; },
    get owned() { return owned; },
    get upgrades() { return upgrades; },
    get colors() { return colors; },
    get parkedOwned() { return parkedOwned; },
  };
}
