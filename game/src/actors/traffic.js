// Traffic: 22 lane vehicles that drive the road grid — sedans, angkot
// minibuses, bajaj, ojek bikes and trucks — braking for anything ahead of
// them (including the player's car), pausing at intersections, and wrapping
// around the city edge. Gunfire nearby makes them flee down their lane.
// The player's car is flagged skipTraffic and never stepped here (it would
// otherwise integrate twice a frame).
import { Car } from './car.js';
import { TRAFFIC_COUNT, TRAFFIC_KINDS } from '../config.js';
import { pick, rr } from '../rng.js';
import { roadLines } from '../city.js';
import { dist } from '../mathx.js';

const FLEET_NAMES = {
  sedan: ['Kijang', 'Panther', 'Avanza', 'Sedan'],
  angkot: ['Angkot', 'Angkot', 'Minibus'],
  bajaj: ['Bajaj', 'Bajaj'],
  ojek: ['Ojek', 'Ojek'],
  truck: ['Truk', 'Pickup'],
};

function pickKind(rng) {
  let roll = rng();
  for (const entry of TRAFFIC_KINDS) {
    if (roll < entry.weight) return entry.kind;
    roll -= entry.weight;
  }
  return 'sedan';
}

export function createTraffic(scene, city, rng) {
  const lines = roadLines();
  const cars = [];

  function spawn(i) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = pick(rng, lines);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = line + (dir > 0 ? 4.5 : -4.5);
    const along = rr(rng, -180, 180);
    const kind = pickKind(rng);
    const car = new Car(scene, rng, {
      kind,
      x: axis === 'x' ? along : lane,
      z: axis === 'x' ? lane : along,
      heading: axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      name: pick(rng, FLEET_NAMES[kind]),
    });
    car.axis = axis;
    car.lane = lane;
    car.dir = dir;
    // Bajaj and ojek are slow; trucks are slower still; angkot dawdle.
    const base = kind === 'bajaj' ? rr(rng, 6, 9) : kind === 'ojek' ? rr(rng, 9, 13) : kind === 'truck' ? rr(rng, 7, 10) : kind === 'angkot' ? rr(rng, 7, 11) : rr(rng, 9, 15);
    car.cruise = base;
    car.speed = car.cruise;
    car.pauseTimer = rr(rng, 4, 20);
    car.fleeTimer = 0;
    return car;
  }

  for (let i = 0; i < TRAFFIC_COUNT; i += 1) cars.push(spawn(i));

  // Is there a car (or the player's car) in `car`'s lane within `ahead` metres?
  function blockedBy(car, others, ahead) {
    for (const o of others) {
      if (o === car || o.health <= 0) continue;
      const dx = o.x - car.x;
      const dz = o.z - car.z;
      const forward = car.axis === 'x' ? dx * car.dir : dz * car.dir;
      const lateral = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
      if (forward > 0 && forward < ahead && lateral < 3.2) return true;
    }
    return false;
  }

  function fleeFrom(x, z, radius = 40) {
    for (const car of cars) {
      if (dist(car.x, car.z, x, z) < radius) car.fleeTimer = 2.5;
    }
  }

  function step(dt, playerCar) {
    const all = playerCar ? [...cars, playerCar] : cars;
    for (const car of cars) {
      // At an intersection, sometimes wait a beat — a city that never stops
      // reads as a conveyor belt, not traffic.
      car.pauseTimer -= dt;
      const atJunction = lines.some((L) => Math.abs((car.axis === 'x' ? car.z : car.x) - L) < 6)
        && lines.some((L) => Math.abs((car.axis === 'x' ? car.x : car.z) - L) < 12);
      let target = car.cruise;
      if (car.fleeTimer > 0) {
        car.fleeTimer -= dt;
        target = car.cruise * 1.6;
      } else if (atJunction && car.pauseTimer <= 0) {
        target = 0;
        if (car.pauseTimer < -1.6) car.pauseTimer = rr(rng, 8, 24);
      }
      if (blockedBy(car, all, 14)) target = 0;
      car.speed += (target - car.speed) * Math.min(1, dt * (target === 0 ? 6 : 1.5));
      const move = car.speed * car.dir * dt;
      if (car.axis === 'x') car.x += move;
      else car.z += move;
      const along = car.axis === 'x' ? car.x : car.z;
      if (along > 192 || along < -192) {
        if (car.axis === 'x') car.x = -car.dir * 190;
        else car.z = -car.dir * 190;
      }
      car.sync();
    }
  }

  return { cars, step, fleeFrom };
}
