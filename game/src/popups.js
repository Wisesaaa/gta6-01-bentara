// Center-screen feedback — the v3 juice layer, at ~35% height, 3 tiers:
// BIG "MISI SELESAI +$2.400" stamps, MID "NGEPOT ×3" / "NYARIS! +$250" /
// "IKAT JALAN DITEMBUS +$300", SMALL aggregated "+$" pulses. Amber
// #ffc247, tilted 8°, scale 1.2 → 1, fade 700 ms. Drift combos run
// ×2 → ×5, white → amber → red. The damage bill gets its own red
// "TAGIHAN +$40" popup, so the billing system is visible in play.
import { STUNTS } from './config.js';

const COMBO_WINDOW_MS = 3000;

export function createPopups(root) {
  let driftCombo = 0;
  let driftComboUntil = 0;

  function spawn(text, sub, kind = 'mid', seconds = 2.6) {
    const el = document.createElement('div');
    const tier = kind === 'big' ? 'feed-big' : kind === 'small' ? 'feed-small' : 'feed-mid';
    el.className = tier;
    if (kind === 'bill' || kind === 'red') el.classList.add('feed-red');
    el.textContent = text;
    if (sub) {
      const s = document.createElement('div');
      s.className = 'feed-small';
      s.textContent = sub;
      el.appendChild(s);
    }
    root.appendChild(el);
    // Settle: 1.2 → 1 over the CSS transition, then fade out 700 ms
    // before the lifetime ends.
    requestAnimationFrame(() => {
      el.style.transform = 'rotate(-8deg) scale(1)';
    });
    const fadeMs = Math.max(0, seconds * 1000 - 700);
    setTimeout(() => { el.classList.add('feed-out'); }, fadeMs);
    setTimeout(() => { el.remove(); }, seconds * 1000);
    return el;
  }

  function drift(amount, secondsHeld, seconds = 2.2) {
    const now = Date.now();
    driftCombo = now <= driftComboUntil ? Math.min(5, driftCombo + 1) : 1;
    driftComboUntil = now + COMBO_WINDOW_MS;
    const label = driftCombo >= 2 ? `NGEPOT ×${driftCombo}` : 'NGEPOT';
    const kind = driftCombo >= 5 ? 'red' : 'mid';
    spawn(`${label} +$${amount}`, `${secondsHeld.toFixed(1)} detik ngepot`, kind, seconds);
  }

  function nearMiss() {
    spawn(`NYARIS! +$${STUNTS.nearMiss}`, 'nyaris tabrakan', 'mid', 2.2);
  }

  function roadblockBreak() {
    spawn('IKAT JALAN DITEMBUS +$300', 'blokade polisi dilewati', 'mid', 2.6);
  }

  function kill(amount) {
    spawn(`+$${amount}`, 'musuh tumbang', 'small', 1.8);
  }

  function collect(amount, label, seconds = 2.2) {
    spawn(`+$${amount} ${label}`, '', 'small', seconds);
  }

  function fare(amount, seconds = 2.6) {
    spawn(`ONGKOS +$${amount}`, 'penumpang sampai', 'small', seconds);
  }

  function raceGate(text, seconds = 2.0) {
    spawn(text, '', 'mid', seconds);
  }

  function bill(amount) {
    spawn(`TAGIHAN +$${amount}`, 'kerusakan dibayar nanti', 'bill', 2.2);
  }

  function big(text, sub) {
    spawn(text, sub, 'big', 3.0);
  }

  function clear() {
    root.innerHTML = '';
    driftCombo = 0;
  }

  return { spawn, drift, nearMiss, roadblockBreak, kill, collect, fare, raceGate, bill, big, clear };
}
