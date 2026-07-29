import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePuzzle } from '../src/core/puzzle-compiler.js';
import { quarterTurn3i } from '../src/core/mat3i.js';
import { bandagedRelayPreset, classic4Preset, ghostPreset } from '../src/core/presets.js';
import { IllegalMoveError, parseMoveToken, PuzzleEngine } from '../src/core/puzzle-engine.js';

const makeEngine = () => new PuzzleEngine(compilePuzzle(ghostPreset()));

test('every primitive move selects exactly one face layer', () => {
  const engine = makeEngine();
  for (const move of engine.puzzle.moves) assert.equal(engine.previewMove(move.id).selectedIds.length, 9);
});

test('4×4 face moves select 16 pieces and preserve exact invariants', () => {
  const engine = new PuzzleEngine(compilePuzzle(classic4Preset()));
  for (const move of engine.puzzle.moves) assert.equal(engine.previewMove(move.id).selectedIds.length, 16);
  engine.scramble(80, 'four-by-four-invariants');
  assert.deepEqual(engine.validate(), []);
  assert.equal(engine.puzzle.stats.logicalPieces, 64);
});

test('move plus inverse and four quarter turns restore exact state', () => {
  for (const move of ['R', 'L', 'U', 'D', 'F', 'B']) {
    const inverseEngine = makeEngine();
    const initial = inverseEngine.stateHash();
    inverseEngine.applyMove(move);
    inverseEngine.applyMove(`${move}'`);
    assert.equal(inverseEngine.stateHash(), initial);

    const orderEngine = makeEngine();
    for (let i = 0; i < 4; i += 1) orderEngine.applyMove(move);
    assert.equal(orderEngine.stateHash(), initial);
    assert.equal(orderEngine.isSolved(), true);
  }
});

test('custom multi-character move tokens parse inverse and double suffixes exactly', () => {
  const spec = classic4Preset();
  spec.id = 'token-grammar-4';
  spec.moves = [
    { id: 'XMAX', axis: 0, layer: 'max', quarterTurns: -1 },
    { id: 'XIN', axis: 0, layer: 1, quarterTurns: -1 },
  ];
  const puzzle = compilePuzzle(spec);
  assert.deepEqual(parseMoveToken("xin'", puzzle.moveById), {
    definition: puzzle.moveById.get('XIN'),
    baseMove: 'XIN',
    quarterTurns: 1,
    canonicalToken: "XIN'",
  });
  assert.deepEqual(parseMoveToken('xmax2', puzzle.moveById), {
    definition: puzzle.moveById.get('XMAX'),
    baseMove: 'XMAX',
    quarterTurns: -2,
    canonicalToken: 'XMAX2',
  });
  const engine = new PuzzleEngine(puzzle);
  assert.equal(engine.previewMove('XIN').selectedIds.length, 16);
  engine.applyMove('XIN');
  engine.applyMove("XIN'");
  assert.equal(engine.isSolved(), true);
});

test('scrambles are deterministic and preserve occupancy/orientation invariants', () => {
  const a = makeEngine();
  const b = makeEngine();
  const scrambleA = a.generateScramble(50, 'benchmark-seed');
  const scrambleB = b.generateScramble(50, 'benchmark-seed');
  assert.deepEqual(scrambleA, scrambleB);
  for (const token of scrambleA) a.applyMove(token);
  assert.deepEqual(a.validate(), []);
  assert.equal(a.isSolved(), false);
});

test('undo, redo, serialization, and load are exact', () => {
  const engine = makeEngine();
  engine.scramble(12, 'state-test');
  const scrambled = engine.stateHash();
  assert.equal(engine.undo(), true);
  assert.notEqual(engine.stateHash(), scrambled);
  assert.equal(engine.redo(), true);
  assert.equal(engine.stateHash(), scrambled);

  const state = engine.serialize();
  const restored = makeEngine();
  restored.load(state);
  assert.equal(restored.stateHash(), scrambled);
  assert.deepEqual(restored.validate(), []);
});

test('public state fingerprints are compact, deterministic, and do not expose piece transforms', () => {
  const first = makeEngine();
  const second = makeEngine();
  const solvedFingerprint = first.stateFingerprint();
  assert.match(solvedFingerprint, /^lml1-[0-9a-f]{32}$/);
  assert.equal(second.stateFingerprint(), solvedFingerprint);
  assert.ok(first.stateHash().includes('p-0-0-0:'));
  assert.equal(solvedFingerprint.includes('p-'), false);

  first.applyMove('R');
  assert.notEqual(first.stateFingerprint(), solvedFingerprint);
  first.applyMove("R'");
  assert.equal(first.stateFingerprint(), solvedFingerprint);
  assert.equal(first.serialize().fingerprint, solvedFingerprint);
});

test('ground truth exposes current coordinates without pixel-derived guesses', () => {
  const engine = makeEngine();
  engine.applyMove('R');
  const truth = engine.groundTruth();
  assert.equal(truth.pieces.length, 27);
  assert.equal(truth.legalMoves.length, 6);
  assert.equal(truth.stateHash, engine.stateHash());
  assert.ok(truth.pieces.some((piece) => piece.homeCoord.join(',') !== piece.currentCoord.join(',')));
});

test('bandaged mechanics expose exact state-dependent legality and reject split turns transactionally', () => {
  const engine = new PuzzleEngine(compilePuzzle(bandagedRelayPreset()));
  assert.deepEqual(engine.legalActionMask(), {
    R: true,
    L: true,
    U: false,
    D: true,
    F: true,
    B: false,
  });
  const initial = engine.stateHash();
  assert.throws(() => engine.applyMove('U'), (error) => {
    assert.ok(error instanceof IllegalMoveError);
    assert.equal(error.code, 'KineScope_ILLEGAL_MOVE');
    assert.equal(error.violatedBandages[0].id, 'north-bridge');
    return true;
  });
  assert.equal(engine.stateHash(), initial);

  engine.applyMove('R');
  assert.deepEqual(engine.validate(), []);
  assert.equal(engine.legalActionMask().U, true);
  assert.equal(engine.bandageForPiece('p-2-2-2')?.pieceIds.length, 2);
});

test('bandaged scrambles are deterministic and never propose a blocked transition', () => {
  const first = new PuzzleEngine(compilePuzzle(bandagedRelayPreset()));
  const second = new PuzzleEngine(compilePuzzle(bandagedRelayPreset()));
  const a = first.generateScramble(80, 'bandage-seed');
  const b = second.generateScramble(80, 'bandage-seed');
  assert.deepEqual(a, b);
  for (const token of a) {
    assert.equal(first.moveLegality(token).legal, true);
    first.applyMove(token);
  }
  assert.deepEqual(first.validate(), []);
});

test('move previews reject stale commits instead of applying to the wrong state', () => {
  const engine = makeEngine();
  const stale = engine.previewMove('R');
  engine.applyMove('U');
  const after = engine.stateHash();
  assert.throws(() => engine.commitPreview(stale), /preview R is stale/i);
  assert.equal(engine.stateHash(), after);
});

test('invalid loaded bandage states are rejected without corrupting the live engine', () => {
  const engine = new PuzzleEngine(compilePuzzle(bandagedRelayPreset()));
  const initial = engine.stateHash();
  const state = engine.serialize();
  const entry = state.transforms.find((candidate) => candidate.pieceId === 'p-2-2-2');
  assert.ok(entry);
  entry.orientation = [...quarterTurn3i(0, 1)];
  assert.throws(() => engine.load(state), /bandage north-bridge is split/i);
  assert.equal(engine.stateHash(), initial);
  assert.deepEqual(engine.validate(), []);
});
