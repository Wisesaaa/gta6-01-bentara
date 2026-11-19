// Missions: 8 jobs in 3 acts, driven by named locations (never raw coordinates).
// Steps: goto / talk / collect / deliver / survive (spawns attackers) / destroy
// (a marked car) / steal (enter a marked car). A gold beacon marks the current
// objective. Completing a mission settles the damage bill against cash first,
// then pays the reward and REP.
//
// Each step type has one handler in the STEP_HANDLERS table — update() is a
// dispatch, not a chain of ifs — and each mission opens with an intro line
// from its contact (hooks.onIntro), so the story has a voice, not just text.
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
  // hooks: { onMissionComplete(m), onTalk(line, who), onSpawnAttacker(h),
  //   onTargetCar(car), onIntro(missionIndex) }
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

  // One handler per step type: setup (spawn what the step needs) and
  // tick (check the win condition). update() only dispatches.
  const STEP_HANDLERS = {
    goto: {
      setup() {},
      tick(s, L, ctx) {
        stepState = { progress: Math.min(1, 1 - dist(ctx.px, ctx.pz, L.x, L.z) / 120) };
        if (dist(ctx.px, ctx.pz, L.x, L.z) < L.r) advance();
      },
    },
    collect: {
      setup() {},
      tick(s, L, ctx) {
        stepState = { progress: Math.min(1, 1 - dist(ctx.px, ctx.pz, L.x, L.z) / 120) };
        if (dist(ctx.px, ctx.pz, L.x, L.z) < 4) advance();
      },
    },
    deliver: {
      setup() {},
      tick(s, L, ctx) {
        stepState = { progress: Math.min(1, 1 - dist(ctx.px, ctx.pz, L.x, L.z) / 120) };
        if (dist(ctx.px, ctx.pz, L.x, L.z) < L.r) advance();
      },
    },
    talk: {
      setup() {},
      tick(s, L, ctx) {
        if (ctx.interactPressed && dist(ctx.px, ctx.pz, L.x, L.z) < 5) {
          if (hooks.onTalk) hooks.onTalk(s.line, s.who);
          advance();
        }
      },
    },
    survive: {
      setup(s) { stepState = { spawned: 0, timer: s.t, spawnTimer: 0.5, progress: 0 }; },
      tick(s, L, ctx) {
        stepState.timer -= ctx.dt;
        stepState.spawnTimer -= ctx.dt;
        if (stepState.spawned < s.n && stepState.spawnTimer <= 0) {
          spawnAttacker();
          stepState.spawned += 1;
          stepState.spawnTimer = Math.max(1.5, s.t / s.n);
        }
        stepState.progress = 1 - Math.max(0, stepState.timer) / s.t;
        // Attackers chase and shoot the player.
        for (const a of attackers) {
          if (!a.alive) continue;
          const d = dist(a.x, a.z, ctx.px, ctx.pz);
          a.face(Math.atan2(ctx.px - a.x, ctx.pz - a.z));
          if (d > 4) a.walk(ctx.dt, 4.6);
          else if (ctx.damagePlayer && rr(rng, 0, 1) < ctx.dt * 0.5) ctx.damagePlayer(rr(rng, 2, 5));
          // Return fire: a tracer back at the player every ~2 s inside
          // 45 m — the firefight reads, and the hook owns the hit roll.
          a.shootTimer = (a.shootTimer === undefined ? rr(rng, 0.5, 1.5) : a.shootTimer) - ctx.dt;
          if (a.shootTimer <= 0 && d < 45) {
            a.shootTimer = rr(rng, 1.2, 2.2);
            if (hooks.onAttackerShoot) hooks.onAttackerShoot(a);
          }
        }
        if (stepState.timer <= 0) advance();
      },
    },
    destroy: {
      setup(s, L) {
        targetCar = new Car(scene, rng, {
          x: L.x + 6, z: L.z + 4, heading: 0.8,
          name: 'Mobil Target', color: 0x6b1f1f,
        });
        targetCar.missionTarget = 'destroy';
        if (hooks.onTargetCar) hooks.onTargetCar(targetCar);
      },
      tick() { if (targetCar && targetCar.health <= 0) advance(); },
    },
    steal: {
      setup(s, L) {
        targetCar = new Car(scene, rng, {
          x: L.x + 6, z: L.z + 4, heading: 0.8,
          name: 'CEMPAKA GT CURIAN', color: 0xd8cdb2,
        });
        targetCar.missionTarget = 'steal';
        if (hooks.onTargetCar) hooks.onTargetCar(targetCar);
      },
      tick(s, L, ctx) { if (ctx.playerCar && ctx.playerCar.missionTarget === 'steal') advance(); },
    },
  };

  function setupStep() {
    clearStepObjects();
    const s = step();
    const L = loc(s.loc);
    beacon.position.set(L.x, 12.5, L.z);
    STEP_HANDLERS[s.type].setup(s, L);
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

  // Staging helpers for screenshots: put a live attacker — or one already
  // downed, lying where a real kill left him — at an exact spot. The
  // downed one goes through the same damage() path as a combat kill.
  function stageAttacker(x, z) {
    const a = new Human(scene, rng, 'attacker');
    a.setPos(x, z);
    a.face(rr(rng, 0, Math.PI * 2));
    attackers.push(a);
    return a;
  }

  function stageDownedAttacker(x, z) {
    const a = stageAttacker(x, z);
    a.damage(999);
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
      if (hooks.onIntro) hooks.onIntro(index);
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
    STEP_HANDLERS[s.type].tick(s, L, { ...ctx, dt });
  }

  function start() {
    index = 0;
    stepIndex = 0;
    done = false;
    beacon.visible = true;
    setupStep();
    if (hooks.onIntro) hooks.onIntro(0);
  }

  function setIndex(i, stepIdx = 0) {
    index = Math.min(i, MISSIONS.length - 1);
    stepIndex = Math.min(stepIdx, current().steps.length - 1);
    done = i >= MISSIONS.length;
    beacon.visible = !done;
    setupStep();
    if (hooks.onIntro) hooks.onIntro(index);
  }

  start();
  return {
    current, step, objectiveText, stageText, stageFrac, nextText,
    update, nearTalkTarget, start, setIndex, stageAttacker, stageDownedAttacker,
    get index() { return index; },
    get stepIndex() { return stepIndex; },
    get done() { return done; },
    get attackers() { return attackers; },
    get targetCar() { return targetCar; },
  };
}
