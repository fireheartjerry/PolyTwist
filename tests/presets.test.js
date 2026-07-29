import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePuzzle } from '../src/core/puzzle-compiler.js';
import {
  alienPreset,
  axisPreset,
  bandagedRelayPreset,
  classic4Preset,
  classicPreset,
  ghost4Preset,
  ghostPreset,
  mirrorPrismPreset,
} from '../src/core/presets.js';

const presets = [
  { create: classicPreset, logical: 27, renderable: 26, minimumTriangles: 300 },
  { create: ghostPreset, logical: 27, renderable: 26, minimumTriangles: 300 },
  { create: axisPreset, logical: 27, renderable: 26, minimumTriangles: 300 },
  { create: bandagedRelayPreset, logical: 27, renderable: 26, minimumTriangles: 300 },
  { create: mirrorPrismPreset, logical: 27, renderable: 26, minimumTriangles: 300 },
  { create: classic4Preset, logical: 64, renderable: 56, minimumTriangles: 700 },
  { create: ghost4Preset, logical: 64, renderable: 56, minimumTriangles: 700 },
];

for (const { create, logical, renderable, minimumTriangles } of presets) {
  test(`${create().name} compiles with strict topology`, () => {
    const puzzle = compilePuzzle(create());
    assert.equal(puzzle.stats.logicalPieces, logical);
    assert.equal(puzzle.stats.renderablePieces, renderable);
    assert.equal(puzzle.stats.topologyWarnings.length, 0);
    assert.equal(puzzle.moves.length, 6);
    assert.ok(puzzle.stats.totalTriangles > minimumTriangles);
    assert.ok(puzzle.stats.totalVolume > 20);
  });
}

test('procedural artifacts are deterministic and compiler-validated', () => {
  const first = alienPreset('determinism-42');
  const second = alienPreset('determinism-42');
  assert.deepEqual(first, second);
  const compiled = compilePuzzle(first);
  assert.equal(compiled.stats.renderablePieces, 26);
  assert.equal(compiled.stats.topologyWarnings.length, 0);
});

test('different appearance/geometry presets expose the same latent logical alphabet', () => {
  const ghost = compilePuzzle(ghostPreset());
  const axis = compilePuzzle(axisPreset());
  assert.deepEqual(ghost.moves, axis.moves);
  assert.deepEqual(ghost.pieces.map((piece) => piece.homeCoord), axis.pieces.map((piece) => piece.homeCoord));
  assert.notDeepEqual(ghost.frame.eulerDeg, axis.frame.eulerDeg);
});

test('explicit convex hull planes compile without relying on the box shorthand', () => {
  const spec = classicPreset();
  spec.id = 'explicit-hull-3';
  spec.name = 'Explicit Hull 3';
  spec.outer = {
    planes: [
      { normal: [1, 0, 0], constant: 1.5, tag: 'outer:+x' },
      { normal: [-1, 0, 0], constant: 1.5, tag: 'outer:-x' },
      { normal: [0, 1, 0], constant: 1.5, tag: 'outer:+y' },
      { normal: [0, -1, 0], constant: 1.5, tag: 'outer:-y' },
      { normal: [0, 0, 1], constant: 1.5, tag: 'outer:+z' },
      { normal: [0, 0, -1], constant: 1.5, tag: 'outer:-z' },
      { normal: [1, 1, 1], constant: 4.42, tag: 'outer:small-corner-cut' },
    ],
  };
  const puzzle = compilePuzzle(spec);
  assert.equal(puzzle.stats.logicalPieces, 27);
  assert.equal(puzzle.stats.renderablePieces, 26);
  assert.equal(puzzle.stats.topologyWarnings.length, 0);
  assert.ok(puzzle.pieces.some((piece) => piece.polyhedron.faces.some((face) => face.tag === 'outer:small-corner-cut')));
});

test('custom move alphabets compile with exterior and interior logical layers', () => {
  const spec = classic4Preset();
  spec.id = 'custom-alphabet-4';
  spec.name = 'Custom Alphabet 4';
  spec.moves = [
    { id: 'XMAX', label: 'x outer', axis: 0, layer: 'max', quarterTurns: -1 },
    { id: 'XIN', label: 'x inner', axis: 0, layer: 1, quarterTurns: -1 },
    { id: 'YMIN', label: 'y outer', axis: 1, layer: 'min', quarterTurns: 1 },
  ];
  const puzzle = compilePuzzle(spec);
  assert.deepEqual(puzzle.moves.map((move) => move.id), ['XMAX', 'XIN', 'YMIN']);
  assert.deepEqual(puzzle.moves.map((move) => move.layer), [3, 1, -3]);
  assert.equal(puzzle.moveById.get('XIN')?.axis, 0);
});

test('bandage compiler enforces unique, renderable, face-connected rigid clusters', () => {
  const compiled = compilePuzzle(bandagedRelayPreset());
  assert.equal(compiled.stats.bandageCount, 2);
  assert.equal(compiled.stats.bandagedPieceCount, 4);
  assert.equal(compiled.constraints.bandages[0].cells.length, 2);
  assert.ok(Number.isFinite(compiled.constraints.bandages[0].centroid.x));

  const disconnected = bandagedRelayPreset();
  disconnected.id = 'disconnected-bandage';
  disconnected.constraints = {
    bandages: [{ id: 'teleport', cells: [[0, 0, 0], [2, 2, 2]] }],
  };
  assert.throws(() => compilePuzzle(disconnected), /face-connected cluster/i);

  const overlap = bandagedRelayPreset();
  overlap.id = 'overlapping-bandage';
  overlap.constraints = {
    bandages: [
      { id: 'first', cells: [[0, 0, 0], [0, 0, 1]] },
      { id: 'second', cells: [[0, 0, 1], [0, 1, 1]] },
    ],
  };
  assert.throws(() => compilePuzzle(overlap), /belongs to both/i);

  const interior = bandagedRelayPreset();
  interior.id = 'interior-bandage';
  interior.constraints = {
    bandages: [{ id: 'core-glue', cells: [[1, 1, 1], [1, 1, 2]] }],
  };
  assert.throws(() => compilePuzzle(interior), /non-renderable interior piece/i);
});
