// Rendering: three.js scene, one 4pm directional sun, bleached-concrete
// palette — dry season, no palms, no sunset bay. Buildings are a single
// InstancedMesh (one draw call); roads, water, skyline and signs are a handful
// of cheap meshes. Under 150k triangles on screen at tier low.
import * as THREE from 'three';
import { CITY, PALETTE, SUN } from './config.js';
import { roadLines } from './city.js';

function textSign(text, w, h, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = fg;
  // Shrink the font until the name fits the canvas — a long name at 44px
  // overflows and gets clipped at both ends.
  let size = 44;
  g.font = `bold ${size}px system-ui, sans-serif`;
  while (g.measureText(text).width > 236 && size > 18) {
    size -= 2;
    g.font = `bold ${size}px system-ui, sans-serif`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // A single plane, not a box: a box's back face mirrors the text.
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    // Unlit so the name stays readable from any side, in any light.
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  mesh.castShadow = true;
  return mesh;
}

export function createView(canvas, city) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Filmic tone mapping + a lifted exposure: the bleached-concrete palette
  // reads as hard 4pm sun instead of a flat beige wash.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.haze, 280, 560);
  scene.userData.city = city;

  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 1200);

  const hemi = new THREE.HemisphereLight(PALETTE.sky, 0x8d9296, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6b0, 2.4);
  sun.position.set(SUN.x, SUN.y, SUN.z);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(sun.target);

  // Ground: one bleached-concrete slab for the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 120, CITY.half * 2 + 120),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Marina water: a still, dusty-teal sheet south of the city edge.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 130),
    new THREE.MeshLambertMaterial({ color: PALETTE.water }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, -194 - 65);
  scene.add(water);
  // Wooden pier reaching into the water at the marina.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3f });
  for (let i = 0; i < 5; i += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 2.4), pierMat);
    plank.position.set(-6, 0.3, -196 - i * 2.6);
    scene.add(plank);
  }

  // Roads: dark strips on both axes, plus dashed centre lines.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  for (const c of roadLines()) {
    const alongX = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.road), roadMat);
    alongX.rotation.x = -Math.PI / 2;
    alongX.position.set(0, 0.02, c);
    alongX.receiveShadow = true;
    scene.add(alongX);
    const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, CITY.half * 2), roadMat);
    alongZ.rotation.x = -Math.PI / 2;
    alongZ.position.set(c, 0.02, 0);
    alongZ.receiveShadow = true;
    scene.add(alongZ);
  }
  const dashGeo = new THREE.PlaneGeometry(0.5, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  const dashes = [];
  for (const c of roadLines()) {
    for (let a = -186; a < 186; a += 12) {
      dashes.push({ x: a, z: c, rot: 0 });
      dashes.push({ x: c, z: a, rot: Math.PI / 2 });
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(-Math.PI / 2, 0, 0);
  dashes.forEach((d, i) => {
    e.set(-Math.PI / 2, 0, d.rot);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(d.x, 0.04, d.z), q, new THREE.Vector3(1, 1, 1));
    dashMesh.setMatrixAt(i, m4);
  });
  scene.add(dashMesh);

  // Street grammar: zebra crossings, lane arrows, street lights, road signs
  // and ground-floor detail, so the roads read as streets, not grey strips.
  // Everything is instanced; the whole batch costs ~5k triangles.
  const h2 = (x, z) => {
    const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const lines = roadLines();
  // Zebra crossings: five bars on each approach of every intersection.
  const zebraSpots = [];
  for (const cx of lines) {
    for (const cz of lines) {
      for (const s of [-1, 1]) {
        for (let k = -2; k <= 2; k += 1) {
          zebraSpots.push({ x: cx + k * 3, z: cz + s * 10.5, rot: 0 });
          zebraSpots.push({ x: cx + s * 10.5, z: cz + k * 3, rot: Math.PI / 2 });
        }
      }
    }
  }
  const zebraMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.8, 3.4),
    new THREE.MeshBasicMaterial({ color: PALETTE.roadLine }),
    zebraSpots.length,
  );
  zebraSpots.forEach((s, i) => {
    e.set(-Math.PI / 2, 0, s.rot);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(s.x, 0.05, s.z), q, new THREE.Vector3(1, 1, 1));
    zebraMesh.setMatrixAt(i, m4);
  });
  scene.add(zebraMesh);

  // Lane arrows: a painted straight-ahead arrow in every lane, every ~62 m.
  const arrowCanvas = document.createElement('canvas');
  arrowCanvas.width = 64;
  arrowCanvas.height = 128;
  const ag = arrowCanvas.getContext('2d');
  ag.fillStyle = '#f5f2e8';
  ag.fillRect(26, 52, 12, 62);
  ag.beginPath();
  ag.moveTo(32, 8);
  ag.lineTo(56, 56);
  ag.lineTo(40, 56);
  ag.lineTo(40, 62);
  ag.lineTo(24, 62);
  ag.lineTo(24, 56);
  ag.lineTo(8, 56);
  ag.closePath();
  ag.fill();
  const arrowTex = new THREE.CanvasTexture(arrowCanvas);
  arrowTex.colorSpace = THREE.SRGBColorSpace;
  const arrowSpots = [];
  for (const c of lines) {
    for (let a = -155; a <= 155; a += 62) {
      arrowSpots.push({ x: c + 4.5, z: a, dx: 0, dz: 1 });
      arrowSpots.push({ x: c - 4.5, z: a, dx: 0, dz: -1 });
      arrowSpots.push({ x: a, z: c + 4.5, dx: 1, dz: 0 });
      arrowSpots.push({ x: a, z: c - 4.5, dx: -1, dz: 0 });
    }
  }
  const arrowMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.7, 3.4),
    new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true }),
    arrowSpots.length,
  );
  const basis = new THREE.Matrix4();
  arrowSpots.forEach((s, i) => {
    // Local +y (texture up) maps to the travel direction, +z to world up.
    basis.makeBasis(
      new THREE.Vector3(-s.dz, 0, s.dx),
      new THREE.Vector3(s.dx, 0, s.dz),
      new THREE.Vector3(0, 1, 0),
    );
    basis.setPosition(s.x, 0.06, s.z);
    arrowMesh.setMatrixAt(i, basis);
  });
  scene.add(arrowMesh);

  // Street lights: pole, arm and a warm lamp head along the four arterials.
  const lightSpots = [];
  for (const c of [-37, 37]) {
    for (let k = 0; k < 9; k += 1) {
      const a = -148 + k * 37;
      const side = k % 2 === 0 ? 1 : -1;
      lightSpots.push({ x: c + side * 10.5, z: a, sx: -side, sz: 0 });
      lightSpots.push({ x: a, z: c + side * 10.5, sx: 0, sz: -side });
    }
  }
  const poleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 6, 0.18), new THREE.MeshLambertMaterial({ color: 0x3a3a38 }), lightSpots.length);
  const armMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.14, 0.14), new THREE.MeshLambertMaterial({ color: 0x3a3a38 }), lightSpots.length);
  const lampMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), lightSpots.length);
  lightSpots.forEach((s, i) => {
    m4.compose(new THREE.Vector3(s.x, 3, s.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    poleMesh.setMatrixAt(i, m4);
    const rotQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.sx !== 0 ? 0 : Math.PI / 2, 0));
    m4.compose(new THREE.Vector3(s.x + s.sx * 0.9, 5.9, s.z + s.sz * 0.9), rotQ, new THREE.Vector3(1, 1, 1));
    armMesh.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(s.x + s.sx * 1.8, 5.85, s.z + s.sz * 1.8), rotQ, new THREE.Vector3(1, 1, 1));
    lampMesh.setMatrixAt(i, m4);
  });
  scene.add(poleMesh, armMesh, lampMesh);

  // Road signs: STOP and one-way signs on posts at the arterial junctions.
  function signTexture(kind) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    if (kind === 'stop') {
      g.fillStyle = '#c0392b';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#ffffff';
      g.font = 'bold 34px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('STOP', 64, 66);
    } else {
      g.fillStyle = '#2f6b8a';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(100, 64);
      g.lineTo(56, 32);
      g.lineTo(56, 52);
      g.lineTo(24, 52);
      g.lineTo(24, 76);
      g.lineTo(56, 76);
      g.lineTo(56, 96);
      g.closePath();
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const roadSignSpots = [];
  for (const cx of [-37, 37]) {
    for (const cz of [-111, -37, 37, 111]) roadSignSpots.push({ x: cx + 10, z: cz + 10, jx: cx, jz: cz, kind: 'stop' });
  }
  for (const cx of [-111, 111]) {
    for (const cz of [-37, 37]) roadSignSpots.push({ x: cx + 10, z: cz + 10, jx: cx, jz: cz, kind: 'oneway' });
  }
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 2.8, 0.14), new THREE.MeshLambertMaterial({ color: 0x8a8a80 }), roadSignSpots.length);
  const stopMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: signTexture('stop') }),
    roadSignSpots.filter((s) => s.kind === 'stop').length,
  );
  const onewayMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: signTexture('oneway') }),
    roadSignSpots.filter((s) => s.kind === 'oneway').length,
  );
  let stopI = 0;
  let oneI = 0;
  roadSignSpots.forEach((s, si) => {
    m4.compose(new THREE.Vector3(s.x, 1.4, s.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    postMesh.setMatrixAt(si, m4);
    // Face the sign toward the junction it guards.
    const faceQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(s.jx - s.x, s.jz - s.z), 0));
    const facePos = new THREE.Vector3(s.x, 2.9, s.z);
    if (s.kind === 'stop') {
      m4.compose(facePos, faceQ, new THREE.Vector3(1, 1, 1));
      stopMesh.setMatrixAt(stopI, m4);
      stopI += 1;
    } else {
      m4.compose(facePos, faceQ, new THREE.Vector3(1, 1, 1));
      onewayMesh.setMatrixAt(oneI, m4);
      oneI += 1;
    }
  });
  scene.add(postMesh, stopMesh, onewayMesh);

  // Ground-floor detail: a door on the street-facing side of every building
  // — a wide grey-blue rolling door on about one in four — plus small shop
  // signs above the doors, so the ground floor is not blank concrete.
  const doorCols = [0x4a3826, 0x2f3e46, 0x6b4a2f];
  const dc = new THREE.Color();
  const doorMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    city.buildings.length,
  );
  const shopNames = ['WARUNG', 'TOKO KELONTONG', 'BENGKEL', 'LAUNDRY', 'FOTOKOPI', 'WARTEG', 'TOKO OBAT', 'BARBERSHOP'];
  const shopCols = [['#3f5a78', '#ffffff'], ['#c0392b', '#ffd75e'], ['#1f6b74', '#ffffff']];
  city.buildings.forEach((b, i) => {
    const nx = lines.reduce((best, L) => (Math.abs(L - b.x) < Math.abs(best - b.x) ? L : best), lines[0]);
    const nz = lines.reduce((best, L) => (Math.abs(L - b.z) < Math.abs(best - b.z) ? L : best), lines[0]);
    const dxFace = Math.abs(b.x - nx) - b.w / 2;
    const dzFace = Math.abs(b.z - nz) - b.d / 2;
    const rolling = h2(b.x + 3, b.z + 7) < 0.25;
    const w = rolling ? 2.6 : 1.3;
    const h = rolling ? 2.4 : 2.2;
    let pos;
    let rotQ;
    if (dxFace < dzFace) {
      const s = Math.sign(nx - b.x) || 1;
      pos = new THREE.Vector3(b.x + s * (b.w / 2 + 0.2), h / 2, b.z);
      rotQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    } else {
      const s = Math.sign(nz - b.z) || 1;
      pos = new THREE.Vector3(b.x, h / 2, b.z + s * (b.d / 2 + 0.2));
      rotQ = new THREE.Quaternion();
    }
    m4.compose(pos, rotQ, new THREE.Vector3(w, h, 0.15));
    doorMesh.setMatrixAt(i, m4);
    doorMesh.setColorAt(i, dc.setHex(rolling ? 0x5a6a72 : doorCols[Math.floor(h2(b.x + 5, b.z + 1) * doorCols.length)]));
    // A shop sign above the door on about one building in seven.
    if (!b.landmark && h2(b.x + 13, b.z + 19) < 0.14) {
      const name = shopNames[Math.floor(h2(b.x + 21, b.z + 27) * shopNames.length)];
      const cols = shopCols[Math.floor(h2(b.x + 29, b.z + 33) * shopCols.length)];
      const sign = textSign(name, 5, 1.2, cols[0], cols[1]);
      const face = dxFace < dzFace ? Math.sign(nx - b.x) || 1 : 0;
      if (dxFace < dzFace) {
        sign.position.set(b.x + face * (b.w / 2 + 0.25), 4.6, b.z);
        sign.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        const s = Math.sign(nz - b.z) || 1;
        sign.position.set(b.x, 4.6, b.z + s * (b.d / 2 + 0.25));
        sign.rotation.y = s > 0 ? 0 : Math.PI;
      }
      scene.add(sign);
    }
  });
  scene.add(doorMesh);

  // Buildings: one InstancedMesh, per-instance bleached-concrete colour.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const inst = new THREE.InstancedMesh(boxGeo, boxMat, city.buildings.length);
  const col = new THREE.Color();
  city.buildings.forEach((b, i) => {
    m4.compose(
      new THREE.Vector3(b.x, b.h / 2, b.z),
      new THREE.Quaternion(),
      new THREE.Vector3(b.w, b.h, b.d),
    );
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, col.setHex(b.color));
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  scene.add(inst);

  // Window bands: one dark glass strip on each building's four faces,
  // a second instanced mesh so the facades stop reading as blank concrete.
  // Band height, height on the facade and glass tone vary per building
  // (hashed from its position, so the variation is deterministic).
  const hash2 = (x, z) => {
    const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const winGeo = new THREE.BoxGeometry(1, 1, 1);
  const winMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const winMesh = new THREE.InstancedMesh(winGeo, winMat, city.buildings.length * 4);
  city.buildings.forEach((b, i) => {
    const bandH = Math.min(7, Math.max(1.5, b.h * (0.3 + hash2(b.x, b.z) * 0.2)));
    // Tall buildings wear their band lower, so it stays in frame when the
    // camera looks up at them from the street — the tower's band at
    // mid-height was cut off above the hero frame.
    const bandY = b.tall
      ? b.h * (0.35 + hash2(b.z, b.x) * 0.1)
      : b.h * (0.5 + hash2(b.z, b.x) * 0.15);
    const tone = PALETTE.glassAlt[Math.floor(hash2(b.x + 7, b.z + 3) * PALETTE.glassAlt.length)];
    m4.compose(new THREE.Vector3(b.x, bandY, b.z + b.d / 2 + 0.07), new THREE.Quaternion(), new THREE.Vector3(b.w * 0.72, bandH, 0.12));
    winMesh.setMatrixAt(i * 4, m4);
    winMesh.setColorAt(i * 4, col.setHex(tone));
    m4.compose(new THREE.Vector3(b.x, bandY, b.z - b.d / 2 - 0.07), new THREE.Quaternion(), new THREE.Vector3(b.w * 0.72, bandH, 0.12));
    winMesh.setMatrixAt(i * 4 + 1, m4);
    winMesh.setColorAt(i * 4 + 1, col.setHex(tone));
    m4.compose(new THREE.Vector3(b.x + b.w / 2 + 0.07, bandY, b.z), new THREE.Quaternion(), new THREE.Vector3(0.12, bandH, b.d * 0.72));
    winMesh.setMatrixAt(i * 4 + 2, m4);
    winMesh.setColorAt(i * 4 + 2, col.setHex(tone));
    m4.compose(new THREE.Vector3(b.x - b.w / 2 - 0.07, bandY, b.z), new THREE.Quaternion(), new THREE.Vector3(0.12, bandH, b.d * 0.72));
    winMesh.setMatrixAt(i * 4 + 3, m4);
    winMesh.setColorAt(i * 4 + 3, col.setHex(tone));
  });
  scene.add(winMesh);

  // Ground-floor plinth in each building's own trim colour: the base of
  // every facade gets a darker band so the boxes sit on the street.
  const plinthMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), city.buildings.length);
  city.buildings.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x, 0.6, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w + 0.3, 1.2, b.d + 0.3));
    plinthMesh.setMatrixAt(i, m4);
    plinthMesh.setColorAt(i, col.setHex(b.trim));
  });
  plinthMesh.receiveShadow = true;
  scene.add(plinthMesh);

  // Awnings over the ground floor: brick-red, deep teal or ochre, sloped
  // toward the street. About two in three buildings get one, front or back.
  const awnings = [];
  for (const b of city.buildings) {
    const r = hash2(b.x + 11, b.z + 5);
    if (r < 0.33) continue;
    const front = hash2(b.x + 23, b.z + 9) < 0.5;
    awnings.push({ x: b.x, y: 3.4, z: b.z + (front ? b.d / 2 + 0.7 : -b.d / 2 - 0.7), w: Math.min(b.w * 0.6, 10), tilt: front ? -0.45 : 0.45, color: PALETTE.awning[Math.floor(hash2(b.x + 31, b.z + 17) * PALETTE.awning.length)] });
  }
  const awnMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, awnings.length));
  awnings.forEach((a, i) => {
    const tiltQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(a.tilt, 0, 0));
    m4.compose(new THREE.Vector3(a.x, a.y, a.z), tiltQ, new THREE.Vector3(a.w, 0.18, 1.6));
    awnMesh.setMatrixAt(i, m4);
    awnMesh.setColorAt(i, col.setHex(a.color));
  });
  awnMesh.castShadow = true;
  scene.add(awnMesh);

  // Rooftop trim boxes on the tall buildings. The tower's glass is the same
  // window band every other building gets (winMesh above) — a full-height
  // dark slab on its south face read as a black wall from the plaza, so
  // there is no separate floor-to-roof glass sheet here.
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x6b5f4a });
  for (const b of city.buildings) {
    if (!b.tall) continue;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.5, 1.2, b.d * 0.5), trimMat);
    trim.position.set(b.x, b.h + 0.6, b.z);
    trim.castShadow = true;
    scene.add(trim);
  }

  // Signs with real names, big enough to read at thumbnail size.
  // Brick-red is the one warm accent; the marina sign stays deep teal.
  const signBentara = textSign('BENTARA', 14, 3.2, '#c0392b', '#ffd75e');
  signBentara.position.set(0, 46, 9.6);
  scene.add(signBentara);
  const signRuko = textSign('RUKO', 10, 2.4, '#3f5a78', '#ffffff');
  signRuko.position.set(-70, 12, -128);
  scene.add(signRuko);
  const signMarina = textSign('MARINA', 12, 2.6, '#2f3e46', '#ffffff');
  signMarina.position.set(-6, 9, -178);
  scene.add(signMarina);
  // Low plaza billboard, readable from the ground at the foot-shot distance.
  // It faces south (toward the player approaching from the plaza's south edge).
  const signPlaza = textSign('PLAZA MENARA', 9, 3, '#c0392b', '#ffd75e');
  signPlaza.position.set(12, 2.4, 32);
  signPlaza.rotation.y = Math.PI;
  scene.add(signPlaza);
  // More legible street signage, all facing the road so a driver reads them.
  const signPasar = textSign('PASAR PAGI', 9, 2.2, '#1f6b74', '#ffffff');
  signPasar.position.set(42, 6, 102);
  signPasar.rotation.y = Math.PI;
  scene.add(signPasar);
  const signBengkel = textSign('BENGKEL LAS', 9, 2.2, '#c0392b', '#ffd75e');
  signBengkel.position.set(120, 6, 78);
  signBengkel.rotation.y = Math.PI;
  scene.add(signBengkel);
  const signApotek = textSign('APOTEK', 8, 2.2, '#3f5a78', '#ffffff');
  signApotek.position.set(-37, 6, -100);
  signApotek.rotation.y = Math.PI;
  scene.add(signApotek);

  // Two moored boats on the marina water, so the story shot has life
  // beyond the pier planks.
  const boatHullMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const boatHull2Mat = new THREE.MeshLambertMaterial({ color: 0xd8a13a });
  const boatCabinMat = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  for (const [bx, bz, hullMat, rot] of [[-40, -232, boatHullMat, 0.3], [30, -242, boatHull2Mat, -0.4]]) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.1, 2.6), hullMat);
    hull.position.set(bx, 0.55, bz);
    hull.rotation.y = rot;
    hull.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.8), boatCabinMat);
    cabin.position.set(bx - Math.sin(rot) * 0.8, 1.6, bz - Math.cos(rot) * 0.8);
    cabin.rotation.y = rot;
    scene.add(hull, cabin);
  }

  // Distant skyline: flat silhouettes beyond the city so the horizon is a city.
  const skyMat = new THREE.MeshLambertMaterial({ color: PALETTE.skyline });
  const skyline = [[-260, -320, 60, 90], [-120, -330, 80, 70], [40, -330, 55, 110], [180, -320, 70, 80], [300, -300, 60, 95], [-320, 100, 55, 80], [320, 120, 60, 70]];
  for (const [x, z, w, h] of skyline) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.6), skyMat);
    s.position.set(x, h / 2, z);
    scene.add(s);
  }

  // Dry-season trees (NOT palms): thin trunks, flat dusty-olive crowns,
  // planted along the road edges where the sidewalk meets the blocks.
  // Hashed placement, so the same seed always grows the same street.
  const treeSpots = [];
  const inSolid = (x, z) => city.solids.some((s) => x > s.minX - 1 && x < s.maxX + 1 && z > s.minZ - 1 && z < s.maxZ + 1);
  for (const c of [-185, -111, -37, 37, 111, 185]) {
    for (let a = -175; a <= 175; a += 35) {
      for (const side of [-11.5, 11.5]) {
        if (Math.abs(c + side) > 190) continue;
        if (hash2(c + a, side * 13) < 0.35) continue;
        const s1 = { x: c + side, z: a + hash2(a, c) * 8 - 4 };
        const s2 = { x: a + hash2(a, c + 5) * 8 - 4, z: c + side };
        if (!inSolid(s1.x, s1.z) && s1.z > -190) treeSpots.push(s1);
        if (!inSolid(s2.x, s2.z) && s2.z > -190) treeSpots.push(s2);
      }
    }
  }
  // Plaza corners get their own four trees, clear of the tower and the beacon.
  for (const [tx, tz] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) {
    treeSpots.push({ x: tx, z: tz, alongX: false });
  }
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.35, 2.4, 0.35),
    new THREE.MeshLambertMaterial({ color: PALETTE.treeTrunk }),
    treeSpots.length,
  );
  const crownMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    treeSpots.length,
  );
  treeSpots.forEach((t, i) => {
    const s = 2.6 + hash2(t.x + 3, t.z + 7) * 1.4;
    m4.compose(new THREE.Vector3(t.x, 1.2, t.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    trunkMesh.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(t.x, 3.2, t.z), new THREE.Quaternion(), new THREE.Vector3(s, 1.2, s));
    crownMesh.setMatrixAt(i, m4);
    crownMesh.setColorAt(i, col.setHex(PALETTE.treeCrown[Math.floor(hash2(t.x + 9, t.z + 1) * PALETTE.treeCrown.length)]));
  });
  trunkMesh.castShadow = true;
  crownMesh.castShadow = true;
  scene.add(trunkMesh, crownMesh);

  // Plaza furniture: benches facing the tower, a bollard ring around it,
  // and a darker plaza disc so the concourse reads as a place, not a gap.
  const plazaDisc = new THREE.Mesh(
    new THREE.CircleGeometry(24, 32),
    new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }),
  );
  plazaDisc.rotation.x = -Math.PI / 2;
  plazaDisc.position.set(0, 0.03, 0);
  plazaDisc.receiveShadow = true;
  scene.add(plazaDisc);
  const benchSpots = [[-16, -14, 0.5], [16, -14, -0.5], [-16, 14, 2.6], [16, 14, -2.6], [0, -20, 0], [0, 20, Math.PI]];
  const benchSeat = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x8a6a3f }), benchSpots.length);
  const benchBack = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x8a6a3f }), benchSpots.length);
  benchSpots.forEach(([bx, bz, rot], i) => {
    const rotQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0));
    m4.compose(new THREE.Vector3(bx, 0.45, bz), rotQ, new THREE.Vector3(1.9, 0.14, 0.65));
    benchSeat.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(bx - Math.sin(rot) * 0.28, 0.85, bz - Math.cos(rot) * 0.28), rotQ, new THREE.Vector3(1.9, 0.7, 0.12));
    benchBack.setMatrixAt(i, m4);
  });
  benchSeat.castShadow = true;
  benchBack.castShadow = true;
  scene.add(benchSeat, benchBack);
  const bollardSpots = [];
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * Math.PI * 2;
    bollardSpots.push({ x: Math.sin(a) * 13.5, z: Math.cos(a) * 13.5 });
  }
  for (let k = 0; k < 6; k += 1) bollardSpots.push({ x: -20 + k * 8, z: 26 });
  const bollardMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.15, 0.18, 0.7, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a8a80 }),
    bollardSpots.length,
  );
  bollardSpots.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x, 0.35, b.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    bollardMesh.setMatrixAt(i, m4);
  });
  bollardMesh.castShadow = true;
  scene.add(bollardMesh);

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return {
    renderer, scene, camera, sun, resize,
    placeCamera(x, z, heading, behind, up, lookAhead = 8) {
      const bx = x - Math.sin(heading) * behind;
      const bz = z - Math.cos(heading) * behind;
      camera.position.set(bx, up, bz);
      camera.lookAt(x + Math.sin(heading) * lookAhead, 1.6, z + Math.cos(heading) * lookAhead);
    },
    render() {
      renderer.render(scene, camera);
    },
  };
}
