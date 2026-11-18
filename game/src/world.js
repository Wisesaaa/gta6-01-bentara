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
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe6ddc0);
  scene.fog = new THREE.Fog(PALETTE.haze, 280, 560);
  scene.userData.city = city;

  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 1200);

  const hemi = new THREE.HemisphereLight(0xf2ead2, 0x8a7a5c, 1.05);
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

  // Window bands: one dark glass strip on each building's two long faces,
  // a second instanced mesh so the facades stop reading as blank concrete.
  const winGeo = new THREE.BoxGeometry(1, 1, 1);
  const winMat = new THREE.MeshLambertMaterial({ color: 0x3a4a52 });
  const winMesh = new THREE.InstancedMesh(winGeo, winMat, city.buildings.length * 2);
  city.buildings.forEach((b, i) => {
    const bandH = Math.max(1.5, b.h * 0.4);
    const bandY = b.h * 0.58;
    m4.compose(new THREE.Vector3(b.x, bandY, b.z + b.d / 2 + 0.07), new THREE.Quaternion(), new THREE.Vector3(b.w * 0.72, bandH, 0.12));
    winMesh.setMatrixAt(i * 2, m4);
    m4.compose(new THREE.Vector3(b.x, bandY, b.z - b.d / 2 - 0.07), new THREE.Quaternion(), new THREE.Vector3(b.w * 0.72, bandH, 0.12));
    winMesh.setMatrixAt(i * 2 + 1, m4);
  });
  scene.add(winMesh);

  // Rooftop trim boxes on the tall buildings, and glass strips on the tower.
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x6b5f4a });
  for (const b of city.buildings) {
    if (!b.tall) continue;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.5, 1.2, b.d * 0.5), trimMat);
    trim.position.set(b.x, b.h + 0.6, b.z);
    trim.castShadow = true;
    scene.add(trim);
  }
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(19, 40, 0.6),
    new THREE.MeshLambertMaterial({ color: PALETTE.glass }),
  );
  glass.position.set(0, 24, 9.4);
  scene.add(glass);

  // Signs with real names, big enough to read at thumbnail size.
  const signBentara = textSign('BENTARA', 14, 3.2, '#7a5c2e', '#ffd75e');
  signBentara.position.set(0, 46, 9.6);
  scene.add(signBentara);
  const signRuko = textSign('RUKO', 10, 2.4, '#3f5a78', '#ffffff');
  signRuko.position.set(-70, 12, -128);
  scene.add(signRuko);
  const signMarina = textSign('MARINA', 12, 2.6, '#5e8f96', '#ffffff');
  signMarina.position.set(-6, 9, -178);
  scene.add(signMarina);
  // Low plaza billboard, readable from the ground at the foot-shot distance.
  // It faces south (toward the player approaching from the plaza's south edge).
  const signPlaza = textSign('PLAZA MENARA', 9, 3, '#7a5c2e', '#ffd75e');
  signPlaza.position.set(12, 2.4, 32);
  signPlaza.rotation.y = Math.PI;
  scene.add(signPlaza);

  // Distant skyline: flat silhouettes beyond the city so the horizon is a city.
  const skyMat = new THREE.MeshLambertMaterial({ color: 0xb0a488 });
  const skyline = [[-260, -320, 60, 90], [-120, -330, 80, 70], [40, -330, 55, 110], [180, -320, 70, 80], [300, -300, 60, 95], [-320, 100, 55, 80], [320, 120, 60, 70]];
  for (const [x, z, w, h] of skyline) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.6), skyMat);
    s.position.set(x, h / 2, z);
    scene.add(s);
  }

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
