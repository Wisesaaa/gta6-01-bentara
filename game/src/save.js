// Save / load through localStorage. Autosave runs on a timer in the game loop
// (every 20 s); the safehouse also saves immediately.
//
// The snapshot carries the garage + usaha economies, the full weapon rack
// and armor. Missing fields fall back to defaults on load.
export const SAVE_KEY = 'bentara.save';

const DEFAULTS = {
  cash: 250, rep: 0, day: 1,
  missionIndex: 0, hasShotgun: false, shells: 0,
  hasSmg: false, smgAmmo: 0, hasBedil: false, bedilAmmo: 0,
  hasPelontar: false, pelontarAmmo: 0, armor: 0,
  collected: 0, taxiTrips: 0, raceBest: null,
  garage: null, usaha: null,
};

const NUMBER_FIELDS = [
  'cash', 'rep', 'day', 'missionIndex', 'shells',
  'smgAmmo', 'bedilAmmo', 'pelontarAmmo', 'armor',
  'collected', 'taxiTrips',
];
const BOOL_FIELDS = ['hasShotgun', 'hasSmg', 'hasBedil', 'hasPelontar'];

export function buildSnapshot(data) {
  const out = {
    version: 1,
    cash: Math.round(data.cash ?? DEFAULTS.cash),
    rep: Math.round(data.rep ?? DEFAULTS.rep),
    day: Math.max(1, data.day ?? DEFAULTS.day),
    missionIndex: Math.max(0, data.missionIndex ?? DEFAULTS.missionIndex),
    hasShotgun: !!data.hasShotgun,
    shells: Math.max(0, data.shells ?? 0),
    hasSmg: !!data.hasSmg,
    smgAmmo: Math.max(0, data.smgAmmo ?? 0),
    hasBedil: !!data.hasBedil,
    bedilAmmo: Math.max(0, data.bedilAmmo ?? 0),
    hasPelontar: !!data.hasPelontar,
    pelontarAmmo: Math.max(0, data.pelontarAmmo ?? 0),
    armor: Math.max(0, data.armor ?? 0),
    collected: Math.max(0, data.collected ?? 0),
    taxiTrips: Math.max(0, data.taxiTrips ?? 0),
    raceBest: data.raceBest ?? null,
    raceRecords: Array.isArray(data.raceRecords) ? data.raceRecords.filter((n) => typeof n === 'number').slice(0, 3) : [],
    garage: data.garage && typeof data.garage === 'object' ? data.garage : null,
    usaha: data.usaha && typeof data.usaha === 'object' ? data.usaha : null,
    savedAt: new Date().toISOString(),
  };
  return out;
}

export function saveGame(snapshot) {
  try {
    const data = buildSnapshot(snapshot);
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function validate(data) {
  if (typeof data !== 'object' || data === null) return null;
  for (const f of NUMBER_FIELDS) {
    if (data[f] !== undefined && typeof data[f] !== 'number') return null;
  }
  for (const f of BOOL_FIELDS) {
    if (data[f] !== undefined && typeof data[f] !== 'boolean') return null;
  }
  if (data.raceBest !== undefined && data.raceBest !== null && typeof data.raceBest !== 'number') return null;
  if (data.raceRecords !== undefined && data.raceRecords !== null && !Array.isArray(data.raceRecords)) return null;
  if (data.garage !== undefined && data.garage !== null && typeof data.garage !== 'object') return null;
  if (data.usaha !== undefined && data.usaha !== null && typeof data.usaha !== 'object') return null;
  return { ...DEFAULTS, ...data, version: 1 };
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = validate(JSON.parse(raw));
      if (data) return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* storage unavailable */ }
}
