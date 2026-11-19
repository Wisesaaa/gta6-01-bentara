// Kill drops: cops and attackers drop glowing cash bundles and ammo
// crates when they go down. Additive glow floats so the pickup reads at
// golden-hour distance. Walk over one to collect it — cash pays straight
// into the wallet, ammo tops up the matching reserve.
import * as THREE from 'three';
import { dist } from './mathx.js';

function glowSprite(color, size) {
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
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

export function createDrops(scene, rng, hooks) {
  const items = [];
  const group = new THREE.Group();
  scene.add(group);

  function spawn(kind, x, z, value) {
    const color = kind === 'cash' ? 0xffd75e : kind === 'armor' ? 0x7dd8ff : 0x2fd8c8;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.35, 0.7),
      new THREE.MeshLambertMaterial({ color }),
    );
    box.position.set(x, 0.5, z);
    const glow = glowSprite(color, 2.4);
    glow.position.set(x, 0.7, z);
    group.add(box, glow);
    items.push({ kind, value, x, z, box, glow, life: 45, phase: rng() * Math.PI * 2 });
    return items[items.length - 1];
  }

  function spawnCash(x, z, value) { return spawn('cash', x, z, value); }
  function spawnAmmo(x, z, value) { return spawn('ammo', x, z, value); }
  function spawnArmor(x, z, value) { return spawn('armor', x, z, value); }

  function update(dt, t, px, pz) {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const it = items[i];
      it.life -= dt;
      it.box.position.y = 0.5 + Math.sin(t * 3 + it.phase) * 0.15;
      it.box.rotation.y += dt * 2;
      it.glow.position.y = it.box.position.y + 0.2;
      it.glow.material.opacity = 0.6 + Math.sin(t * 4 + it.phase) * 0.25;
      if (it.life <= 0) {
        group.remove(it.box, it.glow);
        items.splice(i, 1);
        continue;
      }
      if (dist(px, pz, it.x, it.z) < 2.5) {
        group.remove(it.box, it.glow);
        items.splice(i, 1);
        if (hooks.onPickup) hooks.onPickup(it);
      }
    }
  }

  function clear() {
    for (const it of items.splice(0)) group.remove(it.box, it.glow);
  }

  return {
    spawn, spawnCash, spawnAmmo, spawnArmor, update, clear,
    get count() { return items.length; },
    get list() { return items; },
  };
}
