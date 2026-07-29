// @ts-check

import { add, scale, sub } from '../core/vec3.js';
import { hashSeed } from '../core/rng.js';

/** @typedef {import('../core/puzzle-compiler.js').CompiledPiece} CompiledPiece */
/** @typedef {import('../core/puzzle-compiler.js').CompiledPuzzle} CompiledPuzzle */

/** @param {readonly number[]} color @param {number} factor @returns {[number,number,number]} */
function multiplyColor(color, factor) {
  return [
    Math.max(0, Math.min(1, color[0] * factor)),
    Math.max(0, Math.min(1, color[1] * factor)),
    Math.max(0, Math.min(1, color[2] * factor)),
  ];
}

/** @param {readonly number[]} a @param {readonly number[]} b @param {number} t @returns {[number,number,number]} */
function mixColor(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Maps an integer ID to an exact, collision-free 24-bit color for the practical dataset range.
 * Multiplication by an odd constant permutes the 24-bit space, so nearby IDs remain visually
 * distinct without sacrificing byte-perfect invertibility.
 * @param {number} index
 * @returns {[number,number,number]}
 */
export function machineIdColor(index) {
  const code = Math.imul((Math.trunc(index) + 1) & 0xffffff, 0x9e3779b1) & 0xffffff;
  return [((code >>> 16) & 0xff) / 255, ((code >>> 8) & 0xff) / 255, (code & 0xff) / 255];
}

/** @param {number} index @param {number} _total @returns {[number,number,number]} */
export function pieceIdColor(index, _total) {
  return machineIdColor(index);
}

/** @param {number} index @returns {[number,number,number]} */
export function faceIdColor(index) {
  return machineIdColor(4096 + index);
}

/** @param {import('../core/vec3.js').Vec3} normal */
function dominantOuterTag(normal) {
  const values = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
  const axis = values.indexOf(Math.max(...values));
  const component = axis === 0 ? normal.x : axis === 1 ? normal.y : normal.z;
  return `outer:${component >= 0 ? '+' : '-'}${['x', 'y', 'z'][axis]}`;
}

const CLASSIC_COLORS = {
  'outer:+x': [0.86, 0.08, 0.085],
  'outer:-x': [1.0, 0.29, 0.03],
  'outer:+y': [0.94, 0.95, 0.98],
  'outer:-y': [1.0, 0.82, 0.04],
  'outer:+z': [0.03, 0.64, 0.28],
  'outer:-z': [0.03, 0.24, 0.78],
};

/**
 * @param {CompiledPuzzle} puzzle
 * @param {CompiledPiece} piece
 * @param {number} faceIndex
 * @returns {[number,number,number]}
 */
function surfaceColor(puzzle, piece, faceIndex) {
  const face = piece.polyhedron.faces[faceIndex];
  const appearance = puzzle.spec.appearance;
  if (face.kind !== 'outer') return /** @type {[number,number,number]} */ (appearance.bodyColor ?? [0.025, 0.03, 0.04]);

  if (appearance.palette === 'classic') {
    return /** @type {[number,number,number]} */ (CLASSIC_COLORS[dominantOuterTag(face.normal)] ?? [0.7, 0.72, 0.75]);
  }

  const base = appearance.outerColor ?? [0.55, 0.6, 0.68];
  const accent = appearance.accentColor ?? base;
  const bandage = puzzle.constraints.bandageByPieceId.get(piece.id);
  const materialIdentity = appearance.palette === 'bandaged' && bandage ? bandage.id : piece.id;
  const hash = hashSeed(`${materialIdentity}:${faceIndex}:${appearance.seed ?? ''}`);
  const variation = 0.9 + ((hash & 0xff) / 255) * 0.16;
  const accentStrength = appearance.palette === 'alien' ? 0.28 : appearance.palette === 'bandaged' ? 0.2 : 0.08;
  const accentMix = ((hash >>> 8) & 0xff) / 255 * accentStrength;
  const normalLift = 0.94 + 0.08 * Math.max(0, face.normal.y);
  return multiplyColor(mixColor(base, accent, accentMix), variation * normalLift);
}

/**
 * Converts one exact convex piece into non-indexed GPU arrays. Vertices are duplicated per
 * triangle so flat normals and per-face machine labels remain unambiguous.
 * @param {CompiledPuzzle} puzzle
 * @param {CompiledPiece} piece
 * @param {number} pieceIndex
 * @param {number} [faceIdBase]
 */
export function buildPieceMeshData(puzzle, piece, pieceIndex, faceIdBase = 0) {
  const poly = piece.polyhedron;
  const bandage = puzzle.constraints.bandageByPieceId.get(piece.id);
  const bandagedPieceIds = bandage ? new Set(bandage.pieceIds) : null;
  // Every piece in a rigid bandage is shrunk about the same centroid. Their bonded
  // interface therefore remains coincident while a clean gap stays around the union.
  const shrinkCenter = bandage?.centroid ?? poly.centroid;
  const shrink = 0.962;
  const outerLift = 0.006;
  const positions = [];
  const normals = [];
  const colors = [];
  const material = [];
  const faceColors = [];
  const surfaces = [];
  const surfaceProvenance = [];
  const linePositions = [];

  const appearance = puzzle.spec.appearance;
  const outerRoughness = appearance.roughness ?? 0.28;
  const outerMetallic = appearance.metallic ?? 0.55;
  const bodyRoughness = 0.62;
  const bodyMetallic = 0.08;

  const shrunkVertex = (index, normal = null, lift = 0) => {
    const original = poly.vertices[index];
    let point = add(shrinkCenter, scale(sub(original, shrinkCenter), shrink));
    if (normal && lift !== 0) point = add(point, scale(normal, lift));
    return point;
  };

  /** @param {{a:number,b:number}} edge */
  const isBondedInterfaceEdge = (edge) => {
    if (!bandagedPieceIds) return false;
    for (const face of poly.faces) {
      if (
        face.meta?.provenance?.category === 'internal-surface'
        && face.indices.includes(edge.a)
        && face.indices.includes(edge.b)
      ) return true;
      if (face.kind !== 'cut' || !face.indices.includes(edge.a) || !face.indices.includes(edge.b)) continue;
      const axis = Number(face.meta?.axis);
      const side = String(face.meta?.side ?? '');
      if (![0, 1, 2].includes(axis) || (side !== 'lower' && side !== 'upper')) continue;
      const neighbor = /** @type {[number,number,number]} */ ([...piece.homeIndex]);
      neighbor[axis] += side === 'lower' ? -1 : 1;
      if (bandagedPieceIds.has(`p-${neighbor[0]}-${neighbor[1]}-${neighbor[2]}`)) return true;
    }
    return false;
  };

  for (let triangleIndex = 0; triangleIndex < poly.triangles.length; triangleIndex += 1) {
    const triangle = poly.triangles[triangleIndex];
    const face = poly.faces[triangle.faceIndex];
    const provenanceCategory = String(face.meta?.provenance?.category ?? (
      face.kind === 'outer' ? 'outer-hull' : 'cut-surface'
    ));
    if (provenanceCategory === 'internal-surface') continue;
    const color = surfaceColor(puzzle, piece, triangle.faceIndex);
    const machineFaceColor = faceIdColor(faceIdBase + triangle.faceIndex);
    const isOuter = face.kind === 'outer';
    const roughness = isOuter ? outerRoughness : bodyRoughness;
    const metallic = isOuter ? outerMetallic : bodyMetallic;
    const lift = isOuter ? outerLift : 0;

    for (const vertexIndex of [triangle.a, triangle.b, triangle.c]) {
      const point = shrunkVertex(vertexIndex, face.normal, lift);
      positions.push(point.x, point.y, point.z);
      normals.push(face.normal.x, face.normal.y, face.normal.z);
      colors.push(...color);
      material.push(roughness, metallic);
      faceColors.push(...machineFaceColor);
      surfaces.push(isOuter ? 1 : 0);
      surfaceProvenance.push(isOuter ? 2 : 1);
    }
  }

  for (const edge of poly.edges) {
    if (isBondedInterfaceEdge(edge)) continue;
    const a = shrunkVertex(edge.a);
    const b = shrunkVertex(edge.b);
    linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }

  return {
    pieceId: piece.id,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    material: new Float32Array(material),
    faceColors: new Float32Array(faceColors),
    surfaces: new Float32Array(surfaces),
    surfaceProvenance: new Uint8Array(surfaceProvenance),
    linePositions: new Float32Array(linePositions),
    pieceColor: pieceIdColor(pieceIndex, puzzle.pieces.length),
    triangleCount: positions.length / 9,
    lineSegmentCount: linePositions.length / 6,
  };
}
