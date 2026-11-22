// BENTARA sky + sun pass — a dedicated GLSL sky dome for the dry-season
// 4pm grade: pale bleached sky, warm haze at the horizon, a low sun with
// a forward-scatter halo, and thin drifting cloud wisps.
//
// Technique (shader-dev: atmospheric-scattering, analytic variant — no
// ray march, one fragment shader on a 900 m shell):
//   * Rayleigh-ish 3-stop gradient: zenith pale blue (#bfd4e6) -> mid
//     pale cream -> horizon warm haze (#f2e3c8). The dry season at 4pm:
//     bleached concrete under a pale sky, warm at the horizon, never
//     apocalyptic red.
//   * Mie forward scattering, Henyey-Greenstein-flavoured: a Schlick
//     approximation of the HG phase function warms the sky toward the
//     sun, strongest near the horizon where the aerosol haze sits.
//   * Sun disc via smoothstep on the view/sun cosine, plus a two-lobe
//     halo (tight core + wide glow) so the sun reads as light in the
//     air, not a painted disc.
//   * Haze band hugging the horizon, strength driven by uHaze.
//   * Thin clouds: cheap hash-based value noise, 3 octaves of FBM,
//     projected onto a plane above the horizon and drifting slowly
//     with uTime. Wisps only — the dry season has almost no cloud.
//
// Wiring (this module creates NO lights — lighting.js already owns the
// sun + hemisphere rig; double-lighting would blow out the grade):
//   const sky = createSkyAndSun(scene, { camera });
//   // per frame: sky.update(dt, t);
//   // to move the sun: sky.setSunDirection(new THREE.Vector3(...));
//   // on teardown: sky.dispose();
// The dome follows opts.camera when one is given, so the player can
// never walk out to the shell edge.
//
// GLSL lives in render3d/shaders.js (the pipeline library) — one copy.
import * as THREE from 'three';
import { SKY_VERT as VERT, SKY_FRAG as FRAG } from './render3d/shaders.js';

// Default sun direction matches the lighting rig's SUN vector
// (230, 72, 60) normalised — low, ~15° north of due east, ~17° elevation, r14.
const DEFAULT_SUN_DIR = new THREE.Vector3(230, 72, 60).normalize();

export function createSkyAndSun(scene, opts = {}) {
  const sunDir = opts.sunDirection
    ? opts.sunDirection.clone().normalize()
    : opts.sunDir
      ? opts.sunDir.clone().normalize()
      : DEFAULT_SUN_DIR.clone();
  const camera = opts.camera || null;

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDirection: { value: sunDir },
      uTime: { value: 0 },
      uHaze: { value: opts.haze !== undefined ? opts.haze : 0.38 },
      // Defaults match the Act 1 grade (lighting.js PRESETS[1]) so the
      // first frame already carries the warm sunset grade.
      uTopColor: { value: new THREE.Color(0x8fa8c0) },
      uMidColor: { value: new THREE.Color(0xf0b878) },
      uBottomColor: { value: new THREE.Color(0xffc890) },
      uSunColor: { value: new THREE.Color(0xffb060) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), material);
  // Render behind everything: the dome is the farthest thing in the
  // scene and never writes depth, so it can never occlude the city.
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  scene.add(mesh);

  function update(dt, t) {
    // Absolute time drives the cloud drift (shader-programming rule:
    // drive with an absolute time uniform, not a per-frame accumulator).
    material.uniforms.uTime.value = t;
    if (camera) mesh.position.copy(camera.position);
  }

  function setSunDirection(dir) {
    const d = dir.isVector3
      ? dir.clone().normalize()
      : new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    material.uniforms.uSunDirection.value.copy(d);
  }

  // Per-act grade (lighting.js PRESETS): hex numbers or THREE.Color.
  // Haze is optional — Act 3 dusk runs thicker (0.5) than Act 1 (0.38).
  // Both cut from r7 (0.55 / 0.7): the haze was washing the world pale.
  function setGrade(top, mid, bottom, sun, haze) {
    material.uniforms.uTopColor.value.set(top);
    material.uniforms.uMidColor.value.set(mid);
    material.uniforms.uBottomColor.value.set(bottom);
    material.uniforms.uSunColor.value.set(sun);
    if (haze !== undefined) material.uniforms.uHaze.value = haze;
  }

  function dispose() {
    scene.remove(mesh);
    mesh.geometry.dispose();
    material.dispose();
  }

  return { mesh, update, setSunDirection, setGrade, dispose };
}
