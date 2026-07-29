// @ts-check

import { dot, normalize, scale, v3 } from './vec3.js';
import { lowerCoordinatePlane, upperCoordinatePlane } from './frame.js';

/** @typedef {import('./vec3.js').Vec3} Vec3 */
/** @typedef {import('./frame.js').Frame} Frame */
/**
 * @typedef {Object} Plane
 * @property {Vec3} normal Outward unit normal; the feasible half-space is normal·x <= constant.
 * @property {number} constant
 * @property {[number,number,number]} rawNormal Source coefficients before render normalization.
 * @property {number} rawConstant
 * @property {string} tag
 * @property {'outer'|'cut'|'constraint'} kind
 * @property {Record<string,unknown>} meta
 */

/**
 * @param {Vec3|readonly number[]} normal
 * @param {number} constant
 * @param {{tag?:string,kind?:Plane['kind'],meta?:Record<string,unknown>}} [options]
 * @returns {Plane}
 */
export function makePlane(normal, constant, options = {}) {
  /** @type {Vec3} */
  const n = Array.isArray(normal)
    ? v3(Number(normal[0]), Number(normal[1]), Number(normal[2]))
    : /** @type {Vec3} */ (normal);
  const rawNormal = /** @type {[number,number,number]} */ ([n.x, n.y, n.z]);
  const rawConstant = Number(constant);
  const len = Math.sqrt(dot(n, n));
  if (len <= 1e-12) throw new Error('Plane normal cannot be zero.');
  return {
    normal: normalize(n),
    constant: rawConstant / len,
    rawNormal,
    rawConstant,
    tag: options.tag ?? 'plane',
    kind: options.kind ?? 'constraint',
    meta: options.meta ?? {},
  };
}

/**
 * @param {readonly number[]} halfSize
 * @param {{chamfer?:number,cornerChamfer?:number}} [options]
 * @returns {Plane[]}
 */
export function boxHullPlanes(halfSize, options = {}) {
  const hx = Number(halfSize[0]);
  const hy = Number(halfSize[1]);
  const hz = Number(halfSize[2]);
  if (!(hx > 0 && hy > 0 && hz > 0)) throw new Error('Box half-sizes must be positive.');

  /** @type {Plane[]} */
  const planes = [
    makePlane([1, 0, 0], hx, { tag: 'outer:+x', kind: 'outer', meta: { axis: 0, sign: 1 } }),
    makePlane([-1, 0, 0], hx, { tag: 'outer:-x', kind: 'outer', meta: { axis: 0, sign: -1 } }),
    makePlane([0, 1, 0], hy, { tag: 'outer:+y', kind: 'outer', meta: { axis: 1, sign: 1 } }),
    makePlane([0, -1, 0], hy, { tag: 'outer:-y', kind: 'outer', meta: { axis: 1, sign: -1 } }),
    makePlane([0, 0, 1], hz, { tag: 'outer:+z', kind: 'outer', meta: { axis: 2, sign: 1 } }),
    makePlane([0, 0, -1], hz, { tag: 'outer:-z', kind: 'outer', meta: { axis: 2, sign: -1 } }),
  ];

  const chamfer = Math.max(0, Number(options.chamfer ?? 0));
  if (chamfer > 0) {
    const sizes = [hx, hy, hz];
    for (let a = 0; a < 3; a += 1) {
      for (let b = a + 1; b < 3; b += 1) {
        for (const sa of [-1, 1]) {
          for (const sb of [-1, 1]) {
            const n = [0, 0, 0];
            n[a] = sa;
            n[b] = sb;
            planes.push(
              makePlane(n, sizes[a] + sizes[b] - chamfer, {
                tag: `outer:edge:${a}${sa > 0 ? '+' : '-'}:${b}${sb > 0 ? '+' : '-'}`,
                kind: 'outer',
                meta: { bevel: 'edge', axes: [a, b], signs: [sa, sb] },
              }),
            );
          }
        }
      }
    }
  }

  const cornerChamfer = Math.max(0, Number(options.cornerChamfer ?? 0));
  if (cornerChamfer > 0) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          planes.push(
            makePlane([sx, sy, sz], hx + hy + hz - cornerChamfer, {
              tag: `outer:corner:${sx}:${sy}:${sz}`,
              kind: 'outer',
              meta: { bevel: 'corner', signs: [sx, sy, sz] },
            }),
          );
        }
      }
    }
  }

  return planes;
}

/**
 * Adds the lower and upper half-spaces for one logical cell interval.
 * Null bounds represent unbounded outer layers.
 * @param {Frame} frame
 * @param {0|1|2} axis
 * @param {number|null} lower
 * @param {number|null} upper
 * @param {string} cellTag
 * @returns {Plane[]}
 */
export function intervalPlanes(frame, axis, lower, upper, cellTag) {
  /** @type {Plane[]} */
  const result = [];
  if (lower !== null) {
    const p = lowerCoordinatePlane(frame, axis, lower);
    result.push(
      makePlane(p.normal, p.constant, {
        tag: `cut:${axis}:lower:${cellTag}`,
        kind: 'cut',
        meta: { axis, boundary: lower, side: 'lower' },
      }),
    );
  }
  if (upper !== null) {
    const p = upperCoordinatePlane(frame, axis, upper);
    result.push(
      makePlane(p.normal, p.constant, {
        tag: `cut:${axis}:upper:${cellTag}`,
        kind: 'cut',
        meta: { axis, boundary: upper, side: 'upper' },
      }),
    );
  }
  return result;
}

/** @param {Plane} plane @param {Vec3} point */
export function signedPlaneDistance(plane, point) {
  return dot(plane.normal, point) - plane.constant;
}

/** @param {Plane[]} planes @param {Vec3} point @param {number} [epsilon] */
export function insideAll(planes, point, epsilon = 1e-8) {
  for (const plane of planes) if (signedPlaneDistance(plane, point) > epsilon) return false;
  return true;
}
