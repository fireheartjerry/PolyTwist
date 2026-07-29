// @ts-check

import { add, dot, fromArray, scale, v3 } from './vec3.js';

/** @typedef {import('./vec3.js').Vec3} Vec3 */
/** @typedef {readonly [number,number,number,number,number,number,number,number,number]} Mat3 */
/** @typedef {{origin:Vec3,basis:Mat3,eulerDeg:[number,number,number]}} Frame */

/** @returns {Mat3} */
export function identity3() {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

/** @param {Mat3} a @param {Mat3} b @returns {Mat3} */
export function multiply3(a, b) {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

/** @param {Mat3} m @returns {Mat3} */
export function transpose3(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/** @param {Mat3} m @param {Vec3} p @returns {Vec3} */
export function apply3(m, p) {
  return v3(
    m[0] * p.x + m[1] * p.y + m[2] * p.z,
    m[3] * p.x + m[4] * p.y + m[5] * p.z,
    m[6] * p.x + m[7] * p.y + m[8] * p.z,
  );
}

/** @param {number} degrees */
function rad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Euler order: Rz * Ry * Rx. Inputs are [xPitch, yYaw, zRoll] in degrees.
 * @param {readonly number[]} eulerDeg
 * @returns {Mat3}
 */
export function basisFromEuler(eulerDeg) {
  const [x, y, z] = [rad(eulerDeg[0] ?? 0), rad(eulerDeg[1] ?? 0), rad(eulerDeg[2] ?? 0)];
  const cx = Math.cos(x);
  const sx = Math.sin(x);
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const cz = Math.cos(z);
  const sz = Math.sin(z);

  const rx = /** @type {Mat3} */ ([1, 0, 0, 0, cx, -sx, 0, sx, cx]);
  const ry = /** @type {Mat3} */ ([cy, 0, sy, 0, 1, 0, -sy, 0, cy]);
  const rz = /** @type {Mat3} */ ([cz, -sz, 0, sz, cz, 0, 0, 0, 1]);
  return multiply3(rz, multiply3(ry, rx));
}

/**
 * @param {{origin?:readonly number[],eulerDeg?:readonly number[]}} [options]
 * @returns {Frame}
 */
export function makeFrame(options = {}) {
  const origin = fromArray(options.origin ?? [0, 0, 0]);
  const euler = /** @type {[number,number,number]} */ ([
    Number(options.eulerDeg?.[0] ?? 0),
    Number(options.eulerDeg?.[1] ?? 0),
    Number(options.eulerDeg?.[2] ?? 0),
  ]);
  return { origin, basis: basisFromEuler(euler), eulerDeg: euler };
}

/**
 * Returns a world-space mechanism axis. Basis vectors are columns.
 * @param {Frame} frame
 * @param {0|1|2} axis
 * @returns {Vec3}
 */
export function frameAxis(frame, axis) {
  return v3(frame.basis[axis], frame.basis[3 + axis], frame.basis[6 + axis]);
}

/** @param {Frame} frame @param {Vec3} local @returns {Vec3} */
export function localToWorld(frame, local) {
  return add(frame.origin, apply3(frame.basis, local));
}

/** @param {Frame} frame @param {Vec3} world @returns {Vec3} */
export function worldToLocal(frame, world) {
  return apply3(transpose3(frame.basis), v3(world.x - frame.origin.x, world.y - frame.origin.y, world.z - frame.origin.z));
}

/**
 * Converts a signed-permutation logical rotation to world coordinates.
 * @param {Frame} frame
 * @param {readonly number[]} logical
 * @returns {Mat3}
 */
export function logicalRotationToWorld(frame, logical) {
  const g = /** @type {Mat3} */ ([
    logical[0], logical[1], logical[2],
    logical[3], logical[4], logical[5],
    logical[6], logical[7], logical[8],
  ]);
  return multiply3(frame.basis, multiply3(g, transpose3(frame.basis)));
}

/** @param {Frame} frame @param {Vec3} world */
export function mechanismCoordinates(frame, world) {
  const local = worldToLocal(frame, world);
  return [local.x, local.y, local.z];
}

/**
 * Plane constant for n·x <= c when local mechanism coordinate axis·(x-origin) <= value.
 * @param {Frame} frame
 * @param {0|1|2} axis
 * @param {number} value
 */
export function upperCoordinatePlane(frame, axis, value) {
  const normal = frameAxis(frame, axis);
  return { normal, constant: value + dot(normal, frame.origin) };
}

/**
 * Plane constant for local mechanism coordinate axis·(x-origin) >= value.
 * @param {Frame} frame
 * @param {0|1|2} axis
 * @param {number} value
 */
export function lowerCoordinatePlane(frame, axis, value) {
  const axisVector = frameAxis(frame, axis);
  const normal = scale(axisVector, -1);
  return { normal, constant: -value + dot(normal, frame.origin) };
}
