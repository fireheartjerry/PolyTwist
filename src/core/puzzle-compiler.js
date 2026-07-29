// @ts-check

import { makeFrame } from './frame.js';
import { boxHullPlanes, intervalPlanes, makePlane } from './halfspace.js';
import { intersectHalfspaces, validatePolyhedron } from './polyhedron.js';

/** @typedef {import('./frame.js').Frame} Frame */
/** @typedef {import('./polyhedron.js').Polyhedron} Polyhedron */
/** @typedef {import('./mat3i.js').Vec3i} Vec3i */

/**
 * @typedef {Object} PuzzleSpec
 * @property {string} id
 * @property {string} name
 * @property {string} family
 * @property {string} description
 * @property {number} size
 * @property {{halfSize?:[number,number,number],chamfer?:number,cornerChamfer?:number,planes?:{normal:[number,number,number],constant:number,tag?:string}[]}} outer
 * @property {{origin:[number,number,number],eulerDeg:[number,number,number],cutSpacing:number}} mechanism
 * @property {{id:string,label?:string,axis:0|1|2,layer:number|'min'|'max',quarterTurns:number}[]} [moves]
 * @property {{palette:string,bodyColor?:[number,number,number],outerColor?:[number,number,number],accentColor?:[number,number,number],roughness?:number,metallic?:number,seed?:string|number}} appearance
 * @property {{bandages?:{id:string,label?:string,cells:[number,number,number][] }[]}} [constraints]
 * @property {{expectedRenderable?:number,strictTopology?:boolean}} [validation]
 * @property {Record<string,unknown>} [metadata]
 */
/**
 * @typedef {Object} CompiledPiece
 * @property {string} id
 * @property {[number,number,number]} homeIndex
 * @property {Vec3i} homeCoord
 * @property {Polyhedron} polyhedron
 * @property {boolean} renderable
 * @property {number} outerArea
 */
/**
 * @typedef {Object} CompiledBandage
 * @property {string} id
 * @property {string} label
 * @property {string[]} pieceIds
 * @property {[number,number,number][]} cells
 * @property {{x:number,y:number,z:number}} centroid
 */
/**
 * @typedef {Object} MoveDefinition
 * @property {string} id
 * @property {string} label
 * @property {0|1|2} axis
 * @property {number} layer
 * @property {number} quarterTurns
 */
/**
 * @typedef {Object} CompiledPuzzle
 * @property {PuzzleSpec} spec
 * @property {Frame} frame
 * @property {CompiledPiece[]} pieces
 * @property {Map<string,CompiledPiece>} pieceById
 * @property {MoveDefinition[]} moves
 * @property {Map<string,MoveDefinition>} moveById
 * @property {{bandages:CompiledBandage[],bandageByPieceId:Map<string,CompiledBandage>}} constraints
 * @property {{logicalPieces:number,renderablePieces:number,totalTriangles:number,totalVertices:number,totalVolume:number,bandageCount:number,bandagedPieceCount:number,topologyWarnings:string[]}} stats
 */

/** @param {number} size @param {number} spacing */
export function centeredCutPositions(size, spacing) {
  if (!Number.isInteger(size) || size < 2 || size > 9) throw new Error('Puzzle size must be an integer from 2 through 9.');
  if (!(spacing > 0)) throw new Error('Cut spacing must be positive.');
  const positions = [];
  for (let i = 1; i < size; i += 1) positions.push((i - size / 2) * spacing);
  return positions;
}

/** @param {number} index @param {number} size */
export function logicalCoordinate(index, size) {
  return 2 * index - (size - 1);
}

/** @param {number} size @returns {MoveDefinition[]} */
export function defaultFaceMoves(size) {
  const max = size - 1;
  return [
    { id: 'R', label: 'R', axis: 0, layer: max, quarterTurns: -1 },
    { id: 'L', label: 'L', axis: 0, layer: -max, quarterTurns: 1 },
    { id: 'U', label: 'U', axis: 1, layer: max, quarterTurns: -1 },
    { id: 'D', label: 'D', axis: 1, layer: -max, quarterTurns: 1 },
    { id: 'F', label: 'F', axis: 2, layer: max, quarterTurns: -1 },
    { id: 'B', label: 'B', axis: 2, layer: -max, quarterTurns: 1 },
  ];
}

/** @param {PuzzleSpec['outer']} outer */
function compileOuterPlanes(outer) {
  if (outer.planes?.length) {
    if (outer.planes.length < 4) throw new Error('A custom convex hull requires at least four planes.');
    return outer.planes.map((plane, index) => makePlane(plane.normal, plane.constant, {
      tag: plane.tag ?? `outer:custom:${index}`,
      kind: 'outer',
      meta: { custom: true, sourceIndex: index },
    }));
  }
  if (!outer.halfSize) throw new Error('Outer hull requires either halfSize or an explicit planes array.');
  return boxHullPlanes(outer.halfSize, {
    chamfer: outer.chamfer ?? 0,
    cornerChamfer: outer.cornerChamfer ?? 0,
  });
}

/** @param {PuzzleSpec} spec @returns {MoveDefinition[]} */
function compileMoves(spec) {
  if (!spec.moves?.length) return defaultFaceMoves(spec.size);
  const max = spec.size - 1;
  const seen = new Set();
  return spec.moves.map((move, index) => {
    const id = String(move.id).trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_-]*$/.test(id)) throw new Error(`Move ${index} has invalid id ${move.id}.`);
    if (seen.has(id)) throw new Error(`Move id ${id} is duplicated.`);
    seen.add(id);
    if (![0, 1, 2].includes(move.axis)) throw new Error(`Move ${id} has invalid axis ${move.axis}.`);
    const layer = move.layer === 'max' ? max : move.layer === 'min' ? -max : Number(move.layer);
    if (!Number.isInteger(layer) || layer < -max || layer > max || (layer + max) % 2 !== 0) {
      throw new Error(`Move ${id} targets invalid logical layer ${String(move.layer)}.`);
    }
    const quarterTurns = Math.trunc(Number(move.quarterTurns));
    if (quarterTurns === 0 || !Number.isFinite(quarterTurns)) throw new Error(`Move ${id} must rotate by a nonzero quarter-turn count.`);
    return {
      id,
      label: String(move.label ?? id),
      axis: /** @type {0|1|2} */ (move.axis),
      layer,
      quarterTurns,
    };
  });
}

/** @param {PuzzleSpec} spec @param {Map<string,CompiledPiece>} pieceById */
function compileConstraints(spec, pieceById) {
  /** @type {CompiledBandage[]} */
  const bandages = [];
  /** @type {Map<string,CompiledBandage>} */
  const bandageByPieceId = new Map();
  const seenIds = new Set();

  for (const [index, input] of (spec.constraints?.bandages ?? []).entries()) {
    const id = String(input.id ?? '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]*$/.test(id)) {
      throw new Error(`Bandage ${index} has invalid id ${String(input.id)}.`);
    }
    if (seenIds.has(id)) throw new Error(`Bandage id ${id} is duplicated.`);
    seenIds.add(id);
    if (!Array.isArray(input.cells) || input.cells.length < 2) {
      throw new Error(`Bandage ${id} must join at least two logical cells.`);
    }

    const pieceIds = [];
    /** @type {[number,number,number][]} */
    const cells = [];
    const local = new Set();
    for (const [cellIndex, cell] of input.cells.entries()) {
      if (!Array.isArray(cell) || cell.length !== 3 || !cell.every(Number.isInteger)) {
        throw new Error(`Bandage ${id} cell ${cellIndex} must be an integer [x,y,z] index.`);
      }
      if (cell.some((value) => value < 0 || value >= spec.size)) {
        throw new Error(`Bandage ${id} cell ${cellIndex} lies outside a ${spec.size}×${spec.size}×${spec.size} puzzle.`);
      }
      const pieceId = `p-${cell[0]}-${cell[1]}-${cell[2]}`;
      const piece = pieceById.get(pieceId);
      if (!piece) throw new Error(`Bandage ${id} references missing piece ${pieceId}.`);
      if (!piece.renderable) {
        throw new Error(`Bandage ${id} references non-renderable interior piece ${pieceId}.`);
      }
      if (local.has(pieceId)) throw new Error(`Bandage ${id} repeats logical cell ${pieceId}.`);
      if (bandageByPieceId.has(pieceId)) {
        throw new Error(`Piece ${pieceId} belongs to both ${bandageByPieceId.get(pieceId)?.id} and ${id}.`);
      }
      local.add(pieceId);
      pieceIds.push(pieceId);
      cells.push(/** @type {[number,number,number]} */ ([...cell]));
    }

    // A physical bonded cluster must be connected through complete cubie faces. Without
    // this check, a specification could quietly create a rigid teleportation constraint.
    const cellKeys = new Set(cells.map((cell) => cell.join(',')));
    const visited = new Set([cells[0].join(',')]);
    const queue = [cells[0]];
    while (queue.length > 0) {
      const cell = queue.shift();
      if (!cell) break;
      for (let axis = 0; axis < 3; axis += 1) {
        for (const step of [-1, 1]) {
          const neighbor = /** @type {[number,number,number]} */ ([...cell]);
          neighbor[axis] += step;
          const key = neighbor.join(',');
          if (cellKeys.has(key) && !visited.has(key)) {
            visited.add(key);
            queue.push(neighbor);
          }
        }
      }
    }
    if (visited.size !== cells.length) {
      throw new Error(`Bandage ${id} must form one face-connected cluster of logical cells.`);
    }

    let totalVolume = 0;
    const centroid = { x: 0, y: 0, z: 0 };
    for (const pieceId of pieceIds) {
      const piece = pieceById.get(pieceId);
      if (!piece) continue;
      const weight = piece.polyhedron.volume;
      totalVolume += weight;
      centroid.x += piece.polyhedron.centroid.x * weight;
      centroid.y += piece.polyhedron.centroid.y * weight;
      centroid.z += piece.polyhedron.centroid.z * weight;
    }
    centroid.x /= totalVolume;
    centroid.y /= totalVolume;
    centroid.z /= totalVolume;

    const bandage = { id, label: String(input.label ?? id), pieceIds, cells, centroid };
    bandages.push(bandage);
    for (const pieceId of pieceIds) bandageByPieceId.set(pieceId, bandage);
  }

  return { bandages, bandageByPieceId };
}

/**
 * Compiles a puzzle specification into exact logical mechanics and convex piece meshes.
 * The logical move group is exact (integer signed-permutation matrices); geometry is a
 * deterministic half-space intersection in world coordinates.
 *
 * @param {PuzzleSpec} input
 * @returns {CompiledPuzzle}
 */
export function compilePuzzle(input) {
  const spec = structuredClone(input);
  if (!spec.id || !spec.name) throw new Error('Puzzle specifications require id and name.');
  const size = spec.size;
  if (!Number.isInteger(size) || size < 2 || size > 9) throw new Error('Only cubic sizes 2–9 are currently supported.');

  const frame = makeFrame(spec.mechanism);
  const cuts = centeredCutPositions(size, spec.mechanism.cutSpacing);
  const outerPlanes = compileOuterPlanes(spec.outer);

  /** @type {CompiledPiece[]} */
  const pieces = [];
  for (let ix = 0; ix < size; ix += 1) {
    for (let iy = 0; iy < size; iy += 1) {
      for (let iz = 0; iz < size; iz += 1) {
        const id = `p-${ix}-${iy}-${iz}`;
        const planes = [...outerPlanes];
        const indices = [ix, iy, iz];
        for (let axis = 0; axis < 3; axis += 1) {
          const index = indices[axis];
          const lower = index === 0 ? null : cuts[index - 1];
          const upper = index === size - 1 ? null : cuts[index];
          planes.push(...intervalPlanes(frame, /** @type {0|1|2} */ (axis), lower, upper, id));
        }

        const polyhedron = intersectHalfspaces(planes);
        if (!polyhedron) {
          throw new Error(
            `Specification ${spec.id} produced an empty logical cell at (${ix}, ${iy}, ${iz}). ` +
            'Reduce mechanism tilt/offset or adjust cut spacing.',
          );
        }
        const geometryErrors = validatePolyhedron(polyhedron, planes);
        if (geometryErrors.length > 0) {
          throw new Error(`Invalid piece ${id}: ${geometryErrors.join('; ')}`);
        }

        pieces.push({
          id,
          homeIndex: [ix, iy, iz],
          homeCoord: /** @type {Vec3i} */ ([
            logicalCoordinate(ix, size),
            logicalCoordinate(iy, size),
            logicalCoordinate(iz, size),
          ]),
          polyhedron,
          renderable: polyhedron.outerArea > 1e-5,
          outerArea: polyhedron.outerArea,
        });
      }
    }
  }

  const moves = compileMoves(spec);
  const pieceById = new Map(pieces.map((piece) => [piece.id, piece]));
  const moveById = new Map(moves.map((move) => [move.id, move]));
  const constraints = compileConstraints(spec, pieceById);
  const renderablePieces = pieces.filter((piece) => piece.renderable).length;
  const topologyWarnings = [];
  const expectedRenderable = spec.validation?.expectedRenderable ?? size ** 3 - Math.max(0, size - 2) ** 3;
  if (renderablePieces !== expectedRenderable) {
    topologyWarnings.push(`Expected ${expectedRenderable} renderable pieces but compiled ${renderablePieces}.`);
  }
  if (spec.validation?.strictTopology && topologyWarnings.length > 0) {
    throw new Error(`Topology validation failed for ${spec.id}: ${topologyWarnings.join(' ')}`);
  }

  return {
    spec,
    frame,
    pieces,
    pieceById,
    moves,
    moveById,
    constraints,
    stats: {
      logicalPieces: pieces.length,
      renderablePieces,
      totalTriangles: pieces.reduce((sum, piece) => sum + piece.polyhedron.triangles.length, 0),
      totalVertices: pieces.reduce((sum, piece) => sum + piece.polyhedron.vertices.length, 0),
      totalVolume: pieces.reduce((sum, piece) => sum + piece.polyhedron.volume, 0),
      bandageCount: constraints.bandages.length,
      bandagedPieceCount: constraints.bandageByPieceId.size,
      topologyWarnings,
    },
  };
}
