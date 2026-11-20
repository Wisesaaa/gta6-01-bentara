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
import * as THREE from 'three';

// Default sun direction matches the lighting rig's SUN vector
// (230, 100, 150) normalised — low in the west, 4pm.
const DEFAULT_SUN_DIR = new THREE.Vector3(230, 100, 150).normalize();

const VERT = `
  varying vec3 vDir;
  void main() {
    // vDir MUST be the view direction from the CAMERA, not the local
    // sphere position. The first version ran vDir = normalize(position):
    // the dome sits at the origin, so the disc/gradient/clouds were all
    // parallax-shifted by the camera's ~115 m offset from the origin
    // (up to ~7 degrees) — the sun disc rendered somewhere other than
    // the sun's true screen position, and in the cover it hid behind the
    // HUD panel. The world-space ray from cameraPosition is exact no
    // matter where the dome mesh sits.
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = normalize(wp.xyz - cameraPosition);
    vec4 mv = viewMatrix * wp;
    gl_Position = projectionMatrix * mv;
  }`;

// GLSL ES 1.0 (WebGL1-style): varying / gl_FragColor, no initializer on
// uniforms, functions declared before use, no reversed smoothstep edges.
const FRAG = `
  uniform vec3 uSunDirection;
  uniform float uTime;
  uniform float uHaze;
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uBottomColor;
  uniform vec3 uSunColor;

  varying vec3 vDir;

  // --- hash-based value noise (procedural-noise) -----------------------
  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // 3-octave FBM: enough for thin wisps, cheap enough for a fullscreen
  // dome at 60 FPS (shader-dev budget: FBM <= 6 octaves).
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      v += amp * valueNoise(p);
      p = p * 2.13 + vec2(17.3, 9.1);
      amp *= 0.5;
    }
    return v;
  }

  // Schlick approximation of the Henyey-Greenstein phase function
  // (atmospheric-scattering performance note): forward lobe, no pow()
  // blow-up, g in [0, 1).
  float phaseMieSchlick(float cosTheta, float g) {
    float k = 1.55 * g - 0.55 * g * g * g;
    float denom = 1.0 + k * cosTheta;
    return (1.0 - k * k) / (4.0 * 3.14159265 * denom * denom);
  }

  void main() {
    vec3 dir = normalize(vDir);
    vec3 sunDir = normalize(uSunDirection);
    float h = dir.y;

    // --- Rayleigh-ish gradient (analytic, no ray march) ----------------
    // Zenith pale blue, mid pale cream, horizon warm haze. The gradient
    // is keyed on height so the dome reads as atmosphere, not paint.
    // Colours come from uTopColor/uMidColor/uBottomColor so the per-act
    // grades in lighting.js can drive the sky (setGrade).
    vec3 zenithCol = uTopColor;
    vec3 midCol = uMidColor;
    vec3 horizonCol = uBottomColor;
    float hh = clamp(h, 0.0, 1.0);
    vec3 col = mix(horizonCol, midCol, smoothstep(0.0, 0.28, hh));
    col = mix(col, zenithCol, smoothstep(0.22, 0.72, hh));
    // Below the horizon the dome keeps the horizon haze colour, so the
    // ground line never shows a black underbelly.
    col = mix(horizonCol, col, smoothstep(-0.08, 0.02, h));

    // --- Mie forward scattering: sky warms toward the sun --------------
    float cosTheta = dot(dir, sunDir);
    float sunAmt = max(cosTheta, 0.0);
    float low = 1.0 - smoothstep(0.0, 0.45, hh);
    vec3 sunWarm = uSunColor;
    col += sunWarm * phaseMieSchlick(cosTheta, 0.76) * (0.35 + 0.65 * low);
    col = mix(col, sunWarm, pow(sunAmt, 3.0) * 0.16 * (0.4 + 0.6 * low));

    // --- haze band: dusty air pooling at the horizon -------------------
    // uHaze ~0.55 default: a visible dry-season band, not a whiteout.
    // The mix is capped at 0.45: the first take ran it at 0.75 and the
    // whole low sky washed to flat pale grey.
    float hazeAmt = (1.0 - smoothstep(0.0, 0.30, hh)) * uHaze;
    vec3 hazeCol = mix(horizonCol, sunWarm, pow(sunAmt, 4.0) * 0.5);
    col = mix(col, hazeCol, clamp(hazeAmt, 0.0, 1.0) * 0.45);

    // --- sun disc + halo glow ------------------------------------------
    // Disc: smoothstep on the cosine, ~5 degrees across (bright core).
    // Round-1 verdict: the ~3.4-degree disc read ~30px and too faint.
    // A 5-degree disc is ~70px at 1280 wide — the "sun at the end of the
    // avenue" reads clearly. The disc is a deeper gold now, so it holds
    // against the pale sky instead of washing into it.
    float disc = smoothstep(0.9975, 0.9990, cosTheta);
    // Disc colour: a DEEP gold (1.0, 0.65, 0.22). The first gold (1.0,
    // 0.80, 0.42) plus the halo blew the sun region past ACES saturation
    // into pale cream — the probe proved the shader IS live, so the disc
    // was firing but washing out. A deeper gold survives ACES as gold.
    vec3 sunDiscCol = vec3(1.0, 0.65, 0.22);
    col = mix(col, sunDiscCol, disc);
    // Halos kept SMALL: the tight halo was x1.8, then x0.5 — both swamped
    // the disc, because halo + disc + Mie together blew past ACES into
    // white. The disc is the sun; the halo is a whisper around it.
    col += sunWarm * pow(sunAmt, 350.0) * 0.15;
    col += sunWarm * pow(sunAmt, 24.0) * 0.12;

    // --- thin clouds: drifting FBM wisps -------------------------------
    // Plane projection of the view direction, so the wisps sit on the
    // sky instead of smearing at the zenith; drift is slow (dry-season
    // air barely moves) and driven by the absolute uTime uniform.
    if (h > 0.015) {
      vec2 cuv = dir.xz / (0.30 + h);
      cuv += uTime * vec2(0.004, 0.0016);
      float n = fbm(cuv * 1.6);
      float cover = smoothstep(0.52, 0.74, n);
      // Wisps fade out toward the zenith and just above the horizon,
      // and thin out where the sun glares through them. Alpha 0.55: the
      // first take ran it at 0.38 and no cloud read at all.
      float band = smoothstep(0.015, 0.12, h) * (1.0 - smoothstep(0.55, 0.95, h));
      float sunThin = 1.0 - pow(sunAmt, 6.0) * 0.55;
      vec3 cloudCol = mix(vec3(1.0, 0.98, 0.94), sunWarm, pow(sunAmt, 4.0) * 0.35);
      col = mix(col, cloudCol, cover * band * sunThin * 0.55);
    }

    gl_FragColor = vec4(col, 1.0);
  }`;

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
      uHaze: { value: opts.haze !== undefined ? opts.haze : 0.55 },
      // Defaults match the Act 1 grade (lighting.js PRESETS[1]) so the
      // first frame already carries the pale 4pm grade.
      uTopColor: { value: new THREE.Color(0x9ab0c4) },
      uMidColor: { value: new THREE.Color(0xecc9a0) },
      uBottomColor: { value: new THREE.Color(0xffe0b8) },
      uSunColor: { value: new THREE.Color(0xffc890) },
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
  // Haze is optional — Act 3 dusk runs thicker (0.7) than Act 1 (0.55).
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
