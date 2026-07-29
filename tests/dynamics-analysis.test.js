import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeCurrentDynamics } from '../src/core/dynamics-analysis.js';
import { compilePuzzle } from '../src/core/puzzle-compiler.js';
import { PuzzleEngine } from '../src/core/puzzle-engine.js';
import { bandagedRelayPreset, classicPreset } from '../src/core/presets.js';

function findPair(report, first, second) {
  return report.pairs.find((pair) =>
    (pair.first === first && pair.second === second) ||
    (pair.first === second && pair.second === first));
}

test('exact dynamics analysis recovers action orders and commutation structure', () => {
  const engine = new PuzzleEngine(compilePuzzle(classicPreset()));
  const report = analyzeCurrentDynamics(engine);
  assert.equal(report.schema, 'kinescope.dynamics-analysis.v1');
  assert.equal(report.actions.length, 6);
  assert.ok(report.actions.every((action) => action.legal && action.orderAtState === 4));
  assert.equal(findPair(report, 'R', 'L')?.commutes, true);
  assert.equal(findPair(report, 'U', 'D')?.commutes, true);
  assert.equal(findPair(report, 'R', 'U')?.commutes, false);
  assert.ok(report.actions.find((action) => action.token === 'R')?.permutationCycles.length);
});

test('dynamics analysis represents state-dependent obstructions without mutating the source state', () => {
  const engine = new PuzzleEngine(compilePuzzle(bandagedRelayPreset()));
  const before = engine.stateHash();
  const report = analyzeCurrentDynamics(engine);
  assert.equal(report.legalActionMask.U, false);
  assert.equal(report.actions.find((action) => action.token === 'U')?.closure, 'blocked-at-start');
  assert.equal(report.actions.find((action) => action.token === 'R')?.legal, true);
  assert.equal(engine.stateHash(), before);
  assert.deepEqual(engine.validate(), []);
});
