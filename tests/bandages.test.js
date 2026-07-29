import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeCurrentDynamics } from '../src/core/dynamics-analysis.js';
import { quarterTurn3i } from '../src/core/mat3i.js';
import { compilePuzzle } from '../src/core/puzzle-compiler.js';
import { bandagedRelayPreset } from '../src/core/presets.js';
import {
  IllegalMoveError,
  PuzzleEngine,
  StaleMovePreviewError,
} from '../src/core/puzzle-engine.js';

const makeEngine = () => new PuzzleEngine(compilePuzzle(bandagedRelayPreset()));

test('bandaged preset compiles connected rigid clusters with exact lookup tables', () => {
  const puzzle = compilePuzzle(bandagedRelayPreset());
  assert.equal(puzzle.stats.bandageCount, 2);
  assert.equal(puzzle.stats.bandagedPieceCount, 4);
  assert.deepEqual(puzzle.constraints.bandages.map((bandage) => bandage.id), ['north-bridge', 'south-key']);
  assert.equal(puzzle.constraints.bandageByPieceId.get('p-2-2-2')?.id, 'north-bridge');
  assert.ok(puzzle.constraints.bandages.every((bandage) => Number.isFinite(bandage.centroid.x)));
});

test('compiler rejects disconnected, overlapping, and interior-only bandages', () => {
  const disconnected = bandagedRelayPreset();
  disconnected.id = 'invalid-disconnected-bandage';
  disconnected.constraints = {
    bandages: [{ id: 'teleporter', cells: [[0, 0, 0], [2, 2, 2]] }],
  };
  assert.throws(() => compilePuzzle(disconnected), /face-connected cluster/);

  const overlapping = bandagedRelayPreset();
  overlapping.id = 'invalid-overlapping-bandages';
  overlapping.constraints = {
    bandages: [
      { id: 'first', cells: [[2, 2, 2], [2, 1, 2]] },
      { id: 'second', cells: [[2, 2, 2], [1, 2, 2]] },
    ],
  };
  assert.throws(() => compilePuzzle(overlapping), /belongs to both/);

  const interior = bandagedRelayPreset();
  interior.id = 'invalid-interior-bandage';
  interior.constraints = {
    bandages: [{ id: 'buried', cells: [[1, 1, 1], [1, 1, 2]] }],
  };
  assert.throws(() => compilePuzzle(interior), /non-renderable interior piece/);
});

test('move legality is state-dependent and illegal transitions are atomic', () => {
  const engine = makeEngine();
  assert.deepEqual(engine.legalActionMask(), {
    R: true,
    L: true,
    U: false,
    D: true,
    F: true,
    B: false,
  });

  const before = engine.stateHash();
  assert.throws(
    () => engine.applyMove('U'),
    (error) => error instanceof IllegalMoveError && error.code === 'KineScope_ILLEGAL_MOVE',
  );
  assert.equal(engine.stateHash(), before);
  assert.equal(engine.history.length, 0);

  engine.applyMove('R');
  assert.equal(engine.moveLegality('U').legal, true);
  engine.applyMove('U');
  assert.deepEqual(engine.validate(), []);
});

test('deterministic scrambles only traverse legal bandaged states', () => {
  const first = makeEngine();
  const second = makeEngine();
  const tokens = first.generateScramble(96, 'bandage-regression');
  assert.deepEqual(tokens, second.generateScramble(96, 'bandage-regression'));
  assert.equal(tokens.length, 96);

  const simulation = makeEngine();
  for (const token of tokens) {
    assert.equal(simulation.moveLegality(token).legal, true, `expected ${token} to be legal`);
    simulation.applyMove(token);
    assert.deepEqual(simulation.validate(), []);
  }
  assert.equal(simulation.isSolved(), false);
});

test('preview commits reject stale and forged transitions without corrupting state', () => {
  const stale = makeEngine();
  const preview = stale.previewMove('R');
  stale.applyMove('D');
  const afterInterveningMove = stale.stateHash();
  assert.throws(
    () => stale.commitPreview(preview),
    (error) => error instanceof StaleMovePreviewError && error.code === 'KineScope_STALE_PREVIEW',
  );
  assert.equal(stale.stateHash(), afterInterveningMove);

  const forged = makeEngine();
  const valid = forged.previewMove('R');
  const forgedPreview = { ...valid, selectedIds: valid.selectedIds.slice(1) };
  const beforeForgedCommit = forged.stateHash();
  assert.throws(() => forged.commitPreview(forgedPreview), /does not match the exact current transition/);
  assert.equal(forged.stateHash(), beforeForgedCommit);
});

test('invalid serialized states are rejected transactionally', () => {
  const engine = makeEngine();
  engine.applyMove('R');
  const before = engine.stateHash();
  const state = engine.serialize();
  const target = state.transforms.find((entry) => entry.pieceId === 'p-2-1-2');
  assert.ok(target);
  target.orientation = quarterTurn3i(0, 1);
  assert.throws(() => engine.load(state), /Puzzle state invariant failure/);
  assert.equal(engine.stateHash(), before);
  assert.deepEqual(engine.validate(), []);
});

test('exact dynamics analysis exposes blocked actions, successors, and commutation probes', () => {
  const engine = makeEngine();
  const report = analyzeCurrentDynamics(engine, { maxOrder: 8 });
  assert.equal(report.schema, 'kinescope.dynamics-analysis.v1');
  assert.equal(report.actionCount, 6);
  assert.equal(report.legalActionMask.U, false);
  assert.equal(report.actions.find((action) => action.token === 'U')?.closure, 'blocked-at-start');
  const r = report.actions.find((action) => action.token === 'R');
  assert.equal(r?.legal, true);
  assert.ok(r?.successorStateHash);
  assert.ok((r?.transitions.length ?? 0) > 0);
  assert.equal(report.pairs.length, 15);
});

test('bandage invariants detect manually split rigid clusters', () => {
  const engine = makeEngine();
  engine.transforms.set('p-2-1-2', quarterTurn3i(0, 1));
  assert.match(engine.validate().join('; '), /bandage north-bridge is split/);
});
