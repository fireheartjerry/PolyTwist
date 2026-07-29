// @ts-check

import {
  add,
  average,
  cross,
  distanceSq,
  dot,
  length,
  normalize,
  perpendicular,
  scale,
  solveRows3,
  sub,
  v3,
} from './vec3.js';
import { insideAll, signedPlaneDistance } from './halfspace.js';

/** @typedef {import('./vec3.js').Vec3} Vec3 */
/** @typedef {import('./halfspace.js').Plane} Plane */
/**
 * @typedef {Object} PolyFace
 * @property {number} planeIndex
 * @property {number[]} indices
 * @property {Vec3} normal
 * @property {Vec3} centroid
 * @property {number} area
 * @property {string} tag
 * @property {Plane['kind']} kind
 * @property {Record<string,unknown>} meta
 */
/**
 * @typedef {Object} Polyhedron
 * @property {Vec3[]} vertices
 * @property {PolyFace[]} faces
 * @property {{a:number,b:number,c:number,faceIndex:number}[]} triangles
 * @property {{a:number,b:number}[]} edges
 * @property {number} volume
 * @property {Vec3} centroid
 * @property {number} outerArea
 * @property {number} outerFaceCount
 * @property {number} sourcePlaneCount
 */

/** @param {Vec3[]} vertices @param {Vec3} point @param {number} epsilon */
function appendUnique(vertices, point, epsilon) {
  const epsilonSq = epsilon * epsilon;
  for (const existing of vertices) if (distanceSq(existing, point) <= epsilonSq) return;
  vertices.push(point);
}

/**
 * Removes nearly collinear vertices from an already cyclic polygon.
 * @param {number[]} indices
 * @param {Vec3[]} vertices
 * @param {number} epsilon
 */
function removeCollinear(indices, vertices, epsilon) {
  if (indices.length <= 3) return indices;
  let result = [...indices];
  let changed = true;
  while (changed && result.length > 3) {
    changed = false;
    const next = [];
    for (let i = 0; i < result.length; i += 1) {
      const previous = vertices[result[(i - 1 + result.length) % result.length]];
      const current = vertices[result[i]];
      const following = vertices[result[(i + 1) % result.length]];
      const e1 = sub(current, previous);
      const e2 = sub(following, current);
      const crossLen = length(cross(e1, e2));
      const scaleFactor = Math.max(1, length(e1) * length(e2));
      if (crossLen <= epsilon * scaleFactor) {
        changed = true;
      } else {
        next.push(result[i]);
      }
    }
    result = next;
  }
  return result;
}

/** @param {number[]} indices @param {Vec3[]} vertices @param {Vec3} normal */
function polygonArea(indices, vertices, normal) {
  if (indices.length < 3) return 0;
  let sum = v3();
  for (let i = 0; i < indices.length; i += 1) {
    const a = vertices[indices[i]];
    const b = vertices[indices[(i + 1) % indices.length]];
    sum = add(sum, cross(a, b));
  }
  return Math.abs(dot(sum, normal)) * 0.5;
}

/**
 * Computes an intersection polyhedron from convex half-spaces.
 * Planes must use the convention normal·x <= constant with outward normals.
 *
 * @param {Plane[]} planes
 * @param {{insideEpsilon?:number,vertexEpsilon?:number,faceEpsilon?:number,minVolume?:number}} [options]
 * @returns {Polyhedron|null}
 */
export function intersectHalfspaces(planes, options = {}) {
  const insideEpsilon = options.insideEpsilon ?? 2e-7;
  const vertexEpsilon = options.vertexEpsilon ?? 2e-6;
  const faceEpsilon = options.faceEpsilon ?? 8e-6;
  const minVolume = options.minVolume ?? 1e-8;

  /** @type {Vec3[]} */
  const vertices = [];
  for (let i = 0; i < planes.length - 2; i += 1) {
    for (let j = i + 1; j < planes.length - 1; j += 1) {
      for (let k = j + 1; k < planes.length; k += 1) {
        const a = planes[i];
        const b = planes[j];
        const c = planes[k];
        const point = solveRows3(
          a.normal,
          b.normal,
          c.normal,
          a.constant,
          b.constant,
          c.constant,
          1e-10,
        );
        if (!point) continue;
        if (!insideAll(planes, point, insideEpsilon)) continue;
        appendUnique(vertices, point, vertexEpsilon);
      }
    }
  }

  if (vertices.length < 4) return null;

  /** @type {PolyFace[]} */
  const faces = [];
  for (let planeIndex = 0; planeIndex < planes.length; planeIndex += 1) {
    const plane = planes[planeIndex];
    const candidateIndices = [];
    for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex += 1) {
      if (Math.abs(signedPlaneDistance(plane, vertices[vertexIndex])) <= faceEpsilon) {
        candidateIndices.push(vertexIndex);
      }
    }
    if (candidateIndices.length < 3) continue;

    const facePoints = candidateIndices.map((index) => vertices[index]);
    const centroid = average(facePoints);
    const tangentU = perpendicular(plane.normal);
    const tangentV = cross(plane.normal, tangentU); // tangentU × tangentV = outward normal.

    candidateIndices.sort((ia, ib) => {
      const a = sub(vertices[ia], centroid);
      const b = sub(vertices[ib], centroid);
      const angleA = Math.atan2(dot(a, tangentV), dot(a, tangentU));
      const angleB = Math.atan2(dot(b, tangentV), dot(b, tangentU));
      return angleA - angleB;
    });

    const indices = removeCollinear(candidateIndices, vertices, 3e-6);
    if (indices.length < 3) continue;
    const area = polygonArea(indices, vertices, plane.normal);
    if (area <= 1e-9) continue;

    faces.push({
      planeIndex,
      indices,
      normal: plane.normal,
      centroid: average(indices.map((index) => vertices[index])),
      area,
      tag: plane.tag,
      kind: plane.kind,
      meta: plane.meta,
    });
  }

  if (faces.length < 4) return null;

  const triangles = [];
  for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
    const face = faces[faceIndex];
    for (let i = 1; i < face.indices.length - 1; i += 1) {
      triangles.push({ a: face.indices[0], b: face.indices[i], c: face.indices[i + 1], faceIndex });
    }
  }

  let signedVolume = 0;
  let centroidAccumulator = v3();
  for (const triangle of triangles) {
    const a = vertices[triangle.a];
    const b = vertices[triangle.b];
    const c = vertices[triangle.c];
    const tetraVolume = dot(a, cross(b, c)) / 6;
    signedVolume += tetraVolume;
    centroidAccumulator = add(centroidAccumulator, scale(add(add(a, b), c), tetraVolume / 4));
  }

  const volume = Math.abs(signedVolume);
  if (volume <= minVolume) return null;
  const centroid = Math.abs(signedVolume) > 1e-12
    ? scale(centroidAccumulator, 1 / signedVolume)
    : average(vertices);

  const edgeMap = new Map();
  for (const face of faces) {
    for (let i = 0; i < face.indices.length; i += 1) {
      const a = face.indices[i];
      const b = face.indices[(i + 1) % face.indices.length];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (!edgeMap.has(key)) edgeMap.set(key, { a: Math.min(a, b), b: Math.max(a, b) });
    }
  }

  let outerArea = 0;
  let outerFaceCount = 0;
  for (const face of faces) {
    if (face.kind === 'outer') {
      outerArea += face.area;
      outerFaceCount += 1;
    }
  }

  return {
    vertices,
    faces,
    triangles,
    edges: [...edgeMap.values()],
    volume,
    centroid,
    outerArea,
    outerFaceCount,
    sourcePlaneCount: planes.length,
  };
}

/**
 * Validates that every vertex lies in every source half-space and all face normals are finite.
 * @param {Polyhedron} polyhedron
 * @param {Plane[]} planes
 * @param {number} [epsilon]
 */
export function validatePolyhedron(polyhedron, planes, epsilon = 2e-5) {
  const errors = [];
  for (let i = 0; i < polyhedron.vertices.length; i += 1) {
    const vertex = polyhedron.vertices[i];
    if (![vertex.x, vertex.y, vertex.z].every(Number.isFinite)) errors.push(`vertex ${i} is non-finite`);
    if (!insideAll(planes, vertex, epsilon)) errors.push(`vertex ${i} violates a source half-space`);
  }
  for (let i = 0; i < polyhedron.faces.length; i += 1) {
    const face = polyhedron.faces[i];
    if (face.indices.length < 3) errors.push(`face ${i} has fewer than three vertices`);
    if (!(face.area > 0)) errors.push(`face ${i} has non-positive area`);
    if (![face.normal.x, face.normal.y, face.normal.z].every(Number.isFinite)) {
      errors.push(`face ${i} has a non-finite normal`);
    }
  }
  if (!(polyhedron.volume > 0)) errors.push('polyhedron has non-positive volume');
  return errors;
}
