// Score feedback in three tiers, all spawned from real game events:
// BIG stamps ("MISI SELESAI +$2.400"), MID callouts ("NGEPOT ×3",
// "NYARIS! +$250", "IKAT JALAN DITEMBUS +$300") and SMALL aggregated
// "+$" pulses — all in the centre band at ~35% height, amber, tilted
// 8°, scaling 1.2 -> 1 and fading in 700 ms, so they read even at
// thumbnail size. The old side stack stays for fares and pickups.
//
// A drift chain builds a combo (×2 -> ×5, white -> amber -> red): two
// slides within 4 s of each other count as one chain, and the popup
// shows the chain, not a lonely slide.
export function createPopups(container, centerContainer) {
  const live = [];
  const centerLive = [];
  let combo = 0;
  let comboSince = 0;
  let pulsePending = 0;
  let pulseTimer = null;

  function spawn(text, sub, kind = 'stunt', seconds = 2.6) {
    const el = document.createElement('div');
    el.className = `popup popup-${kind}`;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    const offset = (live.length % 3) * 34;
    el.style.marginTop = `${-offset}px`;
    container.appendChild(el);
    const item = { el, left: seconds };
    live.push(item);
    window.setTimeout(() => {
      el.classList.add('popup-out');
      window.setTimeout(() => {
        el.remove();
        const i = live.indexOf(item);
        if (i >= 0) live.splice(i, 1);
      }, 400);
    }, seconds * 1000);
    return item;
  }

  // Centre-band feedback: one element at a time per tier, replaced when
  // a newer one lands, so the middle of the screen never turns into a
  // wall of text.
  function centerFx(text, sub, tier, seconds = 2.6, extraClass = '') {
    const host = centerContainer || container;
    const el = document.createElement('div');
    el.className = `fx fx-${tier} ${extraClass}`;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    host.appendChild(el);
    const item = { el, tier };
    centerLive.push(item);
    window.setTimeout(() => {
      el.classList.add('fx-out');
      window.setTimeout(() => {
        el.remove();
        const i = centerLive.indexOf(item);
        if (i >= 0) centerLive.splice(i, 1);
      }, 700);
    }, seconds * 1000);
    return item;
  }

  function big(text, sub, seconds = 3) {
    return centerFx(text, sub, 'big', seconds);
  }

  function mid(text, sub, seconds = 2.6) {
    return centerFx(text, sub, 'mid', seconds);
  }

  function pulse(amount) {
    // Small payouts aggregate: three +$15 ticks inside one second show
    // as one "+$45" pulse instead of three competing lines.
    pulsePending += amount;
    if (pulseTimer) return null;
    pulseTimer = window.setTimeout(() => {
      pulseTimer = null;
      const total = pulsePending;
      pulsePending = 0;
      centerFx(`+$${total}`, '', 'small', 1.2);
    }, 900);
    return null;
  }

  // `seconds` is the on-screen lifetime: live play uses the 2.6 s default;
  // a screenshot stage may pass a longer one so the popup survives the
  // slow headless capture (a SwiftShader frame blocks the main thread
  // longer than the default lifetime, so the popup would fade before the
  // capture). The text and amount are always the real earned ones.
  function drift(amount, secondsHeld, seconds = 2.6) {
    const now = Date.now();
    combo = now - comboSince < 4000 ? Math.min(5, combo + 1) : 1;
    comboSince = now;
    if (combo >= 2) {
      const heat = combo >= 5 ? 'fx-hot' : combo >= 3 ? 'fx-warm' : '';
      return centerFx(`NGEPOT ×${combo} +$${amount}`, `${secondsHeld.toFixed(1)} detik ngepot · PARKIR LIAR`, 'mid', seconds, heat);
    }
    return spawn(`NGEPOT +$${amount}`, `PARKIR LIAR · ${secondsHeld.toFixed(1)} detik ngepot`, 'stunt', seconds);
  }

  function nearMiss(amount) {
    return centerFx(`NYARIS! +$${amount}`, 'Nyaris tabrakan di kecepatan penuh', 'mid', 2.6);
  }

  function roadblock(amount) {
    return centerFx(`IKAT JALAN DITEMBUS +$${amount}`, 'Blokade polisi ditembus', 'mid', 2.6, 'fx-warm');
  }

  function collect(amount, kind, seconds = 2.6) {
    return spawn(kind === 'idol' ? 'IDOL +$' + amount : 'KASET +$' + amount, kind === 'idol' ? 'Wayang emas Bentara' : 'Radio Kemarau 92.4', 'collect', seconds);
  }

  function fare(amount, name) {
    return spawn(`TAKSI +$${amount}`, `Antar ${name} sampai tujuan`, 'fare');
  }

  function raceGate(n, total) {
    return spawn(`GATE ${n}/${total}`, 'Checkpoint dilewati', 'race', 1.8);
  }

  function clear() {
    for (const item of live.splice(0)) item.el.remove();
    for (const item of centerLive.splice(0)) item.el.remove();
    if (pulseTimer) { window.clearTimeout(pulseTimer); pulseTimer = null; }
    pulsePending = 0;
    combo = 0;
  }

  return { spawn, drift, nearMiss, roadblock, collect, fare, raceGate, clear, big, mid, pulse };
}
