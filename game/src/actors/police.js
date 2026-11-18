// Police: cruisers that ram, foot cops that shoot, a helicopter from 4 stars,
// and a roadblock from 3 stars. Counts follow the wanted level; names are
// local wind and bird words, and every live unit reports name, distance and
// status for the response list in the HUD.
import * as THREE from 'three';
import { Car } from './car.js';
import { Human } from './human.js';
import { HEAT } from '../config.js';
import { pick, rr } from '../rng.js';
import { dist, clamp, wrapAngle } from '../mathx.js';

const CRUISER_NAMES = ['BAYU', 'ANGIN', 'SAMBAR', 'KIJANG', 'ELANG'];
const COP_NAMES = ['MERAK', 'CENDRAWASIH'];
const HELI_NAME = 'GARUDA-1';

export function createPolice(scene, city, rng) {
  const cruisers = [];
  const cops = [];
  let heli = null;
  let roadblock = null;
  let shootTimer = 0;

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
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
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
    // Spotlight cone, hung under the nose and aimed at the player below.
    const spot = new THREE.Mesh(
      new THREE.ConeGeometry(4.0, 26, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
    );
    spot.position.set(0, -13, 1.6);
    spot.rotation.x = Math.PI;
    group.add(body, stripe, nose, boom, fin, tailRotor, mast, rotor, disc, skidL, skidR, strobe, strobeGlow, spot);
    group.position.set(0, 34, 0);
    scene.add(group);
    heli = { group, rotor, tailRotor, strobe, strobeGlow, spot, unitName: HELI_NAME, status: 'SPOTLIGHT' };
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
    return car;
  }

  function despawnAll() {
    for (const c of cruisers) c.dispose();
    for (const c of cops) c.dispose(scene);
    if (heli) { scene.remove(heli.group); heli = null; }
    if (roadblock) { roadblock.dispose(); roadblock = null; }
    cruisers.length = 0;
    cops.length = 0;
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
    if (heat < HEAT.heliFrom && heli) { scene.remove(heli.group); heli = null; }
    if (heat >= 3 && !roadblock) spawnRoadblock(px, pz, heading);
    if (heat < 3 && roadblock) { roadblock.dispose(); roadblock = null; }
  }

  function step(dt, ctx) {
    const { px, pz, heading, playerInCar, heat } = ctx;
    matchStrength(heat, px, pz, heading);
    // Cruisers: steer toward the player and ram; close in, they read RAMMING.
    for (const c of cruisers) {
      const d = dist(c.x, c.z, px, pz);
      const want = Math.atan2(px - c.x, pz - c.z);
      const turn = clamp(wrapAngle(want - c.heading), -1, 1);
      c.status = d < 12 ? 'RAMMING' : 'PURSUIT';
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
    // Helicopter: hover ahead-left of the player, low enough to stay in the
    // chase camera's frame, spotlight pinned on them.
    if (heli) {
      const t = ctx.t || 0;
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const lx = Math.cos(heading);
      const lz = -Math.sin(heading);
      heli.group.position.set(
        px + fx * 22 + lx * 8,
        17 + Math.sin(t * 0.7) * 1.5,
        pz + fz * 22 + lz * 8,
      );
      heli.group.lookAt(px, 0, pz);
      heli.rotor.rotation.y += dt * 22;
      heli.tailRotor.rotation.x += dt * 30;
      // Strobe blinks twice a second on sim time, never wall-clock.
      const strobeOn = Math.floor(t * 2) % 2 === 0;
      heli.strobe.visible = strobeOn;
      heli.strobeGlow.visible = strobeOn;
    }
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

  return { step, anyoneSees, units, despawnAll, cruisers, cops, get heli() { return heli; }, get roadblock() { return roadblock; } };
}
