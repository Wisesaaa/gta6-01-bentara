// Custom postFx pipeline — the real thing, not presets. Built from the
// shader-dev techniques (post-processing, atmospheric-scattering,
// water-ocean, volumetric-rendering, particle-system, multipass-buffer)
// translated into Three.js ShaderMaterial passes on the vendored r160
// WebGLRenderer, wired per threejs-webgl (r160 addons live at
// three/examples/jsm/postprocessing/ — but the vendored tree ships only
// three.module.min.js, so the composer is hand-rolled on THREE core:
// WebGLRenderTarget ping-pong + fullscreen-quad ShaderMaterials, exactly
// the multipass-buffer pattern). No addon import, no three.js upgrade.
//
// Chain (per frame):
//   scene -> HDR target -> bright-pass + downsample (1/4) -> blur H -> blur V
//   -> composite: bloom add + ACES tone map + bleached grade + vignette +
//   chromatic aberration + film grain + Bayer dither -> screen.
// Cost: one fullscreen composite + three quarter-res passes. Bloom at 1/4
// res, CA first to go if the frame rate ever dips — never the frame rate.
// Tone mapping lives ONLY here: the renderer is switched to NoToneMapping
// while the composer is active, so ACES runs exactly once (the
// threejs-materials-lighting gotcha: an EffectComposer chain without an
// OutputPass renders dark and double-toned).
import * as THREE from 'three';

const QUAD_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

// Bright-pass: keep only what glows (sun disc, halo, lightbars, lit
// windows, muzzle flash) — soft knee so the grade never clips hard.
const BRIGHT_FRAG = `
  uniform sampler2D tDiffuse;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float k = smoothstep(uThreshold, uThreshold + 0.45, l);
    gl_FragColor = vec4(c * k, 1.0);
  }`;

// Separable 9-tap Gaussian (multipass-buffer weights, sigma ~2.0).
// One axis per pass: 121 samples become 2x9.
const BLUR_FRAG = `
  uniform sampler2D tDiffuse;
  uniform vec2 uDirection;
  varying vec2 vUv;
  void main() {
    vec2 px = uDirection;
    vec3 s = vec3(0.0);
    s += texture2D(tDiffuse, vUv - 4.0 * px).rgb * 0.05;
    s += texture2D(tDiffuse, vUv - 3.0 * px).rgb * 0.09;
    s += texture2D(tDiffuse, vUv - 2.0 * px).rgb * 0.12;
    s += texture2D(tDiffuse, vUv - 1.0 * px).rgb * 0.15;
    s += texture2D(tDiffuse, vUv).rgb * 0.16;
    s += texture2D(tDiffuse, vUv + 1.0 * px).rgb * 0.15;
    s += texture2D(tDiffuse, vUv + 2.0 * px).rgb * 0.12;
    s += texture2D(tDiffuse, vUv + 3.0 * px).rgb * 0.09;
    s += texture2D(tDiffuse, vUv + 4.0 * px).rgb * 0.05;
    gl_FragColor = vec4(s / 0.98, 1.0);
  }`;

// Composite: bloom add (HDR space, before tonemapping — the order is not
// reversible), chromatic aberration, bleached grade, ACES, S-curve,
// vignette, grain + Bayer dither against banding. Math per
// shader-programming (mix/step/smoothstep, no reversed smoothstep edges)
// and post-processing (ACES m1/m2 rational polynomial).
const COMPOSITE_FRAG = `
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uBloomStrength;
  uniform float uExposure;
  uniform float uCaStrength;
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  vec3 acesTonemap(vec3 color) {
    mat3 m1 = mat3(0.59719, 0.07600, 0.02840,
                   0.35458, 0.90834, 0.13383,
                   0.04823, 0.01566, 0.83777);
    mat3 m2 = mat3(1.60475, -0.10208, -0.00327,
                   -0.53108, 1.10813, -0.07276,
                   -0.07367, -0.00605, 1.07602);
    vec3 v = m1 * color;
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return clamp(m2 * (a / b), 0.0, 1.0);
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 uv = vUv;
    // Chromatic aberration: sample R/B pulled apart from G, scaled by
    // distance from the centre — the lens trio (CA + vignette + grain).
    vec2 dir = uv - 0.5;
    float ca = uCaStrength * dot(dir, dir) * 4.0;
    vec3 col;
    col.r = texture2D(tScene, uv + dir * ca).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv - dir * ca).b;
    // Bloom in HDR space, then the grade.
    col += texture2D(tBloom, uv).rgb * uBloomStrength;
    // Bleached grade: pull 8% toward luma (dry-season dust), warm the
    // highlights a touch — bleached concrete, never neon.
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(luma), 0.08);
    col *= vec3(1.05, 1.0, 0.93);
    // ACES + gamma (the composite is the OutputPass: this is the only
    // tone map + sRGB conversion in the chain).
    col = acesTonemap(col * uExposure);
    col = pow(col, vec3(1.0 / 2.2));
    // Gentle S-curve for contrast (kept light: the shadow side of a
    // facade must stay readable, not crush to black).
    col = clamp(col, 0.0, 1.0);
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.2);
    // Vignette (post-processing option A) — light, so frame edges keep
    // their HUD and buildings readable.
    vec2 q = uv;
    float vig = pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.25);
    col *= 0.65 + 0.35 * vig;
    // Film grain + Bayer ordered dither (kills banding in the pale sky).
    float g = hash12(uv * uResolution + fract(uTime) * 61.7) - 0.5;
    col += g * 0.012;
    col += (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) - 0.5) * (2.0 / 255.0);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }`;

function makeTarget(w, h, hdr) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: true,
    stencilBuffer: false,
  });
}

export function createPostFx(renderer, scene, camera) {
  // HDR target needs EXT_color_buffer_float; SwiftShader and desktop
  // Chrome both expose it, but fall back to LDR rather than a black
  // frame if the extension is missing (multipass-buffer rule).
  let hdr = false;
  try {
    hdr = !!renderer.getContext().getExtension('EXT_color_buffer_float');
  } catch (e) { hdr = false; }
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const w = Math.max(2, size.x | 0);
  const h = Math.max(2, size.y | 0);
  const bw = Math.max(2, w >> 2);
  const bh = Math.max(2, h >> 2);

  const sceneRT = makeTarget(w, h, hdr);
  const bloomA = makeTarget(bw, bh, false);
  const bloomB = makeTarget(bw, bh, false);

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeo, null);
  quad.frustumCulled = false;
  quadScene.add(quad);

  const brightMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: BRIGHT_FRAG,
    uniforms: {
      tDiffuse: { value: sceneRT.texture },
      uThreshold: { value: hdr ? 1.0 : 0.75 },
    },
    depthTest: false, depthWrite: false,
  });
  const blurMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: BLUR_FRAG,
    uniforms: {
      tDiffuse: { value: null },
      uDirection: { value: new THREE.Vector2(1 / bw, 0) },
    },
    depthTest: false, depthWrite: false,
  });
  const compMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: COMPOSITE_FRAG,
    uniforms: {
      tScene: { value: sceneRT.texture },
      tBloom: { value: bloomA.texture },
      uBloomStrength: { value: 0.45 },
      uExposure: { value: 1.3 },
      uCaStrength: { value: 0.0035 },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(w, h) },
    },
    depthTest: false, depthWrite: false,
  });

  // Tone mapping runs exactly once, in the composite (OutputPass role).
  const prevToneMapping = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;

  function quadPass(mat, target) {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  }

  let time = 0;
  let enabled = true;
  let caEnabled = true;

  return {
    get enabled() { return enabled; },
    setEnabled(v) { enabled = !!v; },
    // First to go if the frame rate dips — never the frame rate itself.
    setCaEnabled(v) {
      caEnabled = !!v;
      compMat.uniforms.uCaStrength.value = caEnabled ? 0.0035 : 0.0;
    },
    setBloomStrength(v) { compMat.uniforms.uBloomStrength.value = v; },
    setExposure(v) { compMat.uniforms.uExposure.value = v; },
    render() {
      time += 1 / 60;
      compMat.uniforms.uTime.value = time;
      if (!enabled) {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        return;
      }
      // Pass 1: scene into the HDR target.
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
      // Pass 2: bright-pass + downsample to 1/4.
      quadPass(brightMat, bloomA);
      // Pass 3-4: separable blur H then V (ping-pong).
      blurMat.uniforms.tDiffuse.value = bloomA.texture;
      blurMat.uniforms.uDirection.value.set(1 / bw, 0);
      quadPass(blurMat, bloomB);
      blurMat.uniforms.tDiffuse.value = bloomB.texture;
      blurMat.uniforms.uDirection.value.set(0, 1 / bh);
      quadPass(blurMat, bloomA);
      // Pass 5: composite to screen.
      quadPass(compMat, null);
    },
    resize(nw, nh) {
      const dw = Math.max(2, nw | 0);
      const dh = Math.max(2, nh | 0);
      const nbw = Math.max(2, dw >> 2);
      const nbh = Math.max(2, dh >> 2);
      sceneRT.setSize(dw, dh);
      bloomA.setSize(nbw, nbh);
      bloomB.setSize(nbw, nbh);
      compMat.uniforms.uResolution.value.set(dw, dh);
      blurMat.uniforms.uDirection.value.set(1 / nbw, 0);
    },
    dispose() {
      renderer.toneMapping = prevToneMapping;
      sceneRT.dispose();
      bloomA.dispose();
      bloomB.dispose();
      quadGeo.dispose();
      brightMat.dispose();
      blurMat.dispose();
      compMat.dispose();
    },
  };
}
