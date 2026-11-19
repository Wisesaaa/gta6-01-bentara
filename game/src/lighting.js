// Golden-hour lighting rig: a real shader sky dome
// (burnt-orange horizon -> blood-red mid -> bruised-purple top), an
// exponential haze fog, a low amber sun with a halo, fake bloom as
// additive glow sprites (no post-processing — nothing here needs an
// EffectComposer), a haze band on the horizon, dust motes and dust
// devils. Three per-act presets snap the grade when a mission starts:
// morning gold, high amber, red dusk with the windows lit.
import * as THREE from 'three';
import { PALETTE, SUN } from './config.js';
import { makeGlowSprite } from './effects.js';

export const SUN_COLOR = 0xffb367;
export const SUN_INTENSITY = 3.4;

// One preset per act. The grade is a mood, not a number the player ever
// sees — but the red dusk of Act 3 is what makes the last missions feel
// like the end of the dry season.
const PRESETS = {
  1: {
    sun: 0xffb367, sunIntensity: 3.4,
    hemiSky: 0xffd2a1, hemiGround: 0x5a2a1a, hemiIntensity: 0.95,
    fogColor: 0xe0925a, fogDensity: 0.011, exposure: 1.28,
    skyBottom: 0xff9a4e, skyMid: 0xe0563a, skyTop: 0x40203e,
    lampGlow: 0.4, litOpacity: 0.85,
  },
  2: {
    sun: 0xffc06a, sunIntensity: 3.9,
    hemiSky: 0xffd2a1, hemiGround: 0x6a3a22, hemiIntensity: 1.05,
    fogColor: 0xe89a58, fogDensity: 0.009, exposure: 1.32,
    skyBottom: 0xffb05e, skyMid: 0xe56a3e, skyTop: 0x4a2438,
    lampGlow: 0.35, litOpacity: 0.8,
  },
  3: {
    sun: 0xff7a3c, sunIntensity: 2.9,
    hemiSky: 0xe8a06a, hemiGround: 0x4a2018, hemiIntensity: 0.8,
    fogColor: 0xc96a3a, fogDensity: 0.014, exposure: 1.15,
    skyBottom: 0xe0703a, skyMid: 0xc94a30, skyTop: 0x2e142e,
    lampGlow: 0.8, litOpacity: 1.0,
  },
};

function skyDomeMaterial(preset) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(preset.skyTop) },
      midColor: { value: new THREE.Color(preset.skyMid) },
      bottomColor: { value: new THREE.Color(preset.skyBottom) },
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
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        // Horizon band: bottom colour low, mid through the middle,
        // top colour only high overhead.
        vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.22, h));
        col = mix(col, topColor, smoothstep(0.2, 0.65, h));
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
  grad.addColorStop(0, 'rgba(224,146,90,0)');
  grad.addColorStop(0.5, 'rgba(224,146,90,0.55)');
  grad.addColorStop(1, 'rgba(224,146,90,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function applyGoldenHour(renderer, scene) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  // The dome covers the sky; this is only the fallback behind it.
  scene.background = new THREE.Color(0xe0563a);
  scene.fog = new THREE.FogExp2(0xe0925a, 0.011);
}

export function createGoldenHour(scene, city, rng, lights = {}) {
  const preset = PRESETS[1];
  const { sun, hemi } = lights;

  // --- sky dome: 900 m shell, shader gradient, never fogged.
  const domeMat = skyDomeMaterial(preset);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), domeMat);
  scene.add(dome);

  // --- the sun itself: a hard disc low over the avenue + a halo sprite.
  // The disc is near-white and large enough to read against the orange
  // sky (r3's small yellow disc washed out), and the halo MUST ignore
  // fog — a SpriteMaterial fogs by default, and at 815 m the Exp2 haze
  // erased it entirely, which is why r3 had no visible sun at all.
  const sunDir = new THREE.Vector3(SUN.x, SUN.y, SUN.z).normalize();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(48, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }),
  );
  disc.position.copy(sunDir).multiplyScalar(820);
  disc.lookAt(0, 0, 0);
  scene.add(disc);
  const halo = makeGlowSprite(0xffb367, 340, 1.0);
  halo.material.fog = false;
  halo.position.copy(sunDir).multiplyScalar(815);
  scene.add(halo);

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
  }

  return { update, applyAct, get act() { return currentAct; } };
}
