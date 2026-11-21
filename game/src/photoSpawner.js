// Photo-mode spawner + framing audit (r11, vlm-frame-composition).
//
// The study's density only counts if the figures READ at 256x144 — so
// the spawner places real traffic / peds / parked cars by CAMERA geometry
// (a point ahead of the lens, offset laterally), not just "near the
// player". The entities are the game's real traffic cars / peds / parked
// cars — only their positions move (the same honest staging shots.js
// already does, now aimed at the camera instead of at the player).
//
// The audit is the proof: every target's bounding box is projected with
// Vector3.project(camera) and reported as a screen bbox (% of frame
// width/height, in-frame or not). No eyeball claims — the shoot script
// reads window.__frameAudit and writes it to shots11.json.
import * as THREE from 'three';

// A world point on the road (y = 0) at `distAhead` metres along the
// camera's ground-projected forward, offset `lateral` metres to the
// camera's right (negative = left). Used to stage a car / ped so it lands
// in a chosen part of the frame at a chosen depth.
export function pointAhead(camera, distAhead, lateral = 0) {
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
  // fwd x up is the camera's screen-right (verified: looking east, right
  // is +z; looking north, right is -x) — so +lateral is screen-right.
  const p = camera.position.clone().addScaledVector(fwd, distAhead).addScaledVector(right, lateral);
  p.y = 0;
  return p;
}

// Project a single world point to screen coordinates 0..1 (origin
// top-left). Returns null when the point is behind the camera.
export function projectPoint(camera, vec3) {
  const v = vec3.clone().project(camera);
  if (v.z > 1) return null;
  return { x: v.x * 0.5 + 0.5, y: 0.5 - v.y * 0.5 };
}

// Audit one target: project the 8 corners of its axis-aligned box
// (centre + halfSize) and report the screen bbox as fractions of the
// frame, plus whether it is fully inside the frame.
export function auditTarget(camera, name, center, halfSize) {
  const pts = [];
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      for (const dz of [-1, 1]) {
        const v = new THREE.Vector3(
          center.x + dx * halfSize.x,
          center.y + dy * halfSize.y,
          center.z + dz * halfSize.z,
        );
        v.project(camera);
        pts.push(v);
      }
    }
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  return {
    name,
    left: Math.round((xMin * 0.5 + 0.5) * 1000) / 1000,
    top: Math.round((0.5 - yMax * 0.5) * 1000) / 1000,
    w: Math.round(((xMax - xMin) * 0.5) * 1000) / 1000,
    h: Math.round(((yMax - yMin) * 0.5) * 1000) / 1000,
    inFrame: xMin >= -1 && xMax <= 1 && yMin >= -1 && yMax <= 1,
    behind: pts.some((p) => p.z > 1),
  };
}

// Count how many of the given world positions project inside the frame.
export function countInView(camera, positions) {
  let n = 0;
  for (const p of positions) {
    const s = projectPoint(camera, new THREE.Vector3(p.x, p.y || 0, p.z));
    if (s && s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1) n += 1;
  }
  return n;
}
