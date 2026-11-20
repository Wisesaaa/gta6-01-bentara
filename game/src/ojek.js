// Ojek penumpang: side-hustle seperti taksi, tapi di atas motor.
// Pemain memesan ojek, motor datang ke pemain, penumpang berhelm naik
// membonceng di belakang pengendara, lalu motor mengantarnya sendiri ke
// tujuan. Argo dihitung dari jarak: ongkos dasar + per meter. Kalau
// perjalanan selesai tanpa goresan, penumpang bayar TIP ×2 (total dua
// kali argo); satu goresan saja — tabrakan atau mobil rusak selama
// perjalanan — tipnya hilang, argo tetap dibayar.
//
// Sistem sesi saja: tidak menyentuh save schema, tidak mengubah misi.
// Builder utama yang mengintegrasikan hook-nya (lihat catatan integrasi).
import * as THREE from 'three';
import { Human } from './actors/human.js';
import { pick, rr } from './rng.js';
import { LOCATIONS, TAXI_STANDS, loc } from './city.js';
import { dist, angleLerp, angleDiff, clamp } from './mathx.js';

// Tuning lokal ojek (builder utama boleh memindahkannya ke config.js).
// Argo: Rp 6.000 + Rp 5/m — perjalanan 1,2 km jatuhnya Rp 12.000.
const OJEK = {
  baseFare: 6000,
  perMetre: 5,
  callRadius: 60, // Batal kalau pemain menjauh sejauh ini sebelum naik.
  arriveRadius: 3, // Motor dianggap sampai di titik jemput/tujuan.
  pickupRadius: 2.5,
  boardRadius: 1.4, // Penumpang dianggap sampai di motor.
  comeSpeed: 14, // Motor menuju titik jemput.
  rideSpeed: 12, // Motor mengantar penumpang ke tujuan.
  walkSpeed: 2.2, // Penumpang jalan kaki ke motor.
  beaconColor: 0x37d67a, // Hijau ojek — beda dari teal taksi.
};

const PASSENGER_NAMES = ['Bu Lastri', 'Pak Dul', 'Mbak Tini', 'Bang Udin', 'Neng Lilis', 'Pak Slamet'];

export function formatRp(n) {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

export function formatKm(metres) {
  return `${(metres / 1000).toFixed(1).replace('.', ',')} km`;
}

export function createOjek(scene, city, rng, hooks = {}) {
  let phase = 'idle'; // idle | coming | boarding | riding
  let staged = false; // true while a stageRide screenshot ride runs: the
  // player is not the caller (he is driving past in a car), so the
  // "player walked away" distance cancel must not fire.
  let passenger = null; // { human, name, stand, x, z }
  let destination = null; // { x, z, label }
  let pickup = null; // { x, z, label }
  let fare = 0;
  let distance = 0;
  let tip = 0;
  let scratched = false;
  let carHealthAtRideStart = null;
  let trips = 0;
  let earned = 0;
  let boardTimer = 0;

  // --- Motor: roda dua kecil, pengendara + penumpang berhelm. ---
  const bike = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f7a4d, roughness: 0.5, metalness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x23211e, roughness: 0.7 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.3, metalness: 0.8 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });

  const wheels = [];
  for (const z of [0.78, -0.78]) {
    const geo = new THREE.TorusGeometry(0.32, 0.09, 10, 18);
    geo.rotateY(Math.PI / 2); // Sumbu roda = sumbu x motor, jadi bisa diputar.
    const wheel = new THREE.Mesh(geo, tireMat);
    wheel.position.set(0, 0.32, z);
    bike.add(wheel);
    wheels.push(wheel);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 1.5), bodyMat);
  frame.position.set(0, 0.6, 0);
  bike.add(frame);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.45), bodyMat);
  tank.position.set(0, 0.74, 0.35);
  bike.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.75), darkMat);
  seat.position.set(0, 0.74, -0.3);
  bike.add(seat);
  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 8), chromeMat);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 0.98, 0.72);
  bike.add(handlebar);
  const headlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  headlight.position.set(0, 0.68, 0.86);
  bike.add(headlight);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: 0xf5eeda }));
  plate.position.set(0, 0.55, -0.86);
  bike.add(plate);

  // Sosok duduk: badan + kepala + helm. Dipakai dua kali — pengendara
  // (jaket hijau, helm kuning) dan penumpang (baju lain, helm merah).
  function makeRider(jacketColor, helmetColor, z) {
    const g = new THREE.Group();
    const jacket = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc89b6d, roughness: 0.8 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.26), jacket);
    torso.position.set(0, 1.12, z);
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin);
    head.position.set(0, 1.5, z);
    g.add(head);
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.35 }),
    );
    helmet.position.set(0, 1.54, z);
    g.add(helmet);
    // Lengan ke setang (pengendara) / ke pinggang pengendara (penumpang).
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.5), jacket);
      arm.position.set(side * 0.22, 1.22, z + 0.3);
      arm.rotation.x = 0.5;
      g.add(arm);
    }
    // Kaki turun ke pijakan samping.
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.11), darkMat);
      leg.position.set(side * 0.2, 0.62, z - 0.05);
      g.add(leg);
    }
    return g;
  }

  const driver = makeRider(0x1f7a4d, 0xd8a13a, 0.18);
  bike.add(driver);
  const pillion = makeRider(0x8a4a6b, 0xc0392b, -0.48);
  pillion.visible = false; // Baru kelihatan setelah penumpang naik.
  bike.add(pillion);

  bike.visible = false;
  bike.position.set(0, 0, 0);
  scene.add(bike);

  // Beacon hijau di atas titik jemput / tujuan — sama idenya dengan
  // beacon taksi, warnanya saja beda supaya tidak tertukar.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 20, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: OJEK.beaconColor, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.y = 10;
  beacon.visible = false;
  scene.add(beacon);

  let heading = 0;
  let speed = 0;

  function resolvePoint(point) {
    if (typeof point === 'string') {
      const L = loc(point);
      return { x: L.x, z: L.z, label: L.label };
    }
    return { x: point.x, z: point.z, label: point.label || 'Tujuan' };
  }

  // Panggil ojek: motor datang ke pemain, penumpang menunggu di titik
  // jemput. `pickup`/`dest` boleh berupa nama lokasi ('marina') atau
  // { x, z, label }. Tanpa argumen: jemput di posisi pemain, tujuan acak.
  function startOjek(pickupArg, destArg) {
    if (phase !== 'idle') return false;
    pickup = pickupArg ? resolvePoint(pickupArg) : { x: 0, z: 0, label: 'Posisimu' };
    const destKey = destArg
      ? null
      : pick(rng, TAXI_STANDS.filter((s) => dist(pickup.x, pickup.z, LOCATIONS[s].x, LOCATIONS[s].z) > 60));
    destination = destArg ? resolvePoint(destArg) : resolvePoint(destKey);
    distance = dist(pickup.x, pickup.z, destination.x, destination.z);
    fare = Math.round((OJEK.baseFare + distance * OJEK.perMetre) / 500) * 500;
    tip = fare; // TIP ×2 selama belum ada goresan.
    scratched = false;
    carHealthAtRideStart = null;

    // Penumpang menunggu di titik jemput — Human yang sama seperti taksi.
    const h = new Human(scene, rng, 'taxi');
    h.setPos(pickup.x + rr(rng, -3, 3), pickup.z + rr(rng, -3, 3));
    h.face(rr(rng, 0, Math.PI * 2));
    passenger = { human: h, name: pick(rng, PASSENGER_NAMES), x: h.x, z: h.z };

    // Motor muncul di jalan agak jauh, lalu meluncur ke titik jemput.
    const bx = pickup.x + rr(rng, -40, 40);
    const bz = pickup.z + rr(rng, -40, 40);
    bike.position.set(bx, 0, bz);
    heading = Math.atan2(pickup.x - bx, pickup.z - bz);
    bike.rotation.y = heading;
    bike.visible = true;
    speed = 0;
    phase = 'coming';
    beacon.position.set(pickup.x, 10, pickup.z);
    beacon.visible = true;
    if (hooks.onCalled) hooks.onCalled(passenger, destination, fare);
    return true;
  }

  // Jalan pintas: pesan ojek dari posisi pemain sekarang.
  function callOjek(px, pz) {
    return startOjek({ x: px, z: pz, label: 'Posisimu' });
  }

  function markScratched(reason) {
    if (scratched || phase === 'idle') return;
    // A staged screenshot ride is a display, not a real call: the chase
    // ramming the player's car must not kill the showcase TIP ×2 meter.
    if (staged) return;
    scratched = true;
    tip = 0; // Tip hilang — argo tetap dibayar saat sampai.
    if (hooks.onScratched) hooks.onScratched(reason);
  }

  // Dipanggil game.js dari kode tabrakan / kerusakan mobil: satu goresan
  // selama perjalanan cukup untuk menghilangkan tip.
  function reportScratch(reason = 'tabrakan') {
    markScratched(reason);
  }

  function finishRide() {
    const paid = fare + tip;
    trips += 1;
    earned += paid;
    const done = {
      name: passenger ? passenger.name : 'Penumpang',
      paid,
      fare,
      tip,
      distance: Math.round(distance),
      destination: destination ? destination.label : '',
    };
    passenger = null;
    destination = null;
    pickup = null;
    fare = 0;
    distance = 0;
    tip = 0;
    scratched = false;
    carHealthAtRideStart = null;
    pillion.visible = false;
    bike.visible = false;
    beacon.visible = false;
    phase = 'idle';
    staged = false;
    if (hooks.onFarePaid) hooks.onFarePaid(done);
    return done;
  }

  function cancelRide(reason) {
    if (passenger && passenger.human) passenger.human.dispose(scene);
    passenger = null;
    destination = null;
    pickup = null;
    fare = 0;
    distance = 0;
    tip = 0;
    scratched = false;
    carHealthAtRideStart = null;
    pillion.visible = false;
    bike.visible = false;
    beacon.visible = false;
    phase = 'idle';
    staged = false;
    if (hooks.onCancelled) hooks.onCancelled(reason);
  }

  // Kemudikan motor menuju target (x, z). Mengembalikan true kalau sampai.
  function driveToward(tx, tz, targetSpeed, dt) {
    const dx = tx - bike.position.x;
    const dz = tz - bike.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < OJEK.arriveRadius) {
      speed = 0;
      return true;
    }
    const targetHeading = Math.atan2(dx, dz);
    const turn = angleDiff(heading, targetHeading);
    heading = angleLerp(heading, targetHeading, Math.min(1, 3.2 * dt));
    speed += (targetSpeed - speed) * Math.min(1, 2 * dt);
    bike.position.x += Math.sin(heading) * speed * dt;
    bike.position.z += Math.cos(heading) * speed * dt;
    bike.rotation.y = heading;
    // Miring ke arah belokan — ciri khas roda dua.
    bike.rotation.z = clamp(-turn * 0.9, -0.35, 0.35);
    for (const w of wheels) w.rotation.x += (speed * dt) / 0.32;
    return false;
  }

  function update(dt, ctx = {}) {
    const { px = 0, pz = 0, playerCarHealth, scratched: ctxScratched } = ctx;
    if (phase === 'idle') return;

    // Goresan terdeteksi dari luar (flag ctx) atau dari turunnya health
    // mobil pemain selama perjalanan.
    if (ctxScratched) markScratched('tabrakan');
    if (playerCarHealth !== undefined && playerCarHealth !== null) {
      if (carHealthAtRideStart === null) carHealthAtRideStart = playerCarHealth;
      else if (playerCarHealth < carHealthAtRideStart) markScratched('mobil rusak');
    }

    if (phase === 'coming') {
      if (!staged && dist(px, pz, pickup.x, pickup.z) > OJEK.callRadius) {
        cancelRide('pemain menjauh');
        return;
      }
      if (driveToward(pickup.x, pickup.z, OJEK.comeSpeed, dt)) {
        phase = 'boarding';
        boardTimer = 0;
        if (hooks.onArrived) hooks.onArrived(passenger, pickup);
      }
      return;
    }

    if (phase === 'boarding') {
      if (!staged && dist(px, pz, pickup.x, pickup.z) > OJEK.callRadius) {
        cancelRide('pemain menjauh');
        return;
      }
      // Penumpang jalan kaki ke motor, lalu naik membonceng.
      boardTimer += dt;
      if (passenger && passenger.human && passenger.human.alive) {
        const h = passenger.human;
        const d = dist(h.x, h.z, bike.position.x, bike.position.z);
        if (d > OJEK.boardRadius) {
          const step = (OJEK.walkSpeed * dt) / d;
          h.setPos(h.x + (bike.position.x - h.x) * step, h.z + (bike.position.z - h.z) * step);
          h.face(Math.atan2(bike.position.x - h.x, bike.position.z - h.z));
        } else {
          passenger.human.dispose(scene);
          passenger = { ...passenger, riding: true };
          pillion.visible = true;
          phase = 'riding';
          beacon.position.set(destination.x, 10, destination.z);
          if (hooks.onBoarded) hooks.onBoarded(passenger, destination);
        }
      } else if (boardTimer > 10) {
        cancelRide('penumpang tidak naik');
      }
      return;
    }

    // riding: motor mengantar sendiri ke tujuan; sampai = argo dibayar.
    if (destination && driveToward(destination.x, destination.z, OJEK.rideSpeed, dt)) {
      finishRide();
    }
  }

  function prompt() {
    if (phase === 'idle') return 'E — Panggil ojek (Rp 6.000 + Rp 5/m)';
    if (phase === 'coming') return 'Ojek meluncur ke kamu…';
    if (phase === 'boarding') return `${passenger ? passenger.name : 'Penumpang'} naik ke motor…`;
    if (phase === 'riding') return meterText();
    return null;
  }

  // Teks argo buat HUD, di dekat speedo: ongkos, jarak, dan status tip.
  function meterText() {
    if (phase === 'idle') return '';
    const base = `OJEK · ${formatRp(fare)} · ${formatKm(distance)}`;
    if (phase === 'riding' || phase === 'boarding') {
      // Short: the pickup toast already states the condition
      // ("Tanpa goresan = TIP ×2") — the meter carries fare + distance
      // + TIP on one line instead of wrapping mid-word.
      return scratched ? `${base} · TIP hilang — ada goresan` : `${base} · TIP ×2`;
    }
    return `${base} · motor meluncur…`;
  }

  function nearPickup(px, pz) {
    if (phase !== 'coming' && phase !== 'boarding') return false;
    return pickup && dist(px, pz, pickup.x, pickup.z) < OJEK.pickupRadius;
  }

  // Staging buat screenshot: paksa satu perjalanan dari stand bernama ke
  // tujuan bernama. Penumpang dan motornya nyata — sama seperti flow asli,
  // hanya titiknya yang dipilih.
  function stageRide(standKey, destKey) {
    if (phase !== 'idle') cancelRide('staging');
    staged = true;
    startOjek(standKey, destKey);
    return passenger;
  }

  // Pindahkan motor (dan beacon jemput) ke titik persis — buat screenshot
  // menaruh ojek di dalam frame tanpa memalsukan argo.
  function moveBike(x, z) {
    if (phase === 'idle') return false;
    bike.position.set(x, 0, z);
    if (phase === 'coming' && pickup) beacon.position.set(pickup.x, 10, pickup.z);
    return true;
  }

  // Snapshot state buat HUD / game.js — bentuk yang diminta builder utama.
  function getState() {
    return {
      active: phase !== 'idle',
      phase,
      fare,
      distance: Math.round(distance),
      tip,
      passenger: passenger ? { name: passenger.name, riding: !!passenger.riding } : null,
      destination: destination ? destination.label : null,
      total: fare + tip,
      scratched,
      trips,
      earned,
    };
  }

  return {
    update,
    updateOjek: update,
    startOjek,
    callOjek,
    cancel: cancelRide,
    reportScratch,
    prompt,
    meterText,
    nearPickup,
    stageRide,
    moveBike,
    getState,
    get state() { return phase; },
    get phase() { return phase; },
    get passenger() { return passenger; },
    get destination() { return destination; },
    get pickup() { return pickup; },
    get fare() { return fare; },
    get distance() { return Math.round(distance); },
    get tip() { return tip; },
    get total() { return fare + tip; },
    get scratched() { return scratched; },
    get trips() { return trips; },
    get earned() { return earned; },
    get bike() { return bike; },
    get beacon() { return beacon; },
  };
}
