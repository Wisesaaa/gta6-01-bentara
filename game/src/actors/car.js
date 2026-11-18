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
    const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.65, CAR.length), bodyMat);
    body.position.y = 0.55;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(CAR.width - 0.3, 0.55, CAR.length * 0.45),
      new THREE.MeshLambertMaterial({ color: this.isCop ? 0x24344a : 0x222222 }),
    );
    cabin.position.set(0, 1.1, -0.2);
    group.add(body, cabin);
    if (this.isCop) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      bar.position.set(0, 1.45, -0.2);
      group.add(bar);
      this.lightBar = bar;
    }
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    this.wheels = [];
    for (const [wx, wz] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]]) {
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
