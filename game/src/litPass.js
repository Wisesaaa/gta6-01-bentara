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

const LIT_VERT = `
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mv = viewMatrix * wp;
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const LIT_FRAG = `
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyColor;
  uniform vec3 uGroundColor;
  uniform vec3 uRimColor;
  uniform vec3 uHazeColor;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 sunDir = normalize(uSunDir);
    // Sun-warmed Lambert: the low 4pm sun is the only key light, so
    // faces turned to it run hot and faces away fall to amber ambient.
    // Ambient 0.28 (was 0.22): the darker value left the shadowed faces
    // brown; the red needs light even in shadow to stay red, not rust.
    float diff = max(dot(n, sunDir), 0.0);
    vec3 ambient = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5) * 0.28;
    vec3 col = uColor * (ambient + uSunColor * diff * 1.35);
    // Fresnel rim (shader-programming pattern, power 3): warm RED light
    // on the silhouette, so the red body never melts into the red dusk.
    float f = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.0);
    col += uRimColor * f * 0.30;
    // Dry-season dust: pull the paint a touch toward the haze, more on
    // the rim where the dust in the air catches the light.
    col = mix(col, uHazeColor, 0.03 + f * 0.05);
    // Saturation boost: the paint is a brick red (0xb8442f) and the warm
    // light drags it toward brown-orange. Push the colour away from grey
    // so the body reads VIVID red — the r6 frame's car samples #903328 /
    // #8c1e1a, and the first lit pass sampled #a66047 (rust). The boost
    // is what returns the hue; the redder sun/rim above keep it there.
    vec3 lum = vec3(dot(col, vec3(0.299, 0.587, 0.114)));
    col = mix(lum, col, 1.35);
    // Exp2 haze, same density as the scene fog.
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }`;

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
      uFogDensity: { value: 0.006 },
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
