// Small math helpers shared by every system.
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
// Frame-rate independent approach: damp(current, target, rate, dt).
export function damp(current, target, rate, dt) {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}
// Squared distance on the ground plane (x/z). Coordinates are numbers only;
// a function slipped in here used to silently produce NaN, so assert.
export function dist2(ax, az, bx, bz) {
  if (typeof ax !== 'number' || typeof az !== 'number' || typeof bx !== 'number' || typeof bz !== 'number') {
    throw new Error('dist2 got a non-number coordinate');
  }
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}
export function dist(ax, az, bx, bz) {
  return Math.sqrt(dist2(ax, az, bx, bz));
}
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export function angleLerp(a, b, t) {
  return a + wrapAngle(b - a) * t;
}
