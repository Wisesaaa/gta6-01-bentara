// Lighting rig — the v3 grade. Suplemen top-6–10 spec, no postprocessing:
// a low directional sun (~11° elevation) with 2048 shadows, hemisphere
// fill, a shader-graded sky dome (bottom #ff9a4e → #e0563a → top #40203e),
// an additive sun sprite + halo, Exp2 haze, and FAKE BLOOM — additive
// glow sprites on lamps, signs and brake lights, never a composer pass.
// Per-act presets snap when a mission starts (no day/night cycling):
// Act 1 morning gold, Act 2 high amber, Act 3 red dusk + lit windows.
// Everything stays kemarau — dust, heat, bleach-amber — never a sunset
// bay and never purple synthwave.
import * as THREE from 'three';
import { SKY_TOP, SKY_HORIZON, HAZE_COLOR, SUN, SUN_COLOR, SUN_INTENSITY } from './config.js';
import { rr } from './rng.js';

// One sky gradient per act. Canvas y=0 is the top of the dome.
const ACT_SKIES = {
  1: [[0, '#5f97c4'], [0.42, '#e07f3a'], [0.62, '#ff8a2e'], [0.8, '#ffb03d'], [1, '#ff9a2e']],
  2: [[0, '#40203e'], [0.45, '#e0563a'], [0.75, '#ff8a3c'], [1, '#ff9a4e']],
  3: [[0, '#2a1830'], [0.45, '#c03a2a'], [0.75, '#ff5a26'], [1, '#ff6a2e']],
};
const ACT_SUN = {
  1: { color: 0xffc27a, pos: [250, 84, 95], intensity: 3.2, exposure: 1.25, fog: 0.009, lit: 0.7 },
  2: { color: 0xffb367, pos: [250, 52, 95], intensity: 3.4, exposure: 1.28, fog: 0.011, lit: 0.85 },
  3: { color: 0xff7a3c, pos: [250, 32, 95], intensity: 3.0, exposure: 1.15, fog: 0.013, lit: 1.0 },
};
const ACT_HEMI = {
  1: [0xffe0b0, 0x8a6a4a],
  2: [0xffd2a1, 0x5a2a1a],
  3: [0xffb08a, 0x4a2018],
};

function skyTextureFor(act) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  for (const [stop, color] of ACT_SKIES[act] || ACT_SKIES[2]) grad.addColorStop(stop, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 214, 140, 1)');
  grad.addColorStop(0.25, 'rgba(255, 170, 90, 0.85)');
  grad.addColorStop(0.6, 'rgba(255, 140, 70, 0.25)');
  grad.addColorStop(1, 'rgba(255, 140, 70, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function dustTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 1, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255, 220, 170, 0.9)');
  grad.addColorStop(1, 'rgba(255, 220, 170, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// Fake bloom: one additive glow sprite. Lamps, signs, brake lights and the
// sun get these — the bright things bloom without a composer pass.
let sharedGlowTex = null;
export function attachGlow(scene, x, y, z, size, color = 0xffc27a, opacity = 0.55) {
  if (!sharedGlowTex) sharedGlowTex = glowTexture();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sharedGlowTex, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sprite.position.set(x, y, z);
  sprite.scale.set(size, size, 1);
  scene.add(sprite);
  return sprite;
}

export function createGoldenHour(scene, city, rng) {
  const glowTex = glowTexture();
  const dustTex = dustTexture();
  let skyTex = skyTextureFor(2);

  // Sky dome: a big sphere, inside-out, painted with the vertical
  // gradient — dark plum top, red mid, hot amber at the horizon. Fog does
  // not touch it (fog: false), so the horizon stays amber at any distance.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  scene.add(dome);

  // The sun itself: a bright disc low in the west plus a wide additive
  // halo, both unlit so they read through the haze. The disc sits just
  // above the skyline, where the cover camera looks down the avenue.
  const sunDir = new THREE.Vector3(SUN.x, SUN.y, SUN.z).normalize();
  const sunPos = sunDir.clone().multiplyScalar(820);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
  );
  disc.position.copy(sunPos);
  disc.lookAt(0, 0, 0);
  scene.add(disc);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 340),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
  );
  halo.position.copy(sunPos);
  halo.lookAt(0, 0, 0);
  scene.add(halo);

  // Haze band at the horizon: a huge open cylinder of translucent amber
  // hugging the skyline, so the city sits in a visible layer of heat.
  const hazeBand = new THREE.Mesh(
    new THREE.CylinderGeometry(860, 860, 60, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xe0925a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }),
  );
  hazeBand.position.y = 22;
  scene.add(hazeBand);

  // Dust motes: a few hundred slow specks drifting across the whole city,
  // denser near the roads. They catch the light and make the air visible.
  const moteCount = 420;
  const motePos = new Float32Array(moteCount * 3);
  const moteSeed = [];
  for (let i = 0; i < moteCount; i += 1) {
    motePos[i * 3] = rr(rng, -190, 190);
    motePos[i * 3 + 1] = rr(rng, 0.5, 14);
    motePos[i * 3 + 2] = rr(rng, -190, 190);
    moteSeed.push({ drift: rr(rng, 0.2, 0.9), bob: rr(rng, 0, Math.PI * 2) });
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    map: dustTex, size: 0.9, transparent: true, opacity: 0.55,
    depthWrite: false, color: 0xffd9a0, sizeAttenuation: true,
  }));
  scene.add(motes);

  // Dust devils: three slow translucent columns wandering the arterials —
  // the one kemarau weather effect no rival has — plus a fast spinner
  // anchored on the plaza, where the foot shot looks.
  const devils = [];
  for (let k = 0; k < 3; k += 1) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 9, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xd8b078, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.position.set(rr(rng, -120, 120), 4.5, rr(rng, -120, 120));
    scene.add(cone);
    devils.push({ mesh: cone, phase: rr(rng, 0, Math.PI * 2), speed: rr(rng, 0.12, 0.3), cx: cone.position.x, cz: cone.position.z, spin: 1.4 });
  }
  const plazaDevil = new THREE.Mesh(
    new THREE.ConeGeometry(3.0, 12, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xd8b078, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  plazaDevil.position.set(0, 6, 0);
  scene.add(plazaDevil);
  devils.push({ mesh: plazaDevil, phase: 0, speed: 0.5, cx: 0, cz: 0, spin: 3.2, anchored: true });

  // The directional sun + hemisphere are owned by world.js (createView) —
  // setActPreset reaches them through the scene's userData, set there.
  function setAct(act, renderer) {
    const preset = ACT_SUN[act] || ACT_SUN[2];
    const hemiColors = ACT_HEMI[act] || ACT_HEMI[2];
    const oldTex = skyTex;
    skyTex = skyTextureFor(act);
    dome.material.map = skyTex;
    dome.material.needsUpdate = true;
    if (oldTex) oldTex.dispose();
    const rig = scene.userData.lightRig;
    if (rig) {
      rig.sun.color.setHex(preset.color);
      rig.sun.position.set(preset.pos[0], preset.pos[1], preset.pos[2]);
      rig.sun.intensity = preset.intensity;
      rig.hemi.color.setHex(hemiColors[0]);
      rig.hemi.groundColor.setHex(hemiColors[1]);
      if (rig.litMesh) rig.litMesh.material.opacity = preset.lit;
      for (const cone of rig.headlightCones || []) cone.visible = act === 3;
    }
    if (scene.fog) scene.fog.density = preset.fog;
    if (renderer) renderer.toneMappingExposure = preset.exposure;
    // The sun disc + halo follow the preset sun direction.
    const dir = new THREE.Vector3(preset.pos[0], preset.pos[1], preset.pos[2]).normalize();
    const pos = dir.clone().multiplyScalar(820);
    disc.position.copy(pos);
    disc.lookAt(0, 0, 0);
    halo.position.copy(pos);
    halo.lookAt(0, 0, 0);
    return act;
  }

  function update(dt, t) {
    // Motes drift east with the wind and bob gently; the positions wrap
    // around the city so the field never thins out.
    const arr = moteGeo.attributes.position.array;
    for (let i = 0; i < moteCount; i += 1) {
      arr[i * 3] += moteSeed[i].drift * dt;
      arr[i * 3 + 1] += Math.sin(t * 0.6 + moteSeed[i].bob) * dt * 0.12;
      if (arr[i * 3] > 195) arr[i * 3] = -195;
    }
    moteGeo.attributes.position.needsUpdate = true;
    for (const d of devils) {
      d.phase += dt * d.speed;
      if (!d.anchored) {
        d.mesh.position.x = d.cx + Math.sin(d.phase) * 26;
        d.mesh.position.z = d.cz + Math.cos(d.phase * 0.7) * 26;
      }
      d.mesh.rotation.y += dt * d.spin;
    }
    halo.material.opacity = 0.82 + Math.sin(t * 0.4) * 0.08;
  }

  return { update, dome, disc, halo, motes, setAct };
}

// Re-tune a renderer + scene for golden hour: warm Exp2 haze, filmic tone
// mapping with a lifted exposure so the amber reads as hard 4pm sun.
export function applyGoldenHour(renderer, scene) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  scene.background = new THREE.Color(SKY_HORIZON);
  scene.fog = new THREE.FogExp2(HAZE_COLOR, 0.011);
}

export { SUN_COLOR, SUN_INTENSITY };
