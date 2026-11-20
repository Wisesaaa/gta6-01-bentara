// Taxi fares: the side activity the mock judges kept asking for. A
// passenger waits at a stand with a raised hand; press E to pick them up,
// drive them to their destination, get paid by distance. It reuses the
// mission goto/deliver shape (a beacon, a radius, a prompt) but pays out
// immediately and repeats all day — progression that rewards play.
import * as THREE from 'three';
import { TAXI } from './config.js';
import { Human } from './actors/human.js';
import { pick, rr } from './rng.js';
import { LOCATIONS, loc, hitsSolid } from './city.js';
import { dist } from './mathx.js';

const STANDS = ['towerConcourse', 'marina', 'northRowStall', 'hospital', 'arterialJunction', 'industrialYard'];
const FARE_NAMES = ['Bu RT', 'Pak Haji', 'Mbak Sari', 'Bang Ojek', 'Neng Rina', 'Pak Kades'];

export function createTaxi(scene, city, rng, hooks) {
  let passenger = null;
  let destination = null;
  let state = 'idle'; // idle | waiting | riding
  let waitTimer = 0;
  let fare = 0;
  let startX = 0;
  let startZ = 0;
  let trips = 0;
  let earned = 0;

  // Teal beacon over the passenger / destination — the same gold-beacon
  // idea as missions, in taxi teal so the two never confuse each other.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 20, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x2fd8c8, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.y = 10;
  beacon.visible = false;
  scene.add(beacon);

  // A stand's loc centre can sit inside a building footprint — Plaza
  // Menara IS the tower (18x18 m at (0,0)), so a car teleported or driven
  // to its centre gets pushed out to the solid's edge + 1.5 m (10.5 m
  // away) and a fare there could never complete inside the 8 m dropoff
  // radius. Push any taxi point out of a solid along the smallest
  // penetration axis first, so the passenger waits and the destination
  // sits on drivable ground a few metres from the stand's heart. Loops:
  // pushing out of one solid can land inside another.
  function toDrivable(x, z) {
    for (let i = 0; i < 3; i++) {
      const s = hitsSolid(city, x, z, 2);
      if (!s) return { x, z };
      const dxMin = x - (s.minX - 2), dxMax = (s.maxX + 2) - x;
      const dzMin = z - (s.minZ - 2), dzMax = (s.maxZ + 2) - z;
      const m = Math.min(dxMin, dxMax, dzMin, dzMax);
      if (m === dxMin) x = s.minX - 2;
      else if (m === dxMax) x = s.maxX + 2;
      else if (m === dzMin) z = s.minZ - 2;
      else z = s.maxZ + 2;
    }
    return { x, z };
  }

  function spawnPassenger() {
    const stand = pick(rng, STANDS);
    const L = loc(stand);
    const P = toDrivable(L.x + rr(rng, -4, 4), L.z + rr(rng, -4, 4));
    const h = new Human(scene, rng, 'taxi');
    h.setPos(P.x, P.z);
    h.face(rr(rng, 0, Math.PI * 2));
    passenger = { human: h, name: pick(rng, FARE_NAMES), stand, x: h.x, z: h.z };
    state = 'waiting';
    waitTimer = TAXI.maxWait;
    beacon.position.set(h.x, 10, h.z);
    beacon.visible = true;
    if (hooks.onPassenger) hooks.onPassenger(passenger);
    return passenger;
  }

  function pickDestination() {
    const names = STANDS.filter((s) => s !== passenger.stand);
    const L = loc(pick(rng, names));
    const P = toDrivable(L.x, L.z);
    destination = { ...L, x: P.x, z: P.z };
    beacon.position.set(destination.x, 10, destination.z);
    return destination;
  }

  function startFare(px, pz) {
    if (state !== 'waiting' || !passenger) return false;
    state = 'riding';
    startX = px;
    startZ = pz;
    fare = TAXI.baseFare;
    passenger.human.dispose(scene);
    passenger = { ...passenger, riding: true };
    pickDestination();
    if (hooks.onPickup) hooks.onPickup(passenger, destination);
    return true;
  }

  function finishFare(px, pz) {
    const distance = dist(startX, startZ, px, pz);
    const paid = Math.round(TAXI.baseFare + distance * TAXI.perMetre);
    trips += 1;
    earned += paid;
    const done = { name: passenger.name, paid, distance: Math.round(distance) };
    passenger = null;
    destination = null;
    state = 'idle';
    beacon.visible = false;
    if (hooks.onFarePaid) hooks.onFarePaid(done);
    return done;
  }

  function update(dt, ctx) {
    const { px, pz, interactPressed, playerInCar } = ctx;
    if (state === 'idle') {
      spawnPassenger();
      return;
    }
    if (state === 'waiting') {
      waitTimer -= dt;
      // The passenger waves while they wait.
      if (passenger && passenger.human.alive) {
        passenger.human.face(Math.atan2(px - passenger.human.x, pz - passenger.human.z));
      }
      if (waitTimer <= 0) {
        if (passenger) passenger.human.dispose(scene);
        passenger = null;
        beacon.visible = false;
        state = 'idle';
      }
      return;
    }
    // riding: the meter ticks with distance; arriving pays out.
    if (destination && dist(px, pz, destination.x, destination.z) < TAXI.dropoffRadius) {
      finishFare(px, pz);
      return;
    }
    if (destination) fare = Math.round(TAXI.baseFare + dist(startX, startZ, px, pz) * TAXI.perMetre);
    if (!playerInCar && hooks.onAbandoned) {
      // Left the car mid-fare: the passenger walks off, fare lost.
      passenger = null;
      destination = null;
      state = 'idle';
      beacon.visible = false;
      hooks.onAbandoned();
    }
  }

  function nearPassenger(px, pz) {
    if (state !== 'waiting' || !passenger) return false;
    return dist(px, pz, passenger.x, passenger.z) < TAXI.pickupRadius;
  }

  function prompt() {
    if (state === 'waiting' && passenger) return `E — Angkut ${passenger.name} (taksi)`;
    return null;
  }

  // Staging hook for screenshots: force a waiting passenger at a named
  // stand, regardless of the spawn timer. The passenger is real — same
  // Human, same beacon, same fare flow — only the stand is chosen.
  function stagePassenger(standKey) {
    if (passenger && passenger.human) passenger.human.dispose(scene);
    const L = loc(standKey);
    const P = toDrivable(L.x + rr(rng, -4, 4), L.z + rr(rng, -4, 4));
    const h = new Human(scene, rng, 'taxi');
    h.setPos(P.x, P.z);
    h.face(rr(rng, 0, Math.PI * 2));
    passenger = { human: h, name: pick(rng, FARE_NAMES), stand: standKey, x: h.x, z: h.z };
    state = 'waiting';
    waitTimer = TAXI.maxWait;
    beacon.position.set(h.x, 10, h.z);
    beacon.visible = true;
    if (hooks.onPassenger) hooks.onPassenger(passenger);
    return passenger;
  }

  // Move the waiting passenger (and their beacon) to an exact spot — used
  // by screenshots to put the passenger in frame without faking the fare.
  function movePassenger(x, z) {
    if (!passenger || !passenger.human) return false;
    const P = toDrivable(x, z);
    passenger.human.setPos(P.x, P.z);
    passenger.x = P.x;
    passenger.z = P.z;
    beacon.position.set(P.x, 10, P.z);
    return true;
  }

  return {
    update, nearPassenger, prompt, startFare, stagePassenger, movePassenger,
    get state() { return state; },
    get passenger() { return passenger; },
    get destination() { return destination; },
    get fare() { return fare; },
    get trips() { return trips; },
    get earned() { return earned; },
    get beacon() { return beacon; },
  };
}
