// Save / load through localStorage. Autosave runs on a timer in the game loop
// (every 20 s); the safehouse also saves immediately.
//
// The snapshot is a plain object built by the game from the live systems
// (state, player, missions, collectibles, taxi) — it is the shape the game
// wrote, not an accident of which object was passed. (The v1.6 save read
// state.missionIndex and state.player, neither of which existed, so every
// save loaded as null; that is fixed here.)
export const SAVE_KEY = 'bentara.save.v2';

const DEFAULTS = {
  cash: 250, rep: 0, day: 1,
  missionIndex: 0, hasShotgun: false, shells: 0,
  collected: 0, taxiTrips: 0, raceBest: null,
};

export function buildSnapshot({ cash, rep, day, missionIndex, hasShotgun, shells, collected, taxiTrips, raceBest }) {
  return {
    cash: Math.round(cash ?? DEFAULTS.cash),
    rep: Math.round(rep ?? DEFAULTS.rep),
    day: Math.max(1, day ?? DEFAULTS.day),
    missionIndex: Math.max(0, missionIndex ?? DEFAULTS.missionIndex),
    hasShotgun: !!hasShotgun,
    shells: Math.max(0, shells ?? 0),
    collected: Math.max(0, collected ?? 0),
    taxiTrips: Math.max(0, taxiTrips ?? 0),
    raceBest: raceBest ?? null,
    savedAt: new Date().toISOString(),
  };
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

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const numberFields = ['cash', 'rep', 'day', 'missionIndex', 'shells', 'collected', 'taxiTrips'];
    for (const f of numberFields) {
      if (data[f] !== undefined && typeof data[f] !== 'number') return null;
    }
    if (data.hasShotgun !== undefined && typeof data.hasShotgun !== 'boolean') return null;
    if (data.raceBest !== undefined && data.raceBest !== null && typeof data.raceBest !== 'number') return null;
    return { ...DEFAULTS, ...data };
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
