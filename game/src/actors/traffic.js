// Traffic: 14 lane cars that drive the road grid, brake for anything ahead of
// them (including the player's car), and wrap around the city edge. The
// player's car is flagged skipTraffic and never stepped here (it would
// otherwise integrate twice a frame).
import { Car } from './car.js';
import { TRAFFIC_COUNT } from '../config.js';
import { pick, rr } from '../rng.js';
import { roadLines } from '../city.js';

export function createTraffic(scene, city, rng) {
  const lines = roadLines();
  const cars = [];
  const names = ['Kijang', 'Panther', 'Avanza', 'Sedan', 'Pickup', 'Angkot', 'Truk', 'Minibus'];

  function spawn(i) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = pick(rng, lines);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = line + (dir > 0 ? 4.5 : -4.5);
    const along = rr(rng, -180, 180);
    const car = new Car(scene, rng, {
      x: axis === 'x' ? along : lane,
      z: axis === 'x' ? lane : along,
      heading: axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      name: pick(rng, names),
    });
    car.axis = axis;
    car.lane = lane;
    car.dir = dir;
    car.cruise = rr(rng, 8, 14);
    car.speed = car.cruise;
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

  function step(dt, playerCar) {
    const all = playerCar ? [...cars, playerCar] : cars;
    for (const car of cars) {
      const blocked = blockedBy(car, all, 14);
      const target = blocked ? 0 : car.cruise;
      car.speed += (target - car.speed) * Math.min(1, dt * (blocked ? 6 : 1.5));
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

  return { cars, step };
}
