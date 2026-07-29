// @ts-check

/** @typedef {readonly [number,number,number,number,number,number,number,number,number]} Mat3i */
/** @typedef {readonly [number,number,number]} Vec3i */

/** @returns {Mat3i} */
export function identity3i() {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

/** @param {Mat3i} a @param {Mat3i} b @returns {Mat3i} */
export function multiply3i(a, b) {
  return /** @type {Mat3i} */ ([
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],

    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],

    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ]);
}

/** @param {Mat3i} m @param {Vec3i} v @returns {Vec3i} */
export function apply3i(m, v) {
  return /** @type {Vec3i} */ ([
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]);
}

/** @param {Mat3i} m @returns {Mat3i} */
export function transpose3i(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/** @param {Mat3i} m */
export function determinant3i(m) {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

/** @param {Mat3i} a @param {Mat3i} b */
export function equals3i(a, b) {
  for (let i = 0; i < 9; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Right-handed quarter-turn rotation in logical puzzle coordinates.
 * axis: 0=x, 1=y, 2=z. Positive turns follow the right-hand rule.
 * @param {0|1|2} axis
 * @param {number} turns
 * @returns {Mat3i}
 */
export function quarterTurn3i(axis, turns) {
  const t = ((Math.trunc(turns) % 4) + 4) % 4;
  if (t === 0) return identity3i();

  const positive = /** @type {Mat3i[]} */ ([
    [1, 0, 0, 0, 0, -1, 0, 1, 0],
    [0, 0, 1, 0, 1, 0, -1, 0, 0],
    [0, -1, 0, 1, 0, 0, 0, 0, 1],
  ])[axis];

  if (t === 1) return positive;
  if (t === 2) return multiply3i(positive, positive);
  return transpose3i(positive);
}

/** @param {Mat3i} m */
export function isProperCubeRotation(m) {
  if (determinant3i(m) !== 1) return false;
  for (let row = 0; row < 3; row += 1) {
    let count = 0;
    for (let col = 0; col < 3; col += 1) {
      const value = m[row * 3 + col];
      if (![0, 1, -1].includes(value)) return false;
      if (value !== 0) count += 1;
    }
    if (count !== 1) return false;
  }
  for (let col = 0; col < 3; col += 1) {
    let count = 0;
    for (let row = 0; row < 3; row += 1) if (m[row * 3 + col] !== 0) count += 1;
    if (count !== 1) return false;
  }
  return true;
}

/** @param {Mat3i} m */
export function key3i(m) {
  return m.join(',');
}
