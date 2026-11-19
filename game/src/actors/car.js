// A car: body, cabin, four wheels, headlights. Arcade handling — throttle,
// steering that bites harder at low speed, handbrake slide — and solid
// collision against the city's AABB walls.
//
// The mesh is built in five passes, one job each: buildChassis (the low
// body, hood, trunk, splitter, skirts, diffuser), buildGlasshouse (cabin,
// sloped windshield, roof), buildAero (spoiler, scoop and stripe — the
// sport silhouette), buildLightBar (full-width headlight/taillight strips
// and exhausts), buildWheelSet (tyres plus rim discs, so wheels read from
// the side instead of hiding under the body). Cop kit, angkot kit and the
// ojek rider bolt on afterwards.
//
// Kinds: sedan (the default), sport (the player's CEMPAKA GT: lower,
// wider stance, spoiler, stripe), angkot (tall minibus with a yellow roof
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

let sharedGlowTex = null;
function glowTextureShared() {
  if (sharedGlowTex) return sharedGlowTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sharedGlowTex = new THREE.CanvasTexture(c);
  return sharedGlowTex;
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
  sport: { len: 1.08, h: 0.82, cabin: 0.8, wheels: 4, sport: true },
  angkot: { len: 1.15, h: 1.25, cabin: 1.35, wheels: 4 },
  bajaj: { len: 0.55, h: 0.85, cabin: 0.9, wheels: 3 },
  ojek: { len: 0.5, h: 0.7, cabin: 0, wheels: 2 },
  truck: { len: 1.6, h: 1.1, cabin: 0.8, wheels: 6 },
};

// Shared dark trim material: splitter, skirts, diffuser, grille, spoiler.
const TRIM = 0x17171a;
const RIM = 0xb8b8b0;

export class Car {
  static glowTexture() { return glowTextureShared(); }

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
    // Garage performance: per-car multipliers set by the garage (engine /
    // grip upgrades). boostAccel is set by the player while NOS is held;
    // fuelFactor halves the top speed under 15% fuel.
    this.perf = { topSpeed: 1, grip: 1, turbo: 0 };
    this.boostAccel = 0;
    this.fuelFactor = 1;
    this.garageId = opts.garageId || null;

    const shape = KIND_SHAPE[this.kind] || KIND_SHAPE.sedan;
    const len = CAR.length * shape.len;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.isCop ? PALETTE.cop : this.color });
    const trimMat = new THREE.MeshLambertMaterial({ color: TRIM });
    const glassMat = new THREE.MeshLambertMaterial({ color: this.isCop ? 0x24344a : 0x5d7a8a });
    this.bodyMat = bodyMat;
    this.buildChassis(group, bodyMat, trimMat, shape, len);
    this.buildGlasshouse(group, bodyMat, glassMat, shape, len);
    if (shape.sport) this.buildAero(group, bodyMat, trimMat, shape, len);
    this.buildLightBar(group, trimMat, len);
    if (this.isCop) this.buildCopKit(group, len);
    if (this.kind === 'angkot') this.buildAngkotKit(group, len);
    if (this.kind === 'ojek') this.buildRider(group);
    this.buildWheelSet(group, shape, len);
    this.buildSmoke(group, len);
    group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    group.position.set(this.x, 0, this.z);
    group.rotation.y = this.heading;
    scene.add(group);
    this.group = group;
    this.scene = scene;
    // Register headlight cones in the scene rig so the lighting preset can
    // toggle them per act (on in Act 3 red dusk).
    if (this.headlightCones && this.headlightCones.length) {
      const rig = scene.userData.lightRig;
      if (rig) rig.headlightCones = (rig.headlightCones || []).concat(this.headlightCones);
      else scene.userData.pendingHeadlightCones = (scene.userData.pendingHeadlightCones || []).concat(this.headlightCones);
    }
  }

  // Pass 1 — the low body: a slab, a lower narrower hood up front and a
  // lower narrower trunk at the rear, so the car tapers at both ends
  // instead of reading as one plain box from the chase camera. The dark
  // trim underneath — splitter, side skirts, rear diffuser — draws the
  // ground line and makes the body sit on its wheels.
  buildChassis(group, bodyMat, trimMat, shape, len) {
    const w = CAR.width;
    const bodyH = 0.65 * shape.h;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, len), bodyMat);
    body.position.y = 0.55 * shape.h;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(w - 0.25, 0.4 * shape.h, 0.9), bodyMat);
    hood.position.set(0, 0.62 * shape.h, len / 2 - 0.35);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(w - 0.25, 0.42 * shape.h, 0.7), bodyMat);
    trunk.position.set(0, 0.63 * shape.h, -len / 2 + 0.25);
    // Sloped nose: a thin wedge tilted down toward the front, so the hood
    // line falls instead of stopping flat.
    const nose = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.1, 0.55), bodyMat);
    nose.position.set(0, 0.52 * shape.h, len / 2 + 0.05);
    nose.rotation.x = -0.28;
    // Dark ground trim.
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.12, 0.5), trimMat);
    splitter.position.set(0, 0.16, len / 2 - 0.05);
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(w - 0.15, 0.16, 0.4), trimMat);
    diffuser.position.set(0, 0.18, -len / 2 + 0.05);
    group.add(body, hood, trunk, nose, splitter, diffuser);
    for (const sx of [-1, 1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, len * 0.62), trimMat);
      skirt.position.set(sx * (w / 2 - 0.02), 0.2, -0.1);
      group.add(skirt);
      // Side mirror: a small stalk + head at the front of the cabin line.
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.22), bodyMat);
      mirror.position.set(sx * (w / 2 + 0.06), 0.95 * shape.h, len * 0.18);
      group.add(mirror);
    }
  }

  // Pass 2 — the glasshouse: pale blue-grey glass, clearly lighter than
  // the body, with a body-colour roof panel, a windshield sloped back
  // from the hood and a rear window sloped down to the trunk.
  buildGlasshouse(group, bodyMat, glassMat, shape, len) {
    if (shape.cabin <= 0) return;
    const w = CAR.width;
    const cabinY = (0.55 + 0.55 * shape.cabin / 2) * shape.h;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.3, 0.55 * shape.cabin, len * 0.45),
      glassMat,
    );
    cabin.position.set(0, cabinY, -0.2);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w - 0.45, 0.08, len * 0.42), bodyMat);
    roof.position.set(0, (0.55 + 0.55 * shape.cabin) * shape.h + 0.04, -0.2);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(w - 0.34, 0.5 * shape.cabin, 0.06), glassMat);
    shield.position.set(0, cabinY + 0.05, len * 0.03);
    shield.rotation.x = -0.38;
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.34, 0.45 * shape.cabin, 0.06), glassMat);
    rearGlass.position.set(0, cabinY + 0.02, -len * 0.24);
    rearGlass.rotation.x = 0.3;
    group.add(cabin, roof, shield, rearGlass);
  }

  // Pass 3 — sport aero only: a rear wing on two struts, a hood scoop and
  // a dark centre stripe over hood, roof and trunk. These three pieces are
  // what make the CEMPAKA GT read as a sports car from behind at a glance.
  buildAero(group, bodyMat, trimMat, shape, len) {
    const w = CAR.width;
    const wingY = (0.55 + 0.55 * shape.cabin) * shape.h + 0.32;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.07, 0.34), trimMat);
    wing.position.set(0, wingY, -len / 2 + 0.28);
    wing.rotation.x = -0.08;
    group.add(wing);
    for (const sx of [-0.6, 0.6]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.12), trimMat);
      strut.position.set(sx, wingY - 0.16, -len / 2 + 0.28);
      group.add(strut);
    }
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.6), trimMat);
    scoop.position.set(0, 0.86 * shape.h, len / 2 - 0.7);
    group.add(scoop);
    // Centre stripe: three flat panels laid over hood, roof and trunk.
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x1d2a3a });
    const stripeHood = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.95), stripeMat);
    stripeHood.position.set(0, 0.84 * shape.h, len / 2 - 0.4);
    const stripeRoof = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, len * 0.42), stripeMat);
    stripeRoof.position.set(0, (0.55 + 0.55 * shape.cabin) * shape.h + 0.09, -0.2);
    const stripeTrunk = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.7), stripeMat);
    stripeTrunk.position.set(0, 0.86 * shape.h, -len / 2 + 0.25);
    group.add(stripeHood, stripeRoof, stripeTrunk);
  }

  // Pass 4 — lights and exhausts: one full-width warm-white strip up
  // front and one full-width red strip at the rear, a dark grille between
  // the headlights, and twin exhaust pipes under the diffuser. From the
  // chase camera the rear strip is the car's signature.
  buildLightBar(group, trimMat, len) {
    const w = CAR.width;
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
    const headStrip = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 0.13, 0.08), headMat);
    headStrip.position.set(0, 0.62, len / 2 + 0.02);
    // Dark backing plate so the red tail strip reads against the red
    // body from the chase camera instead of vanishing into it.
    const tailPlate = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 0.24, 0.05), trimMat);
    tailPlate.position.set(0, 0.62, -len / 2 - 0.01);
    const tailStrip = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 0.13, 0.08), tailMat);
    tailStrip.position.set(0, 0.62, -len / 2 - 0.05);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(w - 0.7, 0.2, 0.06), trimMat);
    grille.position.set(0, 0.42, len / 2 + 0.02);
    group.add(headStrip, tailStrip, grille);
    // Fake bloom: a small additive glow sprite over the tail strip, so the
    // brake light blooms at golden hour without a composer pass.
    const tailGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: Car.glowTexture(), color: 0xff2a1e, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    tailGlow.position.set(0, 0.62, -len / 2 - 0.15);
    tailGlow.scale.set(2.4, 1.2, 1);
    group.add(tailGlow);
    this.tailGlow = tailGlow;
    // Headlight cones: additive cones aimed forward, OFF except in Act 3
    // (red dusk), when the world lights up. Registered in the scene rig so
    // the lighting preset can toggle them per act.
    this.headlightCones = [];
    for (const sx of [-0.6, 0.6]) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 7, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      cone.rotation.x = Math.PI / 2 - 0.06;
      cone.position.set(sx, 0.5, len / 2 + 3.5);
      cone.visible = false;
      group.add(cone);
      this.headlightCones.push(cone);
    }
    for (const sx of [-0.45, 0.45]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.22, 8),
        new THREE.MeshLambertMaterial({ color: 0x3a3a3a }),
      );
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(sx, 0.22, -len / 2 - 0.08);
      group.add(pipe);
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
    // Alternating glow sprites over each half of the bar: the fake-bloom
    // flash. ~5 Hz (6 frames on, 6 off at 60 fps), driven by sync().
    const redGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: Car.glowTexture(), color: 0xff2a2a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    redGlow.position.set(-0.23, 1.55, -0.2);
    redGlow.scale.set(1.8, 1.8, 1);
    const blueGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: Car.glowTexture(), color: 0x2a6bff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    blueGlow.position.set(0.23, 1.55, -0.2);
    blueGlow.scale.set(1.8, 1.8, 1);
    group.add(redGlow, blueGlow);
    this.lightBarGlowRed = redGlow;
    this.lightBarGlowBlue = blueGlow;
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

  // Pass 5 — wheels: dark tyres out at the body's flanks so they show
  // from the side, each with a pale rim disc on its outer face so the
  // wheel reads as a wheel, not a black blob, from the chase camera.
  buildWheelSet(group, shape, len) {
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.3, 10);
    const rimMat = new THREE.MeshLambertMaterial({ color: RIM });
    this.wheels = [];
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
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, 0.36, wz);
      group.add(w, rim);
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
      // Blink on a frame counter, not wall-clock time, so shots stay
      // deterministic. 12-frame cycle: 6 red, 6 blue — ~5 Hz per colour.
      this._blink = (this._blink || 0) + 1;
      const redOn = this._blink % 12 < 6;
      this.lightBarRed.material.color.setHex(redOn ? 0xff2a2a : 0x5a0f0f);
      this.lightBarBlue.material.color.setHex(redOn ? 0x0f2a5a : 0x2a6bff);
      if (this.lightBarGlowRed) {
        this.lightBarGlowRed.material.opacity = redOn ? 0.9 : 0.12;
        this.lightBarGlowBlue.material.opacity = redOn ? 0.12 : 0.9;
      }
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
  // Garage performance applies here: engine upgrades lift the top speed,
  // grip upgrades bite harder in a turn, NOS adds acceleration while the
  // player holds Shift, and low fuel halves the top speed.
  drive(dt, throttle, steer, handbrake) {
    const forward = throttle > 0 ? 1 : -1;
    const accel = throttle !== 0 ? CAR.accel * Math.abs(throttle) : 0;
    this.speed += forward * accel * dt;
    if (this.boostAccel) this.speed += this.boostAccel * dt;
    if (throttle === 0) this.speed = damp(this.speed, 0, 2.5, dt);
    // Handbrake is a slide, not a stop: it bleeds speed slowly (rate 1.0)
    // so the car keeps sliding at 10+ m/s while held and the drift timer
    // can reach its 0.8 s payout. At rate 6 the car dropped under 10 m/s
    // in 0.2 s and a drift could never pay out.
    if (handbrake) this.speed = damp(this.speed, 0, 1.0, dt);
    const perfTop = CAR.maxSpeed * (this.perf ? this.perf.topSpeed : 1) * (this.fuelFactor || 1);
    const perfRev = CAR.maxReverse * (this.perf ? this.perf.topSpeed : 1);
    this.speed = clamp(this.speed, -perfRev, perfTop);
    if (Math.abs(this.speed) > 0.3) {
      const grip = (handbrake ? 0.5 : 1) * (this.perf ? this.perf.grip : 1);
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
