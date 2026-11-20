// Economy: total wealth + economy rank, from the real save data.
//
// netWorth() adds up everything the player owns, priced from the
// catalogs — never from a staged number:
//   cash + usaha pot (uncollected income) + catalog value of owned
//   properties + catalog value of owned cars + upgrade costs sunk into
//   them + owned weapon prices.
// Prices are CATALOG prices, not the discounted price paid: the asset's
// value is what the catalog says it is worth. Stolen cars (PANTHERA /
// PREMAN, not in GARAGE_CATALOG) value at 0 — they were never bought.
// Ammo is skipped: small, consumable, not wealth.
//
// economyRank() turns that wealth into a named tier. The thresholds
// ARE the property ladder — the economy's own price points: $2.500 buys
// WARUNG SARI, $9.500 buys KIOS KAKI LIMA, $22.000 buys SLIP MARINA,
// $34.000 is the full property set's catalog value. A rank is a wealth
// fact, not a vibe: the HUD shows the wealth, the rank, and the
// shortfall to the next tier, all from the same number.
import { USAHA_CATALOG } from './usaha.js';
import { GARAGE_CATALOG, UPGRADE_PRICES, UPGRADE_FIELDS } from './garage.js';
import { WEAPONS } from './config.js';

const WEAPON_OWN_KEYS = {
  hasShotgun: 'shotgun',
  hasSmg: 'smg',
  hasBedil: 'bedil',
  hasPelontar: 'pelontar',
};

export function netWorth(input = {}) {
  let total = Math.round(input.cash ?? 0) + Math.round(input.pot ?? 0);
  for (const id of input.usahaOwned || []) {
    const item = USAHA_CATALOG.find((c) => c.id === id);
    if (item) total += item.price;
  }
  for (const car of input.garageOwned || []) {
    const item = GARAGE_CATALOG.find((c) => c.id === car.id);
    if (item) total += item.price;
    for (const part of Object.keys(UPGRADE_PRICES)) {
      const field = UPGRADE_FIELDS[part];
      const level = Math.max(0, Math.min(3, car[field] || 0));
      total += UPGRADE_PRICES[part].slice(0, level).reduce((a, b) => a + b, 0);
    }
  }
  for (const [key, id] of Object.entries(WEAPON_OWN_KEYS)) {
    if (input[key] && WEAPONS[id] && WEAPONS[id].price) total += WEAPONS[id].price;
  }
  return total;
}

export const ECONOMY_TIERS = [
  { min: 0, title: 'KAKI LIMA' },
  { min: 2500, title: 'PEDAGANG' },
  { min: 9500, title: 'JURAGAN' },
  { min: 22000, title: 'BANDAR MARINA' },
  { min: 34000, title: 'TAIPAN BENTARA' },
];

export function economyRank(wealth) {
  const w = Math.max(0, Math.round(wealth ?? 0));
  let tier = ECONOMY_TIERS[0];
  let next = null;
  for (let i = 0; i < ECONOMY_TIERS.length; i += 1) {
    if (w >= ECONOMY_TIERS[i].min) tier = ECONOMY_TIERS[i];
    else { next = ECONOMY_TIERS[i]; break; }
  }
  return {
    title: tier.title,
    min: tier.min,
    nextTitle: next ? next.title : null,
    nextMin: next ? next.min : null,
    shortfall: next ? next.min - w : 0,
  };
}

// One call for the HUD: wealth + rank + daily usaha income, from the
// live game object (G in hud.update). The HUD never computes these
// itself — it reads this.
export function economySnapshot(G) {
  const S = G.state || {};
  const P = G.player || {};
  const usahaOwned = G.usaha ? G.usaha.ownedList().map((u) => u.id) : [];
  const garageOwned = G.garage ? G.garage.ownedList() : [];
  const wealth = netWorth({
    cash: S.cash || 0,
    pot: G.usaha ? G.usaha.pot || 0 : 0,
    usahaOwned,
    garageOwned,
    // Weapon ownership lives on the player, not the state (hud.js reads
    // the same P[HAS_KEY] fields for the wheel).
    hasShotgun: !!P.hasShotgun,
    hasSmg: !!P.hasSmg,
    hasBedil: !!P.hasBedil,
    hasPelontar: !!P.hasPelontar,
  });
  return {
    wealth,
    rank: economyRank(wealth),
    dailyIncome: G.usaha ? G.usaha.dailyRate() : 0,
    usahaOwned: usahaOwned.length,
    carsOwned: garageOwned.length,
  };
}

// One call for the completion %: the same inputs, from the live game
// object. Kept here (not in hud.js) so the HUD, the pause screen and
// the map screen all compute the same number the same way.
export function completionSnapshot(G) {
  const missions = G.missions || {};
  const done = missions.done ? 8 : Math.min(8, missions.index || 0);
  return {
    missionsDone: done,
    collected: G.collectibles ? G.collectibles.collected || 0 : 0,
    usahaOwned: G.usaha ? G.usaha.ownedList().length : 0,
    carsOwned: G.garage ? G.garage.ownedList().length : 0,
    raceRecords: G.race ? G.race.records : [],
    racePar: 75,
  };
}
