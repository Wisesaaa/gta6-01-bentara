// A car: body, cabin, four wheels, headlights. Arcade handling — throttle,
// steering that bites harder at low speed, handbrake slide — and solid
// collision against the city's AABB walls.
//
// Kinds: sedan (the default), angkot (tall minibus with a yellow roof
// stripe), bajaj (short three-wheeler), ojek (narrow bike with a rider),
// truck (long flatbed). The kind changes the silhouette, not the physics,
// so traffic reads as Indonesian at a glance without a second code path.
// Cop cars get a white-door livery, a POLISI decal and a split red/blue
// lightbar. A car under 40% health smokes from the hood.
import * as THREE from 'three';
import { CAR, PALETTE } from '../config.js';
import { clamp, damp, wrapAngle } from '../mathx.js';
import { hitsSolid, clampToCity } from '../city.js';

let carCounter = 0;

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(60,60,60,0.85)');
  grad.addColorStop(0.6, 'rgba(90,90,90,0.4)');
  grad.addColorStop(1, 'rgba(90,90,90,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function polisiTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#1d2a3a';
  g.font = 'bold 40px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('POLISI', 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const KIND_SHAPE = {
  sedan: { len: 1, h: 1, cabin: 1, wheels: 4 },
  angkot: { len: 1.15, h: 1.25, cabin: 1.35, wheels: 4 },
  bajaj: { len: 0.55, h: 0.85, cabin: 0.9, wheels: 3 },
  ojek: { len: 0.5, h: 0.7, cabin: 0, wheels: 2 },
  truck: { len: 1.6, h: 1.1, cabin: 0.8, wheels: 6 },
};

export class Car {
  constructor(scene, rng, opts = {}) {
    this.id = carCounter;
    carCounter += 1;
    this.name = opts.name || `Mobil ${this.id}`;
    this.kind = opts.kind || 'sedan';
    this.color = opts.color ?? PALETTE.car[Math.floor(rng() * PALETTE.car.length)];
    this.health = CAR.health;
    this.speed = 0;
    this.heading = opts.heading ?? 0;
    this.skipTraffic = !!opts.skipTraffic; // the player's car: driven by input, not traffic
    this.isCop = !!opts.isCop;
    this.x = opts.x ?? 0;
    this.z = opts.z ?? 0;
    this.steerVis = 0;
    this._smokeT = 0;

    const shape = KIND_SHAPE[this.kind] || KIND_SHAPE.sedan;
    const len = CAR.length * shape.len;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.isCop ? PALETTE.cop : this.color });
    this.bodyMat = bodyMat;
    this.buildBody(group, bodyMat, shape, len);
    this.buildLights(group, len);
    if (this.isCop) this.buildCopKit(group, len);
    if (this.kind === 'angkot') this.buildAngkotKit(group, len);
    if (this.kind === 'ojek') this.buildRider(group);
    this.buildWheels(group, shape, len);
    this.buildSmoke(group, len);
    group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    group.position.set(this.x, 0, this.z);
    group.rotation.y = this.heading;
    scene.add(group);
    this.group = group;
    this.scene = scene;
  }

  buildBody(group, bodyMat, shape, len) {
    const w = CAR.width;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.65 * shape.h, len), bodyMat);
    body.position.y = 0.55 * shape.h;
    // Nose and tail taper: both are lower and narrower than the mid-body,
    // so the car reads as a car from the chase camera, not a plain box.
    const hood = new THREE.Mesh(new THREE.BoxGeometry(w - 0.25, 0.4, 0.9), bodyMat);
    hood.position.set(0, 0.62, len / 2 - 0.35);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(w - 0.25, 0.42, 0.7), bodyMat);
    trunk.position.set(0, 0.63, -len / 2 + 0.25);
    group.add(body, hood, trunk);
    if (shape.cabin > 0) {
      // Glasshouse in a pale blue-grey, clearly lighter than the body, with
      // a body-colour roof panel so it reads as glass plus roof.
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.3, 0.55 * shape.cabin, len * 0.45),
        new THREE.MeshLambertMaterial({ color: this.isCop ? 0x24344a : 0x5d7a8a }),
      );
      cabin.position.set(0, (0.55 + 0.55 * shape.cabin / 2) * shape.h, -0.2);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w - 0.45, 0.08, len * 0.42), bodyMat);
      roof.position.set(0, (0.55 + 0.55 * shape.cabin) * shape.h + 0.04, -0.2);
      group.add(cabin, roof);
    }
  }

  buildLights(group, len) {
    // Warm-white headlights up front, red taillights at the rear.
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xd23b2e });
    for (const sx of [-0.6, 0.6]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), headMat);
      head.position.set(sx, 0.62, len / 2 + 0.02);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
      tail.position.set(sx, 0.62, -len / 2 - 0.02);
      group.add(head, tail);
    }
  }

  buildCopKit(group, len) {
    // White doors + POLISI decal on both flanks, so a cruiser reads as
    // police from the side at thumbnail distance, not just as a dark car.
    const decalTex = polisiTexture();
    for (const sx of [-1, 1]) {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.6, len * 0.42),
        new THREE.MeshLambertMaterial({ color: PALETTE.copWhite }),
      );
      door.position.set(sx * (CAR.width / 2 + 0.02), 0.62, -0.1);
      group.add(door);
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.4),
        new THREE.MeshBasicMaterial({ map: decalTex }),
      );
      decal.position.set(sx * (CAR.width / 2 + 0.06), 0.62, -0.1);
      decal.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(decal);
    }
    // Split lightbar: red on the left, blue on the right, alternating.
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.3), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    barBase.position.set(0, 1.45, -0.2);
    group.add(barBase);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x2a6bff });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.3), redMat);
    red.position.set(-0.23, 1.45, -0.2);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.3), blueMat);
    blue.position.set(0.23, 1.45, -0.2);
    group.add(red, blue);
    this.lightBarRed = red;
    this.lightBarBlue = blue;
  }

  buildAngkotKit(group, len) {
    // Yellow roof stripe + route band: the angkot's identity at a glance.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.4, 0.1, len * 0.4), new THREE.MeshBasicMaterial({ color: 0xffd75e }));
    stripe.position.set(0, 1.48, -0.2);
    group.add(stripe);
  }

  buildRider(group) {
    // The ojek rider: a seated figure leaning over the bike.
    const riderMat = new THREE.MeshLambertMaterial({ color: 0x4a6b8a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.25), riderMat);
    torso.position.set(0, 1.0, -0.1);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0xc89b6d }));
    head.position.set(0, 1.42, -0.05);
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.36), new THREE.MeshLambertMaterial({ color: 0xd8a13a }));
    helmet.position.set(0, 1.58, -0.05);
    group.add(torso, head, helmet);
  }

  buildWheels(group, shape, len) {
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    this.wheels = [];
    // Wheels sit out at the body's flanks so they show from the side
    // instead of hiding underneath the body.
    const spots = shape.wheels === 2
      ? [[0, 1.0], [0, -1.0]]
      : shape.wheels === 3
        ? [[-0.95, 1.0], [0.95, 1.0], [0, -1.0]]
        : shape.wheels === 6
          ? [[-0.95, 1.4], [0.95, 1.4], [-0.95, 0], [0.95, 0], [-0.95, -1.4], [0.95, -1.4]]
          : [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]];
    for (const [wx, wz] of spots) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.36, wz);
      group.add(w);
      this.wheels.push(w);
    }
  }

  buildSmoke(group, len) {
    // One smoke puff over the hood, invisible until the car is hurt.
    // A sprite, so it always faces the camera.
    const smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, opacity: 0, depthWrite: false }));
    smoke.position.set(0, 1.6, len / 2 - 0.6);
    smoke.scale.set(1.6, 1.6, 1);
    group.add(smoke);
    this.smoke = smoke;
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
    if (this.lightBarRed) {
      // Blink on a frame counter, not wall-clock time, so shots stay deterministic.
      this._blink = (this._blink || 0) + 1;
      const redOn = this._blink % 20 < 10;
      this.lightBarRed.material.color.setHex(redOn ? 0xff2a2a : 0x5a0f0f);
      this.lightBarBlue.material.color.setHex(redOn ? 0x0f2a5a : 0x2a6bff);
    }
    if (this.smoke) {
      // Damage smoke: thickens as health falls, pulsing on the frame counter.
      this._smokeT += 1;
      const hurt = this.health < CAR.smokeBelow ? 1 - this.health / CAR.smokeBelow : 0;
      const pulse = 0.55 + Math.sin(this._smokeT * 0.18) * 0.3;
      this.smoke.material.opacity = hurt * pulse;
      const s = 1.6 + hurt * 1.2 + Math.sin(this._smokeT * 0.11) * 0.3;
      this.smoke.scale.set(s, s, 1);
    }
  }

  // Arcade step: throttle -1..1, steer -1..1, handbrake bool. Returns distance moved.
  drive(dt, throttle, steer, handbrake) {
    const forward = throttle > 0 ? 1 : -1;
    const accel = throttle !== 0 ? CAR.accel * Math.abs(throttle) : 0;
    this.speed += forward * accel * dt;
    if (throttle === 0) this.speed = damp(this.speed, 0, 2.5, dt);
    // Handbrake is a slide, not a stop: it bleeds speed slowly (rate 1.0)
    // so the car keeps sliding at 10+ m/s while held and the drift timer
    // can reach its 0.8 s payout. At rate 6 the car dropped under 10 m/s
    // in 0.2 s and a drift could never pay out.
    if (handbrake) this.speed = damp(this.speed, 0, 1.0, dt);
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
