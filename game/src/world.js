// Rendering: three.js scene, golden-hour dry-season city — low warm sun,
// amber haze, a gradient sky dome with a real sun disc, dust in the air.
// Buildings are a single InstancedMesh (one draw call); roads, water,
// skyline and signs are a handful of cheap meshes. Under 150k triangles
// on screen at tier low.
//
// The file is organised as small builders, one per street system, called
// in order from createView: ground, roads, street grammar, buildings,
// facades, signs, skyline, trees, plaza, mural. Each builder only touches
// its own meshes, so a lighting change never re-opens the whole city.
import * as THREE from 'three';
import { CITY, PALETTE, SUN, SUN_COLOR, SUN_INTENSITY } from './config.js';
import { roadLines } from './city.js';
import { createGoldenHour, applyGoldenHour } from './lighting.js';

// One hash for all deterministic placement: the same seed grows the same street.
function hash2(x, z) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

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

// The cover mural: a big painted wall on the arterial — a golden sun,
// a wayang silhouette and the words BENTARA / MUSIM KEMARAU. It breaks the
// right-third tan facade the old cover suffered from, and it is the one
// visual anchor no rival has.
function muralTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#a83226';
  g.fillRect(0, 0, 512, 256);
  // Golden sun.
  g.fillStyle = '#ffd75e';
  g.beginPath();
  g.arc(256, 108, 62, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffd75e';
  g.lineWidth = 6;
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(256 + Math.cos(a) * 74, 108 + Math.sin(a) * 74);
    g.lineTo(256 + Math.cos(a) * 92, 108 + Math.sin(a) * 92);
    g.stroke();
  }
  // Wayang silhouette under the sun.
  g.fillStyle = '#1d2a3a';
  g.beginPath();
  g.moveTo(180, 200);
  g.lineTo(200, 150);
  g.lineTo(216, 200);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(300, 200);
  g.lineTo(316, 140);
  g.lineTo(336, 200);
  g.closePath();
  g.fill();
  g.fillRect(120, 198, 272, 6);
  g.fillStyle = '#ffd75e';
  g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('BENTARA', 256, 52);
  g.font = 'bold 24px system-ui, sans-serif';
  g.fillText('MUSIM KEMARAU', 256, 238);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildGround(scene) {
  // Ground: one bleached-concrete slab for the whole city, warmed by the
  // golden-hour palette instead of the old pale grey.
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
}

function buildRoads(scene) {
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
}

function buildStreetGrammar(scene) {
  // Street grammar: zebra crossings, lane arrows, street lights, road signs
  // and ground-floor detail, so the roads read as streets, not grey strips.
  // Everything is instanced; the whole batch costs ~5k triangles.
  const lines = roadLines();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(-Math.PI / 2, 0, 0);
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
  // The horizontal-arterial lamps skip x = ±37 and ±111: those are the
  // centrelines of the vertical arterials, and a pole there stands dead in
  // the driving lane (the drive shot caught one at (37, -47.5) filling the
  // centre of the frame). The vertical-arterial lamps sit at the road edge
  // (c ± 10.5), which is safe at a junction corner.
  const lightSpots = [];
  for (const c of [-37, 37]) {
    for (let k = 0; k < 9; k += 1) {
      const a = -148 + k * 37;
      const side = k % 2 === 0 ? 1 : -1;
      lightSpots.push({ x: c + side * 10.5, z: a, sx: -side, sz: 0 });
      if (Math.abs(a) !== 37 && Math.abs(a) !== 111) {
        lightSpots.push({ x: a, z: c + side * 10.5, sx: 0, sz: -side });
      }
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
  // The lighting rig reads these for its fake-bloom lamp glows.
  scene.userData.lampSpots = lightSpots;
}

function buildBuildings(scene, city) {
  const lines = roadLines();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
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
    const rolling = hash2(b.x + 3, b.z + 7) < 0.25;
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
    doorMesh.setColorAt(i, dc.setHex(rolling ? 0x5a6a72 : doorCols[Math.floor(hash2(b.x + 5, b.z + 1) * doorCols.length)]));
    // A shop sign above the door on about one building in seven.
    if (!b.landmark && hash2(b.x + 13, b.z + 19) < 0.14) {
      const name = shopNames[Math.floor(hash2(b.x + 21, b.z + 27) * shopNames.length)];
      const cols = shopCols[Math.floor(hash2(b.x + 29, b.z + 33) * shopCols.length)];
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

  // Buildings: one InstancedMesh, per-instance warm bleached-concrete colour.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const inst = new THREE.InstancedMesh(boxGeo, boxMat, city.buildings.length);
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

  // Rooftop trim boxes on the tall buildings, plus water tanks — the
  // rooftop silhouette that says "lived-in city" from the chase camera.
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x6b5f4a });
  const tankMat = new THREE.MeshLambertMaterial({ color: 0x2f4a55 });
  for (const b of city.buildings) {
    if (!b.tall) continue;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.5, 1.2, b.d * 0.5), trimMat);
    trim.position.set(b.x, b.h + 0.6, b.z);
    trim.castShadow = true;
    scene.add(trim);
    if (hash2(b.x + 41, b.z + 43) < 0.6) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10), tankMat);
      tank.position.set(b.x + b.w * 0.22, b.h + 1.6, b.z - b.d * 0.2);
      tank.castShadow = true;
      scene.add(tank);
      const tankBase = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.4), trimMat);
      tankBase.position.set(b.x + b.w * 0.22, b.h + 0.25, b.z - b.d * 0.2);
      scene.add(tankBase);
    }
  }

  // The tower (city.tower) gets its own facade treatment on top of the
  // shared window grid: dark corner fins down all four edges and two
  // recessed horizontal bands, so the tallest slab in the city reads as a
  // real tower from the plaza and the arterials instead of a bare box.
  if (city.tower) {
    const t = city.tower;
    const finMat = new THREE.MeshLambertMaterial({ color: 0x5f6b62 });
    for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.6, t.h, 0.6), finMat);
      fin.position.set(t.x + fx * (t.w / 2 - 0.1), t.h / 2, t.z + fz * (t.d / 2 - 0.1));
      fin.castShadow = true;
      scene.add(fin);
    }
    for (const by of [t.h * 0.5, t.h - 4]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.5, 0.6, t.d + 0.5), finMat);
      band.position.set(t.x, by, t.z);
      scene.add(band);
    }
  }
}

function buildFacades(scene, city) {
  // Facade windows: a full grid on all four faces of every building.
  // Columns every ~3.8 m, rows every ~3.6 m; a hashed skip rate leaves
  // some bays blank, and at golden hour one window in five glows warm
  // amber — the city lights up as the sun drops. AC boxes under some
  // windows and a drainpipe down one edge of about half the faces break
  // the wall up further. Planes, not boxes: 2 triangles each.
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  const WIN_W = 1.7;
  const WIN_H = 2.0;
  const winPlacements = [];
  const acPlacements = [];
  const pipePlacements = [];
  for (const b of city.buildings) {
    // Four faces: +z / -z run along x, +x / -x run along z.
    const faces = [
      { along: 'x', len: b.w, fixed: b.z + b.d / 2 + 0.07, rotY: 0, out: [0, 0, 1] },
      { along: 'x', len: b.w, fixed: b.z - b.d / 2 - 0.07, rotY: Math.PI, out: [0, 0, -1] },
      { along: 'z', len: b.d, fixed: b.x + b.w / 2 + 0.07, rotY: Math.PI / 2, out: [1, 0, 0] },
      { along: 'z', len: b.d, fixed: b.x - b.w / 2 - 0.07, rotY: -Math.PI / 2, out: [-1, 0, 0] },
    ];
    faces.forEach((f, fi) => {
      const cols = Math.max(1, Math.floor((f.len - 4) / 3.8));
      const colStep = f.len / (cols + 1);
      const rows = [];
      for (let y = 4.2; y + WIN_H / 2 < b.h - 1.2; y += 3.6) rows.push(y + WIN_H / 2);
      for (let ci = 0; ci < cols; ci += 1) {
        const along = -f.len / 2 + colStep * (ci + 1);
        for (const y of rows) {
          const r = hash2(b.x + fi * 31 + ci * 7, b.z + y * 3 + fi * 13);
          if (r < 0.16) continue; // blank bay: variation, not a wall of glass
          const lit = r > 0.8;
          const tone = lit ? PALETTE.glassLit : PALETTE.glassAlt[Math.floor(hash2(b.x + ci, b.z + y + fi) * PALETTE.glassAlt.length)];
          const px = f.along === 'x' ? b.x + along : f.fixed;
          const pz = f.along === 'x' ? f.fixed : b.z + along;
          winPlacements.push({ x: px, y, z: pz, rotY: f.rotY, tone, lit });
          // An AC box under about one window in seven, on the same face.
          if (hash2(b.x + ci * 3, b.z + y * 7 + fi) < 0.15) {
            acPlacements.push({
              x: px + f.out[0] * 0.3, y: y - WIN_H / 2 - 0.45, z: pz + f.out[2] * 0.3,
              rotY: f.rotY, tone: 0x9a9a92,
            });
          }
        }
      }
      // A drainpipe down one edge of the face, on about half the faces.
      if (hash2(b.x + fi * 17, b.z + fi * 29) < 0.5) {
        const edge = (fi % 2 === 0 ? 1 : -1) * (f.len / 2 - 1.2);
        pipePlacements.push({
          x: f.along === 'x' ? b.x + edge : f.fixed + f.out[0] * 0.12,
          y: b.h / 2,
          z: f.along === 'x' ? f.fixed + f.out[2] * 0.12 : b.z + edge,
          h: b.h - 0.6, tone: hash2(b.x, b.z + fi) < 0.5 ? 0x5f6b62 : 0x8a6a3f,
        });
      }
    });
  }
  const winMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(WIN_W, WIN_H),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    Math.max(1, winPlacements.length),
  );
  winPlacements.forEach((w, i) => {
    const rotQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, w.rotY, 0));
    m4.compose(new THREE.Vector3(w.x, w.y, w.z), rotQ, new THREE.Vector3(1, 1, 1));
    winMesh.setMatrixAt(i, m4);
    winMesh.setColorAt(i, col.setHex(w.tone));
  });
  scene.add(winMesh);
  // Lit windows glow: a second instanced mesh of warm emissive planes over
  // the lit ones, so the amber reads even in shadow.
  const litOnes = winPlacements.filter((w) => w.lit);
  if (litOnes.length > 0) {
    const litMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(WIN_W, WIN_H),
      new THREE.MeshBasicMaterial({ color: PALETTE.glassLit, transparent: true, opacity: 0.85 }),
      litOnes.length,
    );
    litOnes.forEach((w, i) => {
      const rotQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, w.rotY, 0));
      m4.compose(new THREE.Vector3(w.x, w.y, w.z), rotQ, new THREE.Vector3(1, 1, 1));
      litMesh.setMatrixAt(i, m4);
    });
    scene.add(litMesh);
  }
  const acMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    Math.max(1, acPlacements.length),
  );
  acPlacements.forEach((a, i) => {
    const rotQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a.rotY, 0));
    m4.compose(new THREE.Vector3(a.x, a.y, a.z), rotQ, new THREE.Vector3(1.0, 0.65, 0.55));
    acMesh.setMatrixAt(i, m4);
    acMesh.setColorAt(i, col.setHex(a.tone));
  });
  acMesh.castShadow = true;
  scene.add(acMesh);
  const pipeMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    Math.max(1, pipePlacements.length),
  );
  pipePlacements.forEach((p, i) => {
    m4.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(), new THREE.Vector3(0.22, p.h, 0.22));
    pipeMesh.setMatrixAt(i, m4);
    pipeMesh.setColorAt(i, col.setHex(p.tone));
  });
  scene.add(pipeMesh);
}

function buildSigns(scene) {
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
  // Two posts under the MARINA sign, down to the promenade: the sign used
  // to float with nothing holding it up.
  const postMat = new THREE.MeshLambertMaterial({ color: 0x3a3a38 });
  for (const px of [-11, -1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 7.7, 0.35), postMat);
    post.position.set(px, 3.85, -178);
    post.castShadow = true;
    scene.add(post);
  }
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
  // Warung banner strung across the north-row market street.
  const signWarung = textSign('WARUNG KOPI', 8, 2, '#1f6b74', '#ffd75e');
  signWarung.position.set(37, 5.5, 96);
  signWarung.rotation.y = Math.PI;
  scene.add(signWarung);
  // Bengkel Roda Jaya — the garage — on the industrial yard's road face,
  // and Warung Sari's own sign over its stall at the north row.
  const signGarage = textSign('BENGKEL RODA JAYA', 11, 2.4, '#c0392b', '#ffd75e');
  signGarage.position.set(120, 7, 88);
  signGarage.rotation.y = Math.PI;
  scene.add(signGarage);
  const signWarungSari = textSign('WARUNG SARI', 8, 2, '#1f6b74', '#ffd75e');
  signWarungSari.position.set(42, 5, 104);
  signWarungSari.rotation.y = Math.PI;
  scene.add(signWarungSari);
}

function buildSkyline(scene) {
  // Distant skyline: flat silhouettes beyond the city so the horizon is a city.
  // Each slab gets a window grid on the face toward the city — bare grey
  // slabs read as unfinished boxes from the marina, lit and dark windows
  // read as a far skyline. Windows are 2 triangles each, ~1.5k in all.
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  const skyMat = new THREE.MeshLambertMaterial({ color: PALETTE.skyline });
  const skyline = [[-260, -320, 60, 90], [-120, -330, 80, 70], [40, -330, 55, 110], [180, -320, 70, 80], [300, -300, 60, 95], [-320, 100, 55, 80], [320, 120, 60, 70]];
  const skyWin = [];
  for (const [x, z, w, h] of skyline) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.6), skyMat);
    s.position.set(x, h / 2, z);
    scene.add(s);
    // The face toward the city centre: +z for the southern slabs, +x for the
    // western one, -x for the eastern one. Columns every ~7 m, rows every ~8 m.
    const towardCity = Math.abs(x) > 200 ? (x < 0 ? 'px' : 'nx') : 'pz';
    const faceLen = towardCity === 'pz' ? w : w * 0.6;
    const cols = Math.max(2, Math.floor(faceLen / 7));
    const colStep = faceLen / (cols + 1);
    for (let ci = 0; ci < cols; ci += 1) {
      const along = -faceLen / 2 + colStep * (ci + 1);
      for (let y = 8; y < h - 4; y += 8) {
        const r = hash2(x + ci * 7, z + y * 3);
        if (r < 0.35) continue;
        const lit = r > 0.88;
        const tone = lit ? PALETTE.glassLit : 0x2f4a55;
        if (towardCity === 'pz') skyWin.push({ x: x + along, y, z: z + w * 0.3 + 0.15, rotY: 0, tone });
        else if (towardCity === 'px') skyWin.push({ x: x + w * 0.3 + 0.15, y, z: z + along, rotY: Math.PI / 2, tone });
        else skyWin.push({ x: x - w * 0.3 - 0.15, y, z: z + along, rotY: -Math.PI / 2, tone });
      }
    }
  }
  const skyWinMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2.6, 3.2),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    Math.max(1, skyWin.length),
  );
  skyWin.forEach((w, i) => {
    const rotQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, w.rotY, 0));
    m4.compose(new THREE.Vector3(w.x, w.y, w.z), rotQ, new THREE.Vector3(1, 1, 1));
    skyWinMesh.setMatrixAt(i, m4);
    skyWinMesh.setColorAt(i, col.setHex(w.tone));
  });
  scene.add(skyWinMesh);

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
}

function buildTrees(scene, city) {
  // Dry-season trees (NOT palms): thin trunks, flat dusty-olive crowns,
  // planted along the road edges where the sidewalk meets the blocks.
  // Hashed placement, so the same seed always grows the same street.
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
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
    treeSpots.push({ x: tx, z: tz });
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
}

function buildPlaza(scene) {
  // Plaza furniture: benches facing the tower, a bollard ring around it,
  // and a darker plaza disc so the concourse reads as a place, not a gap.
  const m4 = new THREE.Matrix4();
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
}

function buildMural(scene, city) {
  // The mural goes on the tallest building along the east arterial just
  // ahead of where the cover chase ends (z 120–148 — the band the close
  // cover camera looks at), on its west face, so the cover camera reads
  // it on the right third of the frame instead of blank tan concrete.
  // Fallbacks, in order: the tallest in the block band south of the
  // junction (z 46–102, plane at the north end of its face), then the
  // tallest in z 90–185 (plane at the south end). Earlier picks failed
  // measurably: the tallest in z 60–120 was a 9 m building 93 m from the
  // camera, and the tallest in z 90–185 sat behind the camera.
  let best = null;
  for (const b of city.buildings) {
    if (b.x < 100 || b.x > 140 || b.z < 120 || b.z > 148) continue;
    if (!best || b.h > best.h) best = b;
  }
  let mz;
  if (best) {
    mz = best.z;
  } else {
    for (const b of city.buildings) {
      if (b.x < 100 || b.x > 140 || b.z < 46 || b.z > 102) continue;
      if (!best || b.h > best.h) best = b;
    }
    if (best) {
      mz = best.z + Math.max(0, best.d / 2 - 6.5);
    } else {
      for (const b of city.buildings) {
        if (b.x < 100 || b.x > 140 || b.z < 90 || b.z > 185) continue;
        if (!best || b.h > best.h) best = b;
      }
      if (!best) return null;
      const half = Math.min(6.5, Math.max(0, best.d / 2 - 0.5));
      mz = best.z - Math.max(0, best.d / 2 - half);
    }
  }
  const mural = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 6.5),
    new THREE.MeshBasicMaterial({ map: muralTexture() }),
  );
  mural.position.set(best.x - best.w / 2 - 0.12, Math.min(best.h - 4, 12), mz);
  mural.rotation.y = -Math.PI / 2;
  scene.add(mural);
  return { building: best, mesh: mural };
}

export function createView(canvas, city) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.userData.city = city;
  scene.userData.renderer = renderer;
  applyGoldenHour(renderer, scene);

  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 2000);

  // Golden-hour light rig: a low warm sun with long shadows, and a warm
  // hemisphere so the shadow side is amber, not dead grey.
  const hemi = new THREE.HemisphereLight(0xffc98a, 0x8a6a4a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
  sun.position.set(SUN.x, SUN.y, SUN.z);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  scene.add(sun.target);

  const rng = city.rng || Math.random;
  buildGround(scene);
  buildRoads(scene);
  buildStreetGrammar(scene);
  // Golden hour AFTER the street grammar: the lamp positions the glow
  // sprites need are only known once the lamps are placed.
  const golden = createGoldenHour(scene, city, rng, { sun, hemi });
  buildBuildings(scene, city);
  buildFacades(scene, city);
  buildSigns(scene);
  buildSkyline(scene);
  buildTrees(scene, city);
  buildPlaza(scene);
  const mural = buildMural(scene, city);

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return {
    renderer, scene, camera, sun, golden, mural, resize,
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
