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
//   -> composite: bloom add + anamorphic streak + ghost flares (lens
//   glows, read from the bloom texture) + ACES tone map + bleached grade
//   + vignette + chromatic aberration + film grain + Bayer dither -> screen.
// Cost: one fullscreen composite + three quarter-res passes. Bloom at 1/4
// res, CA first to go if the frame rate ever dips — never the frame rate.
// Tone mapping lives ONLY here: the renderer is switched to NoToneMapping
// while the composer is active, so ACES runs exactly once (the
// threejs-materials-lighting gotcha: an EffectComposer chain without an
// OutputPass renders dark and double-toned).
//
// GLSL lives in render3d/shaders.js (the pipeline library) — one copy.
import * as THREE from 'three';
import {
  POST_QUAD_VERT as QUAD_VERT,
  POST_BRIGHT_FRAG as BRIGHT_FRAG,
  POST_BLUR_FRAG as BLUR_FRAG,
  POST_COMPOSITE_FRAG as COMPOSITE_FRAG,
} from './render3d/shaders.js';

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
      uLensStrength: { value: 0.8 },
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
    setLensStrength(v) { compMat.uniforms.uLensStrength.value = v; },
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
