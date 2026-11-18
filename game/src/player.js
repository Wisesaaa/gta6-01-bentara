// The player: on foot (WASD, run, shoot from the crosshair) or in a car
// (arcade driving, handbrake, enter/exit with F). The on-foot body is a Human;
// entering a car hides it and flags the car skipTraffic so traffic never
// steps it.
//
// The chase camera sits low and close now — 6.2 m back, 2.1 m up — so the
// car fills 25–35% of the frame, bottom-centre, instead of floating small
// in a wide shot. Drifting (handbrake + steer at speed) is timed here and
// reported to the game as a stunt event with its payout.
import * as THREE from 'three';
import { Human } from './actors/human.js';
import { CAR, PLAYER, WEAPONS, STUNTS } from './config.js';
import { clamp, damp, dist, wrapAngle } from './mathx.js';
import { hitsSolid, clampToCity } from './city.js';
import { createCombat } from './combat.js';

export function createPlayer(ctx) {
  const { scene, city, view, input, rng } = ctx;
  const body = new Human(scene, rng, 'ped');
  body.torso.material.color.setHex(0xd8a03c);
  const combat = createCombat(scene, city, rng);

  const p = {
    x: -6, z: -164, heading: 0, camHeading: 0,
    onFoot: true, car: null,
    health: PLAYER.health,
    weapon: 'pistol', shells: 12, hasShotgun: false,
    speedKmh: 0, moving: false,
    shootCooldown: 0, driftTimer: 0, drifting: false,
  };

  function nearestCar(cars, maxDist = 5) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const c of cars) {
      if (c.health <= 0) continue;
      const d = dist(p.x, p.z, c.x, c.z);
      if (d * d < bestD) { bestD = d * d; best = c; }
    }
    return best;
  }

  function enterCar(car) {
    p.car = car;
    p.onFoot = false;
    car.skipTraffic = true;
    body.group.visible = false;
    if (ctx.onEnterCar) ctx.onEnterCar(car);
  }

  function exitCar() {
    if (!p.car) return;
    const car = p.car;
    car.skipTraffic = false;
    p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
    p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
    const c = clampToCity(p.x, p.z);
    p.x = c.x; p.z = c.z;
    p.heading = car.heading;
    p.onFoot = true;
    p.car = null;
    body.group.visible = true;
    body.setPos(p.x, p.z);
    if (ctx.onExitCar) ctx.onExitCar(car);
  }

  function stepFoot(dt) {
    const fwd = (input.up() ? 1 : 0) - (input.down() ? 1 : 0);
    const strafe = (input.right() ? 1 : 0) - (input.left() ? 1 : 0);
    const speed = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.moving = fwd !== 0 || strafe !== 0;
    if (p.moving) {
      const moveAngle = p.camHeading + Math.atan2(strafe, fwd);
      p.heading = moveAngle;
      let nx = p.x + Math.sin(moveAngle) * speed * dt;
      let nz = p.z + Math.cos(moveAngle) * speed * dt;
      // Walls push the walker out of solids.
      const hit = hitsSolid(city, nx, nz, PLAYER.radius);
      if (hit) {
        const tryX = hitsSolid(city, nx, p.z, PLAYER.radius) === null;
        const tryZ = hitsSolid(city, p.x, nz, PLAYER.radius) === null;
        if (tryX) nz = p.z;
        else if (tryZ) nx = p.x;
        else { nx = p.x; nz = p.z; }
      }
      const c = clampToCity(nx, nz);
      p.x = c.x; p.z = c.z;
      body.setPos(p.x, p.z);
      body.face(p.heading);
      body.walk(dt, speed);
    } else {
      body.walk(dt, 0);
    }
    // Camera heading eases toward the facing direction.
    p.camHeading += wrapAngle(p.heading - p.camHeading) * Math.min(1, dt * 4);
    p.speedKmh = 0;
  }

  function stepCar(dt) {
    const car = p.car;
    if (!car) return;
    const throttle = (input.up() ? 1 : 0) - (input.down() ? 0.7 : 0);
    const steer = (input.left() ? 1 : 0) - (input.right() ? 1 : 0);
    if (car.health <= 0) car.speed = damp(car.speed, 0, 4, dt);
    else car.drive(dt, throttle, steer, input.brake());
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    p.camHeading = car.heading;
    p.speedKmh = Math.abs(car.speed) * 3.6;
    // Drift: handbrake held, steering, and real speed — the timer runs
    // while the slide lasts and pays out when it ends (or every second).
    const sliding = input.brake() && steer !== 0 && Math.abs(car.speed) > 10;
    if (sliding) {
      p.drifting = true;
      p.driftTimer += dt;
      if (p.driftTimer >= 1 && ctx.onDrift) {
        ctx.onDrift(p.driftTimer, Math.round(p.driftTimer * STUNTS.driftPerSecond));
        p.driftTimer = 0;
      }
    } else if (p.drifting) {
      p.drifting = false;
      if (p.driftTimer >= STUNTS.driftMinSeconds && ctx.onDrift) {
        ctx.onDrift(p.driftTimer, Math.round(p.driftTimer * STUNTS.driftPerSecond));
      }
      p.driftTimer = 0;
    }
    // Ram a prop if the car brushes one.
    if (Math.abs(car.speed) > 4 && ctx.onCarBrush) ctx.onCarBrush(car);
  }

  function shoot() {
    if (p.shootCooldown > 0) return;
    const w = WEAPONS[p.weapon];
    if (p.weapon === 'shotgun') {
      if (!p.hasShotgun || p.shells <= 0) return;
      p.shells -= 1;
    }
    p.shootCooldown = w.rate;
    // Aim: from the camera, through the crosshair, into the world.
    const cam = view.camera.position;
    const target = new THREE.Vector3(
      p.x + Math.sin(p.heading) * 30,
      1.4,
      p.z + Math.cos(p.heading) * 30,
    );
    const dir = new THREE.Vector3().subVectors(target, cam).normalize();
    const origin = new THREE.Vector3(p.x, 1.5, p.z);
    const result = combat.shoot(origin, dir, p.weapon, ctx.targets());
    if (ctx.onShoot) ctx.onShoot(result, p.weapon);
  }

  function step(dt) {
    p.shootCooldown = Math.max(0, p.shootCooldown - dt);
    if (p.onFoot) stepFoot(dt);
    else stepCar(dt);
    if (p.onFoot && (input.mouseDown() || input.takeClick())) shoot();
    combat.step(dt);
  }

  function placeCamera() {
    if (p.onFoot) {
      const behind = 4.2;
      const bx = p.x - Math.sin(p.camHeading) * behind + Math.cos(p.camHeading) * 0.8;
      const bz = p.z - Math.cos(p.camHeading) * behind - Math.sin(p.camHeading) * 0.8;
      view.camera.position.set(bx, 2.4, bz);
      view.camera.lookAt(p.x + Math.sin(p.heading) * 6, 1.4, p.z + Math.cos(p.heading) * 6);
    } else {
      // Low and close: 6.2 m back, 2.1 m up. The car is the hero of the
      // frame — bottom-centre, a quarter to a third of the width — and the
      // street ahead still reads over its roof.
      view.placeCamera(p.x, p.z, p.heading, 6.2, 2.1, 10);
    }
  }

  // Live getters: the state object `p` mutates every step, so the outside
  // world must read through these, never through a stale spread copy.
  return {
    body, combat,
    get x() { return p.x; },
    get z() { return p.z; },
    get heading() { return p.heading; },
    get camHeading() { return p.camHeading; },
    get onFoot() { return p.onFoot; },
    get car() { return p.car; },
    get health() { return p.health; },
    set health(v) { p.health = v; },
    get weapon() { return p.weapon; },
    set weapon(v) { p.weapon = v; },
    get shells() { return p.shells; },
    set shells(v) { p.shells = v; },
    get hasShotgun() { return p.hasShotgun; },
    set hasShotgun(v) { p.hasShotgun = v; },
    get speedKmh() { return p.speedKmh; },
    get moving() { return p.moving; },
    get drifting() { return p.drifting; },
    nearestCar, enterCar, exitCar, step, placeCamera,
    setPos(x, z, heading = 0) {
      p.x = x; p.z = z; p.heading = heading; p.camHeading = heading;
      body.setPos(x, z);
      body.face(heading);
    },
  };
}
