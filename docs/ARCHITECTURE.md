# Architecture

**Status:** target mathematical architecture plus current implementation boundary  
**Date:** 2026-07-29  
**Canonical audit base:** `a970c65ab367b98ea380d48919c449bb63fa8638`

The architectural rule is stronger than “pixels do not define state”:

> **Every authoritative artifact must be a deterministic, independently checkable derivative of one exact mechanism object.**

The canonical source object is the Stratified Kinematic Atlas defined in `research/mathematics/CUT_AND_TURN_ATLAS.md` and developed in `research/monograph/polytwist-monograph.tex`.

## 1. Two scopes must remain explicit

### Current implemented specialization

The repository currently implements a cubic-lattice engine with:

- sizes `2×2×2` through `9×9×9`;
- one translated and rotated orthogonal mechanism frame;
- convex half-space piece geometry;
- exact signed-permutation orientations and quarter turns;
- connected rigid bandages with state-dependent closure checks;
- deterministic browser/server rendering and research exports.

This system is valuable and internally disciplined. It is **not** an implementation of arbitrary cut-and-turn mechanisms.

### Target atlas architecture

The target accepts exact bodies, arbitrary supported cut carriers, bonds, assemblies, joints, turn paths, state-dependent gates, docking relations, and appearance/sensor data. It derives pieces, legality, dynamics, observations, and benchmark targets from those inputs.

No implementation code was changed by the mathematical-monograph work. The architecture below is a promotion contract, not a claim of shipped capability.

## 2. Canonical layer model

```text
Exact Stratified Kinematic Atlas
    │
    ├── coefficient domain and normalized equations
    ├── body B and cut functions Φ
    ├── bonds β
    ├── assembly/joint/docking data J
    ├── reversible turn templates T
    └── appearance/sensor data O
          ↓
Certified stratification compiler
    ├── connected sign components
    ├── closure/facet incidence
    ├── boundary traces and intersections
    ├── atomic chambers
    └── proof certificates / failure witnesses
          ↓
Physical-piece compiler
    ├── bond components
    ├── regular-closed piece solids
    ├── seam quotient
    ├── piece symmetries
    └── piece certificates
          ↓
Configuration compiler
    ├── anchors and fixed bodies
    ├── joint relations
    ├── clearance and nonpenetration
    ├── continuous configuration space
    └── docked state space
          ↓
Turn-domain compiler
    ├── state-indexed anchors
    ├── gate atomicity
    ├── bond closure
    ├── swept-path admissibility
    ├── endpoint docking
    └── explicit reverse verification
          ↓
Partial dynamics
    ├── legal partial bijections
    ├── inverse semigroup
    ├── legal-motion groupoid
    ├── state/scramble graph
    └── planning and experiment oracles
          ↓
Derived observations and benchmark artifacts
    ├── exact transformed surfaces
    ├── certified tessellations
    ├── synchronized pixels/channels
    ├── public/private episodes
    ├── targets and evaluators
    └── provenance manifests
```

Each arrow is a compiler stage with a contract. A stage may consume only authoritative output from earlier stages and declared noncanonical run parameters such as camera or lighting.

## 3. The canonical object and its products

The source object is

\[
\mathfrak P=(\mathbb K;B,\Phi,\beta,\mathcal J,\mathcal T,\mathcal O).
\]

Its products divide into four classes.

### 3.1 Topological products

- connected sign-component stratification;
- closure-incidence poset;
- trace-component and intersection complexes;
- chamber adjacency;
- bond quotient and mechanical seam complex.

### 3.2 Geometric products

- exact chamber and piece solids;
- volumes, centroids, inertia, areas, lengths, angles, and offsets;
- exact transformed surfaces at a configuration;
- certified tessellations with error/provenance metadata.

### 3.3 Dynamical products

- continuous admissible configuration space;
- docked state space;
- turn legality domains;
- partial transitions and their reverses;
- inverse semigroup, action groupoid, state graph, and scramble laws.

### 3.4 Observational products

- render channels and videos;
- visibility and occlusion relations;
- public action aliases and disclosure masks;
- benchmark prompts, targets, plans, intervention labels, and evaluator certificates.

## 4. Exact/numerical boundary

### Authoritative exact layer

The following must never depend on floating-point tolerance alone:

- coefficient normalization and equation identity;
- sign and incidence predicates;
- connected-component identity;
- piece partition and bonds;
- state equality and atlas isomorphism claims;
- gate selection and bond closure;
- legality, endpoint docking, and transition identity;
- evaluator ground truth and canonical digests.

### Certified approximation layer

Meshes, pixels, shadows, depth buffers, animation samples, and numerical acceleration structures are derived approximations. They must carry:

- source atlas digest;
- source state digest;
- compiler/renderer identity;
- approximation parameters;
- error or coverage certificate where applicable;
- deterministic seed and camera/sensor metadata.

Approximation may propose candidates to an exact predicate. It may not silently become the predicate.

## 5. Proof-carrying compiler interfaces

A compiler result is a pair

```text
(value, certificate)
```

or

```text
(failure, witness)
```

rather than a value plus an optimistic log line.

Minimum certificate families:

| Stage | Certificate |
|---|---|
| Coefficients | normalized exact representation and sign-decision trace |
| Stratification | nonempty witnesses, sign labels, connectivity and incidence evidence |
| Pieces | bond-component map, regularity, connectedness, disjoint interiors |
| Traces | exact carrier/face intersection and clipping intervals |
| Gate | chamber extrema or quantified no-straddling proof |
| Bonds | incidence-kernel residual `Dβm` |
| Path | quantified collision/constraint proof or explicit collision witness |
| Docking | endpoint congruence/joint/docking proof |
| Transition | source, domain proof, endpoint, reverse, and state digest |
| Mesh | source faces, tessellation map, orientation, and approximation bounds |
| Benchmark | source atlas/state/action digests and target derivation trace |

The independent verifier should be substantially smaller than the compiler. A compiler that can only check itself is an unusually elaborate assertion statement.

## 6. State representation

### Continuous configuration

A configuration is an equivalence class of exact piece placements in `SE(3)^P` satisfying assembly constraints. Global gauge and declared intrinsic decorated-piece symmetries are quotiented explicitly.

### Docked state

A docked state additionally satisfies the atlas docking predicate. It may be serialized by canonical exact placements plus symmetry/gauge normalization. A finite slot/permutation representation is an optional compiled specialization when proved equivalent.

### Current cubic compatibility representation

The current engine's map from piece IDs to signed-permutation matrices remains a valid exact representation for its cubic specialization. A future atlas adapter should prove a bidirectional correspondence between that representation and the compiled atlas orbit. Until then, it is a compatibility representation, not the universal state schema.

## 7. Turn execution contract

A turn template provides:

- action identity and reverse identity;
- state-indexed anchor frame;
- exact gate;
- exact path parameterization;
- endpoint docking relation;
- optional disclosure alias.

Execution is transactional:

1. normalize the requested token/template;
2. freeze the start-state anchor;
3. derive the selected atomic chambers and physical pieces;
4. verify gate atomicity;
5. verify bond closure;
6. verify the full swept path;
7. verify endpoint docking;
8. construct the exact successor;
9. verify the declared reverse;
10. commit only after every invariant passes.

Animation previews are observations of a proposed transition. They are never permission to mutate state.

## 8. Partial dynamics and graph services

The dynamics layer exposes partial transitions, not a global action table that marks failures afterward.

```text
turnDomain(atlas, state, action) -> legality certificate
applyTurn(atlas, state, action)  -> successor + inverse certificate
```

From these primitives, pure services derive:

- legal-action masks;
- bounded or exhaustive state graphs;
- legality strata;
- inverse-semigroup and groupoid summaries;
- shortest paths and planning baselines;
- scramble product automata;
- experiment signatures and information gain.

A blocked action is first-class data with a structured gate/bond/path/docking witness.

## 9. Rendering architecture

Both browser and server renderers consume the same exact compiled surfaces and exact state placements.

```text
(atlas digest, state digest, view, sensor, render parameters)
    ↓
exact visible surface instance
    ↓
certified tessellation
    ↓
software/WebGL rendering
    ↓
image channels + render manifest
```

The render manifest must make it possible to trace every triangle and pixel channel back to an exact piece face. Renderer disagreement becomes a test failure or a declared approximation difference, not a mechanics fork.

## 10. Benchmark architecture

A benchmark item should store references to canonical private artifacts rather than duplicate mechanics in task-specific schemas.

```text
atlas artifact
state artifact
experiment/action history
observation manifest
public disclosure transform
private target derivation
scoring rule
```

The evaluator replays or verifies against the atlas-derived transition system. Planning targets, legal masks, piece trajectories, visibility labels, and active-identification outcomes must not be hand-authored in parallel.

The public/private split is a capability boundary, not a cryptographic claim inside one JavaScript process. Hostile policy execution belongs in a separate process or sandbox.

## 11. API implications

The current stateless REST design remains useful. The target API should separate:

- **source artifacts:** atlas specifications and canonical state references;
- **compiled artifacts:** stratification, pieces, turn domains, graphs, meshes;
- **proof artifacts:** certificates and witnesses;
- **observation artifacts:** image/video channels and manifests;
- **benchmark artifacts:** public items, private targets, evaluation reports.

Large immutable artifacts should live in content-addressed storage. Requests should pass digests plus bounded overrides rather than repeatedly transmitting the entire world in JSON, a ritual computers endure mainly because humans enjoy mailing furniture.

No endpoint should accept an independently supplied piece partition, legal mask, or target transition when the same object is derivable from the atlas.

## 12. Determinism and canonical digests

A canonical digest may be computed only after:

- exact coefficient normalization;
- canonical ordering of cuts, strata, chambers, pieces, and turns;
- gauge and declared-symmetry normalization;
- removal of nonsemantic metadata;
- proof that serialization is injective on the supported isomorphism class, or an explicit weaker identity claim.

Until the canonical-serialization conjecture is resolved for a class, digests should identify normalized serializations, not claim complete atlas-isomorphism classification.

Run timestamps, wall-clock metrics, machine IDs, and cache locations belong in separate run manifests.

## 13. Verification architecture

Three independently testable implementations are preferred where practical:

1. a production compiler;
2. a small certificate checker;
3. a slow reference implementation for bounded fixtures.

Adversarial fixtures should include:

- disconnected components sharing one sign vector;
- coincident/redundant cuts;
- tangencies and zero-area traces;
- cuts with no trace on a selected face;
- bonds that erase visible cut traces;
- gates that straddle one chamber by an algebraically tiny amount;
- paths with safe endpoints but an interior collision;
- state-dependent anchors;
- symmetric pieces with ambiguous raw poses;
- legal partial actions that are not total group generators;
- malformed certificates and stale compiled artifacts.

## 14. Migration from the cubic engine

The migration order is proof-first.

1. Encode the current cubic presets as affine-convex atlases.
2. Prove the atlas stratification reproduces the existing logical cells.
3. Prove bandage closure agrees with the current cluster test.
4. Prove each current quarter turn has the same domain and successor map.
5. Cross-check state hashes through a declared compatibility map.
6. Derive current meshes and render channels from atlas faces.
7. Only then add noncubic bodies, arbitrary cuts, or new joints.

This avoids the classic rewrite strategy of generalizing everything simultaneously and discovering later that the old system was the only test oracle.

## 15. Repository ownership

| Path | Responsibility |
|---|---|
| `research/monograph/` | full mathematical source and compiled research artifact |
| `research/mathematics/` | normative compact definitions, theorem ledger, research ledger |
| `research/claims.json` | machine-readable claim status and dependencies |
| `research/sources/` | literature registry and bibliography |
| `docs/ARCHITECTURE.md` | target derivation and verification architecture |
| `docs/ROADMAP.md` | promotion gates and implementation order |
| current `src/core/` | existing cubic specialization until an atlas implementation is intentionally undertaken |
| renderer/research/API code | current consumers of the existing exact engine; future consumers of compiled atlas artifacts |

## 16. Non-negotiable invariants

1. The atlas is the only source of mechanical truth.
2. Connected components, not bare sign vectors, determine canonical strata.
3. Bonds derive physical pieces; cuts alone do not.
4. A move is a partial path with a domain and reverse, not merely an endpoint permutation.
5. Legality includes the entire swept path.
6. Docked state and continuous configuration are distinct.
7. Meshes and pixels are derived observations.
8. Every failure has a structured witness.
9. Every canonical digest states what equivalence it actually certifies.
10. The current implementation boundary is documented honestly.
