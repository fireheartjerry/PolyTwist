import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePuzzle } from '../src/core/puzzle-compiler.js';
import { PuzzleEngine } from '../src/core/puzzle-engine.js';
import { bandagedRelayPreset, ghostPreset } from '../src/core/presets.js';
import { frameAxis, logicalRotationToWorld } from '../src/core/frame.js';
import { buildPieceMeshData, faceIdColor, machineIdColor } from '../src/render/mesh-data.js';
import { axisAngle3, mat4AroundOrigin, mat4Multiply } from '../src/render/mat4.js';
import { certifyIdealRigidDisplay } from '../src/render/rigid-display-certificate.js';

const byteKey = (color) => color.map((channel) => Math.round(channel * 255)).join(',');

function modelMatrices(puzzle, engine, preview = null, progress = 0) {
  const matrices = new Map();
  const activeIds = new Set(preview?.selectedIds ?? []);
  const animation = preview
    ? mat4AroundOrigin(
      axisAngle3(frameAxis(puzzle.frame, preview.axis), preview.angleRadians * progress),
      puzzle.frame.origin,
    )
    : null;
  for (const piece of puzzle.pieces) {
    if (!piece.renderable) continue;
    const exact = mat4AroundOrigin(
      logicalRotationToWorld(puzzle.frame, engine.getPieceTransform(piece.id)),
      puzzle.frame.origin,
    );
    matrices.set(piece.id, animation && activeIds.has(piece.id) ? mat4Multiply(animation, exact) : exact);
  }
  return matrices;
}

test('ideal-rigid certificate validates rest, animation, and a committed turn', () => {
  const puzzle = compilePuzzle(ghostPreset());
  const engine = new PuzzleEngine(puzzle);
  const before = certifyIdealRigidDisplay(puzzle, engine.transforms, modelMatrices(puzzle, engine));
  assert.equal(before.valid, true);

  const preview = engine.previewMove('R');
  const moving = modelMatrices(puzzle, engine, preview, 0.37);
  assert.equal(certifyIdealRigidDisplay(puzzle, engine.transforms, moving, preview).valid, true);

  engine.commitPreview(preview);
  const after = certifyIdealRigidDisplay(puzzle, engine.transforms, modelMatrices(puzzle, engine));
  assert.equal(after.geometryHash, before.geometryHash);

  const corrupted = new Map([...modelMatrices(puzzle, engine)].map(
    ([pieceId, matrix]) => [pieceId, new Float32Array(matrix)],
  ));
  const visible = puzzle.pieces.find((piece) => piece.renderable);
  assert.ok(visible);
  corrupted.get(visible.id)[0] = 2;
  assert.equal(certifyIdealRigidDisplay(puzzle, engine.transforms, corrupted).valid, false);
});

test('machine instance colors are collision-free across a substantial practical range', () => {
  const colors = new Set();
  for (let index = 0; index < 20_000; index += 1) colors.add(byteKey(machineIdColor(index)));
  assert.equal(colors.size, 20_000);
});

test('face observation IDs use an explicit global offset rather than a fixed per-piece stride', () => {
  const puzzle = compilePuzzle(bandagedRelayPreset());
  const piece = puzzle.pieces.find((candidate) => candidate.renderable);
  assert.ok(piece);
  const first = buildPieceMeshData(puzzle, piece, 0, 0);
  const shifted = buildPieceMeshData(puzzle, piece, 0, 137);
  assert.notDeepEqual([...first.faceColors.slice(0, 3)], [...shifted.faceColors.slice(0, 3)]);
  assert.equal(byteKey(faceIdColor(0)) === byteKey(faceIdColor(137)), false);
});

test('rigid clusters suppress bonded interface edges while preserving separate instance meshes', () => {
  const bandagedSpec = bandagedRelayPreset();
  const bandaged = compilePuzzle(bandagedSpec);
  const unbandagedSpec = structuredClone(bandagedSpec);
  unbandagedSpec.id = 'unbandaged-render-control';
  delete unbandagedSpec.constraints;
  const unbandaged = compilePuzzle(unbandagedSpec);

  const cluster = bandaged.constraints.bandages[0];
  const bandagedSegments = cluster.pieceIds.reduce((sum, pieceId, index) => {
    const piece = bandaged.pieceById.get(pieceId);
    assert.ok(piece);
    return sum + buildPieceMeshData(bandaged, piece, index).lineSegmentCount;
  }, 0);
  const controlSegments = cluster.pieceIds.reduce((sum, pieceId, index) => {
    const piece = unbandaged.pieceById.get(pieceId);
    assert.ok(piece);
    return sum + buildPieceMeshData(unbandaged, piece, index).lineSegmentCount;
  }, 0);

  assert.ok(bandagedSegments < controlSegments);
  assert.equal(cluster.pieceIds.length, 2);

  const bondedPiece = bandaged.pieceById.get(cluster.pieceIds[0]);
  assert.ok(bondedPiece);
  const mesh = buildPieceMeshData(bandaged, bondedPiece, 0);
  assert.equal(mesh.surfaceProvenance.length, mesh.positions.length / 3);
  assert.ok([...mesh.surfaceProvenance].every((code) => code === 1 || code === 2));
  const internalTriangles = bondedPiece.polyhedron.faces
    .filter((face) => face.meta.provenance.category === 'internal-surface')
    .reduce((count, face) => count + face.indices.length - 2, 0);
  assert.equal(
    mesh.triangleCount,
    bondedPiece.polyhedron.triangles.length - internalTriangles,
  );
});
