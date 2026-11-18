// A car: body, cabin, four wheels, headlights. Arcade handling — throttle,
// steering that bites harder at low speed, handbrake slide — and solid
// collision against the city's AABB walls.
import * as THREE from 'three';
import { CAR, PALETTE } from '../config.js';
import { clamp, damp, wrapAngle } from '../mathx.js';
import { hitsSolid, clampToCity } from '../city.js';

let carCounter = 0;

export class Car {
  constructor(scene, rng, opts = {}) {
    this.id = carCounter;
    carCounter += 1;
    this.name = opts.name || `Mobil ${this.id}`;
    this.color = opts.color ?? PALETTE.car[Math.floor(rng() * PALETTE.car.length)];
    this.health = CAR.health;
    this.speed = 0;
    this.heading = opts.heading ?? 0;
    this.skipTraffic = !!opts.skipTraffic; // the player's car: driven by input, not traffic
    this.isCop = !!opts.isCop;
    this.x = opts.x ?? 0;
    this.z = opts.z ?? 0;
    this.steerVis = 0;

    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.isCop ? 0x1d2a3a : this.color });
    this.bodyMat = bodyMat;
    const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.65, CAR.length), bodyMat);
    body.position.y = 0.55;
    // Nose and tail taper: both are lower and narrower than the mid-body,
    // so the car reads as a car from the chase camera, not a plain box.
    const hood = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.25, 0.4, 0.9), bodyMat);
    hood.position.set(0, 0.62, CAR.length / 2 - 0.35);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.25, 0.42, 0.7), bodyMat);
    trunk.position.set(0, 0.63, -CAR.length / 2 + 0.25);
    // Glasshouse in a pale blue-grey, clearly lighter than the body, with
    // a body-colour roof panel so it reads as glass plus roof.
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(CAR.width - 0.3, 0.55, CAR.length * 0.45),
      new THREE.MeshLambertMaterial({ color: this.isCop ? 0x24344a : 0x5d7a8a }),
    );
    cabin.position.set(0, 1.1, -0.2);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.45, 0.08, CAR.length * 0.42), bodyMat);
    roof.position.set(0, 1.4, -0.2);
    group.add(body, hood, trunk, cabin, roof);
    // Warm-white headlights up front, red taillights at the rear.
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xd23b2e });
    for (const sx of [-0.6, 0.6]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), headMat);
      head.position.set(sx, 0.62, CAR.length / 2 + 0.02);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
      tail.position.set(sx, 0.62, -CAR.length / 2 - 0.02);
      group.add(head, tail);
    }
    if (this.isCop) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      bar.position.set(0, 1.45, -0.2);
      group.add(bar);
      this.lightBar = bar;
    }
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    this.wheels = [];
    // Wheels sit out at the body's flanks so they show from the side
    // instead of hiding underneath the body.
    for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.36, wz);
      group.add(w);
      this.wheels.push(w);
    }
    group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    group.position.set(this.x, 0, this.z);
    group.rotation.y = this.heading;
    scene.add(group);
    this.group = group;
    this.scene = scene;
  }

  // Recolour the body (hood, trunk and roof share the body material), so
  // a shot can stage traffic in distinct colours without a second red car
  // sitting next to the player's red car.
  repaint(hex) {
    this.color = hex;
    if (this.bodyMat) this.bodyMat.color.setHex(hex);
  }

  sync() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    if (this.lightBar) {
      // Blink on a frame counter, not wall-clock time, so shots stay deterministic.
      this._blink = (this._blink || 0) + 1;
      this.lightBar.material.color.setHex(this._blink % 20 < 10 ? 0xff2a2a : 0x2a6bff);
    }
  }

  // Arcade step: throttle -1..1, steer -1..1, handbrake bool. Returns distance moved.
  drive(dt, throttle, steer, handbrake) {
    const forward = throttle > 0 ? 1 : -1;
    const accel = throttle !== 0 ? CAR.accel * Math.abs(throttle) : 0;
    this.speed += forward * accel * dt;
    if (throttle === 0) this.speed = damp(this.speed, 0, 2.5, dt);
    if (handbrake) this.speed = damp(this.speed, 0, 6, dt);
    const max = this.speed >= 0 ? CAR.maxSpeed : CAR.maxReverse;
    this.speed = clamp(this.speed, -CAR.maxReverse, CAR.maxSpeed);
    if (Math.abs(this.speed) > 0.3) {
      const grip = handbrake ? 0.5 : 1;
      this.heading += steer * CAR.steer * grip * dt * clamp(Math.abs(this.speed) / 8, 0.25, 1) * (this.speed >= 0 ? 1 : -1);
    }
    const dx = Math.sin(this.heading) * this.speed * dt;
    const dz = Math.cos(this.heading) * this.speed * dt;
    this.x += dx;
    this.z += dz;
    const clamped = clampToCity(this.x, this.z);
    this.x = clamped.x;
    this.z = clamped.z;
    // Walls: push the car out of any solid and bleed speed.
    const hit = hitsSolid(this.scene.userData.city, this.x, this.z, 1.4);
    if (hit) {
      const cx = clamp(this.x, hit.minX, hit.maxX);
      const cz = clamp(this.z, hit.minZ, hit.maxZ);
      const pushX = Math.abs(this.x - hit.minX) < Math.abs(this.x - hit.maxX) ? hit.minX - 1.5 : hit.maxX + 1.5;
      const pushZ = Math.abs(this.z - hit.minZ) < Math.abs(this.z - hit.maxZ) ? hit.minZ - 1.5 : hit.maxZ + 1.5;
      if (Math.abs(this.x - cx) < Math.abs(this.z - cz)) this.x = pushX;
      else this.z = pushZ;
      this.speed *= 0.4;
      this.health = Math.max(0, this.health - 2);
    }
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2;
    this.sync();
    return Math.abs(dx) + Math.abs(dz);
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  dispose() { this.scene.remove(this.group); }
}
