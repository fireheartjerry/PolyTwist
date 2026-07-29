# PolyTwist Novelty Landscape

**Date:** 2026-07-29  
**Audit base:** `a970c65ab367b98ea380d48919c449bb63fa8638`  
**Source registry:** `research/sources/registry.json`

## 1. Purpose

This document marks the boundary between established mathematics, existing puzzle software, repository-specific synthesis, proved PolyTwist results, and unresolved novelty claims. It is deliberately conservative. A new name for a known object is not a contribution; it is usually just a tax on future readers.

## 2. Established mathematical components

The following ingredients are established and must be cited rather than presented as PolyTwist inventions.

| Area | Established content | Registry sources |
|---|---|---|
| Hyperplane arrangements | Face complexes, region counts, and fixed-dimensional arrangement construction | `SRC-ARR-ZASLAVSKY-1975`, `SRC-ARR-EDELSBRUNNER-OROURKE-SEIDEL-1986` |
| Oriented matroids | Combinatorial encoding of oriented hyperplane arrangements and topological representation | `SRC-OM-FOLKMAN-LAWRENCE-1978` |
| Real algebraic geometry | Finiteness of semialgebraic components, triangulation, sign decomposition, and decision procedures | `SRC-RAG-BASU-POLLACK-ROY-2006`, `SRC-RAG-BOCHNAK-COSTE-ROY-1998` |
| Cylindrical algebraic decomposition | Exact sign-invariant decomposition and quantifier elimination | `SRC-CAD-COLLINS-1975`, `SRC-CAD-ARNON-COLLINS-MCCALLUM-1984` |
| Semialgebraic triviality | Finite parameter stratifications with stable fiber type | `SRC-SA-HARDT-1980` |
| Complexity of quantifier elimination | Doubly exponential generic lower-bound phenomena | `SRC-QE-DAVENPORT-HEINTZ-1988` |
| Configuration-space motion planning | Obstacles and collision constraints represented in configuration space | `SRC-MOTION-LOZANO-PEREZ-1983`, `SRC-MOTION-SCHWARTZ-SHARIR-I-1983`, `SRC-MOTION-SCHWARTZ-SHARIR-II-1983` |
| Partial actions and inverse semigroups | Algebra of partially defined reversible transformations | `SRC-PARTIAL-EXEL-1998`, `SRC-PARTIAL-KELLENDONK-LAWSON-2004` |
| Information gain | Expected information supplied by an experiment | `SRC-INFO-LINDLEY-1956` |
| Rubik-type algorithms | Algorithmic and asymptotic analysis of classical cube families | `SRC-RUBIK-DEMAINE-ETAL-2011` |

PolyTwist uses these theories together. It does not own them.

## 3. Existing puzzle-software capabilities

### 3.1 cubing.js PuzzleGeometry / Twizzle Explorer

First-party documentation describes generation of puzzle geometry, permutations, SVG, and 3D data from symmetric flat cuts of supported base solids. The documented help also records limitations such as unsupported bandaging and jumbling in that interface.

Relevant source IDs:

- `SRC-PRIOR-CUBING-PG-2026`
- `SRC-PRIOR-TWIZZLE-2026`

### 3.2 cubing.js KPuzzle

KPuzzle provides a permutation/orientation execution representation for puzzle states and transformations. It is prior art for clean finite action algebra, not for deriving arbitrary physical mechanisms from cut/assembly geometry.

Relevant source ID: `SRC-PRIOR-KPUZZLE-2026`.

### 3.3 Magic Puzzle Ultimate

Magic Puzzle Ultimate supports broad user-defined puzzle construction with symmetry groups, axes, cutting planes, twists, body boundaries, and higher-dimensional settings. This is important prior art against vague claims such as “the first general puzzle generator” or “the first mathematical puzzle specification.”

Relevant source ID: `SRC-PRIOR-MPU-2026`.

### 3.4 Current PolyTwist/KineScope repository

The audited repository already provides a deterministic cubic specialization with convex geometry, bandages, state-dependent legality, rendering, state graphs, active-hypothesis ranking, benchmark generation, and evaluation.

Relevant source ID: `SRC-REPO-POLYTWIST-2026`.

## 4. Repository-specific definitions

The following are PolyTwist definitions. Definition status is not a novelty claim.

- **Stratified Kinematic Atlas**
  \[
  \mathfrak P=(\mathbb K;B,\Phi,\beta,\mathcal J,\mathcal T,\mathcal O).
  \]
- **Canonical cut stratification:** connected components of all sign conditions plus closure incidence.
- **Mechanical seam quotient:** raw cut traces retained only where adjacent chambers belong to different bonded physical pieces.
- **Turn template:** state-indexed anchor, exact gate, exact rigid path, docking relation, and explicit reverse.
- **Four-obligation legality factorization:** gate atomicity, bond closure, swept-path admissibility, and endpoint docking.
- **Atlas derivation contract:** topology, pieces, state, moves, graph, rendering, and benchmark artifacts derive from one exact source object.
- **Proof-carrying benchmark semantics:** every target and observation carries a derivation path to the canonical atlas/state artifacts.

These definitions are chosen because they expose proof obligations and compose cleanly. Their names should not be advertised as historical discoveries.

## 5. Proved PolyTwist results

The repository-specific theorems are indexed in `research/mathematics/THEOREM_LEDGER.md` and `research/claims.json`. Important examples include:

- finiteness of the connected sign-component stratification under the stated assumptions;
- strict-sign completeness in the affine-convex specialization;
- exact affine trace clipping;
- cuts underdetermine dynamics;
- the bond-incidence kernel criterion;
- legality factorization and semialgebraic turn domains;
- finite constant-legality strata;
- partial-bijection, inverse-semigroup, and group-action reduction results;
- atlas-isomorphism invariance;
- passive boundary nonidentifiability;
- product-automaton scramble laws;
- finite deterministic experiment identifiability.

Most proofs synthesize established mathematics with repository definitions. Their theorem statements and role in the mechanism framework may be new even when proof ingredients are classical.

## 6. Defensible contribution candidate

The strongest current contribution candidate is not any ingredient in isolation. It is the integrated exact architecture:

1. an exact body and oriented cut family;
2. connected sign-component topology rather than unqualified sign vectors;
3. physical pieces obtained by a bond quotient;
4. explicit continuous configuration and docked-state spaces;
5. state-indexed gate selection;
6. legality over the full swept path;
7. reversible partial dynamics represented by an inverse semigroup/groupoid;
8. exact derivation of state graphs, scramble laws, rendering, and benchmark targets;
9. proof certificates and independent verification at every boundary;
10. active mechanism identification evaluated over atlas-level hypotheses rather than merely relabelled move tables.

A publishable novelty claim would need to show that prior systems do not already provide this combination with comparable exactness and derivational guarantees. The current audit supports that as a plausible hypothesis, not a final historical theorem.

## 7. Claims that must not be made

Do not claim:

- the first software to generate puzzles from cuts;
- the first use of planes, axes, symmetry groups, or permutation actions for twisty puzzles;
- the first representation of puzzle states by permutations and orientations;
- the invention of configuration-space collision checking;
- the invention of partial actions, inverse semigroups, groupoids, CAD, or semialgebraic decomposition;
- the first arbitrary or higher-dimensional puzzle simulator;
- that the current implementation already supports arbitrary cut-and-turn mechanisms;
- that generic exact quantifier elimination is practical at benchmark scale;
- that the Slice-Action Code is a canonical mechanism invariant;
- that a new benchmark task name constitutes scientific novelty.

## 8. Retired novelty candidates

### Slice-Action Code

The covariance matrix between finite action supports and sign coordinates may be useful diagnostically. It is coordinate-dependent, downstream, and not expressive enough to define the mechanism. It is retired as a flagship novelty candidate.

### Unified Legality Operator

Packaging several checks into one vector is not, by itself, a deep mathematical contribution. The stronger result is the exact four-obligation factorization tied to geometry, bonds, paths, and docking.

### “Geometry-to-scramble chain” as a slogan

The chain becomes meaningful only when every arrow is formally defined, deterministic, and certified. The phrase alone is not novel.

## 9. Open novelty questions

1. Is there prior work combining cut-stratification topology, bonded-piece quotients, exact swept legality, and partial-action dynamics for mechanical puzzles?
2. Has any puzzle framework made the continuous configuration space and docked partial state graph coequal first-class objects?
3. Has proof-carrying derivation from exact mechanism to multimodal benchmark observations been formalized elsewhere?
4. Are there existing canonical serialization or isomorphism algorithms for a comparable class of cut-and-turn mechanisms?
5. What is the closest robotics or mechanism-design literature on active identification of hidden cut/turn structure from visual interaction?
6. Which specialized collision-certification results can replace generic semialgebraic elimination for puzzle-like axial turns?

These require further primary-source searches before paper claims are frozen.

## 10. Paper-positioning language

Safe current phrasing:

> We introduce a repository-specific exact synthesis, the Stratified Kinematic Atlas, that represents cut topology, bonded physical pieces, continuous assembly constraints, reversible partial turn paths, and derived benchmark observations in one proof-carrying object. The construction combines established tools from arrangements, real algebraic geometry, configuration-space planning, and partial-action algebra. We do not claim novelty for those ingredients individually.

Stronger phrasing should wait for a dedicated literature review and adversarial novelty audit.

## 11. Source-audit protocol

For every prospective novelty statement:

1. write the narrowest falsifiable claim;
2. search primary papers and first-party software documentation;
3. record both supporting and threatening prior art;
4. add source IDs and exact supported claim IDs to the registry;
5. distinguish absence of evidence from evidence of absence;
6. mark the claim `conjecture` until the audit is complete;
7. preserve counterexamples and rejected formulations.
