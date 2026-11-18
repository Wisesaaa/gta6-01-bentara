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
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 5), new THREE.MeshLambertMaterial({ color: 0x1d2a3a }));
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1;
    const spot = new THREE.Mesh(
      new THREE.ConeGeometry(6, 26, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    spot.position.y = -13;
    spot.rotation.x = Math.PI;
    group.add(body, rotor, spot);
    group.position.set(0, 34, 0);
    scene.add(group);
    heli = { group, rotor, spot, unitName: HELI_NAME, status: 'SPOTLIGHT' };
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

  return { step, anyoneSees, units, despawnAll, cruisers, cops, get heli() { return heli; } };
}
