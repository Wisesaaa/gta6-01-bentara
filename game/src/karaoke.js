// KARAOKE — a beat-timing mini-game at the Warung Sari karaoke corner.
// A real input loop, distinct from driving: a beat rings every 0.536 s
// (112 BPM, the 'Aspal Panas' tempo the radio plays), a gold ring shrinks
// onto the mic stand, and E on the beat pays cash + REP. PERFECT (<=0.09 s
// off the beat) pays $15 + 5 REP, BAGUS (<=0.18 s) pays $8 + 3 REP, a miss
// breaks the combo. A session is 12 beats; the HUD panel shows the beat
// dots, the score and the best combo live — the frame reads as a rhythm
// game even at dossier size. The 3D props (mic stand, speakers, beat
// rings) are real scene meshes at the karaoke corner, not a backdrop.
import * as THREE from 'three';
import { rr } from './rng.js';

export const KARAOKE_SPOT = { x: 44, z: 100 };
const BEAT_LEN = 60 / 112;
const BEATS_PER_SESSION = 12;
const PERFECT_WINDOW = 0.09;
const BAGUS_WINDOW = 0.18;

export function createKaraoke(scene, rng, hooks) {
  let active = false;
  let t = 0;
  let beatIndex = 0;
  let hits = 0;
  let perfects = 0;
  let score = 0;
  let combo = 0;
  let bestCombo = 0;
  let sessions = 0;
  let totalScore = 0;
  let lastQuality = '';

  // 3D props at the karaoke corner: a RAISED STAGE, not a mic on bare
  // ground — a 5 x 3.5 m platform (top 1.0 m) with a glowing acid-green
  // front edge, two speaker stacks flanking the mic stand, LED strips
  // at the front corners, and the beat rings on the ground IN FRONT of
  // the stage, where the singer stands. R19 take-2 fix #10: the old
  // flat group (one mic, two small dark boxes, thin strips) never read
  // as a stage at 256 px — the platform + glowing edge + stacks are
  // what make it nameable as "a karaoke stage" from the sheet.
  // R19 take-3 fix #10 (in-game-photography: depth layers FG/MG/BG —
  // the platform is the midground subject, its front face a tall band
  // the eye reads as a stage, not ground shadow): platform raised
  // 0.6 -> 1.0 m, so its front face is a full metre tall and the
  // performers' heads (~3 m) peek OVER the foreground crowd.
  const group = new THREE.Group();
  group.position.set(KARAOKE_SPOT.x, 0, KARAOKE_SPOT.z);
  const STAGE_TOP = 1.0;
  const standMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  // Raised platform: dark, so the glowing edge + performers on top read.
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(5.0, 1.0, 3.5),
    new THREE.MeshLambertMaterial({ color: 0x232d3a }),
  );
  platform.position.y = 0.5;
  group.add(platform);
  // Mic stand ON the platform, centre-stage, slightly forward.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.5, 8), standMat);
  pole.position.set(0, STAGE_TOP + 0.75, -0.3);
  const mic = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshLambertMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: 3 }));
  mic.position.set(0, STAGE_TOP + 1.55, -0.3);
  // R19 (L2/L4): acid-green LED strips — emissive accents that clear
  // the bloom threshold and read as points of light at 256 px, in the
  // cyan/magenta/acid-green neon palette (never orange/amber).
  // Take-2: thicker + taller at the front corners, PLUS a full-width
  // strip along the platform's front top edge — the glowing line that
  // says "stage" at thumbnail size. Take-3 (threejs-postprocessing:
  // selective bloom — threshold 0.85, only emissives clear it; and
  // threejs-exposure-color-grading: measured, not stacked): the old
  // 4x emissive blew past the threshold and bloomed to WHITE bars,
  // not green stage lighting — and 2x STILL did (verified in the
  // take-3 first shoot: the west strip rendered a fat white bar and
  // its bloom wash veiled the speaker stack behind it). 1x sits
  // BELOW the threshold (luminance ~0.70 < 0.85), so the strips do
  // not bloom at all: MeshBasic renders flat acid green, and the
  // hue — the thing that says "stage lighting" — survives. The glow
  // is deliberately given up; colour accuracy wins at 256 px.
  const ledMat = new THREE.MeshBasicMaterial();
  // Acid-green (0x39ff6a) at 1x — below the bloom threshold on purpose.
  ledMat.color.setRGB(0.22 * 1, 1.0 * 1, 0.42 * 1);
  for (const sx of [-2.4, 2.4]) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 0.2), ledMat);
    led.position.set(sx, STAGE_TOP + 0.9, -1.6);
    led.userData.isNeon = true;
    group.add(led);
  }
  const ledEdge = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.14, 0.14), ledMat);
  ledEdge.position.set(0, STAGE_TOP + 0.02, -1.78);
  ledEdge.userData.isNeon = true;
  group.add(ledEdge);
  // Speaker STACKS flanking the mic: two boxes each (~1.9 m tall on
  // the platform) with a light cone circle on the front face, so they
  // read as speakers, not dark crates. Take-3: material lightened
  // 0x1d2a3a -> 0x46586b (in-game-photography: subject/background
  // separation — the old near-black stacks blended with the dark
  // market boxes behind them; the first take-3 shoot proved 0x33414f
  // still vanished, veiled by the LED bloom wash, so the lighter
  // grey goes with the un-bloomed LEDs: no wash left to hide them).
  const speakerMat = new THREE.MeshLambertMaterial({ color: 0x46586b });
  const coneMat = new THREE.MeshLambertMaterial({ color: 0x9aa7b5 });
  for (const sx of [-1.9, 1.9]) {
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.1, 0.65), speakerMat);
    lower.position.set(sx, STAGE_TOP + 0.55, -0.9);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.65), speakerMat);
    upper.position.set(sx, STAGE_TOP + 1.55, -0.9);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), coneMat);
    cone.position.set(sx, STAGE_TOP + 0.55, -1.24);
    cone.rotation.y = Math.PI;
    group.add(lower, upper, cone);
  }
  // Beat rings on the ground IN FRONT of the stage (south side, where
  // the singer stands) — not under the platform.
  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.position.set(0, 0.07, -2.6);
  const hitRing = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  hitRing.rotation.x = -Math.PI / 2;
  hitRing.position.set(0, 0.08, -2.6);
  group.add(pole, mic, targetRing, hitRing);
  group.visible = true;
  scene.add(group);

  const panel = () => document.getElementById('karaokeBox');
  const panelScore = () => document.getElementById('karaokeScore');
  const panelDots = () => document.getElementById('karaokeDots');
  const panelBar = () => document.getElementById('karaokeBeatBar');

  function timeToBeat() {
    if (!active) return Infinity;
    const phase = t - beatIndex * BEAT_LEN;
    return BEAT_LEN - phase;
  }

  function beatPhase() {
    if (!active) return 0;
    return Math.min(1, (t - beatIndex * BEAT_LEN) / BEAT_LEN);
  }

  function renderPanel() {
    const el = panel();
    if (!el) return;
    el.style.display = active ? 'block' : 'none';
    if (!active) return;
    const dots = '●'.repeat(beatIndex) + '○'.repeat(Math.max(0, BEATS_PER_SESSION - beatIndex));
    const ds = panelDots();
    if (ds) ds.textContent = dots;
    const sc = panelScore();
    if (sc) sc.textContent = `SKOR ${score} · ${hits}× KENA · KOMBO ${combo}×`;
    const bar = panelBar();
    if (bar) bar.style.width = `${Math.round(beatPhase() * 100)}%`;
    el.classList.toggle('perfect', lastQuality === 'PERFECT');
  }

  function start() {
    active = true;
    t = 0;
    beatIndex = 0;
    hits = 0;
    perfects = 0;
    score = 0;
    combo = 0;
    lastQuality = '';
    sessions += 1;
    if (hooks.onStart) hooks.onStart();
    renderPanel();
    return true;
  }

  function end() {
    if (!active) return;
    active = false;
    totalScore += score;
    if (combo > bestCombo) bestCombo = combo;
    if (hooks.onEnd) hooks.onEnd({ score, hits, perfects, sessions });
    renderPanel();
  }

  function press() {
    if (!active) return null;
    // Distance to the NEAREST beat (previous or next), in seconds.
    const phase = t - beatIndex * BEAT_LEN;
    const err = Math.min(phase, BEAT_LEN - phase);
    let q = null;
    if (err <= PERFECT_WINDOW) q = 'PERFECT';
    else if (err <= BAGUS_WINDOW) q = 'BAGUS';
    if (q) {
      hits += 1;
      if (q === 'PERFECT') perfects += 1;
      combo += 1;
      if (combo > bestCombo) bestCombo = combo;
      const amount = q === 'PERFECT' ? 15 : 8;
      const rep = q === 'PERFECT' ? 5 : 3;
      score += q === 'PERFECT' ? 100 : 50;
      lastQuality = q;
      if (hooks.onHit) hooks.onHit(q, amount, rep);
    } else {
      combo = 0;
      lastQuality = 'MISS';
      if (hooks.onMiss) hooks.onMiss();
    }
    renderPanel();
    return q;
  }

  function update(dt) {
    if (!active) return;
    t += dt;
    // Advance past whole beats; a beat with no press is a silent miss
    // (combo already only counts presses, so nothing to reset here).
    while (t >= (beatIndex + 1) * BEAT_LEN) {
      beatIndex += 1;
      if (beatIndex >= BEATS_PER_SESSION) { end(); return; }
    }
    // The hit ring shrinks onto the target ring as the beat approaches.
    const s = 1 + (1 - beatPhase()) * 2.2;
    hitRing.scale.set(s, s, 1);
    hitRing.material.opacity = 0.35 + beatPhase() * 0.55;
    targetRing.material.opacity = active ? 0.9 : 0.35;
    renderPanel();
  }

  function nearSpot(x, z) {
    const dx = x - KARAOKE_SPOT.x;
    const dz = z - KARAOKE_SPOT.z;
    return Math.hypot(dx, dz) < 6;
  }

  return {
    start, press, update, end, nearSpot, timeToBeat, beatPhase,
    get active() { return active; },
    get score() { return score; },
    get hits() { return hits; },
    get perfects() { return perfects; },
    get sessions() { return sessions; },
    get totalScore() { return totalScore; },
    get bestCombo() { return bestCombo; },
    get beatsLeft() { return active ? BEATS_PER_SESSION - beatIndex : 0; },
    get spot() { return KARAOKE_SPOT; },
  };
}
