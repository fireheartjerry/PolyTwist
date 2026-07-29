// @ts-check

import {
  apply3i,
  determinant3i,
  isProperCubeRotation,
  key3i,
} from '../core/mat3i.js';
import { frameAxis, logicalRotationToWorld } from '../core/frame.js';
import { verifyAffineGeometry } from '../geometry/affine-verifier.js';
import { mat4AroundOrigin, transformDirection, transformPoint } from './mat4.js';
import { DISPLAY_OUTER_FACE_LIFT, DISPLAY_PIECE_SCALE } from './mesh-data.js';

/** @typedef {import('../core/puzzle-compiler.js').CompiledPuzzle} CompiledPuzzle */
/** @typedef {import('../core/puzzle-engine.js').MovePreview} MovePreview */
/** @typedef {import('../core/mat3i.js').Mat3i} Mat3i */

const MATRIX_TOLERANCE = 2e-5;

/** @param {number} a @param {number} b */
function near(a, b) {
  return Math.abs(a - b) <= MATRIX_TOLERANCE;
}

/** @param {ArrayLike<number>} first @param {ArrayLike<number>} second */
function matricesNear(first, second) {
  if (first.length !== second.length) return false;
  for (let index = 0; index < first.length; index += 1) {
    if (!near(Number(first[index]), Number(second[index]))) return false;
  }
  return true;
}

/** Extracts a row-major rotation from a column-major affine matrix. @param {ArrayLike<number>} matrix */
function rotationFromMat4(matrix) {
  return [
    Number(matrix[0]), Number(matrix[4]), Number(matrix[8]),
    Number(matrix[1]), Number(matrix[5]), Number(matrix[9]),
    Number(matrix[2]), Number(matrix[6]), Number(matrix[10]),
  ];
}

/** @param {number[]} matrix */
function transpose3(matrix) {
  return [
    matrix[0], matrix[3], matrix[6],
    matrix[1], matrix[4], matrix[7],
    matrix[2], matrix[5], matrix[8],
  ];
}

/** @param {number[]} first @param {number[]} second */
function multiply3(first, second) {
  return [
    first[0] * second[0] + first[1] * second[3] + first[2] * second[6],
    first[0] * second[1] + first[1] * second[4] + first[2] * second[7],
    first[0] * second[2] + first[1] * second[5] + first[2] * second[8],
    first[3] * second[0] + first[4] * second[3] + first[5] * second[6],
    first[3] * second[1] + first[4] * second[4] + first[5] * second[7],
    first[3] * second[2] + first[4] * second[5] + first[5] * second[8],
    first[6] * second[0] + first[7] * second[3] + first[8] * second[6],
    first[6] * second[1] + first[7] * second[4] + first[8] * second[7],
    first[6] * second[2] + first[7] * second[5] + first[8] * second[8],
  ];
}

/** @param {number[]} matrix */
function determinant3(matrix) {
  return (
    matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7])
    - matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6])
    + matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6])
  );
}

/** @param {ArrayLike<number>} matrix */
function isRigidAffineMatrix(matrix) {
  if (matrix.length !== 16 || [...matrix].some((value) => !Number.isFinite(Number(value)))) return false;
  if (!near(Number(matrix[3]), 0) || !near(Number(matrix[7]), 0)
    || !near(Number(matrix[11]), 0) || !near(Number(matrix[15]), 1)) return false;
  const rotation = rotationFromMat4(matrix);
  const gram = multiply3(rotation, transpose3(rotation));
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return matricesNear(gram, identity) && near(determinant3(rotation), 1);
}

/** @param {ArrayLike<number>} matrix @param {{x:number,y:number,z:number}} origin */
function fixesOrigin(matrix, origin) {
  const transformed = transformPoint(matrix, origin);
  return near(transformed.x, origin.x)
    && near(transformed.y, origin.y)
    && near(transformed.z, origin.z);
}

/** @param {number[]} rotation @param {{x:number,y:number,z:number}} axis */
function preservesAxis(rotation, axis) {
  const transformed = transformDirection([
    rotation[0], rotation[3], rotation[6], 0,
    rotation[1], rotation[4], rotation[7], 0,
    rotation[2], rotation[5], rotation[8], 0,
    0, 0, 0, 1,
  ], axis);
  return near(transformed.x, axis.x)
    && near(transformed.y, axis.y)
    && near(transformed.z, axis.z);
}

/**
 * Derives the static renderer matrices for an exact docked state.
 *
 * @param {CompiledPuzzle} puzzle
 * @param {Map<string,Mat3i>} transforms
 */
export function deriveExactRigidModelMatrices(puzzle, transforms) {
  const matrices = new Map();
  for (const piece of puzzle.pieces) {
    if (!piece.renderable) continue;
    const transform = transforms.get(piece.id);
    if (!transform) continue;
    matrices.set(piece.id, mat4AroundOrigin(
      logicalRotationToWorld(puzzle.frame, transform),
      puzzle.frame.origin,
    ));
  }
  return matrices;
}

/**
 * Verifies the Phase 1 ideal-rigid display contract against actual derived matrices.
 *
 * @param {CompiledPuzzle} puzzle
 * @param {Map<string,Mat3i>} transforms
 * @param {Map<string,ArrayLike<number>>} modelMatrices
 * @param {MovePreview|null} [activeMove]
 * @param {{geometryVerification?:ReturnType<typeof verifyAffineGeometry>}} [options]
 */
export function certifyIdealRigidDisplay(
  puzzle,
  transforms,
  modelMatrices,
  activeMove = null,
  options = {},
) {
  const errors = [];
  const geometryVerification = options.geometryVerification ?? verifyAffineGeometry(puzzle.geometry);
  if (!geometryVerification.valid) {
    errors.push(...geometryVerification.errors.map((error) => `canonical geometry: ${error}`));
  }

  let exactOrientationsProper = transforms.size === puzzle.pieces.length;
  const occupied = new Set();
  for (const piece of puzzle.pieces) {
    const transform = transforms.get(piece.id);
    if (!transform || !isProperCubeRotation(transform) || determinant3i(transform) !== 1) {
      exactOrientationsProper = false;
      errors.push(`invalid exact transform for ${piece.id}: ${transform ? key3i(transform) : 'missing'}`);
      continue;
    }
    const coordinate = apply3i(transform, piece.homeCoord).join(',');
    if (occupied.has(coordinate)) errors.push(`duplicate logical occupancy at ${coordinate}`);
    occupied.add(coordinate);
  }
  const uniqueLogicalOccupancy = occupied.size === puzzle.pieces.length;

  const visiblePieces = puzzle.pieces.filter((piece) => piece.renderable);
  let renderMatricesRigid = modelMatrices.size === visiblePieces.length;
  let renderPivotFixed = true;
  let renderStateAgreement = true;
  let activeLayerSelection = true;
  let activeAxisPreserved = true;
  let activeCommonRotation = true;
  const activeIds = new Set(activeMove?.selectedIds ?? []);
  let referenceDelta = null;

  if (activeMove) {
    const expectedIds = puzzle.pieces
      .filter((piece) => {
        const transform = transforms.get(piece.id);
        return transform && apply3i(transform, piece.homeCoord)[activeMove.axis] === activeMove.layer;
      })
      .map((piece) => piece.id);
    activeLayerSelection = expectedIds.length === puzzle.spec.size ** 2
      && expectedIds.length === activeMove.selectedIds.length
      && expectedIds.every((pieceId, index) => pieceId === activeMove.selectedIds[index]);
    if (!activeLayerSelection) errors.push(`active move ${activeMove.token} does not select one exact logical layer`);
  }

  for (const piece of visiblePieces) {
    const matrix = modelMatrices.get(piece.id);
    const exact = transforms.get(piece.id);
    if (!matrix || !exact) {
      renderMatricesRigid = false;
      renderStateAgreement = false;
      errors.push(`missing render data for ${piece.id}`);
      continue;
    }
    if (!isRigidAffineMatrix(matrix)) {
      renderMatricesRigid = false;
      errors.push(`render matrix for ${piece.id} is not a proper rigid affine transform`);
    }
    if (!fixesOrigin(matrix, puzzle.frame.origin)) {
      renderPivotFixed = false;
      errors.push(`render matrix for ${piece.id} does not fix the mechanism origin`);
    }

    const base = mat4AroundOrigin(
      logicalRotationToWorld(puzzle.frame, exact),
      puzzle.frame.origin,
    );
    if (!activeMove || !activeIds.has(piece.id)) {
      if (!matricesNear(matrix, base)) {
        renderStateAgreement = false;
        errors.push(`render matrix for stationary ${piece.id} disagrees with exact state`);
      }
      continue;
    }

    const delta = multiply3(rotationFromMat4(matrix), transpose3(rotationFromMat4(base)));
    const axis = frameAxis(puzzle.frame, activeMove.axis);
    if (!preservesAxis(delta, axis)) {
      activeAxisPreserved = false;
      errors.push(`animated matrix for ${piece.id} does not preserve the declared turn axis`);
    }
    if (referenceDelta === null) referenceDelta = delta;
    else if (!matricesNear(delta, referenceDelta)) {
      activeCommonRotation = false;
      errors.push(`animated matrix for ${piece.id} does not share the layer rotation`);
    }
  }

  const checks = {
    canonicalGeometryVerified: geometryVerification.valid,
    exactOrientationsProper,
    uniqueLogicalOccupancy,
    renderMatricesRigid,
    renderPivotFixed,
    renderStateAgreement,
    activeLayerSelection,
    activeAxisPreserved,
    activeCommonRotation,
  };
  return {
    schema: 'polytwist.ideal-rigid-display-certificate.v1',
    scope: 'convex-planar-cut-cubic-adapter',
    valid: Object.values(checks).every(Boolean) && errors.length === 0,
    geometryHash: puzzle.geometry.hashes.geometry,
    checks,
    errors,
    presentation: {
      canonical: false,
      pieceContraction: {
        mode: 'centroid-homothety',
        scale: DISPLAY_PIECE_SCALE,
      },
      outerFaceLift: DISPLAY_OUTER_FACE_LIFT,
    },
    limitations: [
      'not a manufacturing-clearance or tolerance certificate',
      'not a hidden-core, retention, friction, or compliance model',
      'not a general swept-volume collision certificate',
      'bonded nonconvex unions receive rigid-transform checks only',
    ],
  };
}
