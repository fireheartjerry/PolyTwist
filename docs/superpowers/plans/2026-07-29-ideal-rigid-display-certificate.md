# Ideal-Rigid Display Certificate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit a deterministic certificate for the rigid-body and renderer invariants already supported by Phase 1.

**Architecture:** A pure render-side verifier consumes the compiled puzzle, exact transform map, derived model matrices, and optional move preview. It reuses the affine verifier and exact signed-permutation algebra, reports renderer-only clearance parameters, and is exposed only through evaluator-facing geometry analysis and private browser exports.

**Tech Stack:** JavaScript ES modules, Node test runner, exact PolyTwist geometry/state modules, WebGL-derived model matrices.

---

### Task 1: Focused certificate

**Files:**
- Create: `src/render/rigid-display-certificate.js`
- Modify: `src/render/mesh-data.js`
- Test: `tests/render-data.test.js`

- [ ] **Step 1: Add one failing test to the existing render test file**

Import the Ghost preset, engine, matrix helpers, and the new verifier. In one
test, certify the solved state, certify an `R` preview at a partial angle,
commit `R`, verify the geometry hash is unchanged, then corrupt one model
matrix scale and assert rejection:

```js
test('ideal-rigid certificate validates rest, animation, and a committed turn', () => {
  const puzzle = compilePuzzle(ghostPreset());
  const engine = new PuzzleEngine(puzzle);
  const before = certifyIdealRigidDisplay(puzzle, engine.transforms, exactMatrices(puzzle, engine));
  assert.equal(before.valid, true);
  const preview = engine.previewMove('R');
  const moving = animatedMatrices(puzzle, engine, preview, 0.37);
  assert.equal(certifyIdealRigidDisplay(puzzle, engine.transforms, moving, preview).valid, true);
  engine.commitPreview(preview);
  const after = certifyIdealRigidDisplay(puzzle, engine.transforms, exactMatrices(puzzle, engine));
  assert.equal(after.geometryHash, before.geometryHash);
  const corrupted = new Map(exactMatrices(puzzle, engine));
  corrupted.get(puzzle.pieces.find((piece) => piece.renderable).id)[0] = 2;
  assert.equal(certifyIdealRigidDisplay(puzzle, engine.transforms, corrupted).valid, false);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test tests/render-data.test.js
```

Expected: module-not-found failure for `rigid-display-certificate.js`.

- [ ] **Step 3: Implement the pure verifier**

Export renderer parameters from `mesh-data.js`:

```js
export const DISPLAY_PIECE_SCALE = 0.962;
export const DISPLAY_OUTER_FACE_LIFT = 0.006;
```

Implement `certifyIdealRigidDisplay()` with schema
`polytwist.ideal-rigid-display-certificate.v1`. Check the affine artifact,
proper exact rotations, unique logical occupancy, rigid affine model matrices,
fixed mechanism pivot, active layer membership, and active-axis preservation.
Return deterministic `checks`, `errors`, geometry hash, renderer presentation
parameters, and the explicit Phase 1 limitations from the design.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
node --test tests/render-data.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/render/rigid-display-certificate.js src/render/mesh-data.js tests/render-data.test.js
git commit -m "feat: certify ideal-rigid display invariants"
```

### Task 2: Evaluator-facing integration and verification

**Files:**
- Modify: `src/research/geometry-analysis.js`
- Modify: `src/render/scene-controller.js`
- Modify: `docs/IMPLEMENTATION_PHASE_1.md`
- Modify: `docs/VALIDATION.md`

- [ ] **Step 1: Include the home-state certificate in geometry analysis**

Build identity exact transforms and derived model matrices, then add:

```js
idealRigidDisplay: certifyIdealRigidDisplay(puzzle, transforms, modelMatrices)
```

This output is evaluator-facing and does not enter the canonical geometry hash.

- [ ] **Step 2: Include the live certificate in private browser exports**

Add `idealRigidDisplay` to `privateGroundTruth`, using current engine transforms,
`lastModelMatrices`, and the active preview when present. Do not add it to
`episode_public.json`.

- [ ] **Step 3: Document the claim boundary**

Record the implemented checks and state explicitly that the certificate is not
a manufacturability, tolerance, hidden-core, or general swept-collision claim.

- [ ] **Step 4: Run existing tests without creating another fixture**

Run:

```bash
node --test tests/render-data.test.js tests/engine.test.js tests/research-suite.test.js tests/server-api.test.js
npm run check
```

Expected: all pass.

- [ ] **Step 5: Run a live browser turn**

Start the static server, load Ghost 3, apply `R`, inspect console/network, and
verify the private/live certificate remains valid with the same geometry hash.

- [ ] **Step 6: Commit the milestone**

```bash
git add src/research/geometry-analysis.js src/render/scene-controller.js docs/IMPLEMENTATION_PHASE_1.md docs/VALIDATION.md
git commit -m "docs: expose ideal-rigid display evidence"
```
