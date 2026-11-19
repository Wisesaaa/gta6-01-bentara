// Golden-hour lighting rig: a real shader sky dome with atmospheric
// scattering (shader-dev: Rayleigh-ish 3-stop gradient + Henyey-Greenstein
// Mie forward glow around the low sun — analytic, no ray march), an
// exponential haze fog, a low warm sun with a halo, fake bloom as additive
// glow sprites (the real bloom now lives in postfx.js), a haze band on
// the horizon, dust motes and dust devils. Three per-act presets snap the
// grade when a mission starts: morning gold, high amber, red dusk with the
// windows lit. Act 3 keeps some dusk warmth — the last missions feel like
// the end of the dry season — but even dusk stays paler than blood-red.
import * as THREE from 'three';
import { PALETTE, SUN } from './config.js';
import { makeGlowSprite } from './effects.js';

export const SUN_COLOR = 0xffc890;
export const SUN_INTENSITY = 3.0;

// One preset per act. The grade is a mood, not a number the player ever
// sees — but the pale 4pm grade is what the brief asks for: bleached
// concrete under a pale sky, warm at the horizon, never apocalyptic red.
const PRESETS = {
  1: {
    sun: 0xffc890, sunIntensity: 3.0,
    hemiSky: 0xfff0d8, hemiGround: 0x8a7a68, hemiIntensity: 1.05,
    fogColor: 0xe0c8a8, fogDensity: 0.006, exposure: 1.3,
    skyBottom: 0xffe0b8, skyMid: 0xecc9a0, skyTop: 0x9ab0c4,
    lampGlow: 0.4, litOpacity: 0.85,
  },
  2: {
    sun: 0xffc890, sunIntensity: 3.2,
    hemiSky: 0xfff0d8, hemiGround: 0x8a7a68, hemiIntensity: 1.1,
    fogColor: 0xe4ccac, fogDensity: 0.005, exposure: 1.32,
    skyBottom: 0xffe8c0, skyMid: 0xeed0a8, skyTop: 0xa0b4c8,
    lampGlow: 0.35, litOpacity: 0.8,
  },
  3: {
    sun: 0xff9a5a, sunIntensity: 2.6,
    hemiSky: 0xf8d0a8, hemiGround: 0x6a4a3a, hemiIntensity: 0.85,
    fogColor: 0xd8a888, fogDensity: 0.008, exposure: 1.25,
    skyBottom: 0xf0b088, skyMid: 0xd88a68, skyTop: 0x7a5a6a,
    lampGlow: 0.8, litOpacity: 1.0,
  },
};

function skyDomeMaterial(preset) {
  // Atmospheric scattering, analytic variant (no ray march — one
  // fragment shader on a 900 m shell): the 3-stop Rayleigh-ish gradient
  // (pale-cream horizon -> pale-peach mid -> pale blue-grey top, a
  // bleached 4pm sky, NOT a red sunset) plus a Mie forward-scatter glow
  // that warms the sky toward the sun and a tight sun halo. The glow is
  // what makes the 4pm sun read as light in the air, not a painted disc.
  const sunDir = new THREE.Vector3(SUN.x, SUN.y, SUN.z).normalize();
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(preset.skyTop) },
      midColor: { value: new THREE.Color(preset.skyMid) },
      bottomColor: { value: new THREE.Color(preset.skyBottom) },
      sunDir: { value: sunDir },
      sunColor: { value: new THREE.Color(preset.sun) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        // Horizon band: bottom colour low, mid through the middle,
        // top colour only high overhead.
        vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.22, h));
        col = mix(col, topColor, smoothstep(0.2, 0.65, h));
        // Mie forward scattering: the sky warms toward the sun, strongest
        // near the horizon (haze) and tightest right around the disc.
        float sunAmt = max(dot(normalize(vDir), sunDir), 0.0);
        float low = 1.0 - smoothstep(0.0, 0.4, h);
        col = mix(col, sunColor, pow(sunAmt, 3.0) * 0.22 * (0.4 + 0.6 * low));
        col += sunColor * pow(sunAmt, 24.0) * 0.5;
        col += sunColor * pow(sunAmt, 350.0) * 1.4;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function hazeBandTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(224,200,168,0)');
  grad.addColorStop(0.5, 'rgba(224,200,168,0.45)');
  grad.addColorStop(1, 'rgba(224,200,168,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function applyGoldenHour(renderer, scene) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  // The dome covers the sky; this is only the fallback behind it.
  scene.background = new THREE.Color(0xecc9a0);
  scene.fog = new THREE.FogExp2(0xe0c8a8, 0.006);
}

export function createGoldenHour(scene, city, rng, lights = {}) {
  const preset = PRESETS[1];
  const { sun, hemi } = lights;

  // --- sky dome: 900 m shell, shader gradient, never fogged.
  const domeMat = skyDomeMaterial(preset);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), domeMat);
  scene.add(dome);

  // --- the sun itself: a hard disc low over the avenue + a halo sprite.
  // The disc is near-white and large enough to read against the pale
  // sky (r3's small yellow disc washed out), and the halo MUST ignore
  // fog — a SpriteMaterial fogs by default, and at 815 m the Exp2 haze
  // erased it entirely, which is why r3 had no visible sun at all.
  const sunDir = new THREE.Vector3(SUN.x, SUN.y, SUN.z).normalize();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(60, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }),
  );
  disc.position.copy(sunDir).multiplyScalar(820);
  disc.lookAt(0, 0, 0);
  scene.add(disc);
  const halo = makeGlowSprite(0xffc890, 420, 1.0);
  halo.material.fog = false;
  halo.position.copy(sunDir).multiplyScalar(815);
  scene.add(halo);
  // Sun glare: a wide horizontal streak + a soft inner glare, both
  // fog-immune, so the 4pm sun reads as glare, not a flat white disc.
  const streak = makeGlowSprite(0xffe9a8, 1, 0.5);
  streak.material.fog = false;
  streak.material.rotation = -0.12;
  streak.scale.set(760, 64, 1);
  streak.position.copy(sunDir).multiplyScalar(810);
  scene.add(streak);
  const glare = makeGlowSprite(0xfff3b0, 260, 0.35);
  glare.material.fog = false;
  glare.position.copy(sunDir).multiplyScalar(812);
  scene.add(glare);

  // --- haze band: a translucent cylinder hugging the horizon.
  const haze = new THREE.Mesh(
    new THREE.CylinderGeometry(860, 860, 70, 48, 1, true),
    new THREE.MeshBasicMaterial({
      map: hazeBandTexture(), transparent: true, opacity: 0.4,
      side: THREE.BackSide, depthWrite: false, fog: false,
    }),
  );
  haze.position.y = 18;
  scene.add(haze);

  // --- fake bloom on the street lamps: one additive sprite per lamp head.
  // The lamp positions come from the world builder (scene.userData).
  const lampGlows = [];
  const lampSpots = scene.userData.lampSpots || [];
  for (const s of lampSpots) {
    const glow = makeGlowSprite(0xffe9a8, 2.4, preset.lampGlow);
    glow.position.set(s.x + s.sx * 1.8, 5.85, s.z + s.sz * 1.8);
    scene.add(glow);
    lampGlows.push(glow);
  }

  // --- dust motes: 420 specks drifting east, bobbing in the heat.
  const moteCount = 420;
  const moteGeo = new THREE.BufferGeometry();
  const motePos = new Float32Array(moteCount * 3);
  const moteSeed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i += 1) {
    motePos[i * 3] = (rng() - 0.5) * 380;
    motePos[i * 3 + 1] = 0.5 + rng() * 14;
    motePos[i * 3 + 2] = (rng() - 0.5) * 380;
    moteSeed[i] = rng() * Math.PI * 2;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    color: 0xffd9a0, size: 0.35, transparent: true, opacity: 0.6, depthWrite: false,
  }));
  scene.add(motes);

  // --- dust devils: three wandering cones spinning over the plaza.
  const devils = [];
  const devilMat = new THREE.MeshBasicMaterial({
    color: 0xd8b184, transparent: true, opacity: 0.22, depthWrite: false,
  });
  for (let i = 0; i < 3; i += 1) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 10, 1, true), devilMat);
    cone.position.set(-20 + i * 20, 4.5, -10 + i * 8);
    scene.add(cone);
    devils.push({ mesh: cone, phase: rng() * Math.PI * 2, cx: cone.position.x, cz: cone.position.z });
  }

  // --- ash: 260 grey-brown specks drifting west with the wind, falling
  // slowly — the dry season's other airborne signature beside the dust.
  const ashCount = 260;
  const ashGeo = new THREE.BufferGeometry();
  const ashPos = new Float32Array(ashCount * 3);
  const ashSeed = new Float32Array(ashCount);
  for (let i = 0; i < ashCount; i += 1) {
    ashPos[i * 3] = (rng() - 0.5) * 380;
    ashPos[i * 3 + 1] = 0.5 + rng() * 18;
    ashPos[i * 3 + 2] = (rng() - 0.5) * 380;
    ashSeed[i] = rng() * Math.PI * 2;
  }
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  const ash = new THREE.Points(ashGeo, new THREE.PointsMaterial({
    color: 0x8a7a68, size: 0.55, transparent: true, opacity: 0.5, depthWrite: false,
  }));
  scene.add(ash);

  // --- smoke columns: three land-fire columns on the far horizon, each a
  // stack of big dark sprites rising ~100 m — the kemarau skyline, and the
  // reason the ash is in the air. They drift east with the wind, swaying.
  const columns = [];
  const columnSpots = [[-330, -300], [310, -310], [340, 140]];
  for (const [cx, cz] of columnSpots) {
    const sprites = [];
    for (let k = 0; k < 5; k += 1) {
      const s = makeGlowSprite(0x5a4a42, 1, 0.32);
      s.material.blending = THREE.NormalBlending;
      s.material.color.setHex(0x6a5a50);
      s.scale.set(26 + k * 6, 22 + k * 5, 1);
      s.position.set(cx + (rng() - 0.5) * 14, 12 + k * 18, cz + (rng() - 0.5) * 14);
      scene.add(s);
      sprites.push(s);
    }
    columns.push({ sprites, cx, cz, phase: rng() * Math.PI * 2 });
  }

  let currentAct = 1;

  function applyAct(act) {
    const p = PRESETS[act] || PRESETS[1];
    currentAct = act;
    if (sun) {
      sun.color.setHex(p.sun);
      sun.intensity = p.sunIntensity;
    }
    if (hemi) {
      hemi.color.setHex(p.hemiSky);
      hemi.groundColor.setHex(p.hemiGround);
      hemi.intensity = p.hemiIntensity;
    }
    if (scene.fog) {
      scene.fog.color.setHex(p.fogColor);
      scene.fog.density = p.fogDensity;
    }
    const renderer = scene.userData.renderer;
    if (renderer) renderer.toneMappingExposure = p.exposure;
    domeMat.uniforms.topColor.value.setHex(p.skyTop);
    domeMat.uniforms.midColor.value.setHex(p.skyMid);
    domeMat.uniforms.bottomColor.value.setHex(p.skyBottom);
    domeMat.uniforms.sunColor.value.setHex(p.sun);
    for (const g of lampGlows) g.material.opacity = p.lampGlow;
    // Act 3 dusk: the lit windows burn brighter.
    scene.traverse((o) => {
      if (o.isMesh && o.material && o.material.isMeshBasicMaterial
        && o.material.color && o.material.color.getHex() === PALETTE.glassLit) {
        o.material.opacity = p.litOpacity;
      }
    });
  }

  function update(dt, t) {
    // Motes drift east with the wind and bob.
    const pos = moteGeo.attributes.position.array;
    for (let i = 0; i < moteCount; i += 1) {
      pos[i * 3] += dt * 1.6;
      pos[i * 3 + 1] += Math.sin(t * 0.9 + moteSeed[i]) * dt * 0.25;
      if (pos[i * 3] > 190) pos[i * 3] = -190;
    }
    moteGeo.attributes.position.needsUpdate = true;
    // Devils wander the plaza and spin.
    for (const d of devils) {
      d.mesh.rotation.y += dt * 2.2;
      d.mesh.position.x = d.cx + Math.sin(t * 0.25 + d.phase) * 12;
      d.mesh.position.z = d.cz + Math.cos(t * 0.2 + d.phase) * 10;
    }
    // The halo breathes, slowly.
    halo.material.opacity = 0.8 + Math.sin(t * 0.8) * 0.07;
    // Ash drifts west and falls; columns lean east with the wind.
    const apos = ashGeo.attributes.position.array;
    for (let i = 0; i < ashCount; i += 1) {
      apos[i * 3] -= dt * 1.1;
      apos[i * 3 + 1] -= dt * 0.35;
      if (apos[i * 3] < -190) apos[i * 3] = 190;
      if (apos[i * 3 + 1] < 0.4) apos[i * 3 + 1] = 18;
    }
    ashGeo.attributes.position.needsUpdate = true;
    for (const c of columns) {
      c.sprites.forEach((s, k) => {
        s.position.x = c.cx + Math.sin(t * 0.12 + c.phase + k * 0.4) * 8 + Math.sin(t * 0.05 + c.phase) * 10;
        s.material.opacity = 0.26 + Math.sin(t * 0.5 + c.phase + k) * 0.06;
      });
    }
  }

  return { update, applyAct, get act() { return currentAct; } };
}
