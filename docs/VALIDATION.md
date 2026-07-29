# Validation record

## Release checks

Run:

```bash
npm run check
npm run typecheck
npm run build
npm run browser:smoke
```

The deterministic Node suite contains **63 tests**. The Phase 1 additions are intentionally consolidated into six high-signal proof fixtures. They cover:

- exact rational parsing, arithmetic, large-coefficient numeric projection, and primitive plane normalization;
- dependency-free standard-vector SHA-256 and canonical serialization;
- exact convex B-rep closure, Euler characteristic, two-face edge incidence, volume, centroid, and clipping;
- deterministic faces and triangles under plane reordering and positive rescaling;
- rejection of unbounded and lower-dimensional intersections;
- canonical affine chamber adjacency, bond quotient, provenance, exposed surfaces, diagnostics, and hashes;
- independent rejection of corrupted vertices, provenance, and hashes;
- Rational Ghost Atlas A's 27 chambers, six selected-face traces, and exact short-trace endpoints;
- canonical geometry integration for every supported preset and procedural artifact;
- renderer omission of `internal-surface` triangles and per-vertex provenance codes;
- compile API summaries, verifier results, canonical hashes, and schema discovery;

- exact signed-permutation rotation algebra and right-hand-rule behavior;
- inverse/order-four restoration, occupancy, serialization, loading, undo, and redo;
- stale or forged preview rejection and atomic state mutation;
- 2×2, 3×3, and 4×4 controls, shape mods, custom convex hulls, and custom action alphabets;
- connected rigid-bandage compilation, state-dependent legality, legal scramble generation, and split-cluster rejection;
- exact action orders, blocked closures, successor states, permutation cycles, and pairwise commutation;
- compact public fingerprints and exact private state signatures;
- collision-free machine colors, global face IDs, and fused-bandage interface suppression;
- ideal-rigid display certification at rest, during an axial layer animation,
  and after an exact committed turn, including rejection of a non-rigid render
  matrix;
- deterministic CRC-32 and ZIP construction;
- dense geometry reports and stable digests;
- bounded state graphs with multiple legality patterns;
- enumeration of 24 proper cube-frame hypotheses and information-gain ranking;
- public/private episode leakage boundaries;
- generation of all 16 task families and JSONL partitions;
- evaluator coverage, task-aware scoring, plan verification, and perfect-target sanity checks;
- deterministic CPU PNG rendering across observation modes;
- REST health, exact transition, binary render behavior, and Vercel adapter response preservation.

The JSDoc-annotated source is configured for `tsc -p tsconfig.check.json --noEmit`; TypeScript must be installed in the execution environment. The static builder emits a self-contained browser application at `dist/index.html`.

## Compiler inspection

```bash
npm run inspect -- ghost-4 artifact-001
npm run analyze -- bandaged-relay-3 artifact-001 --max-order 32
npm run research:analyze -- ghost-3 artifact-001 --output validation/ghost-analysis.json
npm run research:graph -- bandaged-relay-3 artifact-001 \
  --max-states 512 --max-depth 5 \
  --output validation/bandaged-graph.json
```

The Ghost Frame 4×4 preset is expected to compile to 64 logical cells and 56 renderable pieces with no topology warnings. The Bandaged Relay preset starts with two rigid clusters and the exact legality mask:

```json
{ "R": true, "L": true, "U": false, "D": true, "F": true, "B": false }
```

After `R`, `U` becomes legal. The dynamics report records blocked primitives, executable successors, local action closure, affected-piece transitions, permutation cycles, and all primitive action pairs.

Canonical compiler inspection is also available through:

```bash
curl -X POST http://127.0.0.1:4173/api/v1/compile \
  -H 'content-type: application/json' \
  -d '{"preset":"ghost-3","includePieces":false}'
```

The response must report `polytwist.affine-geometry.v1`, a valid independent-verifier result, exact stage diagnostics, and two 64-character SHA-256 hashes. Add `"includeCanonicalGeometry":true` only when the full exact artifact is required.

## API smoke test

Start the combined server:

```bash
npm run serve
```

Then verify:

```bash
curl http://127.0.0.1:4173/api/v1/health
curl http://127.0.0.1:4173/api/v1/capabilities
curl -X POST 'http://127.0.0.1:4173/api/v1/render?format=png' \
  -H 'content-type: application/json' \
  -d '{"preset":"ghost-2","mode":"normal","width":128,"height":128,"format":"png"}' \
  --output validation/api-normal.png
```

A valid PNG begins with bytes `89 50 4e 47 0d 0a 1a 0a`.

## Browser/WebGL2 smoke test

Run in an environment with Python Playwright, Chromium, Xvfb, and WebGL2:

```bash
KineScope_SMOKE_OUTPUT=./smoke npm run browser:smoke
```

The test verifies:

1. startup through `window.__KINESCOPE_READY__` with no fatal page/WebGL errors;
2. new KineScope browser globals and deprecated v0.2 aliases referencing the same capabilities;
3. a narrow `window.kineScopeAgent` surface with no ground-truth method;
4. opaque public artifact metadata, neutral `A0…A5` actions, no hidden legality mask, and no raw piece IDs;
5. a blocked hidden action returning `KineScope_ACTION_REJECTED` without state mutation or constraint leakage;
6. disclosed exact legality controls and `KineScope_ILLEGAL_MOVE` for evaluator-side blocked actions;
7. state-dependent unlocking of `U` after `R`;
8. bounded camera intervention;
9. 3×3, 4×4, rigid-bandaged, and seeded procedural compilation;
10. normal PNG capture and synchronized multi-pass episode ZIP export;
11. exact dynamics analysis and zero fatal console entries.

GPU readback may emit expected performance warnings during capture. Those warnings describe synchronization cost, not correctness failure.

## Research-suite release sample

A release sample should be generated with:

```bash
npm run research:suite -- \
  --seed release-smoke \
  --splits validation,test-iid,test-mechanics-ood \
  --episodes-per-split 1 \
  --horizon 4 \
  --scramble-depth 2 \
  --output datasets/release-smoke \
  --monolithic
```

Validation checks should record:

- suite/public/private digests;
- episode, item, target, diagnostic, task, and split counts;
- JSONL line counts;
- file sizes and SHA-256 digests;
- no canonical specification or alias map in public partitions;
- exactly one private target per public item.
