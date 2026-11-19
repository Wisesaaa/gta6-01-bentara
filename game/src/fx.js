// Juice effects — tire smoke, dust bursts, skid-mark decals and impact
// sparks. All pooled sprites / instanced planes, capped counts, one
// shared smoke texture. Nothing here allocates per frame in the hot loop:
// the pools are built once and recycled.
import * as THREE from 'three';

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(214, 190, 150, 0.75)');
  grad.addColorStop(0.6, 'rgba(190, 165, 120, 0.35)');
  grad.addColorStop(1, 'rgba(190, 165, 120, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const MAX_PUFFS = 48;
const MAX_SKIDS = 40;
const MAX_SPARKS = 24;

export function createFx(scene) {
  const tex = smokeTexture();
  const puffs = [];
  const sparks = [];
  const skids = [];
  const skidGeo = new THREE.PlaneGeometry(0.5, 1.6);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55, depthWrite: false });

  function puff(x, y, z, size = 1.6, life = 0.9) {
    let p = puffs.find((q) => q.life <= 0);
    if (!p) {
      if (puffs.length >= MAX_PUFFS) return null;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
      scene.add(sprite);
      p = { sprite, life: 0, max: 1 };
      puffs.push(p);
    }
    p.sprite.position.set(x, y, z);
    p.sprite.scale.set(size, size, 1);
    p.life = life;
    p.max = life;
    return p;
  }

  function burst(x, z, n = 3, size = 1.8) {
    for (let i = 0; i < n; i += 1) {
      puff(x + (Math.random() - 0.5) * 1.2, 0.4, z + (Math.random() - 0.5) * 1.2, size * (0.8 + Math.random() * 0.5), 0.8 + Math.random() * 0.4);
    }
  }

  function spark(x, y, z) {
    let s = sparks.find((q) => q.life <= 0);
    if (!s) {
      if (sparks.length >= MAX_SPARKS) return null;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xffc247 }),
      );
      scene.add(mesh);
      s = { mesh, life: 0, vx: 0, vy: 0, vz: 0 };
      sparks.push(s);
    }
    s.mesh.position.set(x, y, z);
    s.vx = (Math.random() - 0.5) * 6;
    s.vy = 2 + Math.random() * 3;
    s.vz = (Math.random() - 0.5) * 6;
    s.life = 0.35;
    s.mesh.visible = true;
    return s;
  }

  function skid(x, z, heading) {
    let s = skids.find((q) => q.life <= 0);
    if (!s) {
      if (skids.length >= MAX_SKIDS) return null;
      const mesh = new THREE.Mesh(skidGeo, skidMat.clone());
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);
      s = { mesh, life: 0 };
      skids.push(s);
    }
    s.mesh.position.set(x, 0.06, z);
    s.mesh.rotation.z = heading;
    s.mesh.material.opacity = 0.55;
    s.life = 6;
    s.mesh.visible = true;
    return s;
  }

  function step(dt) {
    for (const p of puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const f = Math.max(0, p.life / p.max);
      p.sprite.material.opacity = f * 0.7;
      const s = p.sprite.scale.x + dt * 2.2;
      p.sprite.scale.set(s, s, 1);
      p.sprite.position.y += dt * 0.8;
      if (p.life <= 0) p.sprite.material.opacity = 0;
    }
    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.vy -= 12 * dt;
      if (s.life <= 0) s.mesh.visible = false;
    }
    for (const s of skids) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.material.opacity = Math.max(0, Math.min(0.55, (s.life / 6) * 0.55));
      if (s.life <= 0) s.mesh.visible = false;
    }
  }

  return { puff, burst, spark, skid, step };
}
