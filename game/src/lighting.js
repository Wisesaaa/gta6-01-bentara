// Golden-hour lighting: a gradient sky dome, a low sun disc with halo,
// drifting dust motes and slow dust devils. All of it is kemarau — warm
// amber haze over bleached concrete — never a sunset bay.
import * as THREE from 'three';
import { SKY_TOP, SKY_HORIZON, HAZE_COLOR, HAZE_NEAR, HAZE_FAR, SUN, SUN_COLOR, SUN_INTENSITY } from './config.js';
import { rr } from './rng.js';

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  // v2.1: deeper, hotter stops — the old gradient washed out to pale cream
  // under ACES + fog. Dusty blue on top, saturated amber at the horizon,
  // still kemarau gold, never a sunset bay.
  grad.addColorStop(0, '#4f83b8');
  grad.addColorStop(0.42, '#e07f3a');
  grad.addColorStop(0.62, '#ff8a2e');
  grad.addColorStop(0.78, '#ffb03d');
  grad.addColorStop(1, '#e0914f');
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

export function createGoldenHour(scene, city, rng) {
  const glowTex = glowTexture();
  const dustTex = dustTexture();

  // Sky dome: a big sphere, inside-out, painted with the vertical
  // gradient — dusty blue at the top, hot amber at the horizon. Fog does
  // not touch it (fog: false), so the horizon stays amber at any distance.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(dome);

  // The sun itself: a bright disc low in the west plus a wide halo, both
  // unlit so they read through the haze. The disc sits just above the
  // skyline, where the cover camera looks down the arterial.
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
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.9, depthWrite: false, fog: false }),
  );
  halo.position.copy(sunPos);
  halo.lookAt(0, 0, 0);
  scene.add(halo);

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
  // the one kemarau weather effect no rival has.
  const devils = [];
  for (let k = 0; k < 3; k += 1) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 9, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xd8b078, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.position.set(rr(rng, -120, 120), 4.5, rr(rng, -120, 120));
    scene.add(cone);
    devils.push({ mesh: cone, phase: rr(rng, 0, Math.PI * 2), speed: rr(rng, 0.12, 0.3), cx: cone.position.x, cz: cone.position.z });
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
      d.mesh.position.x = d.cx + Math.sin(d.phase) * 26;
      d.mesh.position.z = d.cz + Math.cos(d.phase * 0.7) * 26;
      d.mesh.rotation.y += dt * 1.4;
    }
    halo.material.opacity = 0.82 + Math.sin(t * 0.4) * 0.08;
  }

  return { update, dome, disc, halo, motes };
}

// Re-tune a renderer + scene for golden hour: warm fog, filmic tone
// mapping with a lifted exposure so the amber reads as hard 4pm sun.
export function applyGoldenHour(renderer, scene) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  scene.background = new THREE.Color(SKY_HORIZON);
  scene.fog = new THREE.Fog(HAZE_COLOR, HAZE_NEAR, HAZE_FAR);
}

export { SUN_COLOR, SUN_INTENSITY };
