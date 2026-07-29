import test from 'node:test';
import assert from 'node:assert/strict';

import { boxHullPlanes } from '../src/core/halfspace.js';
import { intersectHalfspaces, validatePolyhedron } from '../src/core/polyhedron.js';

const approximately = (actual, expected, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≉ ${expected}`);

test('half-space intersection reconstructs a unit box', () => {
  const planes = boxHullPlanes([1, 1, 1]);
  const polyhedron = intersectHalfspaces(planes);
  assert.ok(polyhedron);
  assert.equal(polyhedron.vertices.length, 8);
  assert.equal(polyhedron.faces.length, 6);
  assert.equal(polyhedron.triangles.length, 12);
  assert.equal(polyhedron.edges.length, 12);
  approximately(polyhedron.volume, 8);
  approximately(polyhedron.outerArea, 24);
  assert.deepEqual(validatePolyhedron(polyhedron, planes), []);
});

test('edge and corner chamfers remain closed convex polyhedra', () => {
  const planes = boxHullPlanes([1.2, 1.1, 0.9], { chamfer: 0.08, cornerChamfer: 0.05 });
  const polyhedron = intersectHalfspaces(planes);
  assert.ok(polyhedron);
  assert.ok(polyhedron.vertices.length > 8);
  assert.ok(polyhedron.faces.length > 6);
  assert.ok(polyhedron.volume > 0);
  assert.deepEqual(validatePolyhedron(polyhedron, planes), []);
});
