// @ts-check

import {
  absRational,
  addRational,
  compareRational,
  divideRational,
  makeRational,
  multiplyRational,
  negatePlane,
  normalizePlane,
  rationalKey,
  rationalToNumber,
  signRational,
  subtractRational,
} from './rational.js';

/** @typedef {import('./rational.js').Rational} Rational */
/** @typedef {import('./rational.js').RationalPlaneInput} RationalPlaneInput */
/** @typedef {import('./rational.js').NormalizedPlane} NormalizedPlane */
/** @typedef {[Rational,Rational,Rational]} ExactPoint */
/**
 * @typedef {{
 *   plane:NormalizedPlane,
 *   vertexIndices:number[],
 *   area:number
 * }} ExactFace
 */
/**
 * @typedef {{
 *   vertexIndices:[number,number],
 *   faceIndices:number[]
 * }} ExactEdge
 */
/**
 * @typedef {{
 *   vertexIndices:[number,number,number],
 *   faceIndex:number
 * }} ExactTriangle
 */
/**
 * @typedef {{
 *   sourcePlanes:NormalizedPlane[],
 *   vertices:ExactPoint[],
 *   faces:ExactFace[],
 *   edges:ExactEdge[],
 *   triangles:ExactTriangle[],
 *   volume:Rational,
 *   centroid:ExactPoint,
 *   numeric:{
 *     vertices:[number,number,number][],
 *     volume:number,
 *     centroid:[number,number,number]
 *   }
 * }} ExactPolyhedron
 */

const ZERO = makeRational(0n);
const ONE = makeRational(1n);
const FOUR = makeRational(4n);
const SIX = makeRational(6n);

/** @param {ExactPoint} point */
export function exactPointKey(point) {
  return point.map(rationalKey).join(',');
}

/** @param {ExactPoint} a @param {ExactPoint} b */
function comparePoints(a, b) {
  for (let axis = 0; axis < 3; axis += 1) {
    const comparison = compareRational(a[axis], b[axis]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

/** @param {ExactPoint} a @param {ExactPoint} b @returns {ExactPoint} */
function addPoint(a, b) {
  return [
    addRational(a[0], b[0]),
    addRational(a[1], b[1]),
    addRational(a[2], b[2]),
  ];
}

/** @param {ExactPoint} a @param {ExactPoint} b @returns {ExactPoint} */
function subtractPoint(a, b) {
  return [
    subtractRational(a[0], b[0]),
    subtractRational(a[1], b[1]),
    subtractRational(a[2], b[2]),
  ];
}

/** @param {ExactPoint} point @param {Rational} scalar @returns {ExactPoint} */
function scalePoint(point, scalar) {
  return [
    multiplyRational(point[0], scalar),
    multiplyRational(point[1], scalar),
    multiplyRational(point[2], scalar),
  ];
}

/** @param {ExactPoint} a @param {ExactPoint} b @returns {Rational} */
function dotPoint(a, b) {
  return addRational(
    addRational(multiplyRational(a[0], b[0]), multiplyRational(a[1], b[1])),
    multiplyRational(a[2], b[2]),
  );
}

/** @param {ExactPoint} a @param {ExactPoint} b @returns {ExactPoint} */
function crossPoint(a, b) {
  return [
    subtractRational(multiplyRational(a[1], b[2]), multiplyRational(a[2], b[1])),
    subtractRational(multiplyRational(a[2], b[0]), multiplyRational(a[0], b[2])),
    subtractRational(multiplyRational(a[0], b[1]), multiplyRational(a[1], b[0])),
  ];
}

/** @param {ExactPoint[]} points @returns {ExactPoint} */
function averagePoints(points) {
  let sum = /** @type {ExactPoint} */ ([ZERO, ZERO, ZERO]);
  for (const point of points) sum = addPoint(sum, point);
  return scalePoint(sum, divideRational(ONE, makeRational(BigInt(points.length))));
}

/** @param {NormalizedPlane} plane @param {ExactPoint} point @returns {Rational} */
export function evaluateExactPlane(plane, point) {
  return subtractRational(dotPoint(plane.normal, point), plane.constant);
}

/**
 * Exact determinant of a matrix whose rows are `a`, `b`, and `c`.
 * @param {ExactPoint} a
 * @param {ExactPoint} b
 * @param {ExactPoint} c
 */
function determinant3(a, b, c) {
  return dotPoint(a, crossPoint(b, c));
}

/**
 * @param {NormalizedPlane} a
 * @param {NormalizedPlane} b
 * @param {NormalizedPlane} c
 * @returns {ExactPoint|null}
 */
function intersectThreePlanes(a, b, c) {
  const determinant = determinant3(a.normal, b.normal, c.normal);
  if (signRational(determinant) === 0) return null;
  return [
    divideRational(determinant3(
      [a.constant, a.normal[1], a.normal[2]],
      [b.constant, b.normal[1], b.normal[2]],
      [c.constant, c.normal[1], c.normal[2]],
    ), determinant),
    divideRational(determinant3(
      [a.normal[0], a.constant, a.normal[2]],
      [b.normal[0], b.constant, b.normal[2]],
      [c.normal[0], c.constant, c.normal[2]],
    ), determinant),
    divideRational(determinant3(
      [a.normal[0], a.normal[1], a.constant],
      [b.normal[0], b.normal[1], b.constant],
      [c.normal[0], c.normal[1], c.constant],
    ), determinant),
  ];
}

/** @param {NormalizedPlane[]} planes */
function canonicalPlanes(planes) {
  const sorted = [...planes].sort((a, b) => (
    a.key.localeCompare(b.key)
    || String(a.sourceId).localeCompare(String(b.sourceId))
  ));
  /** @type {NormalizedPlane[]} */
  const unique = [];
  for (const plane of sorted) {
    if (unique.at(-1)?.key !== plane.key) unique.push(plane);
  }
  return unique;
}

/** @param {RationalPlaneInput[]|NormalizedPlane[]} planes */
function normalizePlanes(planes) {
  return canonicalPlanes(planes.map((plane) => (
    'integerCoefficients' in plane ? plane : normalizePlane(plane)
  )));
}

/** @param {ExactPoint[]} points */
function uniqueSortedPoints(points) {
  const byKey = new Map(points.map((point) => [exactPointKey(point), point]));
  return [...byKey.values()].sort(comparePoints);
}

/**
 * Orders a convex coplanar point set counterclockwise as viewed from outside.
 * No floating angles or tolerance decisions participate.
 *
 * @param {ExactPoint[]} sourcePoints
 * @param {NormalizedPlane} plane
 */
function orderFacePoints(sourcePoints, plane) {
  const points = uniqueSortedPoints(sourcePoints);
  if (points.length < 3) return [];
  const centroid = averagePoints(points);
  let dominantAxis = 0;
  for (let axis = 1; axis < 3; axis += 1) {
    if (compareRational(absRational(plane.normal[axis]), absRational(plane.normal[dominantAxis])) > 0) {
      dominantAxis = axis;
    }
  }
  const uAxis = (dominantAxis + 1) % 3;
  const vAxis = (dominantAxis + 2) % 3;

  const ordered = [...points].sort((a, b) => {
    const av = subtractPoint(a, centroid);
    const bv = subtractPoint(b, centroid);
    const half = (point) => {
      const vSign = signRational(point[vAxis]);
      const uSign = signRational(point[uAxis]);
      return vSign > 0 || (vSign === 0 && uSign >= 0) ? 0 : 1;
    };
    const halfA = half(av);
    const halfB = half(bv);
    if (halfA !== halfB) return halfA - halfB;
    const cross = subtractRational(
      multiplyRational(av[uAxis], bv[vAxis]),
      multiplyRational(av[vAxis], bv[uAxis]),
    );
    const crossSign = signRational(cross);
    if (crossSign !== 0) return -crossSign;
    return compareRational(dotPoint(av, av), dotPoint(bv, bv));
  });

  if (signRational(plane.normal[dominantAxis]) < 0) ordered.reverse();

  let result = ordered;
  let changed = true;
  while (changed && result.length > 3) {
    changed = false;
    const retained = [];
    for (let index = 0; index < result.length; index += 1) {
      const previous = result[(index - 1 + result.length) % result.length];
      const current = result[index];
      const next = result[(index + 1) % result.length];
      const first = subtractPoint(current, previous);
      const second = subtractPoint(next, current);
      const projectedCross = subtractRational(
        multiplyRational(first[uAxis], second[vAxis]),
        multiplyRational(first[vAxis], second[uAxis]),
      );
      if (signRational(projectedCross) === 0) {
        changed = true;
      } else {
        retained.push(current);
      }
    }
    result = retained;
  }

  let minimumIndex = 0;
  for (let index = 1; index < result.length; index += 1) {
    if (comparePoints(result[index], result[minimumIndex]) < 0) minimumIndex = index;
  }
  return [...result.slice(minimumIndex), ...result.slice(0, minimumIndex)];
}

/** @param {ExactPoint[]} points */
function numericPolygonArea(points) {
  const origin = points[0].map(rationalToNumber);
  let area = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = points[index].map(rationalToNumber);
    const b = points[index + 1].map(rationalToNumber);
    const first = /** @type {[number,number,number]} */ (a.map((value, axis) => value - origin[axis]));
    const second = /** @type {[number,number,number]} */ (b.map((value, axis) => value - origin[axis]));
    const cross = [
      first[1] * second[2] - first[2] * second[1],
      first[2] * second[0] - first[0] * second[2],
      first[0] * second[1] - first[1] * second[0],
    ];
    area += Math.hypot(...cross) / 2;
  }
  return area;
}

/**
 * @param {{plane:NormalizedPlane,points:ExactPoint[]}[]} rawFaces
 * @param {NormalizedPlane[]} sourcePlanes
 * @returns {ExactPolyhedron|null}
 */
function finalizePolyhedron(rawFaces, sourcePlanes) {
  const orderedFaces = rawFaces
    .map(({ plane, points }) => ({ plane, points: orderFacePoints(points, plane) }))
    .filter(({ points }) => points.length >= 3)
    .sort((a, b) => a.plane.key.localeCompare(b.plane.key));
  if (orderedFaces.length < 4) return null;

  const vertices = uniqueSortedPoints(orderedFaces.flatMap((face) => face.points));
  const vertexIndexByKey = new Map(vertices.map((point, index) => [exactPointKey(point), index]));
  /** @type {ExactFace[]} */
  const faces = orderedFaces.map(({ plane, points }) => ({
    plane,
    vertexIndices: points.map((point) => /** @type {number} */ (vertexIndexByKey.get(exactPointKey(point)))),
    area: numericPolygonArea(points),
  }));

  /** @type {ExactTriangle[]} */
  const triangles = [];
  for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
    const indices = faces[faceIndex].vertexIndices;
    for (let index = 1; index < indices.length - 1; index += 1) {
      triangles.push({
        vertexIndices: [indices[0], indices[index], indices[index + 1]],
        faceIndex,
      });
    }
  }

  const edgeMap = new Map();
  for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
    const indices = faces[faceIndex].vertexIndices;
    for (let index = 0; index < indices.length; index += 1) {
      const first = indices[index];
      const second = indices[(index + 1) % indices.length];
      const pair = /** @type {[number,number]} */ (first < second ? [first, second] : [second, first]);
      const key = pair.join(':');
      const edge = edgeMap.get(key) ?? { vertexIndices: pair, faceIndices: [] };
      edge.faceIndices.push(faceIndex);
      edgeMap.set(key, edge);
    }
  }
  const edges = /** @type {ExactEdge[]} */ (
    [...edgeMap.values()].sort((a, b) => (
      a.vertexIndices[0] - b.vertexIndices[0] || a.vertexIndices[1] - b.vertexIndices[1]
    ))
  );
  if (edges.some((edge) => edge.faceIndices.length !== 2)) return null;
  if (vertices.length - edges.length + faces.length !== 2) return null;

  let signedVolume = ZERO;
  let centroidAccumulator = /** @type {ExactPoint} */ ([ZERO, ZERO, ZERO]);
  for (const triangle of triangles) {
    const [a, b, c] = triangle.vertexIndices.map((index) => vertices[index]);
    const tetraVolume = divideRational(dotPoint(a, crossPoint(b, c)), SIX);
    signedVolume = addRational(signedVolume, tetraVolume);
    centroidAccumulator = addPoint(
      centroidAccumulator,
      scalePoint(addPoint(addPoint(a, b), c), divideRational(tetraVolume, FOUR)),
    );
  }
  if (signRational(signedVolume) <= 0) return null;
  const centroid = scalePoint(centroidAccumulator, divideRational(ONE, signedVolume));
  return {
    sourcePlanes: canonicalPlanes(sourcePlanes),
    vertices,
    faces,
    edges,
    triangles,
    volume: signedVolume,
    centroid,
    numeric: {
      vertices: vertices.map((point) => /** @type {[number,number,number]} */ (point.map(rationalToNumber))),
      volume: rationalToNumber(signedVolume),
      centroid: /** @type {[number,number,number]} */ (centroid.map(rationalToNumber)),
    },
  };
}

/**
 * Constructs a bounded full-dimensional convex polyhedron from exact half-spaces.
 * Planes use the convention `normal·x <= constant` with outward normals.
 *
 * @param {RationalPlaneInput[]|NormalizedPlane[]} planeInputs
 * @returns {ExactPolyhedron|null}
 */
export function intersectExactHalfspaces(planeInputs) {
  const planes = normalizePlanes(planeInputs);
  /** @type {ExactPoint[]} */
  const candidates = [];
  for (let first = 0; first < planes.length - 2; first += 1) {
    for (let second = first + 1; second < planes.length - 1; second += 1) {
      for (let third = second + 1; third < planes.length; third += 1) {
        const point = intersectThreePlanes(planes[first], planes[second], planes[third]);
        if (!point) continue;
        if (planes.every((plane) => signRational(evaluateExactPlane(plane, point)) <= 0)) {
          candidates.push(point);
        }
      }
    }
  }
  const vertices = uniqueSortedPoints(candidates);
  if (vertices.length < 4) return null;

  const rawFaces = planes.map((plane) => ({
    plane,
    points: vertices.filter((point) => signRational(evaluateExactPlane(plane, point)) === 0),
  }));
  return finalizePolyhedron(rawFaces, planes);
}

/**
 * Clips one face polygon to `plane <= 0`.
 * @param {ExactPoint[]} points
 * @param {NormalizedPlane} plane
 */
function clipFacePoints(points, plane) {
  /** @type {ExactPoint[]} */
  const result = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const currentDistance = evaluateExactPlane(plane, current);
    const nextDistance = evaluateExactPlane(plane, next);
    const currentInside = signRational(currentDistance) <= 0;
    const nextInside = signRational(nextDistance) <= 0;
    if (currentInside) result.push(current);
    if (currentInside !== nextInside) {
      const direction = subtractPoint(next, current);
      const denominator = subtractRational(currentDistance, nextDistance);
      const parameter = divideRational(currentDistance, denominator);
      result.push(addPoint(current, scalePoint(direction, parameter)));
    }
  }
  return uniqueSortedPoints(result);
}

/**
 * @param {ExactPolyhedron} polyhedron
 * @param {NormalizedPlane} plane
 * @returns {ExactPolyhedron|null}
 */
function clipNegative(polyhedron, plane) {
  /** @type {{plane:NormalizedPlane,points:ExactPoint[]}[]} */
  const rawFaces = [];
  /** @type {ExactPoint[]} */
  const capPoints = [];
  for (const face of polyhedron.faces) {
    const points = face.vertexIndices.map((index) => polyhedron.vertices[index]);
    const clipped = clipFacePoints(points, plane);
    if (clipped.length >= 3) rawFaces.push({ plane: face.plane, points: clipped });
    for (const point of clipped) {
      if (signRational(evaluateExactPlane(plane, point)) === 0) capPoints.push(point);
    }
  }
  const uniqueCapPoints = uniqueSortedPoints(capPoints);
  if (uniqueCapPoints.length >= 3) rawFaces.push({ plane, points: uniqueCapPoints });
  return finalizePolyhedron(rawFaces, [...polyhedron.sourcePlanes, plane]);
}

/**
 * Splits a full-dimensional exact convex polyhedron by an oriented plane.
 * `negative` is the `normal·x <= constant` child; `positive` is the opposite.
 *
 * @param {ExactPolyhedron} polyhedron
 * @param {RationalPlaneInput|NormalizedPlane} planeInput
 * @returns {{
 *   relation:'split'|'negative-only'|'positive-only',
 *   plane:NormalizedPlane,
 *   negative:ExactPolyhedron|null,
 *   positive:ExactPolyhedron|null
 * }}
 */
export function clipExactPolyhedron(polyhedron, planeInput) {
  const plane = 'integerCoefficients' in planeInput ? planeInput : normalizePlane(planeInput);
  const signs = polyhedron.vertices.map((point) => signRational(evaluateExactPlane(plane, point)));
  const hasNegative = signs.some((sign) => sign < 0);
  const hasPositive = signs.some((sign) => sign > 0);
  if (!hasPositive) {
    return { relation: 'negative-only', plane, negative: polyhedron, positive: null };
  }
  if (!hasNegative) {
    return { relation: 'positive-only', plane, negative: null, positive: polyhedron };
  }
  return {
    relation: 'split',
    plane,
    negative: clipNegative(polyhedron, plane),
    positive: clipNegative(polyhedron, negatePlane(plane)),
  };
}

/**
 * Independently checks local exact B-rep invariants without rebuilding the hull.
 * @param {ExactPolyhedron} polyhedron
 */
export function validateExactPolyhedron(polyhedron) {
  /** @type {string[]} */
  const errors = [];
  if (signRational(polyhedron.volume) <= 0) errors.push('volume is not positive');
  if (polyhedron.vertices.length - polyhedron.edges.length + polyhedron.faces.length !== 2) {
    errors.push('Euler characteristic is not two');
  }
  for (let vertexIndex = 0; vertexIndex < polyhedron.vertices.length; vertexIndex += 1) {
    const point = polyhedron.vertices[vertexIndex];
    for (const plane of polyhedron.sourcePlanes) {
      if (signRational(evaluateExactPlane(plane, point)) > 0) {
        errors.push(`vertex ${vertexIndex} violates source plane ${plane.key}`);
      }
    }
  }
  for (let faceIndex = 0; faceIndex < polyhedron.faces.length; faceIndex += 1) {
    const face = polyhedron.faces[faceIndex];
    if (face.vertexIndices.length < 3) errors.push(`face ${faceIndex} has fewer than three vertices`);
    for (const vertexIndex of face.vertexIndices) {
      if (!polyhedron.vertices[vertexIndex]) {
        errors.push(`face ${faceIndex} references missing vertex ${vertexIndex}`);
      } else if (signRational(evaluateExactPlane(face.plane, polyhedron.vertices[vertexIndex])) !== 0) {
        errors.push(`face ${faceIndex} is not planar`);
      }
    }
  }
  for (let edgeIndex = 0; edgeIndex < polyhedron.edges.length; edgeIndex += 1) {
    if (polyhedron.edges[edgeIndex].faceIndices.length !== 2) {
      errors.push(`edge ${edgeIndex} does not have two incident faces`);
    }
  }
  const expectedTriangles = polyhedron.faces.reduce(
    (count, face) => count + face.vertexIndices.length - 2,
    0,
  );
  if (polyhedron.triangles.length !== expectedTriangles) {
    errors.push('triangle count does not match deterministic face fans');
  }
  return errors;
}
