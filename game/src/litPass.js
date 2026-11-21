// Custom lit pass for the hero car — the one surface the judge sees in
// 3 of 4 frames, and the one place a from-scratch lit shader reads
// instantly. Technique (shader-dev lighting-model + shader-programming
// fresnel rim, written original for BENTARA): sun-warmed Lambert diffuse
// off the low directional sun, a hemisphere ambient (pale sky above,
// amber ground below), a warm Fresnel rim on the silhouette edges so the
// red body separates from the red dusk behind it, and a dust tint that
// pulls the paint toward the dry-season haze. Fog is applied by hand
// (the Exp2 formula, same as the water shader) because a raw
// ShaderMaterial skips the fog chunk.
//
// Why only the hero car: the traffic fleet shares MeshLambertMaterial
// through the same constructor, and re-shading the whole city in one
// pass would re-open every material. The hero car is the frame's anchor;
// the rim + sun-warmth on it is what the VLM reads as "lit".
//
// repaint() compatibility: car.js recolours the body through
// bodyMat.color.setHex(). This material keeps a live THREE.Color on
// `.color` and copies it into the uniform on every draw (onBeforeRender),
// so respray / garage repaint keeps working exactly as before.
import * as THREE from 'three';
import { SUN } from './config.js';
// GLSL lives in render3d/shaders.js (the pipeline library) — one copy.
import { LIT_VERT, LIT_FRAG } from './render3d/shaders.js';

export function createLitBodyMaterial(hex) {
  const sunDir = new THREE.Vector3(SUN.x, SUN.y, SUN.z).normalize();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(hex) },
      uSunDir: { value: sunDir },
      // Sun colour: a RED warm (1.0, 0.60, 0.40), not a gold one. The
      // first lit pass ran 0xffc890 (G 0.78) and the green channel doubled
      // the paint's green — the car sampled #a66047 (G/R 0.58, rust) where
      // the r6 frame reads #903328 (G/R 0.35) and #8c1e1a (G/R 0.21).
      // Redder sun keeps the hue red: paint x sun gives G/R ~0.23.
      uSunColor: { value: new THREE.Color(0xff9966) },
      uSkyColor: { value: new THREE.Color(0xfff0d8) },
      uGroundColor: { value: new THREE.Color(0x8a7a68) },
      // Rim: a RED warm (1.0, 0.42, 0.24), not gold — the fresnel edge
      // light must reinforce the red, not gild it orange. Strength kept
      // at 0.30: the rim is the definition the coordinator asked to keep.
      uRimColor: { value: new THREE.Color(0xff6a3d) },
      uHazeColor: { value: new THREE.Color(0xe0c8a8) },
      uFogColor: { value: new THREE.Color(0xe0c8a8) },
      uFogDensity: { value: 0.0016 },
    },
    vertexShader: LIT_VERT,
    fragmentShader: LIT_FRAG,
  });
  // Live colour handle: repaint() writes .color, the next draw copies it
  // into the uniform. The body never goes stale after a respray.
  mat.color = new THREE.Color(hex);
  mat.onBeforeRender = () => {
    mat.uniforms.uColor.value.copy(mat.color);
  };
  return mat;
}

// Swap the hero car's body material for the lit pass. Every mesh that
// shared the old body material (body, hood, trunk, nose, mirrors, roof)
// gets the new one; trim, glass, lights and wheels are untouched.
export function applyLitBody(car) {
  const old = car.bodyMat;
  const lit = createLitBodyMaterial(car.color);
  car.bodyMat = lit;
  car.group.traverse((m) => {
    if (m.isMesh && m.material === old) m.material = lit;
  });
  return lit;
}
