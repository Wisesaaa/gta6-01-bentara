// MEMANCING — fishing off the marina pier. A real wait-then-react loop,
// distinct from driving and from karaoke's rhythm: cast, wait for the
// bite (2–5 s of bobbing), then a 0.9 s STRIKE window — E inside it lands
// the fish, E late (or never) loses it. The catch is a real fish with a
// name and a cash value, paid through the same settle path as missions.
// The bobber is a real scene mesh in the marina water; it dips and the
// splash ring flares on the strike, so the tell is loud, not a pause.
// The HUD panel shows the state in one line: waiting, STRIKE!, or the
// catch. forceBite() is the QA/shot hook — the live game never calls it.
import * as THREE from 'three';
import { rr, pick } from './rng.js';

export const FISHING_SPOT = { x: -6, z: -198 };
const BOBBER = { x: -6, z: -210 };
const STRIKE_WINDOW = 0.9;

const FISH = [
  { name: 'IKAN KEMBUNG', value: 20, w: 0.45 },
  { name: 'IKAN KAKAP', value: 45, w: 0.35 },
  { name: 'IKAN KERAPU', value: 70, w: 0.15 },
  { name: 'IKAN HIU KECIL', value: 120, w: 0.05 },
];

function rollFish(rng) {
  let r = rng();
  for (const f of FISH) {
    if (r < f.w) return f;
    r -= f.w;
  }
  return FISH[0];
}

export function createFishing(scene, rng, hooks) {
  let active = false;
  let phase = 'idle'; // idle | waiting | strike
  let t = 0;
  let biteAt = 0;
  let strikeLeft = 0;
  let catches = 0;
  let earned = 0;
  let biggest = null;
  let lastCatch = null;

  // Bobber + splash ring in the marina water, off the pier end.
  const bobber = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xff3b2e, emissive: 0x661111 }),
  );
  bobber.position.set(BOBBER.x, 0.25, BOBBER.z);
  const splash = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  splash.rotation.x = -Math.PI / 2;
  splash.position.set(BOBBER.x, 0.08, BOBBER.z);
  scene.add(bobber, splash);

  const panel = () => document.getElementById('fishingBox');
  const panelText = () => document.getElementById('fishingText');

  function renderPanel() {
    const el = panel();
    if (!el) return;
    el.style.display = active ? 'block' : 'none';
    if (!active) return;
    const tx = panelText();
    if (!tx) return;
    if (phase === 'waiting') tx.textContent = '🎣 MEMANCING · tunggu gigitan…';
    else if (phase === 'strike') tx.textContent = '⚡ STRIKE! TEKAN E!';
    el.classList.toggle('strike', phase === 'strike');
  }

  function start() {
    active = true;
    phase = 'waiting';
    t = 0;
    biteAt = rr(rng, 2, 5);
    strikeLeft = 0;
    lastCatch = null;
    if (hooks.onCast) hooks.onCast();
    renderPanel();
    return true;
  }

  function forceBite() {
    if (!active) return false;
    biteAt = t;
    return true;
  }

  function press() {
    if (!active) return null;
    if (phase === 'strike') {
      const fish = rollFish(rng);
      catches += 1;
      earned += fish.value;
      if (!biggest || fish.value > biggest.value) biggest = fish;
      lastCatch = fish;
      active = false;
      phase = 'idle';
      if (hooks.onCatch) hooks.onCatch(fish);
      renderPanel();
      return fish;
    }
    return null;
  }

  function end(missed) {
    active = false;
    phase = 'idle';
    if (missed && hooks.onMiss) hooks.onMiss();
    renderPanel();
  }

  function update(dt) {
    if (!active) return;
    t += dt;
    if (phase === 'waiting') {
      bobber.position.y = 0.25 + Math.sin(t * 3) * 0.06;
      if (t >= biteAt) {
        phase = 'strike';
        strikeLeft = STRIKE_WINDOW;
        bobber.position.y = 0.05;
        splash.material.opacity = 0.9;
        if (hooks.onBite) hooks.onBite();
      }
    } else if (phase === 'strike') {
      strikeLeft -= dt;
      const s = 1 + (STRIKE_WINDOW - strikeLeft) * 2;
      splash.scale.set(s, s, 1);
      splash.material.opacity = Math.max(0, strikeLeft / STRIKE_WINDOW) * 0.9;
      if (strikeLeft <= 0) end(true);
    }
    renderPanel();
  }

  function nearSpot(x, z) {
    return Math.hypot(x - FISHING_SPOT.x, z - FISHING_SPOT.z) < 5;
  }

  return {
    start, press, update, forceBite, nearSpot,
    get active() { return active; },
    get phase() { return phase; },
    get catches() { return catches; },
    get earned() { return earned; },
    get biggest() { return biggest; },
    get lastCatch() { return lastCatch; },
    get spot() { return FISHING_SPOT; },
  };
}
