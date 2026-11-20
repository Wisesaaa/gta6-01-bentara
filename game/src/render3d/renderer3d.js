// render3d/renderer3d.js — the hand-written 3D pipeline, orchestrated.
//
// The pipeline HALCYON is judged on, named and wired in one place.
// Pass order, per frame (lit -> water -> sky -> post):
//   lit:   the hero car's custom lit material (litPass.js) — a material,
//          so it runs inside the scene render, not as a separate pass.
//          The orchestrator records it in `passes` and the game applies
//          it via applyLitBody; QA proves it from the car's material.
//   water: the marina shader sheet (world.js buildGround, time advanced
//          here) + the wet-road sheen overlays (this module) — the water
//          pass now reads on the arterials too, not only at the marina.
//   sky:   the GLSL sky dome + golden-hour rig (lighting.js
//          createGoldenHour) — updated here on the absolute clock.
//   post:  the fullscreen composer (postfx.js) — the final render. If
//          the composer fails to construct, the pipeline falls back to
//          the direct render path, never a black frame (same rule as the
//          old createView: the postfx try/catch lives here now).
//
// No three.js upgrade: the vendored r160 core only, same as before.
// The view (world.js createView) owns the camera shake + trauma and
// calls renderer3d.render() after it; resize() keeps the composer in
// sync with the drawing buffer.
import * as THREE from 'three';
import { SUN } from '../config.js';
import { createGoldenHour } from '../lighting.js';
import { createPostFx } from '../postfx.js';
import { ROAD_WATER_VERT, ROAD_WATER_FRAG, PASSES } from './shaders.js';

// Wet-road sheen strips: the two shot arterials + the market street.
// Width 14 m sits inside the 18 m road band (centred on the line);
// y 0.045 sits above the road plane (0.02) and below the puddles
// (0.05) and sun streaks (0.06), so nothing z-fights.
const ROAD_WATER_STRIPS = [
  { x: 20, z: 111, w: 380, d: 14 }, // z=111 arterial (east-west, the cover road)
  { x: 111, z: 20, w: 14, d: 380 }, // x=111 arterial (north-south, the drive road)
  { x: 40, z: 95, w: 10, d: 70 }, // market street (north-south, the foot road)
];

function createRoadWater(scene) {
  const sunDir = new THREE.Vector3(SUN.x, SUN.y, SUN.z).normalize();
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDir },
      uSky: { value: new THREE.Color(0xecc9a0) },
      uSunColor: { value: new THREE.Color(0xffc890) },
      uFogColor: { value: new THREE.Color(0xe0c8a8) },
      uFogDensity: { value: 0.004 },
      uStrength: { value: 0.9 },
    },
    vertexShader: ROAD_WATER_VERT,
    fragmentShader: ROAD_WATER_FRAG,
  });
  const group = new THREE.Group();
  for (const s of ROAD_WATER_STRIPS) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.d), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(s.x, 0.045, s.z);
    mesh.renderOrder = 2;
    group.add(mesh);
  }
  scene.add(group);
  return {
    material: mat,
    group,
    setStrength(v) { mat.uniforms.uStrength.value = v; },
  };
}

export function createRenderer3d({ renderer, scene, camera, city, rng, lights = {} }) {
  // post pass: the fullscreen composer (try/catch — direct render if it fails).
  let postfx = null;
  try {
    postfx = createPostFx(renderer, scene, camera);
  } catch (e) {
    postfx = null;
  }
  // sky pass: the golden-hour rig (sky dome + haze + lamps + dust).
  // Called AFTER buildStreetGrammar: the lamp positions the glow
  // sprites need are only known once the lamps are placed.
  const golden = createGoldenHour(scene, city, rng, lights);
  // water pass: the wet-road sheen overlays (the marina sheet lives in
  // buildGround and its time is advanced in render() below).
  const roadWater = createRoadWater(scene);

  let roadWaterTime = 0;

  function render(dt) {
    // water: marina sheet + road sheen advance with the render clock.
    // (The sky pass is updated by the game step — view.golden.update()
    // in game.js — on the sim clock, not here: updating it in render()
    // too would drift the clouds and dust twice as fast.)
    const wm = scene.userData.waterMat;
    if (wm) wm.uniforms.uTime.value += dt;
    roadWaterTime += dt;
    roadWater.material.uniforms.uTime.value = roadWaterTime;
    // post: composite to screen, or the direct path if the composer failed.
    if (postfx) postfx.render();
    else renderer.render(scene, camera);
  }

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (postfx) {
      const s = new THREE.Vector2();
      renderer.getDrawingBufferSize(s);
      postfx.resize(s.x, s.y);
    }
  }

  return {
    // The four named passes, and whether each one is live in this run.
    // lit is a material (applied to the hero car by the game), so it is
    // always "live" once the module graph loads; water/sky are built
    // above; post is live unless its construction failed.
    passes: { lit: true, water: true, sky: true, post: !!postfx },
    passOrder: PASSES.slice(),
    postfx,
    golden,
    roadWater,
    render,
    resize,
    applyAct(act) { golden.applyAct(act); },
    dispose() {
      if (postfx) postfx.dispose();
      roadWater.group.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
      roadWater.material.dispose();
      scene.remove(roadWater.group);
    },
  };
}
