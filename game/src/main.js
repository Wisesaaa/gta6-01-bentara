// Boot: ?shot=heat|drive|foot|story&at=N&seed=N stages a screenshot scene;
// otherwise the game runs its live loop with title, pause and caught screens.
// Action bits come from input.js by name — never as raw numbers — so a
// renumbering of the flags cannot silently break the title screen.
import { createGame } from './game.js';
import { stageShot } from './shots.js';
import { loadGame } from './save.js';
import { ACT_CONFIRM, ACT_PAUSE } from './input.js';
import { randomDjLine } from './dialogue.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const at = Number.parseFloat(params.get('at') ?? '');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('view');
const game = createGame(canvas, seed);
const hud = game.hud;
// Exposed for headless verification (mission test, triangle audit).
window.__game = game;

function resize() {
  game.view.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

const TITLE_HTML = `
  <div>
    <h1>BENTARA</h1>
    <h2>DRY SEASON — KOTA MILIK YANG BERANI</h2>
    <p>Musim kemarau di Bentara. Delapan misi, tiga babak, satu kota yang retak
    di bawah matahari jam empat sore. Temui <span class="key">Pak Wira</span> di
    Marina, curi mobil, kabur dari polisi — dan jangan hancurkan terlalu banyak
    kios, tagihannya nyata.</p>
    <p>Di sela misi: <span class="key">Bengkel Roda Jaya</span> di Kawasan
    Industri (beli 5 mobil, upgrade MESIN/BAN/TURBO, respray),
    <span class="key">usaha</span> — Warung Sari, Kios Kaki Lima, Slip Marina
    (pendapatan harian, cairkan dengan tidur di safehouse),
    <span class="key">taksi</span> (angkut penumpang, dibayar argo),
    <span class="key">24 koleksi</span> wayang emas &amp; kaset tersebar
    di kota, <span class="key">balapan 5 gate</span> di Plaza, dan
    <span class="key">Bang Ocid</span> di Radio Kemarau 92.4.</p>
    <p>Naik REP untuk buka <span class="key">NITRO (REP 2)</span>,
    <span class="key">sogok polisi $250/bintang (REP 3)</span> dan
    <span class="key">diskon toko 20% (REP 4)</span>.</p>
    <p><span class="key">WASD</span> jalan / mengemudi &nbsp;·&nbsp; <span class="key">SPACE</span> rem tangan
    &nbsp;·&nbsp; <span class="key">SHIFT</span> nitro &nbsp;·&nbsp; <span class="key">F</span> masuk / curi mobil &nbsp;·&nbsp; <span class="key">E</span> interaksi
    &nbsp;·&nbsp; <span class="key">T</span> tidur di safehouse &nbsp;·&nbsp; <span class="key">Q</span> isi ulang &nbsp;·&nbsp; <span class="key">B</span> sogok
    &nbsp;·&nbsp; <span class="key">KLIK</span> tembak &nbsp;·&nbsp; <span class="key">1–5</span> senjata
    &nbsp;·&nbsp; <span class="key">R</span> radio &nbsp;·&nbsp; <span class="key">P</span> jeda</p>
    <p id="titleSave"></p>
    <p><span class="key">KLIK atau tekan ENTER untuk mulai</span></p>
  </div>`;

const PAUSED_HTML = `
  <div>
    <h1>JEDA</h1>
    <h2>BENTARA MENUNGGU</h2>
    <p id="pauseStats"></p>
    <p>Progress tersimpan otomatis tiap 20 detik, dan di Safehouse Timur.</p>
    <p><span class="key">P atau ENTER</span> untuk lanjut &nbsp;·&nbsp; <span class="key">R</span> radio</p>
  </div>`;

function startGame() {
  game.audio.unlock();
  game.setMode('play');
  hud.hideScreen();
  hud.announce('Bermain. Temui Pak Wira di Marina Bentara.');
  hud.toast('Misi 1/8: Temui Pak Wira di Marina Bentara.', 5);
  // Bang Ocid greets the player on the radio line as the game starts.
  hud.els.radioLine.textContent = `RADIO KEMARAU 92.4 · ${randomDjLine(game.rng)}`;
}

if (shot) {
  stageShot(shot, game, Number.isFinite(at) ? at : undefined);
} else {
  const saved = loadGame();
  game.setMode('title');
  hud.showScreen(TITLE_HTML);
  const saveNote = document.getElementById('titleSave');
  if (saveNote && saved) {
    saveNote.innerHTML = `Save ditemukan: <span class="key">$${saved.cash} · Misi ${saved.missionIndex + 1}/8 · Koleksi ${saved.collected}/24 · Taksi ${saved.taxiTrips} trip</span> — lanjut otomatis dari save.`;
    game.applySave(saved);
  }
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    acc += Math.min((now - last) / 1000, 0.25);
    last = now;
    const mode = game.state.mode;
    if (mode === 'title') {
      const actions = game.input.takeActions();
      if (actions & ACT_CONFIRM) startGame();
      while (acc >= 1 / 60) { game.step(1 / 60); acc -= 1 / 60; }
      game.view.camera.position.set(120, 60, -160);
      game.view.camera.lookAt(0, 0, 0);
      game.view.render();
    } else if (mode === 'paused') {
      // Actions are consumed here, not in game.step, so a press is never lost.
      const actions = game.input.takeActions();
      if (actions & (ACT_CONFIRM | ACT_PAUSE)) {
        game.setMode('play');
        hud.hideScreen();
      }
      game.draw();
    } else if (mode === 'play') {
      // game.step consumes the actions itself (pause included). The step
      // runs at game.timeScale() during a hit-stop (game-feel): the sim
      // slows to 5% while the wall clock keeps the fixed-step budget, so
      // the freeze always ends on real time.
      while (acc >= 1 / 60) { game.step((1 / 60) * game.timeScale()); acc -= 1 / 60; }
      if (game.state.mode === 'paused') hud.showScreen(PAUSED_HTML);
      else game.draw();
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state.mode === 'play') {
      game.setMode('paused');
      hud.showScreen(PAUSED_HTML);
    }
  });
  requestAnimationFrame(frame);
}
