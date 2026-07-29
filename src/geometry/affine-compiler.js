// @ts-check

import {
  clipExactPolyhedron,
  exactPointKey,
  intersectExactFaceWithPlane,
  intersectExactHalfspaces,
  validateExactPolyhedron,
} from './exact-polyhedron.js';
import { normalizePlane } from './rational.js';
import { canonicalSha256 } from './sha256.js';

/** @typedef {import('./rational.js').RationalPlaneInput} RationalPlaneInput */
/** @typedef {import('./rational.js').NormalizedPlane} NormalizedPlane */
/** @typedef {import('./exact-polyhedron.js').ExactPolyhedron} ExactPolyhedron */

/**
 * @typedef {{
 *   body:{planes:RationalPlaneInput[]},
 *   cuts:RationalPlaneInput[],
 *   bonds?:Array<[unknown,unknown]>,
 *   bondGroups?:Array<{id?:string,cells:unknown[]}>,
 *   sourceExactness?:'exact-rational'|'rationalized-numerical'
 * }} AffineCompilerInput
 */

class DisjointSet {
  /** @param {string[]} values */
  constructor(values) {
    this.parent = new Map(values.map((value) => [value, value]));
  }

  /** @param {string} value */
  find(value) {
    const parent = this.parent.get(value);
    if (parent === undefined) throw new Error(`Unknown disjoint-set value ${value}.`);
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  /** @param {string} first @param {string} second */
  union(first, second) {
    const firstRoot = this.find(first);
    const secondRoot = this.find(second);
    if (firstRoot === secondRoot) return;
    if (firstRoot < secondRoot) this.parent.set(secondRoot, firstRoot);
    else this.parent.set(firstRoot, secondRoot);
  }
}

/** @param {NormalizedPlane} plane */
function planeHashRecord(plane) {
  return plane.integerCoefficients.map(String);
}

/**
 * Normalizes planes, fills stable source IDs, and rejects ambiguous IDs.
 * @param {RationalPlaneInput[]} inputs
 * @param {'hull'|'cut'} type
 */
function canonicalSourcePlanes(inputs, type) {
  const planes = inputs.map((input) => {
    const plane = normalizePlane(input);
    return {
      ...plane,
      sourceId: plane.sourceId ?? `${type}:${plane.carrierKey}`,
    };
  }).sort((a, b) => a.key.localeCompare(b.key) || a.sourceId.localeCompare(b.sourceId));
  const ids = new Set();
  for (const plane of planes) {
    if (ids.has(plane.sourceId)) throw new Error(`Duplicate ${type} source ID: ${plane.sourceId}.`);
    ids.add(plane.sourceId);
  }
  return planes;
}

/** @param {number[]} signs */
function signKey(signs) {
  return signs.map((sign) => sign < 0 ? '-' : '+').join('');
}

/**
 * @param {unknown} selector
 * @param {{id:string,sourceId:string}[]} cuts
 * @param {Map<string,string>} cellIdBySignKey
 */
function resolveCellSelector(selector, cuts, cellIdBySignKey) {
  if (typeof selector === 'string') {
    if (selector.startsWith('cell:')) {
      if (![...cellIdBySignKey.values()].includes(selector)) {
        throw new Error(`Bond selector references missing ${selector}.`);
      }
      return selector;
    }
    const cellId = cellIdBySignKey.get(selector);
    if (!cellId) throw new Error(`Bond selector references empty sign chamber ${selector}.`);
    return cellId;
  }
  if (Array.isArray(selector)) {
    const key = signKey(selector.map((value) => Number(value)));
    const cellId = cellIdBySignKey.get(key);
    if (!cellId) throw new Error(`Bond selector references empty sign chamber ${key}.`);
    return cellId;
  }
  if (typeof selector === 'object' && selector !== null) {
    const record = /** @type {Record<string,unknown>} */ (selector);
    const key = signKey(cuts.map((cut) => {
      if (!(cut.sourceId in record)) {
        throw new Error(`Bond selector omits cut ${cut.sourceId}.`);
      }
      const value = Number(record[cut.sourceId]);
      if (value !== -1 && value !== 1) {
        throw new Error(`Bond selector for ${cut.sourceId} must be -1 or +1.`);
      }
      return value;
    }));
    const cellId = cellIdBySignKey.get(key);
    if (!cellId) throw new Error(`Bond selector references empty sign chamber ${key}.`);
    return cellId;
  }
  throw new Error('Bond cell selectors must be sign strings, sign arrays, or cut-ID maps.');
}

/** @param {ExactPolyhedron} polyhedron @param {number} faceIndex */
function facePointKeys(polyhedron, faceIndex) {
  return polyhedron.faces[faceIndex].vertexIndices
    .map((vertexIndex) => exactPointKey(polyhedron.vertices[vertexIndex]))
    .sort();
}

/**
 * Canonical semantic input payload. Display/source IDs do not define geometry.
 * @param {{bodyPlanes:NormalizedPlane[],cuts:NormalizedPlane[],bondGroups:string[][]}} value
 */
export function affineInputHashPayload(value) {
  return {
    bodyPlanes: value.bodyPlanes.map(planeHashRecord),
    cuts: value.cuts.map(planeHashRecord),
    bondGroups: value.bondGroups.map((group) => [...group].sort()).sort((a, b) => (
      a.join('|').localeCompare(b.join('|'))
    )),
  };
}

/**
 * Canonical compiled-geometry payload. This intentionally omits diagnostics,
 * display IDs, and hashes themselves.
 *
 * @param {any} geometry
 */
export function affineGeometryHashPayload(geometry) {
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
      cells: adjacency.cellIds.map((id) => cellById.get(id).signKey),
      cutIndex: adjacency.cutIndex,
      points: adjacency.points.map(exactPointKey),
    })),
    pieces: geometry.physicalPieces.map((piece) => ({
      cells: piece.cellIds.map((id) => cellById.get(id).signKey).sort(),
    })),
    boundaryTraces: geometry.boundaryTraces.map((trace) => ({
      hullPlane: trace.hullPlaneKey,
      cutIndex: trace.cutIndex,
      points: trace.points.map(exactPointKey),
    })),
  };
}

/**
 * Compiles the affine-convex specialization of `(B, Φ, β)`.
 *
 * Initial hull construction is `O(h^3(h+v))` through exact plane triples.
 * Incremental arrangement construction is output-sensitive in the current
 * B-rep: each cut visits every surviving cell face and face edge once.
 *
 * @param {AffineCompilerInput} input
 */
export function compileAffineGeometry(input) {
  if (!input?.body || !Array.isArray(input.body.planes) || input.body.planes.length < 4) {
    throw new Error('Affine geometry requires a convex body with at least four hull planes.');
  }
  if (!Array.isArray(input.cuts)) throw new Error('Affine geometry cuts must be an array.');

  const bodyPlanes = canonicalSourcePlanes(input.body.planes, 'hull');
  const cuts = canonicalSourcePlanes(input.cuts, 'cut').map((cut, index) => ({
    ...cut,
    id: `cut:${index}`,
  }));
  const hullCarriers = new Set(bodyPlanes.map((plane) => plane.carrierKey));
  const cutCarriers = new Set();
  for (const cut of cuts) {
    if (hullCarriers.has(cut.carrierKey)) {
      throw new Error(`Cut ${cut.sourceId} is coincident with a hull carrier.`);
    }
    if (cutCarriers.has(cut.carrierKey)) {
      throw new Error(`Duplicate cut carrier ${cut.carrierKey}.`);
    }
    cutCarriers.add(cut.carrierKey);
  }

  const body = intersectExactHalfspaces(bodyPlanes);
  if (!body) throw new Error('Outer hull is empty, unbounded, or lower-dimensional.');
  const bodyErrors = validateExactPolyhedron(body);
  if (bodyErrors.length) throw new Error(`Outer hull failed exact validation: ${bodyErrors.join('; ')}`);

  /** @type {{signs:number[],polyhedron:ExactPolyhedron}[]} */
  let cells = [{ signs: [], polyhedron: body }];
  const cutDiagnostics = [];
  for (let cutIndex = 0; cutIndex < cuts.length; cutIndex += 1) {
    const cut = cuts[cutIndex];
    /** @type {{signs:number[],polyhedron:ExactPolyhedron}[]} */
    const nextCells = [];
    let splitCells = 0;
    let negativeOnlyCells = 0;
    let positiveOnlyCells = 0;
    for (const cell of cells) {
      const split = clipExactPolyhedron(cell.polyhedron, cut);
      if (split.relation === 'split') {
        if (!split.negative || !split.positive) {
          throw new Error(`Cut ${cut.sourceId} produced a non-solid child.`);
        }
        splitCells += 1;
        nextCells.push(
          { signs: [...cell.signs, -1], polyhedron: split.negative },
          { signs: [...cell.signs, 1], polyhedron: split.positive },
        );
      } else if (split.relation === 'negative-only') {
        negativeOnlyCells += 1;
        nextCells.push({ signs: [...cell.signs, -1], polyhedron: cell.polyhedron });
      } else {
        positiveOnlyCells += 1;
        nextCells.push({ signs: [...cell.signs, 1], polyhedron: cell.polyhedron });
      }
    }
    cells = nextCells;
    cutDiagnostics.push({
      cutIndex,
      cutSourceId: cut.sourceId,
      inputCells: cells.length - splitCells,
      outputCells: cells.length,
      splitCells,
      negativeOnlyCells,
      positiveOnlyCells,
      globallySeparating: splitCells > 0,
    });
  }

  const atomicCells = cells.map((cell) => {
    const key = signKey(cell.signs);
    return {
      id: `cell:${key}`,
      signKey: key,
      signs: cell.signs,
      signsByCut: Object.fromEntries(cuts.map((cut, index) => [cut.sourceId, cell.signs[index]])),
      polyhedron: cell.polyhedron,
      faces: [],
      physicalPieceId: '',
    };
  }).sort((a, b) => a.signKey.localeCompare(b.signKey));
  const cellById = new Map(atomicCells.map((cell) => [cell.id, cell]));
  const cellIdBySignKey = new Map(atomicCells.map((cell) => [cell.signKey, cell.id]));

  const cutIndexByCarrier = new Map(cuts.map((cut, index) => [cut.carrierKey, index]));
  const hullIndexByCarrier = new Map(bodyPlanes.map((plane, index) => [plane.carrierKey, index]));
  const interfaceOccurrences = new Map();
  for (const cell of atomicCells) {
    for (let faceIndex = 0; faceIndex < cell.polyhedron.faces.length; faceIndex += 1) {
      const face = cell.polyhedron.faces[faceIndex];
      const cutIndex = cutIndexByCarrier.get(face.plane.carrierKey);
      if (cutIndex === undefined) continue;
      const points = facePointKeys(cell.polyhedron, faceIndex);
      const key = `${cutIndex}|${points.join(';')}`;
      const occurrences = interfaceOccurrences.get(key) ?? [];
      occurrences.push({ cellId: cell.id, faceIndex, points });
      interfaceOccurrences.set(key, occurrences);
    }
  }

  const adjacency = [...interfaceOccurrences.entries()].map(([signature, occurrences]) => {
    if (occurrences.length !== 2) {
      throw new Error(`Cut interface ${signature} has ${occurrences.length} incident cells instead of two.`);
    }
    occurrences.sort((a, b) => a.cellId.localeCompare(b.cellId));
    const cutIndex = Number(signature.slice(0, signature.indexOf('|')));
    const points = occurrences[0].points.map((key) => {
      const cell = /** @type {any} */ (cellById.get(occurrences[0].cellId));
      const point = cell.polyhedron.vertices.find((vertex) => exactPointKey(vertex) === key);
      if (!point) throw new Error(`Interface point ${key} is absent from its source cell.`);
      return point;
    });
    const cellIds = /** @type {[string,string]} */ (occurrences.map((entry) => entry.cellId));
    return {
      id: `adj:${canonicalSha256({ cutIndex, cellIds, points: points.map(exactPointKey) }).slice(0, 20)}`,
      cutIndex,
      cutSourceId: cuts[cutIndex].sourceId,
      carrierKey: cuts[cutIndex].carrierKey,
      cellIds,
      faceIndices: /** @type {[number,number]} */ (occurrences.map((entry) => entry.faceIndex)),
      points,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  const adjacentIds = new Map(atomicCells.map((cell) => [cell.id, new Set()]));
  const adjacencyByFace = new Map();
  for (const adjacent of adjacency) {
    adjacentIds.get(adjacent.cellIds[0])?.add(adjacent.cellIds[1]);
    adjacentIds.get(adjacent.cellIds[1])?.add(adjacent.cellIds[0]);
    adjacencyByFace.set(`${adjacent.cellIds[0]}:${adjacent.faceIndices[0]}`, adjacent);
    adjacencyByFace.set(`${adjacent.cellIds[1]}:${adjacent.faceIndices[1]}`, adjacent);
  }

  /** @type {string[][]} */
  const resolvedBondGroups = [];
  for (const group of input.bondGroups ?? []) {
    const members = [...new Set(group.cells.map(
      (selector) => resolveCellSelector(selector, cuts, cellIdBySignKey),
    ))].sort();
    if (members.length === 0) throw new Error('Bond groups cannot be empty.');
    const memberSet = new Set(members);
    const reached = new Set([members[0]]);
    const queue = [members[0]];
    while (queue.length) {
      const current = /** @type {string} */ (queue.shift());
      for (const neighbor of adjacentIds.get(current) ?? []) {
        if (memberSet.has(neighbor) && !reached.has(neighbor)) {
          reached.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (reached.size !== members.length) {
      const missing = members.filter((member) => !reached.has(member));
      throw new Error(
        `Bond group ${group.id ?? '(unnamed)'} is not face-connected; witness ${members[0]} cannot reach ${missing[0]}.`,
      );
    }
    resolvedBondGroups.push(members);
  }
  for (const bond of input.bonds ?? []) {
    if (!Array.isArray(bond) || bond.length !== 2) throw new Error('Every bond edge needs two cells.');
    const pair = bond.map((selector) => resolveCellSelector(selector, cuts, cellIdBySignKey)).sort();
    if (!adjacentIds.get(pair[0])?.has(pair[1])) {
      throw new Error(`Bond edge ${pair.join(' ↔ ')} does not follow exact face adjacency.`);
    }
    resolvedBondGroups.push(pair);
  }

  const disjointSet = new DisjointSet(atomicCells.map((cell) => cell.id));
  for (const group of resolvedBondGroups) {
    for (let index = 1; index < group.length; index += 1) {
      disjointSet.union(group[0], group[index]);
    }
  }
  const pieceCellsByRoot = new Map();
  for (const cell of atomicCells) {
    const root = disjointSet.find(cell.id);
    const members = pieceCellsByRoot.get(root) ?? [];
    members.push(cell.id);
    pieceCellsByRoot.set(root, members);
  }
  const physicalPieces = [...pieceCellsByRoot.values()].map((cellIds) => {
    cellIds.sort();
    return {
      id: `piece:${canonicalSha256({ cellIds }).slice(0, 20)}`,
      cellIds,
      exposedSurfaceIds: [],
    };
  }).sort((a, b) => a.cellIds[0].localeCompare(b.cellIds[0]));
  const pieceIdByCellId = new Map();
  for (const piece of physicalPieces) {
    for (const cellId of piece.cellIds) pieceIdByCellId.set(cellId, piece.id);
  }

  for (const cell of atomicCells) {
    cell.physicalPieceId = /** @type {string} */ (pieceIdByCellId.get(cell.id));
    cell.faces = cell.polyhedron.faces.map((face, faceIndex) => {
      const adjacent = adjacencyByFace.get(`${cell.id}:${faceIndex}`);
      const hullIndex = hullIndexByCarrier.get(face.plane.carrierKey);
      const cutIndex = cutIndexByCarrier.get(face.plane.carrierKey);
      let category;
      let sourceType;
      let sourceIndex;
      let sourceId;
      if (hullIndex !== undefined) {
        category = 'outer-hull';
        sourceType = 'hull';
        sourceIndex = hullIndex;
        sourceId = bodyPlanes[hullIndex].sourceId;
      } else if (cutIndex !== undefined) {
        const neighborId = adjacent?.cellIds.find((id) => id !== cell.id);
        const bonded = neighborId && pieceIdByCellId.get(neighborId) === cell.physicalPieceId;
        category = bonded ? 'internal-surface' : 'cut-surface';
        sourceType = 'cut';
        sourceIndex = cutIndex;
        sourceId = cuts[cutIndex].sourceId;
      } else {
        throw new Error(`Face ${cell.id}:${faceIndex} has no hull or cut provenance.`);
      }
      const pointKeys = facePointKeys(cell.polyhedron, faceIndex);
      const id = `face:${canonicalSha256({
        cell: cell.signKey,
        plane: face.plane.key,
        points: pointKeys,
      }).slice(0, 20)}`;
      return {
        id,
        polyhedronFaceIndex: faceIndex,
        vertexIndices: face.vertexIndices,
        triangleIndices: cell.polyhedron.triangles
          .map((triangle, triangleIndex) => ({ triangle, triangleIndex }))
          .filter(({ triangle }) => triangle.faceIndex === faceIndex)
          .map(({ triangleIndex }) => triangleIndex),
        planeKey: face.plane.key,
        carrierKey: face.plane.carrierKey,
        provenance: {
          category,
          sourceType,
          sourceIndex,
          sourceId,
          adjacencyId: adjacent?.id ?? null,
        },
      };
    });
  }

  const exposedSurfaces = atomicCells.flatMap((cell) => cell.faces
    .filter((face) => face.provenance.category !== 'internal-surface')
    .map((face) => ({
      id: face.id,
      cellId: cell.id,
      physicalPieceId: cell.physicalPieceId,
      vertexIndices: face.vertexIndices,
      triangleIndices: face.triangleIndices,
      provenance: face.provenance,
    }))).sort((a, b) => a.id.localeCompare(b.id));
  const pieceById = new Map(physicalPieces.map((piece) => [piece.id, piece]));
  for (const surface of exposedSurfaces) {
    pieceById.get(surface.physicalPieceId)?.exposedSurfaceIds.push(surface.id);
  }
  for (const piece of physicalPieces) piece.exposedSurfaceIds.sort();

  const boundaryTraces = [];
  for (let hullFaceIndex = 0; hullFaceIndex < body.faces.length; hullFaceIndex += 1) {
    const hullFace = body.faces[hullFaceIndex];
    const hullIndex = hullIndexByCarrier.get(hullFace.plane.carrierKey);
    if (hullIndex === undefined) continue;
    for (let cutIndex = 0; cutIndex < cuts.length; cutIndex += 1) {
      const points = intersectExactFaceWithPlane(body, hullFaceIndex, cuts[cutIndex]);
      if (points.length !== 2) continue;
      boundaryTraces.push({
        id: `trace:${canonicalSha256({
          hull: hullFace.plane.key,
          cut: cuts[cutIndex].key,
          points: points.map(exactPointKey),
        }).slice(0, 20)}`,
        hullIndex,
        hullSourceId: bodyPlanes[hullIndex].sourceId,
        hullPlaneKey: bodyPlanes[hullIndex].key,
        cutIndex,
        cutSourceId: cuts[cutIndex].sourceId,
        cutPlaneKey: cuts[cutIndex].key,
        points,
      });
    }
  }
  boundaryTraces.sort((a, b) => (
    a.hullPlaneKey.localeCompare(b.hullPlaneKey)
    || a.cutIndex - b.cutIndex
    || a.id.localeCompare(b.id)
  ));

  const geometry = {
    schema: 'polytwist.affine-geometry.v1',
    exactness: {
      predicates: 'exact-rational',
      source: input.sourceExactness ?? 'exact-rational',
      topologyUsesTolerance: false,
    },
    normalizedInput: {
      bodyPlanes,
      cuts,
      bondGroups: resolvedBondGroups.map((group) => [...group]),
    },
    body,
    atomicCells,
    adjacency,
    physicalPieces,
    exposedSurfaces,
    boundaryTraces,
    diagnostics: {
      stages: [
        {
          stage: 'normalize',
          hullPlaneCount: bodyPlanes.length,
          cutCount: cuts.length,
          sourceExactness: input.sourceExactness ?? 'exact-rational',
        },
        {
          stage: 'outer-hull',
          vertexCount: body.vertices.length,
          faceCount: body.faces.length,
          exactValidationErrors: bodyErrors,
        },
        ...cutDiagnostics.map((diagnostic) => ({ stage: 'arrangement-cut', ...diagnostic })),
        {
          stage: 'adjacency',
          atomicCellCount: atomicCells.length,
          interfaceCount: adjacency.length,
        },
        {
          stage: 'bond-quotient',
          bondGroupCount: resolvedBondGroups.length,
          physicalPieceCount: physicalPieces.length,
        },
      ],
      complexity: {
        initialHull: 'O(h^3(h+v)) exact triple-plane enumeration',
        arrangement: 'output-sensitive O(sum over cuts of current face-edge count)',
        adjacency: 'O(total faces log total faces)',
      },
    },
    certificates: {
      body: {
        boundedFullDimensional: true,
        exactValidationErrors: bodyErrors,
      },
      cells: atomicCells.map((cell) => ({
        cellId: cell.id,
        witness: cell.polyhedron.centroid,
        signKey: cell.signKey,
        exactValidationErrors: validateExactPolyhedron(cell.polyhedron),
      })),
      adjacency: adjacency.map((entry) => ({
        adjacencyId: entry.id,
        incidentCellCount: entry.cellIds.length,
        pointCount: entry.points.length,
      })),
      bonds: resolvedBondGroups.map((group) => ({
        cellIds: group,
        faceConnected: true,
      })),
    },
    hashes: {
      input: '',
      geometry: '',
    },
  };
  geometry.hashes.input = canonicalSha256(affineInputHashPayload({
    bodyPlanes,
    cuts,
    bondGroups: resolvedBondGroups,
  }));
  geometry.hashes.geometry = canonicalSha256(affineGeometryHashPayload(geometry));
  return geometry;
}
