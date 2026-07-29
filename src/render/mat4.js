// @ts-check

import { add, cross, dot, normalize, scale, sub, v3 } from '../core/vec3.js';

/** @typedef {import('../core/vec3.js').Vec3} Vec3 */
/** @typedef {Float32Array} Mat4 */
/** @typedef {readonly [number,number,number,number,number,number,number,number,number]} Mat3 */

/** @returns {Mat4} */
export function mat4Identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

/** @param {ArrayLike<number>} a @param {ArrayLike<number>} b @returns {Mat4} */
export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/** @param {number} fovYRadians @param {number} aspect @param {number} near @param {number} far */
export function mat4Perspective(fovYRadians, aspect, near, far) {
  const f = 1 / Math.tan(fovYRadians / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

/** @param {number} left @param {number} right @param {number} bottom @param {number} top @param {number} near @param {number} far */
export function mat4Orthographic(left, right, bottom, top, near, far) {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);
  return new Float32Array([
    -2 * lr, 0, 0, 0,
    0, -2 * bt, 0, 0,
    0, 0, 2 * nf, 0,
    (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1,
  ]);
}

/** @param {Vec3} eye @param {Vec3} target @param {Vec3} up */
export function mat4LookAt(eye, target, up) {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x.x, y.x, z.x, 0,
    x.y, y.y, z.y, 0,
    x.z, y.z, z.z, 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

/**
 * Rodrigues rotation matrix in row-major form.
 * @param {Vec3} axis
 * @param {number} angle
 * @returns {Mat3}
 */
export function axisAngle3(axis, angle) {
  const n = normalize(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  const { x, y, z } = n;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

/**
 * Builds a rigid transform x' = R(x-origin)+origin from row-major R.
 * @param {ArrayLike<number>} rotation
 * @param {Vec3} origin
 * @returns {Mat4}
 */
export function mat4AroundOrigin(rotation, origin) {
  const rx = rotation[0] * origin.x + rotation[1] * origin.y + rotation[2] * origin.z;
  const ry = rotation[3] * origin.x + rotation[4] * origin.y + rotation[5] * origin.z;
  const rz = rotation[6] * origin.x + rotation[7] * origin.y + rotation[8] * origin.z;
  const tx = origin.x - rx;
  const ty = origin.y - ry;
  const tz = origin.z - rz;
  return new Float32Array([
    rotation[0], rotation[3], rotation[6], 0,
    rotation[1], rotation[4], rotation[7], 0,
    rotation[2], rotation[5], rotation[8], 0,
    tx, ty, tz, 1,
  ]);
}

/** @param {ArrayLike<number>} matrix @param {Vec3} point @returns {Vec3} */
export function transformPoint(matrix, point) {
  const x = matrix[0] * point.x + matrix[4] * point.y + matrix[8] * point.z + matrix[12];
  const y = matrix[1] * point.x + matrix[5] * point.y + matrix[9] * point.z + matrix[13];
  const z = matrix[2] * point.x + matrix[6] * point.y + matrix[10] * point.z + matrix[14];
  const w = matrix[3] * point.x + matrix[7] * point.y + matrix[11] * point.z + matrix[15];
  return Math.abs(w) > 1e-12 ? v3(x / w, y / w, z / w) : v3(x, y, z);
}

/** @param {ArrayLike<number>} matrix @param {Vec3} direction @returns {Vec3} */
export function transformDirection(matrix, direction) {
  return v3(
    matrix[0] * direction.x + matrix[4] * direction.y + matrix[8] * direction.z,
    matrix[1] * direction.x + matrix[5] * direction.y + matrix[9] * direction.z,
    matrix[2] * direction.x + matrix[6] * direction.y + matrix[10] * direction.z,
  );
}

/** @param {ArrayLike<number>} matrix @returns {Float32Array} */
export function normalMatrix3FromMat4(matrix) {
  // All puzzle transforms are rigid rotations, so the upper-left 3x3 is already inverse-transpose.
  return new Float32Array([
    matrix[0], matrix[1], matrix[2],
    matrix[4], matrix[5], matrix[6],
    matrix[8], matrix[9], matrix[10],
  ]);
}

/** @param {number} t */
export function easeInOutCubic(t) {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
}
