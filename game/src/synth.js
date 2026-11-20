// Mesin radio prosedural BENTARA: DRY SEASON.
// Musik beneran, dibangkitkan WebAudio API — tanpa file audio.
// Kick (sine drop pitch), snare (noise + bandpass), bass (sawtooth +
// lowpass), pad (detuned sawtooth, attack lambat), hat (noise + highpass).
// Step sequencer 16 langkah per bar, tempo per track, pola per track dari
// radioStations.js. Struktur: intro 1 bar (pad + kick saja) lalu loop
// bar dengan variasi tiap bar ke-4 (fill snare + hat terbuka).
// AudioContext dibuat lazy di unlock() — sama seperti audio.js — supaya
// tidak ada suara sebelum gesture pertama pemain. Di mode screenshot
// (tanpa gesture) tidak ada yang dibuat.

import { STATIONS, getStation, getTrack } from './radioStations.js';

const STEPS_PER_BAR = 16;

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function createRadioSynth() {
  let ctx = null;
  let master = null;
  let analyser = null;
  let noiseBuf = null;
  let timer = null;
  let playing = false;
  let stationIdx = 0;
  let trackIdx = 0;
  let step = 0;
  let bar = 0;
  let nextStepTime = 0;
  let volume = 0.5;
  // Level cadangan dari pola sequencer kalau AnalyserNode belum tersedia.
  let lastStepLevels = [0, 0, 0, 0, 0, 0, 0, 0];

  function currentStation() {
    return STATIONS[stationIdx] || STATIONS[0];
  }

  function currentTrack() {
    const st = currentStation();
    return st.tracks[trackIdx] || st.tracks[0];
  }

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = volume;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    // Satu buffer noise dipakai ulang untuk snare dan hat.
    const len = Math.floor(ctx.sampleRate * 1);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function stepDuration() {
    return 60 / currentTrack().bpm / 4;
  }

  function scheduleStep(stepIdx, barIdx, when) {
    const track = currentTrack();
    const isIntro = barIdx === 0;
    const isFillBar = !isIntro && barIdx % 4 === 3;
    const stepInBar = stepIdx % STEPS_PER_BAR;

    // Kick — sine yang pitch-nya jatuh 150 Hz ke 40 Hz.
    if (track.kick[stepInBar]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, when);
      o.frequency.exponentialRampToValueAtTime(40, when + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.28);
      o.connect(g).connect(master);
      o.start(when);
      o.stop(when + 0.3);
    }

    // Snare — noise lewat bandpass 1800 Hz. Di bar fill, tambah pukulan
    // di langkah 14–15 sebagai penutup bar.
    const snareHit = track.snare[stepInBar] || (isFillBar && (stepInBar === 14 || stepInBar === 15));
    if (!isIntro && snareHit) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
      src.connect(bp).connect(g).connect(master);
      src.start(when);
      src.stop(when + 0.2);
    }

    // Hat — noise lewat highpass 8000 Hz, pendek. Di bar fill, hat
    // terbuka (lebih panjang) di langkah 14.
    if (!isIntro && track.hat[stepInBar]) {
      const open = isFillBar && stepInBar === 14;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 8000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(open ? 0.22 : 0.14, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + (open ? 0.3 : 0.05));
      src.connect(hp).connect(g).connect(master);
      src.start(when);
      src.stop(when + (open ? 0.32 : 0.07));
    }

    // Bass — sawtooth lewat lowpass, nada dari pola (offset semitone
    // dari root; null = diam; 0 = root).
    const bassNote = track.bass[stepInBar];
    if (bassNote !== null && bassNote !== undefined) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiToFreq(track.root + bassNote);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, when);
      lp.frequency.exponentialRampToValueAtTime(300, when + stepDuration());
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.32, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + stepDuration() * 0.95);
      o.connect(lp).connect(g).connect(master);
      o.start(when);
      o.stop(when + stepDuration());
    }

    // Pad — dua sawtooth detuned per nada akor, attack lambat, dimainkan
    // sekali di awal tiap bar (langkah 0), akor berganti tiap bar.
    if (stepInBar === 0) {
      const chord = track.chords[barIdx % track.chords.length];
      const barLen = stepDuration() * STEPS_PER_BAR;
      chord.forEach((midi) => {
        [-6, 6].forEach((detune) => {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = midiToFreq(midi);
          o.detune.value = detune;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 1200;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, when);
          g.gain.linearRampToValueAtTime(0.05, when + barLen * 0.3);
          g.gain.setValueAtTime(0.05, when + barLen * 0.7);
          g.gain.linearRampToValueAtTime(0.0001, when + barLen);
          o.connect(lp).connect(g).connect(master);
          o.start(when);
          o.stop(when + barLen + 0.05);
        });
      });
    }

    // Level cadangan untuk equalizer HUD: energi per band diturunkan
    // dari instrumen yang bunyi di langkah ini.
    const lv = [0, 0, 0, 0, 0, 0, 0, 0];
    if (track.kick[stepInBar]) { lv[0] = 0.9; lv[1] = 0.6; }
    if (bassNote !== null && bassNote !== undefined) { lv[1] = Math.max(lv[1], 0.7); lv[2] = 0.5; }
    if (snareHit) { lv[3] = 0.6; lv[4] = 0.55; }
    if (track.hat[stepInBar]) { lv[6] = 0.45; lv[7] = 0.4; }
    lv[5] = 0.3; // pad selalu mengalir
    lastStepLevels = lv;
  }

  function scheduler() {
    if (!ctx || !playing) return;
    const ahead = 0.12;
    while (nextStepTime < ctx.currentTime + ahead) {
      scheduleStep(step, bar, nextStepTime);
      nextStepTime += stepDuration();
      step += 1;
      if (step >= STEPS_PER_BAR) {
        step = 0;
        bar += 1;
      }
    }
  }

  function resetPosition() {
    step = 0;
    bar = 0;
    if (ctx) nextStepTime = ctx.currentTime + 0.06;
  }

  return {
    // Buat (atau lanjutkan) AudioContext. Panggil dari gesture pemain,
    // mis. bersamaan dengan audio.unlock().
    unlock() {
      const ok = ensure();
      if (ok && ctx.state === 'suspended') ctx.resume();
      return ok;
    },

    start() {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      if (playing) return true;
      playing = true;
      resetPosition();
      timer = setInterval(scheduler, 25);
      return true;
    },

    stop() {
      playing = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },

    setStation(id) {
      // getStation() jatuh kembali ke stasiun pertama kalau id tidak
      // dikenal — jadi cek dulu apakah id itu memang ada.
      if (!STATIONS.some((s) => s.id === id)) return false;
      const st = getStation(id);
      stationIdx = STATIONS.findIndex((s) => s.id === st.id);
      trackIdx = 0;
      if (playing) resetPosition();
      return true;
    },

    nextStation() {
      stationIdx = (stationIdx + 1) % STATIONS.length;
      trackIdx = 0;
      if (playing) resetPosition();
      return currentStation();
    },

    nextTrack() {
      const st = currentStation();
      trackIdx = (trackIdx + 1) % st.tracks.length;
      if (playing) resetPosition();
      return currentTrack();
    },

    prevTrack() {
      const st = currentStation();
      trackIdx = (trackIdx - 1 + st.tracks.length) % st.tracks.length;
      if (playing) resetPosition();
      return currentTrack();
    },

    getNowPlaying() {
      const st = currentStation();
      const tr = currentTrack();
      return {
        station: st.name,
        stationId: st.id,
        freq: st.freq,
        track: tr.title,
        artist: tr.artist,
        trackId: tr.id,
        bpm: tr.bpm,
        playing,
      };
    },

    // Cari info satu track dari data stasiun (untuk HUD / daftar putar).
    // Id yang tidak dikenal jatuh kembali ke track pertama stasiun itu
    // — perilaku getTrack() dari radioStations.js.
    lookupTrack(stationId, trackId) {
      const st = getStation(stationId);
      const tr = getTrack(stationId, trackId);
      return {
        station: st.name,
        stationId: st.id,
        freq: st.freq,
        track: tr.title,
        artist: tr.artist,
        trackId: tr.id,
        bpm: tr.bpm,
      };
    },

    // 8 band level 0..1 untuk equalizer HUD. Dari AnalyserNode kalau
    // tersedia; kalau belum, dari pola sequencer langkah terakhir.
    getLevels() {
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const bands = [];
        const perBand = Math.floor(data.length / 8);
        for (let b = 0; b < 8; b += 1) {
          let sum = 0;
          for (let i = 0; i < perBand; i += 1) sum += data[b * perBand + i];
          bands.push(Math.min(1, (sum / perBand / 255) * 1.6));
        }
        return bands;
      }
      return lastStepLevels.slice();
    },

    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    },

    isPlaying() {
      return playing;
    },

    getStations() {
      return STATIONS.map((s) => ({
        id: s.id,
        name: s.name,
        freq: s.freq,
        tagline: s.tagline,
        tracks: s.tracks.map((t) => ({ id: t.id, title: t.title, artist: t.artist, bpm: t.bpm })),
      }));
    },
  };
}
