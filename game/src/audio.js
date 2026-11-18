// Procedural audio: engine hum, two-tone siren, gunshots, a tiny radio
// sequencer, and the new cash-register blips for collectibles, taxi fares
// and drifts. No audio files. Everything is created lazily on first user
// gesture; in screenshot mode there is no gesture, so nothing is created.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = 0;
  let radioStep = 0;
  let radioOn = false;
  const MELODY = [0, 3, 5, 7, 10, 7, 5, 3, 0, -2, 0, 5];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    } catch {
      return false;
    }
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(ctx.destination);
    sirenOsc.start();
    return true;
  }

  function blip(freq, dur, type = 'square', vol = 0.08) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  // A short ascending phrase, played with `delay` between notes.
  function phrase(notes, delay = 0.09, type = 'sine', vol = 0.1) {
    if (!ctx) return;
    notes.forEach((freq, i) => {
      setTimeout(() => blip(freq, 0.14, type, vol), i * delay * 1000);
    });
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setRadio(on) { radioOn = on; },
    radioOn: () => radioOn,
    // Engine pitch follows speed; siren wails while the heat is on.
    step(dt, speedKmh, heat) {
      if (!ctx) return;
      const target = speedKmh > 1 ? 0.05 + speedKmh / 900 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speedKmh * 1.6, ctx.currentTime, 0.1);
      if (heat >= 2) {
        sirenGain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.2);
        const t = ctx.currentTime % 1;
        sirenOsc.frequency.setTargetAtTime(t < 0.5 ? 720 : 960, ctx.currentTime, 0.05);
      } else {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      }
      if (radioOn) {
        radioTimer -= dt;
        if (radioTimer <= 0) {
          radioTimer = 0.22;
          const base = 220 * Math.pow(2, MELODY[radioStep % MELODY.length] / 12);
          blip(base, 0.2, 'triangle', 0.05);
          if (radioStep % 4 === 0) blip(base / 2, 0.2, 'sine', 0.06);
          radioStep += 1;
        }
      }
    },
    gunshot() {
      if (!ctx) return;
      const len = Math.floor(ctx.sampleRate * 0.12);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      src.connect(g).connect(ctx.destination);
      src.start();
    },
    pickup() { phrase([660, 880], 0.08); },
    missionDone() { phrase([523, 659, 784], 0.12); },
    // New: a bright two-note chime when a wayang idol or tape is picked up.
    collect() { phrase([988, 1319], 0.07, 'triangle', 0.12); },
    // New: the taxi meter ding when a passenger gets in.
    taxiDing() { phrase([1047, 1568], 0.1, 'sine', 0.12); },
    // New: a short skid sting when a drift pays out.
    drift() { phrase([392, 523], 0.06, 'sawtooth', 0.05); },
    // New: DJ stinger when the radio line changes.
    stinger() { phrase([440, 554, 659], 0.08, 'triangle', 0.06); },
  };
}
