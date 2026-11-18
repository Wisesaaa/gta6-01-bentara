// Seeded random: the same seed gives the same city, traffic and screenshots.
export function mulberry32(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convenience wrappers over one rng function.
export function rr(rng, min, max) {
  return min + rng() * (max - min);
}
export function ri(rng, min, max) {
  return Math.floor(rr(rng, min, max + 1));
}
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
export function chance(rng, p) {
  return rng() < p;
}
// Weighted pick: entries are [value, weight] pairs; the total weight is
// summed once and a single roll selects the entry. Used for traffic kinds.
export function pickWeighted(rng, entries) {
  let total = 0;
  for (const [, w] of entries) total += w;
  let roll = rng() * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}
