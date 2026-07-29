# Affine Geometry Compiler Phase 1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first exact, deterministic affine-convex geometry compiler for \((B,\Phi,\beta)\), then make the existing cubic/Ghost compiler consume its canonical cells, provenance, adjacency, physical-piece quotient, triangulations, diagnostics, certificates, and hashes.

**Architecture:** Add a dependency-free rational predicate layer and an output-sensitive convex clipping kernel under `src/geometry/`. The generic affine compiler owns topology and canonical identity; `puzzle-compiler.js` becomes a compatibility adapter that derives its legacy logical pieces from the affine artifact while preserving the exact signed-permutation engine. A separate verifier checks emitted artifacts without trusting the compiler search path.

**Tech Stack:** JavaScript ES modules, JSDoc/TypeScript checking, `BigInt` rational arithmetic, Node test runner, existing deterministic render/research/API stack.

---

## Scope and invariants

- Supported source class: bounded convex polyhedral \(B\), finite oriented affine cuts \(\Phi\), and face-connected chamber bond groups \(\beta\).
- Topological predicates use normalized rational arithmetic. Floating source numbers are interpreted as their exact decimal spellings; legacy trigonometric frame construction is explicitly diagnosed as a rationalized numerical source.
- Canonical geometry identity ignores input object order, positive equation scaling, display IDs, materials, meshes, and cameras.
- Cut orientation is semantic. Negative equation scaling reverses signs and is not silently treated as the same oriented cut.
- Atomic cells are strict sign chambers. Non-separating/tangent/redundant cuts produce diagnostics rather than tolerance-dependent phantom cells.
- Physical pieces are bond-graph components. Interfaces within one physical piece have `internal-surface` provenance and are not exposed.
- Every polygon and triangulation has a deterministic exact vertex order.
- The legacy engine remains a finite rigid-transform state machine. No Phase 2 collision, jumbling, curved-cut, joint, or arbitrary-mechanism behavior is introduced.

### Task 1: Exact scalar and canonical digest primitives

**Files:**
- Create: `src/geometry/rational.js`
- Create: `src/geometry/sha256.js`
- Create: `tests/rational-geometry.test.js`

- [ ] **Step 1: Write failing tests**

Test exact decimal/fraction parsing, normalized arithmetic, exact comparisons, positive-scale plane normalization, SHA-256's standard `abc` vector, and order-stable canonical payload hashing.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/rational-geometry.test.js`

Expected: module-not-found failure for `src/geometry/rational.js`.

- [ ] **Step 3: Implement minimal exact primitives**

Use normalized `{ numerator: bigint, denominator: bigint }` values, exact vector/determinant operations, primitive integer plane normalization, and a synchronous dependency-free SHA-256 implementation.

- [ ] **Step 4: Run focused tests and full core checks**

Run: `node --test tests/rational-geometry.test.js`

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/geometry/rational.js src/geometry/sha256.js tests/rational-geometry.test.js
git commit -m "feat: add exact affine geometry primitives"
```

### Task 2: Exact convex B-rep and clipping kernel

**Files:**
- Create: `src/geometry/exact-polyhedron.js`
- Modify: `tests/rational-geometry.test.js`

- [ ] **Step 1: Write failing polyhedron tests**

Cover exact unit-cube reconstruction, Euler characteristic, closed two-face edge incidence, deterministic face/triangle ordering under hull-plane reorder, exact clipping at `x=0`, and rejection of an unbounded or lower-dimensional hull.

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test tests/rational-geometry.test.js`

Expected: missing exact-polyhedron exports.

- [ ] **Step 3: Implement exact hull construction and clipping**

Construct the initial hull from exact triple-plane intersections. Split convex cells with exact Sutherland-Hodgman face clipping, create canonical cap faces, orient polygons exactly, triangulate from the lexicographically minimal vertex, and emit exact volume/centroid plus numerical render projections.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/rational-geometry.test.js`

Expected: all exact polyhedron tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/geometry/exact-polyhedron.js tests/rational-geometry.test.js
git commit -m "feat: add deterministic exact convex clipping"
```

### Task 3: Canonical affine compiler and independent verifier

**Files:**
- Create: `src/geometry/affine-compiler.js`
- Create: `src/geometry/affine-verifier.js`
- Create: `src/geometry/index.js`
- Create: `tests/affine-compiler.test.js`

- [ ] **Step 1: Write failing compiler tests**

Test:

- one cut through a cube yields two cells and one exact adjacency;
- two orthogonal cuts yield four cells independent of cut order and positive rescaling;
- a face-connected bond group yields one physical piece and converts its paired face provenance to `internal-surface`;
- a disconnected bond group is rejected with a witness;
- every exposed face is `outer-hull` or `cut-surface`;
- canonical hashes and triangulations are stable across repeated compilation;
- Rational Ghost Atlas A yields 27 cells, the proved six traces on `X=8/5`, and the exact short-trace endpoints;
- the verifier accepts valid output and rejects corrupted vertices, adjacency, provenance, or hashes.

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test tests/affine-compiler.test.js`

Expected: module-not-found failure for `src/geometry/affine-compiler.js`.

- [ ] **Step 3: Implement the compiler**

Normalize and canonically order body planes/cuts, incrementally split cells, derive sign maps and stable IDs, pair exact cut faces into adjacency, quotient bonds with union-find, classify face provenance, build exposed-surface lists, emit stage diagnostics/certificates, and hash only normalized semantic data.

- [ ] **Step 4: Implement the verifier**

Independently check normalized input, exact half-space satisfaction, face planarity, polygon/triangle consistency, closed-cell edge incidence, symmetric adjacency, physical-piece membership, provenance rules, exposed-surface rules, and canonical payload hashes.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/affine-compiler.test.js`

Expected: all affine compiler/verifier tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/geometry tests/affine-compiler.test.js
git commit -m "feat: compile canonical affine cut geometry"
```

### Task 4: Adapt the legacy cubic/Ghost compiler

**Files:**
- Modify: `src/core/halfspace.js`
- Modify: `src/core/puzzle-compiler.js`
- Modify: `src/core/index.js`
- Modify: `src/render/mesh-data.js`
- Modify: `src/research/geometry-analysis.js`
- Modify: `tests/presets.test.js`
- Modify: `tests/render-data.test.js`
- Modify: `tests/research-suite.test.js`

- [ ] **Step 1: Write failing integration tests**

Require every compiled preset to expose:

- `geometry.schema === "polytwist.affine-geometry.v1"`;
- exact atomic-cell and physical-piece counts;
- exact symmetric adjacency;
- face provenance with source cut/hull IDs;
- stable canonical geometry hashes;
- bandaged physical-piece quotient counts;
- mesh surface provenance derived from face provenance;
- geometry-analysis compiler diagnostics and hashes.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `node --test tests/presets.test.js tests/render-data.test.js tests/research-suite.test.js`

Expected: missing `geometry`/provenance assertions fail.

- [ ] **Step 3: Build the compatibility adapter**

Preserve raw plane coefficients in `makePlane`, derive canonical body/cut inputs from the current specification, encode logical-cell sign selectors and bandage bond groups, compile once, map canonical atoms back to legacy piece IDs, and retain the engine's exact integer state semantics.

- [ ] **Step 4: Make render/research consumers use provenance**

Replace `face.kind`-only decisions with exact provenance categories while keeping compatibility fields during migration. Add canonical compiler diagnostics/hashes to geometry reports.

- [ ] **Step 5: Run all Node tests**

Run: `npm run check`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/core src/render/mesh-data.js src/research/geometry-analysis.js tests
git commit -m "feat: derive puzzle geometry from affine compiler"
```

### Task 5: Schema, API, validation, and research documentation

**Files:**
- Create: `schema/affine-geometry.schema.json`
- Create: `docs/IMPLEMENTATION_PHASE_1.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/VALIDATION.md`
- Modify: `docs/API.md`
- Modify: `docs/PUZZLE_SPEC.md`
- Modify: `research/mathematics/MATHEMATICAL_RESEARCH_LEDGER.md`
- Modify: `PolyTwist_Mathematical_Monograph_Source/docs/ARCHITECTURE.md`
- Modify: `PolyTwist_Mathematical_Monograph_Source/docs/ROADMAP.md`
- Modify: `PolyTwist_Mathematical_Monograph_Source/research/mathematics/MATHEMATICAL_RESEARCH_LEDGER.md`
- Modify: `src/server/api.js`
- Modify: `tests/server-api.test.js`

- [ ] **Step 1: Write failing API/schema assertions**

Require `/compile` to return the canonical affine artifact summary, verifier result, stage diagnostics, and hashes. Require the schema catalog/check script to parse the new schema.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/server-api.test.js`

Expected: canonical geometry fields are absent.

- [ ] **Step 3: Add schema and API output**

Expose bounded canonical summaries by default and full cells/faces only when explicitly requested, so the stateless API does not mail an accidental geometry novel on every compile.

- [ ] **Step 4: Update implementation and research ledgers**

Document the exact supported specialization, predicate/source exactness boundary, invariants, complexity, certificate model, compatibility mapping, unsupported Phase 2 features, and newly observed implementation facts. Do not promote a new theorem or novelty claim unless the implementation establishes one beyond the existing monograph.

- [ ] **Step 5: Run focused and full checks**

Run:

```bash
node --test tests/server-api.test.js
npm run check
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add schema docs research PolyTwist_Mathematical_Monograph_Source src/server/api.js tests/server-api.test.js
git commit -m "docs: record affine compiler milestone"
```

### Task 6: Final independent verification

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run deterministic compiler fixtures twice**

Compile classic, Ghost, Mirror, Axis, bandaged, procedural, and Rational Ghost A fixtures twice and compare canonical hashes, adjacency, triangulations, diagnostics, and verifier results.

- [ ] **Step 2: Run the complete release checks**

Run:

```bash
npm run check
npm run build
node "$(npm root -g)/typescript/bin/tsc" -p tsconfig.check.json --noEmit
```

Run browser smoke only if Chromium, Playwright, and Xvfb are available; otherwise record the precise missing prerequisite.

- [ ] **Step 3: Inspect the final diff and repository state**

Run:

```bash
git diff --check
git status --short
git log -6 --oneline
```

Expected: no whitespace errors; only intentional changes before the final commit; clean tree afterward.

- [ ] **Step 4: Commit any verification fixes**

Use a narrowly scoped commit message describing the actual fix.

