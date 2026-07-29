import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addRational,
  compareRational,
  divideRational,
  multiplyRational,
  makeRational,
  normalizePlane,
  parseRational,
  rationalKey,
  rationalToNumber,
  subtractRational,
} from '../src/geometry/rational.js';
import {
  clipExactPolyhedron,
  exactPointKey,
  intersectExactHalfspaces,
  validateExactPolyhedron,
} from '../src/geometry/exact-polyhedron.js';
import { canonicalSha256, canonicalStringify, sha256 } from '../src/geometry/sha256.js';

const cubePlanes = [
  { id: 'x+', normal: [1, 0, 0], constant: 1 },
  { id: 'x-', normal: [-1, 0, 0], constant: 1 },
  { id: 'y+', normal: [0, 1, 0], constant: 1 },
  { id: 'y-', normal: [0, -1, 0], constant: 1 },
  { id: 'z+', normal: [0, 0, 1], constant: 1 },
  { id: 'z-', normal: [0, 0, -1], constant: 1 },
];

test('exact rational, plane-normalization, and canonical-hash primitives', () => {
  assert.equal(rationalKey(parseRational('3/4')), '3/4');
  assert.equal(rationalKey(parseRational('-1.250')), '-5/4');
  assert.equal(rationalKey(parseRational('2.5e-3')), '1/400');
  assert.equal(rationalKey(parseRational(0.125)), '1/8');
  assert.throws(() => parseRational('1/0'), /denominator/i);
  assert.throws(() => parseRational(Number.NaN), /finite/i);
  const oneThird = parseRational('1/3');
  const oneSixth = parseRational('1/6');
  assert.equal(rationalKey(addRational(oneThird, oneSixth)), '1/2');
  assert.equal(rationalKey(subtractRational(oneThird, oneSixth)), '1/6');
  assert.equal(rationalKey(multiplyRational(oneThird, parseRational(9))), '3/1');
  assert.equal(rationalKey(divideRational(oneSixth, oneThird)), '1/2');
  assert.equal(compareRational(parseRational('0.1'), parseRational('1/10')), 0);
  assert.equal(compareRational(parseRational('999999999999999999/1000000000000000000'), parseRational(1)), -1);
  assert.ok(Math.abs(rationalToNumber(makeRational(
    5n * 10n ** 400n + 1n,
    4n * 10n ** 400n + 3n,
  )) - 1.25) < 1e-14);
  const first = normalizePlane({
    normal: ['1/2', '-3/4', '5/6'],
    constant: '7/8',
  });
  const scaled = normalizePlane({
    normal: [12, -18, 20],
    constant: 21,
  });
  const reversed = normalizePlane({
    normal: [-12, 18, -20],
    constant: -21,
  });

  assert.deepEqual(first.integerCoefficients, [12n, -18n, 20n, 21n]);
  assert.equal(first.key, scaled.key);
  assert.notEqual(first.key, reversed.key);
  assert.equal(first.carrierKey, reversed.carrierKey);
  assert.equal(first.orientationAgainstCarrier, 1);
  assert.equal(reversed.orientationAgainstCarrier, -1);
  assert.equal(
    sha256('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    canonicalSha256({ z: -0, a: [3, { y: true, x: 'cut' }] }),
    canonicalSha256({ a: [3, { x: 'cut', y: true }], z: 0 }),
  );
  assert.notEqual(canonicalSha256({ a: 1 }), canonicalSha256({ a: 2 }));
  assert.throws(() => canonicalSha256({ invalid: Number.POSITIVE_INFINITY }), /finite/i);
  assert.equal(
    canonicalStringify({ z: 2n, a: { y: -0, x: 'exact' } }),
    '{"a":{"x":"exact","y":0},"z":"2n"}',
  );
});

test('exact convex B-rep construction, canonical ordering, clipping, and rejection', () => {
  const cube = intersectExactHalfspaces(cubePlanes);
  assert.ok(cube);
  assert.equal(cube.vertices.length, 8);
  assert.equal(cube.faces.length, 6);
  assert.equal(cube.edges.length, 12);
  assert.equal(cube.triangles.length, 12);
  assert.equal(rationalKey(cube.volume), '8/1');
  assert.deepEqual(cube.centroid.map(rationalKey), ['0/1', '0/1', '0/1']);
  assert.equal(cube.vertices.length - cube.edges.length + cube.faces.length, 2);
  assert.ok(cube.edges.every((edge) => edge.faceIndices.length === 2));
  assert.deepEqual(validateExactPolyhedron(cube), []);
  const forward = intersectExactHalfspaces(cubePlanes);
  const reordered = intersectExactHalfspaces([
    cubePlanes[4],
    cubePlanes[1],
    cubePlanes[3],
    cubePlanes[5],
    cubePlanes[0],
    cubePlanes[2],
  ]);
  assert.ok(forward);
  assert.ok(reordered);

  const signature = (polyhedron) => ({
    vertices: polyhedron.vertices.map(exactPointKey),
    faces: polyhedron.faces.map((face) => ({
      plane: face.plane.key,
      points: face.vertexIndices.map((index) => exactPointKey(polyhedron.vertices[index])),
    })),
    triangles: polyhedron.triangles.map((triangle) => triangle.vertexIndices
      .map((index) => exactPointKey(polyhedron.vertices[index]))),
  });
  assert.deepEqual(signature(forward), signature(reordered));
  const splitCube = intersectExactHalfspaces(cubePlanes);
  assert.ok(splitCube);
  const split = clipExactPolyhedron(splitCube, {
    id: 'middle-x',
    normal: [1, 0, 0],
    constant: 0,
  });

  assert.equal(split.relation, 'split');
  assert.ok(split.negative);
  assert.ok(split.positive);
  assert.equal(rationalKey(split.negative.volume), '4/1');
  assert.equal(rationalKey(split.positive.volume), '4/1');
  assert.deepEqual(validateExactPolyhedron(split.negative), []);
  assert.deepEqual(validateExactPolyhedron(split.positive), []);
  assert.equal(
    split.negative.faces.filter((face) => face.plane.sourceId === 'middle-x').length,
    1,
  );
  assert.equal(
    split.positive.faces.filter((face) => face.plane.sourceId === 'middle-x').length,
    1,
  );
  assert.equal(intersectExactHalfspaces(cubePlanes.slice(0, 5)), null);
  assert.equal(intersectExactHalfspaces([
    ...cubePlanes.slice(2),
    { normal: [1, 0, 0], constant: 0 },
    { normal: [-1, 0, 0], constant: 0 },
  ]), null);
});
