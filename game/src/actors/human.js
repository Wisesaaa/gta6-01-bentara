// A person on foot: peds, cops, attackers, taxi passengers and named NPCs
// share one body. Built from boxes so the whole crowd stays cheap; legs
// swing while walking. Hats vary (peci, cap, bare hair) so the crowd is
// not thirty clones, and a taxi passenger wears yellow and waves.
import * as THREE from 'three';
import { PLAYER } from '../config.js';

const SKIN = [0xc89b6d, 0x8a5a3b, 0xe0b184, 0x6b4423];
const SHIRT = [0x4a6b8a, 0x8a4a4a, 0x4a7a5a, 0xd8cdb2, 0x7a5a8a, 0x3f5a78, 0xc0392b, 0xd8a13a];
const HATS = ['none', 'cap', 'peci', 'none', 'hair'];

function buildHead(group, skin, hat, mat) {
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), mat(skin));
  head.position.y = 1.58;
  group.add(head);
  if (hat === 'cap') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), mat(0x2f6b4f));
    cap.position.y = 1.76;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.2), mat(0x2f6b4f));
    brim.position.set(0, 1.72, 0.22);
    group.add(cap, brim);
  } else if (hat === 'peci') {
    const peci = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.12, 10), mat(0x1d2a3a));
    peci.position.y = 1.78;
    group.add(peci);
  } else if (hat === 'hair') {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), mat(0x1a1a1a));
    hair.position.y = 1.76;
    group.add(hair);
  }
  return head;
}

export class Human {
  constructor(scene, rng, role = 'ped') {
    this.role = role;
    this.health = 100;
    this.alive = true;
    this.speed = 0;
    this.heading = rng ? rng() * Math.PI * 2 : 0;
    this.walkPhase = rng ? rng() * 6 : 0;
    const shirt = role === 'cop' ? 0x1d2a3a : role === 'attacker' ? 0x6b1f1f : role === 'taxi' ? 0xffd75e : SHIRT[Math.floor((rng ? rng() : 0.5) * SHIRT.length)];
    const skin = SKIN[Math.floor((rng ? rng() : 0.5) * SKIN.length)];
    const hat = role === 'cop' ? 'cap' : HATS[Math.floor((rng ? rng() : 0.5) * HATS.length)];
    this.group = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.28), mat(shirt));
    this.torso.position.y = 1.05;
    this.head = buildHead(this.group, skin, hat, mat);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), mat(0x2e2a24));
    this.legL.position.set(-0.13, 0.35, 0);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.13;
    // Arms: the taxi passenger's right arm stays raised, waving.
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), mat(shirt));
    this.armL.position.set(-0.32, 1.05, 0);
    this.armR = this.armL.clone();
    this.armR.position.x = 0.32;
    if (role === 'taxi') {
      this.armR.position.y = 1.35;
      this.armR.rotation.z = -2.4;
    }
    this.group.add(this.torso, this.legL, this.legR, this.armL, this.armR);
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
    if (role === 'taxi') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.1, 24),
        new THREE.MeshBasicMaterial({ color: 0x2fd8c8, side: THREE.DoubleSide }),
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
    if (this.role !== 'taxi') {
      this.armL.rotation.x = -swing * 0.7;
      this.armR.rotation.x = swing * 0.7;
    }
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
