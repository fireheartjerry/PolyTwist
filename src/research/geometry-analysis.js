// @ts-check

import { compilePuzzle } from '../core/puzzle-compiler.js';
import { numericSummary, histogram } from './statistics.js';
import { stableDigest } from './canonical.js';
import { ENGINE_VERSION, PLATFORM_NAME } from '../version.js';
import { verifyAffineGeometry } from '../geometry/affine-verifier.js';

/** @typedef {import('../core/puzzle-compiler.js').PuzzleSpec} PuzzleSpec */
/** @typedef {import('../core/puzzle-compiler.js').CompiledPuzzle} CompiledPuzzle */

/** @param {number} value */
function finite(value) {
  return Number.isFinite(value) ? value : null;
}

/** @param {{x:number,y:number,z:number}[]} points */
function bounds(points) {
  if (points.length === 0) return { min: [0, 0, 0], max: [0, 0, 0], extent: [0, 0, 0], diagonal: 0 };
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    minimum[0] = Math.min(minimum[0], point.x);
    minimum[1] = Math.min(minimum[1], point.y);
    minimum[2] = Math.min(minimum[2], point.z);
    maximum[0] = Math.max(maximum[0], point.x);
    maximum[1] = Math.max(maximum[1], point.y);
    maximum[2] = Math.max(maximum[2], point.z);
  }
  const extent = maximum.map((value, index) => value - minimum[index]);
  return {
    min: minimum,
    max: maximum,
    extent,
    diagonal: Math.hypot(...extent),
  };
}

/** @param {number[]} values */
function normalizedEntropy(values) {
  const positive = values.map((value) => Math.max(0, value));
  const total = positive.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || positive.length <= 1) return 0;
  let entropy = 0;
  for (const value of positive) {
    const probability = value / total;
    if (probability > 0) entropy -= probability * Math.log2(probability);
  }
  return entropy / Math.log2(positive.length);
}

/** @param {PuzzleSpec|CompiledPuzzle} input */
function ensureCompiled(input) {
  return 'pieces' in input && 'moveById' in input ? input : compilePuzzle(input);
}

/**
 * Produces a deliberately dense, evaluator-facing geometry and mechanics report. The report
 * is JSON-compatible and contains no renderer-dependent measurements.
 *
 * @param {PuzzleSpec|CompiledPuzzle} input
 * @param {{includePieces?:boolean,includeFaces?:boolean,histogramBins?:number}} [options]
 */
export function analyzePuzzleGeometry(input, options = {}) {
  const puzzle = ensureCompiled(input);
  const includePieces = options.includePieces ?? true;
  const includeFaces = options.includeFaces ?? false;
  const histogramBins = Math.max(2, Math.min(64, Math.trunc(options.histogramBins ?? 12)));

  const pieceRows = puzzle.pieces.map((piece) => {
    const poly = piece.polyhedron;
    const box = bounds(poly.vertices);
    const faceAreas = poly.faces.map((face) => face.area);
    const outerFaceAreas = poly.faces.filter((face) => face.kind === 'outer').map((face) => face.area);
    const cutFaceAreas = poly.faces.filter((face) => face.kind === 'cut').map((face) => face.area);
    const surfaceArea = faceAreas.reduce((sum, area) => sum + area, 0);
    const compactness = surfaceArea > 0 ? 36 * Math.PI * poly.volume ** 2 / surfaceArea ** 3 : null;
    const radialCentroid = Math.hypot(
      poly.centroid.x - puzzle.frame.origin.x,
      poly.centroid.y - puzzle.frame.origin.y,
      poly.centroid.z - puzzle.frame.origin.z,
    );
    const row = {
      pieceId: piece.id,
      homeIndex: [...piece.homeIndex],
      homeCoord: [...piece.homeCoord],
      renderable: piece.renderable,
      bandageId: puzzle.constraints.bandageByPieceId.get(piece.id)?.id ?? null,
      volume: poly.volume,
      surfaceArea,
      outerArea: poly.outerArea,
      cutArea: Math.max(0, surfaceArea - poly.outerArea),
      outerAreaFraction: surfaceArea > 0 ? poly.outerArea / surfaceArea : null,
      compactness,
      radialCentroid,
      centroid: [poly.centroid.x, poly.centroid.y, poly.centroid.z],
      bounds: box,
      topology: {
        vertices: poly.vertices.length,
        edges: poly.edges.length,
        faces: poly.faces.length,
        triangles: poly.triangles.length,
        outerFaces: poly.outerFaceCount,
        cutFaces: poly.faces.length - poly.outerFaceCount,
        eulerCharacteristic: poly.vertices.length - poly.edges.length + poly.faces.length,
        sourcePlanes: poly.sourcePlaneCount,
      },
      faceAreaSummary: numericSummary(faceAreas),
      outerFaceAreaSummary: numericSummary(outerFaceAreas),
      cutFaceAreaSummary: numericSummary(cutFaceAreas),
    };
    if (includeFaces) {
      row.faces = poly.faces.map((face, faceIndex) => ({
        faceIndex,
        tag: face.tag,
        kind: face.kind,
        area: face.area,
        normal: [face.normal.x, face.normal.y, face.normal.z],
        centroid: [face.centroid.x, face.centroid.y, face.centroid.z],
        vertexCount: face.indices.length,
        meta: structuredClone(face.meta),
      }));
    }
    return row;
  });

  const renderable = pieceRows.filter((piece) => piece.renderable);
  const values = {
    volume: renderable.map((piece) => piece.volume),
    surfaceArea: renderable.map((piece) => piece.surfaceArea),
    outerArea: renderable.map((piece) => piece.outerArea),
    outerAreaFraction: renderable.map((piece) => piece.outerAreaFraction ?? 0),
    compactness: renderable.map((piece) => piece.compactness ?? 0),
    radialCentroid: renderable.map((piece) => piece.radialCentroid),
    vertices: renderable.map((piece) => piece.topology.vertices),
    edges: renderable.map((piece) => piece.topology.edges),
    faces: renderable.map((piece) => piece.topology.faces),
    triangles: renderable.map((piece) => piece.topology.triangles),
    extentX: renderable.map((piece) => piece.bounds.extent[0]),
    extentY: renderable.map((piece) => piece.bounds.extent[1]),
    extentZ: renderable.map((piece) => piece.bounds.extent[2]),
  };

  const worldPoints = puzzle.pieces.flatMap((piece) => piece.renderable ? piece.polyhedron.vertices : []);
  const totalSurfaceArea = renderable.reduce((sum, piece) => sum + piece.surfaceArea, 0);
  const totalOuterArea = renderable.reduce((sum, piece) => sum + piece.outerArea, 0);
  const meanVolume = values.volume.length ? values.volume.reduce((a, b) => a + b, 0) / values.volume.length : 0;
  const volumeDeviation = values.volume.reduce((sum, value) => sum + Math.abs(value - meanVolume), 0);
  const mechanism = puzzle.spec.mechanism;
  const geometryVerification = verifyAffineGeometry(puzzle.geometry);

  const report = {
    schema: 'kinescope.geometry-analysis.v1',
    platform: PLATFORM_NAME,
    engineVersion: ENGINE_VERSION,
    puzzle: {
      id: puzzle.spec.id,
      name: puzzle.spec.name,
      family: puzzle.spec.family,
      description: puzzle.spec.description,
      size: puzzle.spec.size,
      metadata: structuredClone(puzzle.spec.metadata ?? {}),
      specificationDigest: stableDigest(puzzle.spec, 'kinescope-spec'),
    },
    compilation: {
      ...structuredClone(puzzle.stats),
      canonicalGeometry: {
        schema: puzzle.geometry.schema,
        exactness: structuredClone(puzzle.geometry.exactness),
        hashes: structuredClone(puzzle.geometry.hashes),
        atomicCellCount: puzzle.geometry.atomicCells.length,
        physicalPieceCount: puzzle.geometry.physicalPieces.length,
        adjacencyCount: puzzle.geometry.adjacency.length,
        exposedSurfaceCount: puzzle.geometry.exposedSurfaces.length,
        diagnostics: structuredClone(puzzle.geometry.diagnostics),
        verifier: geometryVerification,
      },
    },
    worldBounds: bounds(worldPoints),
    mechanism: {
      origin: [...mechanism.origin],
      eulerDeg: [...mechanism.eulerDeg],
      cutSpacing: mechanism.cutSpacing,
      basis: [...puzzle.frame.basis],
      actions: puzzle.moves.map((move) => ({ ...move })),
      actionCount: puzzle.moves.length,
      axisActionCounts: [0, 1, 2].map((axis) => puzzle.moves.filter((move) => move.axis === axis).length),
    },
    constraints: {
      bandageCount: puzzle.constraints.bandages.length,
      bandagedPieceCount: puzzle.constraints.bandageByPieceId.size,
      coverageFraction: puzzle.pieces.length ? puzzle.constraints.bandageByPieceId.size / puzzle.pieces.length : 0,
      bandages: puzzle.constraints.bandages.map((bandage) => ({
        id: bandage.id,
        label: bandage.label,
        pieceIds: [...bandage.pieceIds],
        cells: bandage.cells.map((cell) => [...cell]),
        centroid: [bandage.centroid.x, bandage.centroid.y, bandage.centroid.z],
      })),
    },
    aggregateGeometry: {
      totalVolume: puzzle.stats.totalVolume,
      totalSurfaceArea,
      totalOuterArea,
      exposedAreaFraction: totalSurfaceArea > 0 ? totalOuterArea / totalSurfaceArea : null,
      renderableVolumeEntropy: normalizedEntropy(values.volume),
      volumeMeanAbsoluteDeviationFraction: meanVolume > 0 ? volumeDeviation / values.volume.length / meanVolume : null,
      dimensionAnisotropy: (() => {
        const extent = bounds(worldPoints).extent;
        const minimum = Math.min(...extent);
        return minimum > 0 ? Math.max(...extent) / minimum : null;
      })(),
      visualPieceIrregularityIndex: (() => {
        const volume = numericSummary(values.volume).coefficientOfVariation ?? 0;
        const area = numericSummary(values.outerArea).coefficientOfVariation ?? 0;
        const compactness = numericSummary(values.compactness).coefficientOfVariation ?? 0;
        return finite((volume + area + compactness) / 3);
      })(),
    },
    distributions: Object.fromEntries(Object.entries(values).map(([key, series]) => [key, {
      summary: numericSummary(series),
      histogram: histogram(series, histogramBins),
    }])),
    topologyChecks: {
      allEulerCharacteristicTwo: renderable.every((piece) => piece.topology.eulerCharacteristic === 2),
      allPositiveVolume: renderable.every((piece) => piece.volume > 0),
      allFinite: renderable.every((piece) => [
        piece.volume,
        piece.surfaceArea,
        piece.outerArea,
        piece.compactness ?? 0,
      ].every(Number.isFinite)),
      warnings: [...puzzle.stats.topologyWarnings],
    },
    observabilityAudit: {
      appearanceFields: Object.keys(puzzle.spec.appearance ?? {}).sort(),
      mechanicsFields: ['mechanism', 'moves', 'constraints'],
      publicSafeByDefault: ['id-or-opaque-id', 'family-or-hidden', 'size', 'appearance', 'action-aliases', 'render-metadata'],
      evaluatorOnlyByDefault: ['mechanism', 'canonical-move-map', 'piece-transforms', 'bandage-membership', 'exact-state-hash'],
      caveat: 'A benchmark policy must still decide which specification fields to disclose. Merely serializing everything is not an access-control strategy.',
    },
  };
  if (includePieces) report.pieces = pieceRows;
  report.reportDigest = stableDigest(report, 'kinescope-geometry');
  return report;
}
