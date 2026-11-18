// Score popups: floating DRIFT / NEAR MISS / pickup / fare payouts over
// the road, and the "DI PANDANG" flash when police have eyes on the player.
// DOM elements, animated with CSS, spawned from real game events — never
// set by a shot script directly (shots trigger the real events instead).
export function createPopups(container) {
  const live = [];

  function spawn(text, sub, kind = 'stunt', seconds = 2.6) {
    const el = document.createElement('div');
    el.className = `popup popup-${kind}`;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    // Stack them slightly apart so two stunts in one second stay readable.
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

  function drift(amount, secondsHeld) {
    return spawn(`DRIFT +$${amount}`, `${secondsHeld.toFixed(1)} detik ngepot`, 'stunt');
  }

  function nearMiss(amount) {
    return spawn(`NEAR MISS +$${amount}`, 'Nyaris tabrakan di kecepatan penuh', 'stunt');
  }

  function collect(amount, kind) {
    return spawn(kind === 'idol' ? 'IDOL +$' + amount : 'KASET +$' + amount, kind === 'idol' ? 'Wayang emas Bentara' : 'Radio Kemarau 92.4', 'collect');
  }

  function fare(amount, name) {
    return spawn(`TAKSI +$${amount}`, `Antar ${name} sampai tujuan`, 'fare');
  }

  function raceGate(n, total) {
    return spawn(`GATE ${n}/${total}`, 'Checkpoint dilewati', 'race', 1.8);
  }

  function clear() {
    for (const item of live.splice(0)) item.el.remove();
  }

  return { spawn, drift, nearMiss, collect, fare, raceGate, clear };
}
