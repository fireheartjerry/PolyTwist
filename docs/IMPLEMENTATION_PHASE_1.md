# Implementation Phase 1: canonical affine geometry

**Status:** Phase 1.1 complete for the affine-convex specialization; Phase 1.2–1.4 integrated for the existing cubic mechanism adapter  
**Milestone base:** `3062274`

## Supported object

The production compiler in `src/geometry/` accepts:

\[
(B,\Phi,\beta),
\]

where `B` is a bounded full-dimensional convex rational polyhedron, `Φ` is a finite set of oriented rational affine planes, and `β` is a set of face-connected chamber bond groups. It deliberately does not implement curved carriers, nonconvex decomposition, jumbling, swept collision, gears, sliders, locks, or continuous contact.

Legacy Euler-angle puzzle specifications are admitted through an explicit compatibility boundary. Their finite JavaScript coefficients are interpreted as exact decimal rationals and marked `source: "rationalized-numerical"`. All predicates after that boundary are exact; the original trigonometric construction is not retroactively claimed to be symbolic.

## Compiler stages

1. Normalize every oriented plane to primitive integer coefficients.
2. Reconstruct the initial hull from exact triple-plane intersections.
3. Incrementally clip current convex cells by canonically ordered cuts.
4. Label each nonempty strict chamber by its canonical sign vector.
5. Pair equal exact cut polygons to obtain chamber adjacency.
6. Validate face-connected bond hyperedges and compute their disjoint-set quotient.
7. Classify every face as `outer-hull`, `cut-surface`, or `internal-surface`.
8. Emit exposed surfaces, raw boundary traces, deterministic face fans, diagnostics, certificates, and SHA-256 digests.
9. Run the independent verifier, which checks emitted B-reps and hashes without repeating the arrangement search.

Initial hull reconstruction enumerates plane triples. Subsequent cuts are output-sensitive in the current B-rep and visit the surviving face edges. Exact arithmetic can grow substantially for rationalized trigonometric inputs, so the legacy adapter maintains a bounded semantics-keyed cache with defensive cloning.

## Canonical identity

The input digest ignores object order, positive equation scaling, display IDs, materials, cameras, and meshes. Cut orientation remains semantic. The geometry digest covers exact vertices, deterministic polygons and triangles, sign cells, adjacency, the bond quotient, provenance, and raw traces.

These hashes identify the normalized serialization of the supported affine object. They do not settle the open generic atlas-isomorphism conjecture.

## Rendering and state

`compilePuzzle()` compiles canonical geometry once and projects its exact vertices to floating point for rasterization. It no longer reconstructs cells with the legacy epsilon half-space solver. Browser and software rendering consume the same derived triangles and provenance.

Puzzle states contain only exact signed-permutation piece transforms. Scrambling never rebuilds a mesh. Bonded interfaces carry `internal-surface` provenance and are omitted from render triangles and exposed-surface lists.

The evaluator-facing `polytwist.ideal-rigid-display-certificate.v1` report
checks the canonical geometry, exact proper rotations, bijective logical
occupancy, actual render matrices, common mechanism pivot, and declared active
layer axis. Renderer clearance is disclosed as a noncanonical `0.962`
centroid contraction with a `0.006` outer-face lift. Neither value affects
mechanics, legality, canonical geometry, or hashes.

## Verification

Focused fixtures cover:

- exact unit-cube B-rep closure, Euler characteristic, and edge incidence;
- order- and positive-scale-invariant geometry;
- exact planar bisection;
- unbounded and lower-dimensional rejection;
- exact adjacency and bond connectivity;
- provenance and exposed-surface rules;
- corrupted vertex, provenance, and digest rejection;
- Rational Ghost Atlas A: 27 cells, six traces on `X=8/5`, and the exact short-trace endpoints;
- all built-in Classic, Ghost, Mirror, Axis, bandaged, and procedural presets.

The artifact schema is `schema/affine-geometry.schema.json`. `POST /api/v1/compile` returns hashes, counts, diagnostics, and verifier output by default; set `includeCanonicalGeometry: true` to include the full canonical serialization.

## Known boundary

The current signed-permutation move engine remains a proved-by-regression cubic compatibility specialization, not a general atlas dynamics compiler. Exact geometry is shipped; general joints, docking, path legality, and arbitrary mechanisms are not. Phase 2 starts there—not by quietly bolting collision guesses onto Phase 1.

The ideal-rigid display certificate is likewise not a manufacturability,
tolerance, hidden-core, friction, retention, compliance, or general
swept-volume collision certificate.
