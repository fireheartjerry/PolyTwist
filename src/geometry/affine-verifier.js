// @ts-check

import {
  evaluateExactPlane,
  exactPointKey,
  validateExactPolyhedron,
} from './exact-polyhedron.js';
import { signRational } from './rational.js';
import { canonicalSha256 } from './sha256.js';

/** @param {any} plane */
function planeHashRecord(plane) {
  return plane.integerCoefficients.map(String);
}

/** @param {any} geometry */
function independentInputPayload(geometry) {
  return {
    bodyPlanes: geometry.normalizedInput.bodyPlanes.map(planeHashRecord),
    cuts: geometry.normalizedInput.cuts.map(planeHashRecord),
    bondGroups: geometry.normalizedInput.bondGroups
      .map((group) => [...group].sort())
      .sort((a, b) => a.join('|').localeCompare(b.join('|'))),
  };
}

/** @param {any} geometry */
function independentGeometryPayload(geometry) {
  const cellById = new Map(geometry.atomicCells.map((cell) => [cell.id, cell]));
  return {
    cells: geometry.atomicCells.map((cell) => ({
      signKey: cell.signKey,
      vertices: cell.polyhedron.vertices.map(exactPointKey),
      faces: cell.faces.map((face) => ({
        plane: face.planeKey,
        vertices: face.vertexIndices.map((index) => exactPointKey(cell.polyhedron.vertices[index])),
        provenance: {
          category: face.provenance.category,
          sourceType: face.provenance.sourceType,
          sourceIndex: face.provenance.sourceIndex,
        },
      })),
      triangles: cell.polyhedron.triangles.map((triangle) => triangle.vertexIndices),
    })),
    adjacency: geometry.adjacency.map((adjacency) => ({
      cells: adjacency.cellIds.map((id) => cellById.get(id)?.signKey),
      cutIndex: adjacency.cutIndex,
      points: adjacency.points.map(exactPointKey),
    })),
    pieces: geometry.physicalPieces.map((piece) => ({
      cells: piece.cellIds.map((id) => cellById.get(id)?.signKey).sort(),
    })),
    boundaryTraces: geometry.boundaryTraces.map((trace) => ({
      hullPlane: trace.hullPlaneKey,
      cutIndex: trace.cutIndex,
      points: trace.points.map(exactPointKey),
    })),
  };
}

/**
 * Rejects a compiler artifact without reconstructing it through the compiler's
 * arrangement search. The verifier checks emitted exact certificates and
 * recomputes canonical digests through a separate payload implementation.
 *
 * @param {any} geometry
 * @returns {{valid:boolean,errors:string[]}}
 */
export function verifyAffineGeometry(geometry) {
  /** @type {string[]} */
  const errors = [];
  try {
    if (geometry?.schema !== 'polytwist.affine-geometry.v1') {
      errors.push('schema is not polytwist.affine-geometry.v1');
      return { valid: false, errors };
    }
    const hullPlanes = geometry.normalizedInput.bodyPlanes;
    const cuts = geometry.normalizedInput.cuts;
    const hullIndexByCarrier = new Map(hullPlanes.map((plane, index) => [plane.carrierKey, index]));
    const cutIndexByCarrier = new Map(cuts.map((plane, index) => [plane.carrierKey, index]));
    const cellById = new Map(geometry.atomicCells.map((cell) => [cell.id, cell]));

    const bodyErrors = validateExactPolyhedron(geometry.body);
    for (const error of bodyErrors) errors.push(`body: ${error}`);

    const pieceIdByCellId = new Map();
    for (const piece of geometry.physicalPieces) {
      for (const cellId of piece.cellIds) {
        if (!cellById.has(cellId)) errors.push(`piece ${piece.id} references missing cell ${cellId}`);
        if (pieceIdByCellId.has(cellId)) errors.push(`cell ${cellId} occurs in multiple physical pieces`);
        pieceIdByCellId.set(cellId, piece.id);
      }
    }
    for (const cell of geometry.atomicCells) {
      if (!pieceIdByCellId.has(cell.id)) errors.push(`cell ${cell.id} has no physical piece`);
      if (pieceIdByCellId.get(cell.id) !== cell.physicalPieceId) {
        errors.push(`cell ${cell.id} physical-piece back-reference is inconsistent`);
      }
    }

    const adjacencyByFace = new Map();
    for (const adjacent of geometry.adjacency) {
      if (adjacent.cellIds.length !== 2 || adjacent.cellIds[0] === adjacent.cellIds[1]) {
        errors.push(`adjacency ${adjacent.id} does not join two distinct cells`);
        continue;
      }
      const firstCell = cellById.get(adjacent.cellIds[0]);
      const secondCell = cellById.get(adjacent.cellIds[1]);
      if (!firstCell || !secondCell) {
        errors.push(`adjacency ${adjacent.id} references a missing cell`);
        continue;
      }
      const differingSigns = firstCell.signs
        .map((sign, index) => sign === secondCell.signs[index] ? -1 : index)
        .filter((index) => index >= 0);
      if (differingSigns.length !== 1 || differingSigns[0] !== adjacent.cutIndex) {
        errors.push(`adjacency ${adjacent.id} does not cross exactly its declared cut`);
      }
      const firstFace = firstCell.polyhedron.faces[adjacent.faceIndices[0]];
      const secondFace = secondCell.polyhedron.faces[adjacent.faceIndices[1]];
      if (!firstFace || !secondFace) {
        errors.push(`adjacency ${adjacent.id} references a missing face`);
        continue;
      }
      const firstPoints = firstFace.vertexIndices
        .map((index) => exactPointKey(firstCell.polyhedron.vertices[index]))
        .sort();
      const secondPoints = secondFace.vertexIndices
        .map((index) => exactPointKey(secondCell.polyhedron.vertices[index]))
        .sort();
      const declaredPoints = adjacent.points.map(exactPointKey).sort();
      if (
        firstPoints.join(';') !== secondPoints.join(';')
        || firstPoints.join(';') !== declaredPoints.join(';')
      ) {
        errors.push(`adjacency ${adjacent.id} does not pair identical exact polygons`);
      }
      adjacencyByFace.set(`${adjacent.cellIds[0]}:${adjacent.faceIndices[0]}`, adjacent);
      adjacencyByFace.set(`${adjacent.cellIds[1]}:${adjacent.faceIndices[1]}`, adjacent);
    }

    for (const cell of geometry.atomicCells) {
      const polyhedronErrors = validateExactPolyhedron(cell.polyhedron);
      for (const error of polyhedronErrors) errors.push(`${cell.id}: ${error}`);
      if (cell.faces.length !== cell.polyhedron.faces.length) {
        errors.push(`${cell.id}: provenance face count differs from B-rep face count`);
      }
      for (let cutIndex = 0; cutIndex < cuts.length; cutIndex += 1) {
        const sign = signRational(evaluateExactPlane(cuts[cutIndex], cell.polyhedron.centroid));
        if (sign !== cell.signs[cutIndex]) {
          errors.push(`${cell.id}: centroid witness does not certify cut ${cutIndex}`);
        }
      }
      for (let faceIndex = 0; faceIndex < cell.faces.length; faceIndex += 1) {
        const face = cell.faces[faceIndex];
        const polyhedronFace = cell.polyhedron.faces[faceIndex];
        if (!polyhedronFace) continue;
        if (
          face.vertexIndices.join(',') !== polyhedronFace.vertexIndices.join(',')
          || face.planeKey !== polyhedronFace.plane.key
        ) {
          errors.push(`${cell.id}:${faceIndex} provenance record does not match its B-rep face`);
        }
        const hullIndex = hullIndexByCarrier.get(polyhedronFace.plane.carrierKey);
        const cutIndex = cutIndexByCarrier.get(polyhedronFace.plane.carrierKey);
        const adjacent = adjacencyByFace.get(`${cell.id}:${faceIndex}`);
        let expectedCategory;
        let expectedType;
        let expectedIndex;
        if (hullIndex !== undefined) {
          expectedCategory = 'outer-hull';
          expectedType = 'hull';
          expectedIndex = hullIndex;
        } else if (cutIndex !== undefined) {
          const neighborId = adjacent?.cellIds.find((id) => id !== cell.id);
          expectedCategory = neighborId
            && pieceIdByCellId.get(neighborId) === pieceIdByCellId.get(cell.id)
            ? 'internal-surface'
            : 'cut-surface';
          expectedType = 'cut';
          expectedIndex = cutIndex;
        } else {
          errors.push(`${cell.id}:${faceIndex} has no normalized source carrier`);
          continue;
        }
        if (
          face.provenance.category !== expectedCategory
          || face.provenance.sourceType !== expectedType
          || face.provenance.sourceIndex !== expectedIndex
        ) {
          errors.push(`${cell.id}:${faceIndex} has invalid provenance`);
        }
      }
    }

    const expectedExposed = geometry.atomicCells.flatMap((cell) => cell.faces
      .filter((face) => face.provenance.category !== 'internal-surface')
      .map((face) => face.id)).sort();
    const actualExposed = geometry.exposedSurfaces.map((surface) => surface.id).sort();
    if (expectedExposed.join('|') !== actualExposed.join('|')) {
      errors.push('exposed surfaces do not equal the non-internal provenance faces');
    }
    if (geometry.exposedSurfaces.some(
      (surface) => surface.provenance.category === 'internal-surface',
    )) {
      errors.push('exposed surfaces contain internal provenance');
    }

    const inputHash = canonicalSha256(independentInputPayload(geometry));
    if (inputHash !== geometry.hashes.input) errors.push('input hash does not match normalized input');
    const geometryHash = canonicalSha256(independentGeometryPayload(geometry));
    if (geometryHash !== geometry.hashes.geometry) errors.push('geometry hash does not match artifact');
  } catch (error) {
    errors.push(`verifier exception: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { valid: errors.length === 0, errors };
}
