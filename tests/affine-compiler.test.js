import test from 'node:test';
import assert from 'node:assert/strict';

import { compileAffineGeometry } from '../src/geometry/affine-compiler.js';
import { verifyAffineGeometry } from '../src/geometry/affine-verifier.js';
import { exactPointKey } from '../src/geometry/exact-polyhedron.js';

const cubeBody = {
  planes: [
    { id: 'x+', normal: [1, 0, 0], constant: 1 },
    { id: 'x-', normal: [-1, 0, 0], constant: 1 },
    { id: 'y+', normal: [0, 1, 0], constant: 1 },
    { id: 'y-', normal: [0, -1, 0], constant: 1 },
    { id: 'z+', normal: [0, 0, 1], constant: 1 },
    { id: 'z-', normal: [0, 0, -1], constant: 1 },
  ],
};

const orthogonalCuts = [
  { id: 'x', normal: [1, 0, 0], constant: 0 },
  { id: 'y', normal: [0, 1, 0], constant: 0 },
];

test('one affine cut compiles two strict cells and one exact paired interface', () => {
  const geometry = compileAffineGeometry({
    body: cubeBody,
    cuts: [orthogonalCuts[0]],
  });

  assert.equal(geometry.schema, 'polytwist.affine-geometry.v1');
  assert.equal(geometry.atomicCells.length, 2);
  assert.equal(geometry.adjacency.length, 1);
  assert.equal(geometry.physicalPieces.length, 2);
  assert.deepEqual(geometry.atomicCells.map((cell) => cell.signKey), ['-', '+']);
  assert.deepEqual(geometry.adjacency[0].cellIds, ['cell:-', 'cell:+']);
  assert.ok(geometry.atomicCells.every((cell) => cell.faces.every(
    (face) => ['outer-hull', 'cut-surface'].includes(face.provenance.category),
  )));
});

test('canonical affine output ignores cut order and positive equation scaling', () => {
  const first = compileAffineGeometry({
    body: cubeBody,
    cuts: orthogonalCuts,
  });
  const reordered = compileAffineGeometry({
    body: { planes: [...cubeBody.planes].reverse() },
    cuts: [
      { id: 'y', normal: [0, 7, 0], constant: 0 },
      { id: 'x', normal: [3, 0, 0], constant: 0 },
    ],
  });

  assert.equal(first.atomicCells.length, 4);
  assert.equal(first.adjacency.length, 4);
  assert.equal(first.hashes.input, reordered.hashes.input);
  assert.equal(first.hashes.geometry, reordered.hashes.geometry);
  assert.deepEqual(
    first.atomicCells.map((cell) => ({
      signKey: cell.signKey,
      triangles: cell.polyhedron.triangles,
    })),
    reordered.atomicCells.map((cell) => ({
      signKey: cell.signKey,
      triangles: cell.polyhedron.triangles,
    })),
  );
});

test('the bond quotient creates physical pieces and hides bonded interfaces', () => {
  const geometry = compileAffineGeometry({
    body: cubeBody,
    cuts: orthogonalCuts,
    bondGroups: [{
      id: 'lower-half',
      cells: [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
      ],
    }],
  });

  assert.equal(geometry.physicalPieces.length, 3);
  const bondedCells = geometry.atomicCells.filter((cell) => (
    cell.signsByCut.x === -1 || cell.signsByCut.x === 1
  ) && cell.signsByCut.y === -1);
  assert.equal(new Set(bondedCells.map((cell) => cell.physicalPieceId)).size, 1);
  const internalFaces = bondedCells.flatMap((cell) => cell.faces).filter(
    (face) => face.provenance.category === 'internal-surface',
  );
  assert.equal(internalFaces.length, 2);
  assert.ok(geometry.exposedSurfaces.every(
    (surface) => surface.provenance.category !== 'internal-surface',
  ));
});

test('a bond hyperedge must be connected in the exact chamber adjacency graph', () => {
  assert.throws(() => compileAffineGeometry({
    body: cubeBody,
    cuts: orthogonalCuts,
    bondGroups: [{
      cells: [
        { x: -1, y: -1 },
        { x: 1, y: 1 },
      ],
    }],
  }), /not face-connected.*cell:/i);
});

test('Rational Ghost Atlas A emerges as 27 cells with six exact selected-face traces', () => {
  const level = '8/5';
  const geometry = compileAffineGeometry({
    body: {
      planes: [
        { id: 'x+', normal: [1, 0, 0], constant: level },
        { id: 'x-', normal: [-1, 0, 0], constant: level },
        { id: 'y+', normal: [0, 1, 0], constant: level },
        { id: 'y-', normal: [0, -1, 0], constant: level },
        { id: 'z+', normal: [0, 0, 1], constant: level },
        { id: 'z-', normal: [0, 0, -1], constant: level },
      ],
    },
    cuts: [
      { id: '1-', normal: [4, 2, -4], constant: -3 },
      { id: '1+', normal: [4, 2, -4], constant: 3 },
      { id: '2-', normal: [20, 40, 40], constant: -29 },
      { id: '2+', normal: [20, 40, 40], constant: 31 },
      { id: '3-', normal: [40, -40, 20], constant: -23 },
      { id: '3+', normal: [40, -40, 20], constant: 37 },
    ],
  });

  assert.equal(geometry.atomicCells.length, 27);
  const traces = geometry.boundaryTraces.filter((trace) => trace.hullSourceId === 'x+');
  assert.equal(traces.length, 6);
  const shortTrace = traces.find((trace) => trace.cutSourceId === '1-');
  assert.ok(shortTrace);
  assert.deepEqual(shortTrace.points.map(exactPointKey), [
    '8/5,-8/5,31/20',
    '8/5,-3/2,8/5',
  ]);
});

test('independent verification accepts canonical output and rejects corrupted geometry and hashes', () => {
  const geometry = compileAffineGeometry({
    body: cubeBody,
    cuts: orthogonalCuts,
  });
  assert.deepEqual(verifyAffineGeometry(geometry), { valid: true, errors: [] });

  const corruptedVertex = structuredClone(geometry);
  corruptedVertex.atomicCells[0].polyhedron.vertices[0][0].numerator = 99n;
  const vertexResult = verifyAffineGeometry(corruptedVertex);
  assert.equal(vertexResult.valid, false);
  assert.ok(vertexResult.errors.some((error) => /vertex|hash/i.test(error)));

  const corruptedProvenance = structuredClone(geometry);
  corruptedProvenance.atomicCells[0].faces[0].provenance.category = 'internal-surface';
  const provenanceResult = verifyAffineGeometry(corruptedProvenance);
  assert.equal(provenanceResult.valid, false);
  assert.ok(provenanceResult.errors.some((error) => /provenance|hash/i.test(error)));

  const corruptedHash = structuredClone(geometry);
  corruptedHash.hashes.geometry = '0'.repeat(64);
  assert.equal(verifyAffineGeometry(corruptedHash).valid, false);
});
