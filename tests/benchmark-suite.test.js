import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBenchmarkSuite,
  createDisentanglementGroup,
} from '../src/core/benchmark-suite.js';
import { compilePuzzle } from '../src/core/puzzle-compiler.js';

test('factorial group isolates appearance and action-semantics interventions', () => {
  const group = createDisentanglementGroup('controlled-17');
  const byCode = Object.fromEntries(group.conditions.map((condition) => [condition.code, condition]));
  const base = byCode.A0M0.spec;
  const appearance = byCode.A1M0.spec;
  const mechanics = byCode.A0M1.spec;
  const both = byCode.A1M1.spec;

  assert.deepEqual(base.outer, appearance.outer);
  assert.deepEqual(base.mechanism, appearance.mechanism);
  assert.deepEqual(byCode.A0M0.actionSemantics, byCode.A1M0.actionSemantics);
  assert.notDeepEqual(base.appearance, appearance.appearance);

  assert.deepEqual(base.outer, mechanics.outer);
  assert.deepEqual(base.mechanism, mechanics.mechanism);
  assert.deepEqual(base.appearance, mechanics.appearance);
  assert.notDeepEqual(byCode.A0M0.actionSemantics, byCode.A0M1.actionSemantics);

  assert.deepEqual(appearance.appearance, both.appearance);
  assert.deepEqual(byCode.A0M1.actionSemantics, byCode.A1M1.actionSemantics);
  for (const condition of group.conditions) {
    const compiled = compilePuzzle(condition.spec);
    assert.equal(compiled.stats.renderablePieces, 26);
    assert.deepEqual(compiled.stats.topologyWarnings, []);
  }
});

test('benchmark suites are deterministic and contain four conditions per group', () => {
  const first = createBenchmarkSuite({ groups: 3, seed: 'paper-seed' });
  const second = createBenchmarkSuite({ groups: 3, seed: 'paper-seed' });
  assert.deepEqual(first, second);
  assert.equal(first.groupCount, 3);
  assert.equal(first.conditionCount, 12);
  assert.ok(first.groups.every((group) => group.conditions.length === 4));
});
