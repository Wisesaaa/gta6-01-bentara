// Progression: the REP ladder, what each rank unlocks, the three named
// acts, and the completion percentage the pause screen and the dossier
// show. One source of truth — the HUD, the garage discount, the weapon
// shop and the bribe all read from here, never from their own copies.
//
// Ladder (supplement wins): KUTIL -> BOS KECIL -> RAJA JALANAN ->
// LEGENDA BENTARA. Thresholds 0 / 250 / 1000 / 2500 REP.
export const REP_TITLES = ['KUTIL', 'BOS KECIL', 'RAJA JALANAN', 'LEGENDA BENTARA'];
export const REP_STEPS = [0, 250, 1000, 2500];

export function repLevel(rep) {
  let level = 1;
  for (let i = 0; i < REP_STEPS.length; i += 1) {
    if (rep >= REP_STEPS[i]) level = i + 1;
  }
  return level;
}

export function repTitle(rep) {
  return REP_TITLES[repLevel(rep) - 1];
}

// Where the player sits inside the current rank: how much REP earned
// toward the next rank, how much is needed, and the 0..1 fraction.
export function repProgress(rep) {
  const level = repLevel(rep);
  const title = REP_TITLES[level - 1];
  if (level >= REP_TITLES.length) {
    return { level, title, into: rep - REP_STEPS[REP_STEPS.length - 1], need: 0, frac: 1, nextTitle: null };
  }
  const base = REP_STEPS[level - 1];
  const next = REP_STEPS[level];
  const into = Math.max(0, rep - base);
  const need = next - base;
  return { level, title, into, need, frac: Math.min(1, into / need), nextTitle: REP_TITLES[level] };
}

// Rank-gated unlocks. The HUD advertises the next one ("BERIKUTNYA di
// REP 3: NITRO") so the ladder is visible before it is reached.
export const UNLOCKS = [
  { level: 2, key: 'nitro', label: 'NITRO', detail: 'Shift = NOS di mobil' },
  { level: 3, key: 'bribe', label: 'PELEPASAN $250/bintang', detail: 'Tekan B untuk sogok polisi' },
  { level: 3, key: 'bedil', label: 'BEDIL', detail: 'Senapan laras panjang — $900 di Ruko' },
  { level: 4, key: 'discount', label: 'DISKON TOKO 20%', detail: 'Garasi, usaha & senjata lebih murah' },
  { level: 4, key: 'pelontar', label: 'PELONTAR', detail: 'Satu tembakan, satu mobil — $1.800 di Ruko' },
];

export function hasUnlock(rep, key) {
  const u = UNLOCKS.find((x) => x.key === key);
  return !!u && repLevel(rep) >= u.level;
}

export function nextUnlock(rep) {
  const level = repLevel(rep);
  return UNLOCKS.find((u) => u.level > level) || null;
}

export function unlocksAtLevel(level) {
  return UNLOCKS.filter((u) => u.level === level);
}

// The eight missions, presented as three named acts. The mission logic
// itself is untouched — this only names the act a mission index sits in.
export const ACT_NAMES = {
  1: 'BABAK 1 — KENALAN',
  2: 'BABAK 2 — NAIK DAUN',
  3: 'BABAK 3 — MUSIM KERING',
};

export function actForMission(index) {
  if (index < 3) return 1;
  if (index < 6) return 2;
  return 3;
}

export function actNameForMission(index) {
  return ACT_NAMES[actForMission(index)];
}

// Completion across the whole game, in Bahasa, for the pause screen and
// the dossier line under the REP bar.
export function missionProgress(missions) {
  const total = 8;
  const done = missions.done ? total : Math.min(total, missions.index || 0);
  return { done, total, pct: Math.round((done / total) * 100) };
}
