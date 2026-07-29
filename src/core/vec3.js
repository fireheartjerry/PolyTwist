// @ts-check

/** @typedef {{x:number,y:number,z:number}} Vec3 */

/** @returns {Vec3} */
export function v3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export function add(a, b) {
  return v3(a.x + b.x, a.y + b.y, a.z + b.z);
}

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export function sub(a, b) {
  return v3(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** @param {Vec3} a @param {number} s @returns {Vec3} */
export function scale(a, s) {
  return v3(a.x * s, a.y * s, a.z * s);
}

/** @param {Vec3} a @param {Vec3} b */
export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export function cross(a, b) {
  return v3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

/** @param {Vec3} a */
export function lengthSq(a) {
  return dot(a, a);
}

/** @param {Vec3} a */
export function length(a) {
  return Math.sqrt(lengthSq(a));
}

/** @param {Vec3} a @param {number} [epsilon] @returns {Vec3} */
export function normalize(a, epsilon = 1e-12) {
  const len = length(a);
  if (len <= epsilon) {
    throw new Error(`Cannot normalize near-zero vector (${a.x}, ${a.y}, ${a.z}).`);
  }
  return scale(a, 1 / len);
}

/** @param {Vec3} a @param {Vec3} b */
export function distanceSq(a, b) {
  return lengthSq(sub(a, b));
}

/** @param {Vec3} a @param {Vec3} b */
export function distance(a, b) {
  return Math.sqrt(distanceSq(a, b));
}

/** @param {Vec3} a @param {Vec3} b @param {number} t @returns {Vec3} */
export function lerp(a, b, t) {
  return v3(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t,
  );
}

/** @param {Vec3[]} points @returns {Vec3} */
export function average(points) {
  if (points.length === 0) return v3();
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return v3(x / points.length, y / points.length, z / points.length);
}

/**
 * Returns a stable unit tangent perpendicular to n.
 * @param {Vec3} n
 * @returns {Vec3}
 */
export function perpendicular(n) {
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  const reference = ax <= ay && ax <= az ? v3(1, 0, 0) : ay <= az ? v3(0, 1, 0) : v3(0, 0, 1);
  return normalize(cross(reference, n));
}

/**
 * Solves a 3x3 linear system whose rows are a, b, c.
 * Returns null for a singular or nearly singular system.
 *
 * @param {Vec3} a
 * @param {Vec3} b
 * @param {Vec3} c
 * @param {number} da
 * @param {number} db
 * @param {number} dc
 * @param {number} [epsilon]
 * @returns {Vec3|null}
 */
export function solveRows3(a, b, c, da, db, dc, epsilon = 1e-10) {
  const bxc = cross(b, c);
  const det = dot(a, bxc);
  if (Math.abs(det) <= epsilon) return null;

  const termA = scale(bxc, da);
  const termB = scale(cross(c, a), db);
  const termC = scale(cross(a, b), dc);
  return scale(add(add(termA, termB), termC), 1 / det);
}

/** @param {Vec3} a @param {Vec3} b @param {number} [epsilon] */
export function approxEqual(a, b, epsilon = 1e-8) {
  return distanceSq(a, b) <= epsilon * epsilon;
}

/** @param {Vec3} a @returns {[number,number,number]} */
export function toArray(a) {
  return [a.x, a.y, a.z];
}

/** @param {readonly number[]} a @returns {Vec3} */
export function fromArray(a) {
  if (a.length < 3) throw new Error('Expected at least three coordinates.');
  return v3(Number(a[0]), Number(a[1]), Number(a[2]));
}

/** @param {Vec3} a @param {number} digits @returns {Vec3} */
export function rounded(a, digits = 8) {
  const factor = 10 ** digits;
  return v3(
    Math.round(a.x * factor) / factor,
    Math.round(a.y * factor) / factor,
    Math.round(a.z * factor) / factor,
  );
}
