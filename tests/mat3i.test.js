import test from 'node:test';
import assert from 'node:assert/strict';

import {
  apply3i,
  determinant3i,
  equals3i,
  identity3i,
  isProperCubeRotation,
  multiply3i,
  quarterTurn3i,
  transpose3i,
} from '../src/core/mat3i.js';

for (const axis of [0, 1, 2]) {
  test(`axis ${axis} quarter turns form an exact order-four rotation`, () => {
    const q = quarterTurn3i(axis, 1);
    assert.equal(determinant3i(q), 1);
    assert.equal(isProperCubeRotation(q), true);
    const q2 = multiply3i(q, q);
    const q4 = multiply3i(q2, q2);
    assert.equal(equals3i(q4, identity3i()), true);
    assert.equal(equals3i(multiply3i(q, transpose3i(q)), identity3i()), true);
  });
}

test('quarter-turn coordinates obey the right-hand rule', () => {
  assert.deepEqual(apply3i(quarterTurn3i(0, 1), [0, 1, 0]), [0, 0, 1]);
  assert.deepEqual(apply3i(quarterTurn3i(1, 1), [0, 0, 1]), [1, 0, 0]);
  assert.deepEqual(apply3i(quarterTurn3i(2, 1), [1, 0, 0]), [0, 1, 0]);
});

test('negative and triple quarter turns are identical', () => {
  for (const axis of [0, 1, 2]) {
    assert.equal(equals3i(quarterTurn3i(axis, -1), quarterTurn3i(axis, 3)), true);
  }
});
