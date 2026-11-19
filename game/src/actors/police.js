// Police: cruisers that ram, foot cops that shoot, a helicopter from 4 stars,
// and a roadblock from 3 stars. Counts follow the wanted level; names are
// local wind and bird words, and every live unit reports name, distance and
// status for the response list in the HUD.
//
// The cruisers wear the POLISI livery (white doors, decal, split red/blue
// lightbar — built in actors/car.js). The roadblock is a real barricade:
// two striped barriers plus a spike strip across the lane. The helicopter
// is 60% bigger than before, with a narrow spotlight cone and a bright
// pool of light on the ground under the player — a beam, not a pale wash.
import * as THREE from 'three';
import { Car } from './car.js';
import { Human } from './human.js';
import { HEAT } from '../config.js';
import { pick, rr } from '../rng.js';
import { dist, clamp, wrapAngle } from '../mathx.js';

const CRUISER_NAMES = ['BAYU', 'ANGIN', 'SAMBAR', 'KIJANG', 'ELANG'];
const COP_NAMES = ['MERAK', 'CENDRAWASIH'];
const HELI_NAME = 'GARUDA-1';

function barrierMesh() {
  // Striped barricade: red/white boards on two legs.
  const group = new THREE.Group();
  const boardMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  for (let k = 0; k < 2; k += 1) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 0.12), k === 0 ? boardMat : whiteMat);
    board.position.y = 0.7 + k * 0.45;
    group.add(board);
  }
  for (const sx of [-1.4, 1.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.5), boardMat);
    leg.position.set(sx, 0.6, 0);
    group.add(leg);
  }
  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return group;
}

function spikeStripMesh() {
  // A dark strip with steel teeth across the lane.
  const group = new THREE.Group();
  const strip = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.8), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  strip.position.y = 0.05;
  group.add(strip);
  const spikeMat = new THREE.MeshLambertMaterial({ color: 0x8a8a80 });
  for (let k = 0; k < 7; k += 1) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 4), spikeMat);
    spike.position.set(-1.5 + k * 0.5, 0.25, 0);
    group.add(spike);
  }
  return group;
}

export function createPolice(scene, city, rng) {
  const cruisers = [];
  const cops = [];
  let heli = null;
  let roadblock = null;
  let roadblockProps = [];
  let roadblockBeacons = [];
  let shootTimer = 0;
  let dispatchTimer = 0;
  let lastSeen = { x: 0, z: 0 };
  let heliSearchPhase = 0;
  let heliPrevX = 0;
  let heliPrevZ = 0;

  // "ZONA PENCARIAN" — the ring on the ground where police last saw the
  // player. It only shows while the player is out of sight with heat on
  // the board, and it grows as the search drags on.
  const searchRing = new THREE.Mesh(
    new THREE.RingGeometry(9.4, 10, 48),
    new THREE.MeshBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }),
  );
  searchRing.rotation.x = -Math.PI / 2;
  searchRing.position.y = 0.09;
  searchRing.visible = false;
  scene.add(searchRing);

  function spawnCruiser(name) {
    const car = new Car(scene, rng, { isCop: true, name, x: rr(rng, -60, 60), z: rr(rng, -60, 60) });
    car.unitName = name;
    car.status = 'PURSUIT';
    cruisers.push(car);
    return car;
  }

  function spawnCop(name) {
    const h = new Human(scene, rng, 'cop');
    h.unitName = name;
    h.status = 'PURSUIT';
    h.setPos(rr(rng, -40, 40), rr(rng, -40, 40));
    cops.push(h);
    return h;
  }

  function spawnHeli() {
    const group = new THREE.Group();
    const S = 1.6; // 60% bigger than the old helicopter, so it reads from the chase camera.
    // Pale blue-grey body with a white cheatline and a light glass nose, so
    // the machine reads against the sky instead of melting into one dark blob.
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a5a6e });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.3, 4.6), bodyMat);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.06, 0.28, 3.6), new THREE.MeshLambertMaterial({ color: 0xe8e4da }));
    stripe.position.y = 0.18;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.9), new THREE.MeshLambertMaterial({ color: 0x7fa3b5 }));
    nose.position.set(0, 0.1, 2.3);
    // Tail boom, fin and tail rotor: the silhouette that says "helicopter".
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.6), bodyMat);
    boom.position.set(0, 0.15, -4.0);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 0.9), bodyMat);
    fin.position.set(0, 0.6, -5.6);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.28), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    tailRotor.position.set(0.32, 0.5, -5.7);
    // Main rotor: two blades over a translucent disc, the classic blurred
    // rotor read from below, plus a short mast.
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 8), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    mast.position.y = 0.95;
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    rotor.position.y = 1.3;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 24),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 1.32;
    // Skids: two rails on short struts, standing the body off the air.
    const skidMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.6), skidMat);
    skidL.position.set(-1.15, -1.05, 0.2);
    const skidR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.6), skidMat);
    skidR.position.set(1.15, -1.05, 0.2);
    for (const sx of [-1.15, 1.15]) {
      for (const sz of [-0.9, 1.1]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), skidMat);
        strut.position.set(sx, -0.8, sz);
        group.add(strut);
      }
    }
    // Belly strobe: a red lamp with a soft glow halo, blinking on a
    // deterministic timer so the shot stays reproducible.
    const strobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
    );
    strobe.position.set(0, -0.85, 1.6);
    const strobeGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    strobeGlow.position.copy(strobe.position);
    // Spotlight: a NARROW cone (radius 1.7, not the old 4.0 wash) hung
    // under the nose, plus a bright pool of light on the ground where it
    // lands. The beam reads as a searchlight, not a pale fog.
    const spot = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    );
    spot.position.set(0, -15, 1.6);
    spot.rotation.x = Math.PI;
    // A real light source inside the cone so the player and the road under
    // the beam actually brighten.
    const spotLight = new THREE.SpotLight(0xffe9a8, 60, 60, 0.16, 0.45, 1.2);
    spotLight.position.set(0, -1, 1.6);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, -30, 1.6);
    spotLight.target = spotTarget;
    group.add(body, stripe, nose, boom, fin, tailRotor, mast, rotor, disc, skidL, skidR, strobe, strobeGlow, spot, spotLight, spotTarget);
    group.scale.setScalar(S);
    group.position.set(0, 34, 0);
    scene.add(group);
    // The ground pool: a bright disc that follows the player under the beam.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.08;
    scene.add(pool);
    heli = { group, rotor, tailRotor, strobe, strobeGlow, spot, spotLight, pool, unitName: HELI_NAME, status: 'SPOTLIGHT' };
    return heli;
  }

  function spawnRoadblock(px, pz, heading) {
    const ahead = 46;
    const bx = px + Math.sin(heading) * ahead;
    const bz = pz + Math.cos(heading) * ahead;
    const car = new Car(scene, rng, { isCop: true, name: 'BLOKADE', x: bx, z: bz, heading: heading + Math.PI / 2 });
    car.unitName = 'BLOKADE';
    car.status = 'ROADBLOCK';
    car.speed = 0;
    roadblock = car;
    // Barriers on both flanks of the cruiser, spike strips in front of it.
    const sideX = Math.cos(heading);
    const sideZ = -Math.sin(heading);
    const props = [];
    for (const s of [-6, 6]) {
      const barrier = barrierMesh();
      barrier.position.set(bx + sideX * s, 0, bz + sideZ * s);
      barrier.rotation.y = heading + Math.PI / 2;
      scene.add(barrier);
      props.push(barrier);
    }
    for (const s of [-3, 3]) {
      const strip = spikeStripMesh();
      strip.position.set(bx + Math.sin(heading) * 4 + sideX * s, 0, bz + Math.cos(heading) * 4 + sideZ * s);
      strip.rotation.y = heading + Math.PI / 2;
      scene.add(strip);
      props.push(strip);
    }
    // Blinking beacons on the barriers: the roadblock reads from 60 m.
    roadblockBeacons = [];
    for (const s of [-6, 6]) {
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
      );
      beacon.position.set(bx + sideX * s, 1.5, bz + sideZ * s);
      scene.add(beacon);
      roadblockBeacons.push(beacon);
      props.push(beacon);
    }
    roadblockProps = props;
    return car;
  }

  function clearRoadblockProps() {
    for (const p of roadblockProps) scene.remove(p);
    roadblockProps = [];
    roadblockBeacons = [];
  }

  function despawnAll() {
    for (const c of cruisers) c.dispose();
    for (const c of cops) c.dispose(scene);
    if (heli) { scene.remove(heli.group); scene.remove(heli.pool); heli = null; }
    if (roadblock) { roadblock.dispose(); roadblock = null; }
    clearRoadblockProps();
    cruisers.length = 0;
    cops.length = 0;
  }

  // The player stole a cruiser: pull it out of the pursuit so the police
  // stop driving a car the player now owns. matchStrength will spawn a
  // fresh unit if the heat still demands one.
  function stealCruiser(car) {
    const i = cruisers.indexOf(car);
    if (i >= 0) cruisers.splice(i, 1);
  }

  // Desired strength from the wanted level; spawn or trim to match.
  function matchStrength(heat, px, pz, heading) {
    const wantCruisers = heat >= 1 ? Math.min(Math.floor(heat), HEAT.cruiserCap) : 0;
    while (cruisers.length < wantCruisers) spawnCruiser(CRUISER_NAMES[cruisers.length % CRUISER_NAMES.length]);
    while (cruisers.length > wantCruisers) cruisers.pop().dispose();
    const wantCops = heat >= HEAT.footCopFrom ? 2 : 0;
    while (cops.length < wantCops) spawnCop(COP_NAMES[cops.length % COP_NAMES.length]);
    while (cops.length > wantCops) cops.pop().dispose(scene);
    if (heat >= HEAT.heliFrom && !heli) spawnHeli();
    if (heat < HEAT.heliFrom && heli) { scene.remove(heli.group); scene.remove(heli.pool); heli = null; }
    if (heat >= 3 && !roadblock) spawnRoadblock(px, pz, heading);
    if (heat < 3 && roadblock) { roadblock.dispose(); roadblock = null; clearRoadblockProps(); }
  }

  const DISPATCH_LINES = [
    'POLISI: Semua unit — kejar sedan merah di Kawasan Industri!',
    'POLISI: Tersangka menuju Plaza Menara. Tutup semua jalan keluar!',
    'POLISI: Jangan biarkan dia sampai ke Marina. Ulangi: Marina!',
    'POLISI: Unit BAYU, potong dari utara. Unit ANGIN, dari selatan!',
    'POLISI: Dia cepat, tapi kota ini kecil. Terus kejar!',
  ];

  function step(dt, ctx) {
    const { px, pz, heading, playerInCar, heat } = ctx;
    const t = ctx.t || 0;
    const prevHeat = step._prevHeat || 0;
    step._prevHeat = heat;
    matchStrength(heat, px, pz, heading);
    // Line of sight decides the whole pursuit mood: seen = hunt,
    // unseen with heat = search. The HUD pills and the search ring read
    // this one flag.
    const sees = heat > 0 && anyoneSees(px, pz);
    const searching = heat > 0 && !sees;
    if (sees) {
      lastSeen = { x: px, z: pz };
      step._searchTime = 0;
    } else if (searching) {
      step._searchTime = (step._searchTime || 0) + dt;
    }
    // Dispatch ticker: a line when the response escalates, then one
    // every ~25 s while the chase is live.
    if (ctx.onDispatch) {
      if (prevHeat < 3 && heat >= 3) ctx.onDispatch('POLISI: Blokade di depan — jangan sampai lolos!');
      if (prevHeat < 4 && heat >= 4) ctx.onDispatch('POLISI: GARUDA-1 sudah di udara — kejar dari atas!');
      dispatchTimer -= dt;
      if (heat >= 1 && dispatchTimer <= 0) {
        dispatchTimer = 25;
        ctx.onDispatch(DISPATCH_LINES[Math.floor(rng() * DISPATCH_LINES.length)]);
      }
    }
    // Cruisers: steer toward the player and ram; close in, they read RAMMING.
    // Blind, they sweep toward the last place the player was seen.
    for (const c of cruisers) {
      const tx = searching ? lastSeen.x : px;
      const tz = searching ? lastSeen.z : pz;
      const d = dist(c.x, c.z, px, pz);
      const want = Math.atan2(tx - c.x, tz - c.z);
      const turn = clamp(wrapAngle(want - c.heading), -1, 1);
      c.status = d < 12 ? 'RAMMING' : searching ? 'SEARCHING' : 'PURSUIT';
      const throttle = d > 4 ? 1 : 0.3;
      c.drive(dt, throttle, turn, false);
      if (d < 4.5) {
        if (playerInCar && ctx.playerCar) {
          ctx.playerCar.health = Math.max(0, ctx.playerCar.health - 6 * dt);
          ctx.playerCar.speed *= 1 - 0.4 * dt;
        } else {
          ctx.damagePlayer(8 * dt);
        }
      }
    }
    // Foot cops: run at the player on foot and shoot inside 26 m.
    shootTimer -= dt;
    for (const cop of cops) {
      if (!cop.alive) continue;
      const d = dist(cop.x, cop.z, px, pz);
      cop.status = d < 26 ? 'PURSUIT' : 'SEARCHING';
      cop.face(Math.atan2(px - cop.x, pz - cop.z));
      if (d > 3) cop.walk(dt, 5.2);
      if (d < 26 && shootTimer <= 0) {
        shootTimer = 1.3;
        ctx.damagePlayer(rr(rng, 3, 7));
        if (ctx.onCopShot) ctx.onCopShot(cop);
      }
    }
    // Helicopter: hover ahead of the player, high enough to stay in the
    // chase camera's frame. It bobs ±0.3 m, banks into its turns, and its
    // spotlight sweeps a search pattern while the player is unseen —
    // pinned on the player the moment eyes are back on them. The pool of
    // light follows the beam, not the player.
    if (heli) {
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const lx = Math.cos(heading);
      const lz = -Math.sin(heading);
      const hx = px + fx * 20 + lx * 6;
      const hz = pz + fz * 20 + lz * 6;
      // Bank into the turn: lean by lateral velocity.
      const bank = clamp((hx - heliPrevX) * 0.03 + (hz - heliPrevZ) * 0.03, -0.22, 0.22);
      heliPrevX = hx;
      heliPrevZ = hz;
      heli.group.position.set(hx, 22 + Math.sin(t * 1.4) * 0.3, hz);
      heli.group.lookAt(px, 0, pz);
      heli.group.rotateZ(bank);
      heli.rotor.rotation.y += dt * 22;
      heli.tailRotor.rotation.x += dt * 30;
      // Spotlight: sweep a lerp search pattern around the last-seen point
      // while searching, snap onto the player when seen.
      heliSearchPhase += dt * 0.9;
      const sweepX = searching
        ? lastSeen.x + Math.sin(heliSearchPhase) * 8
        : px;
      const sweepZ = searching
        ? lastSeen.z + Math.cos(heliSearchPhase * 0.7) * 8
        : pz;
      heli.spotX = heli.spotX === undefined ? sweepX : heli.spotX + (sweepX - heli.spotX) * Math.min(1, dt * 1.5);
      heli.spotZ = heli.spotZ === undefined ? sweepZ : heli.spotZ + (sweepZ - heli.spotZ) * Math.min(1, dt * 1.5);
      heli.status = searching ? 'SEARCHING' : 'SPOTLIGHT';
      heli.spot.position.set(
        (heli.spotX - heli.group.position.x) * 0.35,
        -15,
        (heli.spotZ - heli.group.position.z) * 0.35 + 1.6,
      );
      // The cone itself stays pointing down; the lean of its position
      // plus the moving light target and pool read as a sweeping beam.
      heli.spotLight.target.position.set(heli.spotX - heli.group.position.x, -30, heli.spotZ - heli.group.position.z + 1.6);
      heli.pool.position.set(heli.spotX, 0.08, heli.spotZ);
      // Strobe blinks twice a second on sim time, never wall-clock.
      const strobeOn = Math.floor(t * 2) % 2 === 0;
      heli.strobe.visible = strobeOn;
      heli.strobeGlow.visible = strobeOn;
    }
    // Search ring: visible only while the player is unseen with heat on.
    searchRing.visible = searching;
    if (searching) {
      searchRing.position.set(lastSeen.x, 0.09, lastSeen.z);
      const grow = Math.min(2, 1 + (step._searchTime || 0) * 0.05);
      searchRing.scale.setScalar(grow);
      searchRing.material.opacity = 0.5 + Math.sin(t * 3) * 0.2;
    }
    // Roadblock beacons blink twice a second on sim time.
    const beaconOn = Math.floor(t * 2) % 2 === 0;
    for (const b of roadblockBeacons) b.visible = beaconOn;
    if (roadblock) roadblock.sync();
  }

  // Any unit close enough to see the player (the helicopter always can).
  function anyoneSees(px, pz) {
    if (heli) return true;
    for (const c of cruisers) if (dist(c.x, c.z, px, pz) < 55) return true;
    for (const c of cops) if (c.alive && dist(c.x, c.z, px, pz) < 40) return true;
    return false;
  }

  function units(px, pz) {
    const list = [];
    for (const c of cruisers) list.push({ name: c.unitName, dist: Math.round(dist(c.x, c.z, px, pz)), status: c.status, x: c.x, z: c.z });
    for (const c of cops) {
      if (c.alive) list.push({ name: c.unitName, dist: Math.round(dist(c.x, c.z, px, pz)), status: c.status, x: c.x, z: c.z });
    }
    if (heli) list.push({ name: heli.unitName, dist: Math.round(dist(heli.group.position.x, heli.group.position.z, px, pz)), status: heli.status, x: heli.group.position.x, z: heli.group.position.z });
    if (roadblock) list.push({ name: 'BLOKADE', dist: Math.round(dist(roadblock.x, roadblock.z, px, pz)), status: 'ROADBLOCK', x: roadblock.x, z: roadblock.z });
    return list;
  }

  return { step, anyoneSees, units, despawnAll, stealCruiser, cruisers, cops, get heli() { return heli; }, get roadblock() { return roadblock; } };
}
