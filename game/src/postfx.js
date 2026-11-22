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
//   scene -> HDR target -> [meter: 64x36 encoded-luminance readback ->
//   adapted exposure] -> bright-pass (threshold 0.85) + downsample (1/4)
//   -> blur H -> blur V -> composite: bloom add + anamorphic streak +
//   ghost flares + ACES tone map (once) + ONE 32-cube LUT (dry-dusk
//   recipe, post-tonemap) + vignette + chromatic aberration + film
//   grain + Bayer dither -> screen.
//
// R19 (threejs-postprocessing + threejs-exposure-color-grading):
//   * Selective bloom: bright-pass threshold 0.85, bloom strength 0.7 —
//     only emissives (neon signs, lamps, LED strips at intensity 3-6)
//     clear the threshold; the rest of the scene does not bloom.
//   * Measured grade: the meter renders the HDR scene to 64x36, encodes
//     luminance (enc = L/(L+1)), and the CPU takes the weighted
//     log-average, targets middle gray 0.18, clamps exposure to
//     [0.45, 1.85] and adapts asymmetrically (up 3.2 / down 1.1). The
//     R11/R14 stacked grade (sat 1.25 + S-curve 0.54 + split tone) is
//     DELETED from the composite; the grade lives in one 32-cube LUT.
//   * Tone mapping lives ONLY in the composite: the renderer is switched
//     to NoToneMapping while the composer is active, so ACES runs exactly
//     once (the threejs-materials-lighting gotcha: an EffectComposer
//     chain without an OutputPass renders dark and double-toned).
//
// GLSL lives in render3d/shaders.js (the pipeline library) — one copy.
import * as THREE from 'three';
import {
  POST_QUAD_VERT as QUAD_VERT,
  POST_BRIGHT_FRAG as BRIGHT_FRAG,
  POST_BLUR_FRAG as BLUR_FRAG,
  POST_COMPOSITE_FRAG as COMPOSITE_FRAG,
  POST_METER_FRAG as METER_FRAG,
} from './render3d/shaders.js';

// R19 — the dry-dusk 32-cube LUT, authored once, stored as a 2D atlas
// (8x4 tiles of 32x32 = 256x128). Recipe order per
// threejs-exposure-color-grading (scene-referred-color-pipeline):
// normalize black/white range -> S-curve blend (fixed 0.44) -> contrast
// around 0.5 -> shadow/midtone/highlight tints -> per-channel gamma ->
// saturation -> vibrance -> small highlight glow bias -> clamp [0,1].
// The LUT is authored for the bounded post-tonemap domain: never sample
// it before tone mapping without rebuilding it.
function buildDryDuskLut() {
  const N = 32;
  const data = new Uint8Array(256 * 128 * 4);
  const sstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let b = 0; b < N; b += 1) {
    for (let g = 0; g < N; g += 1) {
      for (let r = 0; r < N; r += 1) {
        let c = [r / 31, g / 31, b / 31];
        const luma0 = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
        c = c.map((v) => Math.min(1, Math.max(0, (v - 0.02) / 0.96)));
        c = c.map((v) => v + (v * v * (3 - 2 * v) - v) * 0.44);
        c = c.map((v) => (v - 0.5) * 1.06 + 0.5);
        const shadow = 1 - sstep(0.12, 0.54, luma0);
        const highlight = sstep(0.48, 0.92, luma0);
        const midtone = Math.max(0, 1 - Math.abs(luma0 - 0.5) * 2);
        const shadowTint = [0.94, 1.0, 1.06];
        const highTint = [1.04, 1.0, 0.94];
        c = c.map((v, i) => v * (1 + (shadowTint[i] - 1) * shadow * 0.5 + (highTint[i] - 1) * highlight * 0.4 + 0 * midtone));
        c = [Math.pow(Math.max(0, c[0]), 1.0), Math.pow(Math.max(0, c[1]), 0.98), Math.pow(Math.max(0, c[2]), 1.02)];
        const luma1 = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
        c = c.map((v) => luma1 + (v - luma1) * 1.05);
        const sat = Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
        c = c.map((v) => luma1 + (v - luma1) * (1 + 0.08 * (1 - sat)));
        c = c.map((v) => v + (1 - v) * 0.02 * luma1);
        c = c.map((v) => Math.min(1, Math.max(0, v)));
        const x = (b % 8) * 32 + r;
        const y = Math.floor(b / 8) * 32 + g;
        const o = (y * 256 + x) * 4;
        data[o] = Math.round(c[0] * 255);
        data[o + 1] = Math.round(c[1] * 255);
        data[o + 2] = Math.round(c[2] * 255);
        data[o + 3] = 255;
      }
    }
  }
  const tex = new THREE.DataTexture(data, 256, 128, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

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
      // R19 selective bloom: threshold 0.85 in HDR — only emissives
      // (neon at intensity 3-6, sun disc, lamp glows) clear it.
      uThreshold: { value: hdr ? 0.85 : 0.7 },
    },
    depthTest: false, depthWrite: false,
  });
  const lutTex = buildDryDuskLut();
  // R19 luminance meter: the HDR scene downsampled to 64x36 with the
  // encoded-luminance pass, read back for the weighted log-average.
  const meterRT = makeTarget(64, 36, false);
  const meterMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: METER_FRAG,
    uniforms: { tDiffuse: { value: sceneRT.texture } },
    depthTest: false, depthWrite: false,
  });
  const meterPixels = new Uint8Array(64 * 36 * 4);
  // Exposure state (threejs-exposure-color-grading defaults): middle
  // gray 0.18, clamp [0.45, 1.85], adapt up 3.2 / down 1.1.
  let meterAvg = 0.18;
  let meterTarget = 1.3;
  let meterCurrent = 1.3;
  let meterSamples = 0;
  function meterUpdate() {
    quadPass(meterMat, meterRT);
    renderer.readRenderTargetPixels(meterRT, 0, 0, 64, 36, meterPixels);
    let sum = 0;
    let wsum = 0;
    for (let i = 0; i < 64 * 36; i += 1) {
      const enc = meterPixels[i * 4] / 255;
      const lum = enc / Math.max(0.0001, 1 - enc);
      const w = lum > 0.002 ? 1.0 : 0.15;
      sum += Math.log(Math.max(lum, 0.0001)) * w;
      wsum += w;
    }
    const avg = Math.exp(sum / wsum);
    const target = Math.min(1.85, Math.max(0.45, 0.18 / avg));
    if (meterSamples === 0) {
      // Snap on the first sample: a frozen shot gets its measured
      // exposure on the very frame that is captured, not after a
      // history it never renders.
      meterCurrent = target;
    } else if (Math.abs(target - meterCurrent) / meterCurrent > 0.25) {
      // R19 take 2 — scene cut: the staged frame is a different scene
      // from the boot frame the meter first sampled (first shoot: the
      // foot frame sat at 1.81 against a 0.96 target, ~1 stop too
      // bright, because the 5%/frame adaptation never converges in the
      // 2 frames a frozen shot renders). A >25% jump in one frame is a
      // cut, not a pan, so snap; smaller moves keep the smooth adapt.
      meterCurrent = target;
    } else {
      const speed = target > meterCurrent ? 3.2 : 1.1;
      const amount = 1 - Math.exp(-(1 / 60) * speed);
      meterCurrent += (target - meterCurrent) * amount;
    }
    meterAvg = avg;
    meterTarget = target;
    meterSamples += 1;
    compMat.uniforms.uExposure.value = meterCurrent;
  }
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
      tLut: { value: lutTex },
      uBloomStrength: { value: 0.7 },
      uLensStrength: { value: 0.8 },
      uExposure: { value: 1.3 },
      uCaStrength: { value: 0.0035 },
      uLutIntensity: { value: 1.0 },
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
    setLensStrength(v) { compMat.uniforms.uLensStrength.value = v; },
    setExposure(v) { compMat.uniforms.uExposure.value = v; },
    // R19 diagnostics for the shoot/QA: measured luminance, exposure
    // target + adapted value, bloom params, LUT presence.
    getMeter() {
      return { avg: meterAvg, target: meterTarget, current: meterCurrent, samples: meterSamples };
    },
    getBloom() {
      return { threshold: brightMat.uniforms.uThreshold.value, strength: compMat.uniforms.uBloomStrength.value };
    },
    get lutReady() { return !!lutTex; },
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
      // R19 meter: measure the just-rendered HDR frame and adapt the
      // exposure the composite is about to use. Readback is 64x36, so
      // it runs every frame (the skill's 12-frame cadence is a live-play
      // default; the frozen shots render only a handful of frames and
      // must measure the frame they capture).
      meterUpdate();
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
      meterRT.dispose();
      meterMat.dispose();
      lutTex.dispose();
      quadGeo.dispose();
      brightMat.dispose();
      blurMat.dispose();
      compMat.dispose();
    },
  };
}
