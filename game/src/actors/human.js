// A person on foot: peds, cops, attackers and named NPCs share one body.
// Built from boxes so the whole crowd stays cheap; legs swing while walking.
import * as THREE from 'three';
import { PLAYER } from '../config.js';

const SKIN = [0xc89b6d, 0x8a5a3b, 0xe0b184, 0x6b4423];
const SHIRT = [0x4a6b8a, 0x8a4a4a, 0x4a7a5a, 0xd8cdb2, 0x7a5a8a, 0x3f5a78];

export class Human {
  constructor(scene, rng, role = 'ped') {
    this.role = role;
    this.health = 100;
    this.alive = true;
    this.speed = 0;
    this.heading = rng ? rng() * Math.PI * 2 : 0;
    this.walkPhase = rng ? rng() * 6 : 0;
    const shirt = role === 'cop' ? 0x1d2a3a : role === 'attacker' ? 0x6b1f1f : SHIRT[Math.floor((rng ? rng() : 0.5) * SHIRT.length)];
    const skin = SKIN[Math.floor((rng ? rng() : 0.5) * SKIN.length)];
    this.group = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.28), mat(shirt));
    this.torso.position.y = 1.05;
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), mat(skin));
    this.head.position.y = 1.58;
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), mat(0x2e2a24));
    this.legL.position.set(-0.13, 0.35, 0);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.13;
    this.group.add(this.torso, this.head, this.legL, this.legR);
    if (role === 'cop' || role === 'attacker') {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), mat(0x111111));
      gun.position.set(0.2, 1.15, 0.3);
      this.group.add(gun);
      this.gun = gun;
    }
    if (role === 'npc') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1, 24),
        new THREE.MeshBasicMaterial({ color: 0xffd75e, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      this.group.add(ring);
    }
    this.group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    scene.add(this.group);
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }
  setPos(x, z) { this.group.position.x = x; this.group.position.z = z; }
  face(heading) { this.heading = heading; this.group.rotation.y = heading; }

  // Walk at `speed` m/s toward the heading; legs swing with the phase.
  walk(dt, speed) {
    this.speed = speed;
    this.group.position.x += Math.sin(this.heading) * speed * dt;
    this.group.position.z += Math.cos(this.heading) * speed * dt;
    this.walkPhase += dt * speed * 2.2;
    const swing = Math.sin(this.walkPhase) * 0.5 * Math.min(1, speed / 3);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0 && this.alive) {
      this.alive = false;
      this.group.rotation.x = -Math.PI / 2;
      this.group.position.y = 0.2;
      return true;
    }
    return false;
  }

  dispose(scene) { scene.remove(this.group); }
}

export { PLAYER };
