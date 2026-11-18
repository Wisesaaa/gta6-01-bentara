// Missions: 8 jobs in 3 acts, driven by named locations (never raw coordinates).
// Steps: goto / talk / collect / deliver / survive (spawns attackers) / destroy
// (a marked car) / steal (enter a marked car). A gold beacon marks the current
// objective. Completing a mission settles the damage bill against cash first,
// then pays the reward and REP.
import * as THREE from 'three';
import { Human } from './actors/human.js';
import { Car } from './actors/car.js';
import { loc } from './city.js';
import { rr } from './rng.js';
import { dist } from './mathx.js';

export const MISSIONS = [
  { act: 'ACT 1 — KENALAN', title: 'JUMPA DI MARINA', reward: 150, rep: 100,
    steps: [
      { type: 'goto', loc: 'marina' },
      { type: 'talk', loc: 'marina', who: 'PAK WIRA', line: 'Selamat datang di Bentara. Musim kemarau ini, kota ini milik yang berani.' },
    ],
    next: 'Antar paket ke Kios Baris Utara', doneLine: 'Pak Wira: Kerja bagus. Ada paket buat diantar — jangan sampai telat.' },
  { act: 'ACT 1 — KENALAN', title: 'ANTAR PAKET', reward: 200, rep: 150,
    steps: [
      { type: 'goto', loc: 'northRowStall' },
      { type: 'survive', loc: 'northRowStall', n: 3, t: 20 },
      { type: 'deliver', loc: 'arterialJunction' },
    ],
    next: 'Ambil alih Kawasan Industri', doneLine: 'Pak Wira: Paket sampai. Mereka mulai memperhatikanmu.' },
  { act: 'ACT 1 — KENALAN', title: 'RAMPOKAN KECIL', reward: 300, rep: 200,
    steps: [
      { type: 'goto', loc: 'industrialYard' },
      { type: 'destroy', loc: 'industrialYard' },
      { type: 'deliver', loc: 'eastSafehouse' },
    ],
    next: 'Paket Ruko — temui Sari', doneLine: 'Sari: Mobil itu sudah tidak akan mengganggu siapa-siapa lagi.' },
  { act: 'ACT 2 — NAIK DAUN', title: 'PAKET RUKO', reward: 350, rep: 250,
    steps: [
      { type: 'collect', loc: 'shophouseRow' },
      { type: 'deliver', loc: 'towerConcourse' },
    ],
    next: 'Pertahankan Plaza Menara', doneLine: 'Dedi: Ruko aman. Plaza butuh orang yang bisa dipegang.' },
  { act: 'ACT 2 — NAIK DAUN', title: 'PERTAHANKAN PLAZA', reward: 400, rep: 300,
    steps: [
      { type: 'goto', loc: 'towerConcourse' },
      { type: 'survive', loc: 'towerConcourse', n: 4, t: 25 },
      { type: 'deliver', loc: 'hospital' },
    ],
    next: 'Jemputan darurat di Rumah Sakit', doneLine: 'Pak Wira: Plaza tetap berdiri karena kamu. Istirahat sebentar.' },
  { act: 'ACT 2 — NAIK DAUN', title: 'JEMPUTAN DARURAT', reward: 450, rep: 300,
    steps: [
      { type: 'goto', loc: 'hospital' },
      { type: 'survive', loc: 'hospital', n: 3, t: 20 },
      { type: 'deliver', loc: 'eastSafehouse' },
    ],
    next: 'Curi mobil di Kawasan Industri', doneLine: 'Sari: Kamu selamat. Safehouse Timur sudah siap.' },
  { act: 'ACT 3 — MUSIM KERING', title: 'CURI MOBIL', reward: 600, rep: 400,
    steps: [
      { type: 'goto', loc: 'industrialYard' },
      { type: 'steal', loc: 'industrialYard' },
      { type: 'deliver', loc: 'marina' },
    ],
    next: 'Panas Terakhir di Plaza Menara', doneLine: 'Dedi: Mobil curian itu mulus. Satu kerjaan terakhir.' },
  { act: 'ACT 3 — MUSIM KERING', title: 'PANAS TERAKHIR', reward: 1000, rep: 600,
    steps: [
      { type: 'goto', loc: 'towerConcourse' },
      { type: 'survive', loc: 'towerConcourse', n: 5, t: 30 },
      { type: 'deliver', loc: 'marina' },
    ],
    next: 'Bentara milikmu — tamat', doneLine: 'Pak Wira: Musim kemarau selesai. Bentara sekarang mengenal namamu.' },
];

const STEP_TEXT = {
  goto: (s) => `Pergi ke ${loc(s.loc).label}.`,
  talk: (s) => `Bicara dengan ${s.who} di ${loc(s.loc).label} (E).`,
  collect: (s) => `Ambil paket di ${loc(s.loc).label}.`,
  deliver: (s) => `Antar ke ${loc(s.loc).label}.`,
  survive: (s) => `Tahan ${loc(s.loc).label} — jangan tumbang!`,
  destroy: (s) => `Hancurkan mobil target di ${loc(s.loc).label}.`,
  steal: (s) => `Curi mobil bertanda di ${loc(s.loc).label} (F).`,
};

export function createMissions(scene, city, rng, hooks) {
  // hooks: { onMissionComplete(m), onTalk(line, who), onSpawnAttacker(h), onTargetCar(car) }
  let index = 0;
  let stepIndex = 0;
  let stepState = null;
  let attackers = [];
  let targetCar = null;
  let done = false;

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 25, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.y = 12.5;
  scene.add(beacon);

  function current() { return MISSIONS[Math.min(index, MISSIONS.length - 1)]; }
  function step() { return current().steps[stepIndex]; }
  function objectiveText() {
    if (done) return 'Semua misi selesai — Bentara milikmu.';
    return STEP_TEXT[step().type](step());
  }
  function stageText() {
    if (done) return `${MISSIONS.length}/${MISSIONS.length}`;
    return `${stepIndex + 1}/${current().steps.length}`;
  }
  function stageFrac() {
    if (done) return 1;
    return (stepIndex + (stepState?.progress || 0)) / current().steps.length;
  }
  function nextText() {
    if (done) return 'Tamat — kelilingi kota sesukamu.';
    return `NEXT: ${current().next}`;
  }

  function clearStepObjects() {
    for (const a of attackers) a.dispose(scene);
    attackers = [];
    if (targetCar) { targetCar.dispose(); targetCar = null; }
    stepState = null;
  }

  function setupStep() {
    clearStepObjects();
    const s = step();
    const L = loc(s.loc);
    beacon.position.set(L.x, 12.5, L.z);
    if (s.type === 'survive') {
      stepState = { spawned: 0, timer: s.t, spawnTimer: 0.5, progress: 0 };
    } else if (s.type === 'destroy' || s.type === 'steal') {
      targetCar = new Car(scene, rng, {
        x: L.x + 6, z: L.z + 4, heading: 0.8,
        name: s.type === 'steal' ? 'KIDANG GT CURIAN' : 'Mobil Target',
        color: s.type === 'steal' ? 0xd8cdb2 : 0x6b1f1f,
      });
      targetCar.missionTarget = s.type;
      if (hooks.onTargetCar) hooks.onTargetCar(targetCar);
    }
  }

  function spawnAttacker() {
    const s = step();
    const L = loc(s.loc);
    const a = new Human(scene, rng, 'attacker');
    const ang = rr(rng, 0, Math.PI * 2);
    a.setPos(L.x + Math.sin(ang) * 18, L.z + Math.cos(ang) * 18);
    attackers.push(a);
    if (hooks.onSpawnAttacker) hooks.onSpawnAttacker(a);
    return a;
  }

  function advance() {
    stepIndex += 1;
    if (stepIndex >= current().steps.length) {
      const m = current();
      clearStepObjects();
      beacon.visible = false;
      if (hooks.onMissionComplete) hooks.onMissionComplete(m);
      index += 1;
      stepIndex = 0;
      if (index >= MISSIONS.length) { done = true; return; }
      beacon.visible = true;
      setupStep();
    } else {
      setupStep();
    }
  }

  // Returns true when the player is close enough to the current objective to talk.
  function nearTalkTarget(px, pz) {
    const s = step();
    if (s.type !== 'talk') return null;
    const L = loc(s.loc);
    return dist(px, pz, L.x, L.z) < 5 ? s : null;
  }

  function update(dt, ctx) {
    if (done) return;
    const s = step();
    const L = loc(s.loc);
    const px = ctx.px;
    const pz = ctx.pz;
    if (s.type === 'goto' || s.type === 'collect' || s.type === 'deliver') {
      const r = s.type === 'collect' ? 4 : L.r;
      stepState = { progress: Math.min(1, 1 - dist(px, pz, L.x, L.z) / 120) };
      if (dist(px, pz, L.x, L.z) < r) advance();
    } else if (s.type === 'talk') {
      if (ctx.interactPressed && dist(px, pz, L.x, L.z) < 5) {
        if (hooks.onTalk) hooks.onTalk(s.line, s.who);
        advance();
      }
    } else if (s.type === 'survive') {
      stepState.timer -= dt;
      stepState.spawnTimer -= dt;
      if (stepState.spawned < s.n && stepState.spawnTimer <= 0) {
        spawnAttacker();
        stepState.spawned += 1;
        stepState.spawnTimer = Math.max(1.5, s.t / s.n);
      }
      stepState.progress = 1 - Math.max(0, stepState.timer) / s.t;
      // Attackers chase and shoot the player.
      for (const a of attackers) {
        if (!a.alive) continue;
        const d = dist(a.x, a.z, px, pz);
        a.face(Math.atan2(px - a.x, pz - a.z));
        if (d > 4) a.walk(dt, 4.6);
        else if (ctx.damagePlayer && rr(rng, 0, 1) < dt * 0.5) ctx.damagePlayer(rr(rng, 2, 5));
      }
      if (stepState.timer <= 0) advance();
    } else if (s.type === 'destroy') {
      if (targetCar && targetCar.health <= 0) advance();
    } else if (s.type === 'steal') {
      if (ctx.playerCar && ctx.playerCar.missionTarget === 'steal') advance();
    }
  }

  function start() {
    index = 0;
    stepIndex = 0;
    done = false;
    beacon.visible = true;
    setupStep();
  }

  function setIndex(i, stepIdx = 0) {
    index = Math.min(i, MISSIONS.length - 1);
    stepIndex = Math.min(stepIdx, current().steps.length - 1);
    done = index >= MISSIONS.length;
    beacon.visible = !done;
    setupStep();
  }

  start();
  return {
    current, step, objectiveText, stageText, stageFrac, nextText,
    update, nearTalkTarget, start, setIndex,
    get index() { return index; },
    get stepIndex() { return stepIndex; },
    get done() { return done; },
    get attackers() { return attackers; },
    get targetCar() { return targetCar; },
  };
}
