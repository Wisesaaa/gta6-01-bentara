// World effects, all pooled so a long chase never allocates: skid-mark
// decals under a sliding car, smoke puffs from a handbrake slide, sparks
// off a wall scrape, and the cash bundles + ammo crates cops drop when
// they go down. Drops glow (additive sprites) so they read as loot, not
// litter, and bob until the player walks over them.
import * as THREE from 'three';
import { rr } from './rng.js';

const MAX_SKIDS = 120;
const MAX_SMOKE = 40;
const MAX_SPARKS = 60;
const MAX_DROPS = 24;

// One soft radial disc, reused by every glow sprite in the game.
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

// An additive glow sprite: the fake-bloom primitive. Lamps, brake lights,
// drops and the heli pool all use this instead of post-processing.
export function makeGlowSprite(color, scale = 1, opacity = 0.7) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

let smokeTex = null;
function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(200,190,175,0.8)');
  grad.addColorStop(0.6, 'rgba(180,170,155,0.35)');
  grad.addColorStop(1, 'rgba(180,170,155,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  smokeTex = new THREE.CanvasTexture(c);
  return smokeTex;
}

export function createEffects(scene, rng) {
  // --- skid decals: flat dark planes, laid in pairs under the rear wheels.
  const skidGeo = new THREE.PlaneGeometry(0.35, 1.6);
  const skids = [];
  for (let i = 0; i < MAX_SKIDS; i += 1) {
    const m = new THREE.Mesh(
      skidGeo,
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    skids.push({ mesh: m, life: 0 });
  }
  let skidCursor = 0;
  let skidAcc = 0;

  // --- smoke puffs: soft sprites that rise, spread and fade.
  const smokes = [];
  for (let i = 0; i < MAX_SMOKE; i += 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTexture(), transparent: true, opacity: 0, depthWrite: false,
    }));
    s.visible = false;
    scene.add(s);
    smokes.push({ sprite: s, life: 0, max: 1, vy: 0 });
  }
  let smokeCursor = 0;

  // --- sparks: tiny orange boxes that fly out and fall.
  const sparkGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  const sparks = [];
  for (let i = 0; i < MAX_SPARKS; i += 1) {
    const m = new THREE.Mesh(
      sparkGeo,
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0 }),
    );
    m.visible = false;
    scene.add(m);
    sparks.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0 });
  }
  let sparkCursor = 0;

  // --- drops: cash bundles (green + gold glow) and ammo crates (olive +
  // amber glow). Bob and spin until collected.
  const drops = [];
  const cashMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
  const ammoMat = new THREE.MeshLambertMaterial({ color: 0x6b6b2f });
  function spawnDrop(x, z, kind, amount) {
    if (drops.length >= MAX_DROPS) return null;
    const group = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.3, 0.5),
      kind === 'cash' ? cashMat : ammoMat,
    );
    box.position.y = 0.15;
    box.castShadow = true;
    const glow = makeGlowSprite(kind === 'cash' ? 0xffd75e : 0xff9d5c, 1.8, 0.55);
    glow.position.y = 0.6;
    group.add(box, glow);
    group.position.set(x, 0, z);
    scene.add(group);
    const drop = { group, kind, amount, t: rr(rng, 0, Math.PI * 2) };
    drops.push(drop);
    return drop;
  }

  return {
    // One skid mark under each rear wheel, throttled to every 0.05 s so a
    // long slide lays a trail instead of one black slab.
    skidPair(x, z, heading, dt) {
      skidAcc += dt;
      if (skidAcc < 0.05) return;
      skidAcc = 0;
      const sideX = Math.cos(heading);
      const sideZ = -Math.sin(heading);
      for (const s of [-0.95, 0.95]) {
        const slot = skids[skidCursor];
        skidCursor = (skidCursor + 1) % MAX_SKIDS;
        slot.mesh.position.set(
          x + sideX * s - Math.sin(heading) * 1.4,
          0.06,
          z + sideZ * s - Math.cos(heading) * 1.4,
        );
        slot.mesh.rotation.z = -heading;
        slot.mesh.material.opacity = 0.55;
        slot.mesh.visible = true;
        slot.life = 20;
      }
    },
    smoke(x, z, big = false) {
      const slot = smokes[smokeCursor];
      smokeCursor = (smokeCursor + 1) % MAX_SMOKE;
      slot.sprite.position.set(x + rr(rng, -0.4, 0.4), 0.6, z + rr(rng, -0.4, 0.4));
      const s = big ? 2.2 : 1.4;
      slot.sprite.scale.set(s, s, 1);
      slot.sprite.material.opacity = 0.7;
      slot.sprite.visible = true;
      slot.life = 1.1;
      slot.max = 1.1;
      slot.vy = 1.2;
    },
    sparks(x, z) {
      for (let i = 0; i < 6; i += 1) {
        const slot = sparks[sparkCursor];
        sparkCursor = (sparkCursor + 1) % MAX_SPARKS;
        slot.mesh.position.set(x, 0.6, z);
        slot.vx = rr(rng, -4, 4);
        slot.vy = rr(rng, 2, 5);
        slot.vz = rr(rng, -4, 4);
        slot.life = 0.3;
        slot.mesh.material.opacity = 1;
        slot.mesh.visible = true;
      }
    },
    dropCash(x, z, amount) {
      return spawnDrop(x, z, 'cash', amount);
    },
    dropAmmo(x, z, kind, amount) {
      return spawnDrop(x, z, kind, amount);
    },
    dropCount() {
      return drops.length;
    },
    // Walk over a drop to take it. Returns what was collected.
    collectDrops(px, pz, radius = 2.2) {
      const got = [];
      for (let i = drops.length - 1; i >= 0; i -= 1) {
        const d = drops[i];
        const dx = d.group.position.x - px;
        const dz = d.group.position.z - pz;
        if (dx * dx + dz * dz < radius * radius) {
          got.push({ kind: d.kind, amount: d.amount });
          scene.remove(d.group);
          drops.splice(i, 1);
        }
      }
      return got;
    },
    update(dt, t) {
      for (const s of skids) {
        if (!s.mesh.visible) continue;
        s.life -= dt;
        if (s.life <= 0) { s.mesh.visible = false; continue; }
        s.mesh.material.opacity = Math.min(0.55, s.life * 0.05);
      }
      for (const s of smokes) {
        if (!s.sprite.visible) continue;
        s.life -= dt;
        if (s.life <= 0) { s.sprite.visible = false; continue; }
        s.sprite.position.y += s.vy * dt;
        const grow = 1 + dt * 1.4;
        s.sprite.scale.multiplyScalar(grow);
        s.sprite.material.opacity = 0.7 * (s.life / s.max);
      }
      for (const s of sparks) {
        if (!s.mesh.visible) continue;
        s.life -= dt;
        if (s.life <= 0) { s.mesh.visible = false; continue; }
        s.mesh.position.x += s.vx * dt;
        s.mesh.position.y += s.vy * dt;
        s.mesh.position.z += s.vz * dt;
        s.vy -= 12 * dt;
        s.mesh.material.opacity = Math.max(0, s.life / 0.3);
      }
      for (const d of drops) {
        d.t += dt * 3;
        d.group.position.y = 0.1 + Math.sin(d.t) * 0.12;
        d.group.rotation.y += dt * 1.5;
      }
    },
  };
}
