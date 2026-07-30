# PolyTwist Mathematical Research Ledger

**Canonical status:** active mathematical foundation  
**Date:** 2026-07-29  
**Repository audit base:** `a970c65ab367b98ea380d48919c449bb63fa8638`  
**Normative companion:** `research/monograph/polytwist-monograph.tex`

## 0. Implementation Phase 1 evidence — 2026-07-29

Milestone base `3062274` implements the affine-convex specialization of the atlas:

- primitive integer normalization and exact rational predicates for `B` and `Φ`;
- exact convex B-reps and incremental planar clipping;
- strict-sign atomic chambers justified by `THM-AFFINE-CONVEX-001`;
- exact paired-face adjacency and face-connected bond quotient `β`;
- seam-aware `outer-hull`, `cut-surface`, and `internal-surface` provenance;
- deterministic triangulations, normalized serialization hashes, stage diagnostics, and certificates;
- an independent verifier that does not repeat the arrangement search;
- exact computational reproduction of Rational Ghost Atlas A's 27 chambers and six traces on `X=8/5`.

This is implementation evidence for existing mathematics, especially `EX-GHOST-A-001`; it is not promoted as a new theorem. The generic canonical-serialization conjecture remains open. Legacy Euler-frame inputs are marked `rationalized-numerical`, after which topology predicates are exact.

## 1. Canonical objective

PolyTwist studies exact representation, active identification, and planning for unfamiliar three-dimensional cut-and-turn mechanisms. The target is not a larger catalogue of Rubik-like action tables. It is a mathematical language in which one mechanism object determines:

- cut geometry and cut topology;
- visible traces and mechanically visible seams;
- atomic chambers and bonded physical pieces;
- continuous configurations and docked states;
- state-dependent legal and illegal turns;
- the legal-motion graph, scramble laws, and planning problems;
- certified geometry, meshes, pixels, and evaluator ground truth.

The benchmark is downstream of the mechanism. A benchmark implementation that independently invents pieces, moves, legality, or observations is nonconforming even when its outputs look plausible. Plausibility is how humans traditionally invite silent contradictions into software.

## 2. Claim-status discipline

Every mathematical statement belongs to exactly one status class.

| Status | Meaning |
|---|---|
| **Established** | Imported mathematics with a cited source and no repository novelty claim. |
| **Repository definition** | A canonical term or object introduced for PolyTwist. |
| **Proved theorem** | A repository theorem with an explicit proof and declared dependencies. |
| **Proved example** | A fully specified specimen whose claimed properties are proved exactly. |
| **Computational evidence** | Reproducible evidence that is not promoted to proof. |
| **Conjecture** | A precise unproved statement. |
| **Open problem** | A scoped research target without a claimed answer. |
| **Retired** | A previous abstraction that remains historically documented but is no longer foundational. |

The machine-readable source of truth is `research/claims.json`. The theorem-focused human index is `research/mathematics/THEOREM_LEDGER.md`. Literature provenance lives in `research/sources/registry.json` and `research/sources/references.bib`.

## 3. Canonical mechanism object

A **Stratified Kinematic Atlas** is

\[
\mathfrak P=(\mathbb K;B,\Phi,\beta,\mathcal J,\mathcal T,\mathcal O).
\]

Here:

1. \(\mathbb K\) is an effective ordered exact coefficient domain with decidable sign, normally the real algebraic numbers.
2. \(B\subset\mathbb R^3\) is a compact three-dimensional regular-closed semialgebraic body.
3. \(\Phi=(\phi_1,\ldots,\phi_m)\) is an ordered family of continuous oriented semialgebraic cut functions. Cut \(i\) has carrier
   \[
   S_i=B\cap\phi_i^{-1}(0).
   \]
4. \(\beta\) is an admissible bond system over atomic chambers.
5. \(\mathcal J\) contains exact assembly data: anchors, fixed components, joint relations, clearance and nonpenetration constraints, intrinsic piece symmetries, and docking predicates.
6. \(\mathcal T\) is a finite family of exact reversible turn templates.
7. \(\mathcal O\) contains appearance and sensor data. It changes observations, not mechanics, except where decorated-piece symmetries are explicitly part of the state quotient.

The atlas is canonical only up to exact atlas isomorphism. JSON key order, triangle order, camera conventions, and floating-point tessellation are not mathematical identity.

## 4. Canonical cut stratification

For \(\sigma\in\{-,0,+\}^m\), define the sign condition

\[
X_\sigma=B\cap\bigcap_{i=1}^m\{x:\operatorname{sgn}\phi_i(x)=\sigma_i\}.
\]

The canonical cut strata are the **connected components** of every nonempty \(X_\sigma\), together with their sign labels and closure-incidence order

\[
X\preceq Y\quad\Longleftrightarrow\quad X\subseteq\overline Y.
\]

This component refinement is essential. A single sign vector can describe several disconnected regions for curved cuts or nonconvex bodies. Bare sign vectors become complete only in the affine-convex specialization, because intersections of convex half-spaces are convex.

The atomic chambers are the connected components of

\[
B^\circ\setminus\bigcup_i S_i.
\]

A CAD, triangulation, or other certified decomposition may refine the canonical strata for computation. Such a refinement must be quotiented back to connected sign components before it is hashed or interpreted as mechanism topology.

## 5. Traces, seams, and physical pieces

The raw boundary trace of cut \(i\) is

\[
T_i=S_i\cap\partial B.
\]

Trace placement, direction, angle, offset, endpoints, length, intersections, connected components, and closure incidence are derived from \((B,\Phi)\). For an affine cut on a polyhedral boundary face, the trace is obtained by exact line computation followed by interval clipping against the face inequalities.

A raw trace is not automatically a visible seam. At a regular trace point, inspect the two adjacent atomic chambers. The trace survives as a mechanical seam exactly when the adjacent chambers belong to different physical pieces after the bond quotient.

Let \(G_\beta\) be the bond graph on atomic chambers. Each connected component \(C\) induces a physical piece

\[
Q_C=\overline{\bigcup_{A\in C}A}.
\]

A valid atlas must certify that each \(Q_C\) is a connected regular-closed solid and that distinct piece interiors are disjoint.

If \(D_\beta\) is an oriented incidence matrix of the bond graph and \(m\in\{0,1\}^{\mathcal C}\) selects atomic chambers, then

\[
D_\beta m=0
\]

if and only if the selector is constant on every bonded component. This is the canonical bond-closure invariant.

## 6. Configuration space and docked states

For physical pieces \(Q_p\), a raw placement is \(g=(g_p)_p\in SE(3)^P\). The admissible continuous configuration space is

\[
\operatorname{Conf}(\mathfrak P)
=
\{g:\text{all anchor, joint, clearance, and nonpenetration relations hold}\}/\sim,
\]

where \(\sim\) removes global gauge and declared intrinsic decorated-piece symmetries.

The docked state space \(\Omega\subseteq\operatorname{Conf}(\mathfrak P)\) consists of configurations satisfying the exact docking predicate. It is not assumed finite by definition. Ordinary twisty-puzzle state graphs arise from finite orbits inside \(\Omega\).

This distinction repairs a major conceptual gap in purely permutation-based descriptions: legality concerns a continuous path in configuration space, while a scramble graph records selected docked endpoints.

## 7. Turn templates and exact legality

A reversible turn template \(a\in\mathcal T\) contains:

1. a state-indexed anchor frame \(F_a(x)\in SE(3)\), frozen at turn start;
2. an exact semialgebraic gate in anchor coordinates;
3. a piecewise-semialgebraic rigid path \(\rho_a:[0,1]\to SE(3)\) with \(\rho_a(0)=I\);
4. an endpoint docking relation;
5. an explicitly declared reverse template \(\bar a\).

A docked state \(x\) belongs to the exact domain \(D_a\) precisely when four obligations hold:

- **gate atomicity:** the gate boundary does not cut through an atomic chamber;
- **bond closure:** \(D_\beta m_x(a)=0\);
- **swept-path admissibility:** the entire induced placement path lies in \(\operatorname{Conf}(\mathfrak P)\);
- **endpoint docking:** the endpoint lies in \(\Omega\) and satisfies the template docking relation.

The structured legality residual is

\[
\Lambda_x(a)=
(r_{\mathrm{gate}},D_\beta m_x(a),r_{\mathrm{path}},r_{\mathrm{dock}}).
\]

Legality is equivalent to every component vanishing. This replaces the former six-bit **Unified Legality Operator** packaging. The older conditions are not discarded; they are reorganized under proof obligations whose meanings do not depend on a pre-existing slot permutation.

## 8. Partial algebraic dynamics

A reversible legal turn induces a partial bijection

\[
\tau_a:D_a\longrightarrow D_{\bar a}.
\]

The partial bijections generated by \(\mathcal T\) form an inverse subsemigroup of the symmetric inverse monoid on \(\Omega\). Their action groupoid is the **legal-motion groupoid**. Its generator-labelled one-skeleton is the exact state/scramble graph.

When every turn domain is all of \(\Omega\), this partial system reduces to an ordinary group action and the graph becomes a Schreier graph. Classical unbandaged Rubik-type mechanics are therefore a special case of the atlas, not the universal starting object.

For a finite turn family with semialgebraic data, the legality domains induce a finite connected semialgebraic stratification of \(\Omega\) on which the legal-action mask is constant.

## 9. Promoted results

The following results are promoted to proved status in the monograph and theorem ledger.

| Claim ID | Result |
|---|---|
| `THM-SIGN-FINITE-001` | The connected sign-component stratification is finite under the stated semialgebraic assumptions. |
| `THM-AFFINE-CONVEX-001` | Strict sign vectors index atomic chambers in the affine-convex specialization. |
| `THM-TRACE-CLIP-001` | Affine traces on polyhedral faces are computed by exact line clipping. |
| `THM-CUTS-UNDERDET-001` | Cut geometry alone does not determine the move system. |
| `THM-BOND-001` | \(D_\beta m=0\) exactly characterizes bond-closed selectors. |
| `THM-LEGALITY-FACTORIZATION-001` | Legal turns factor into gate, bond, swept-path, and docking obligations. |
| `THM-DOMAIN-SEMI-001` | Exact turn domains are semialgebraic under the atlas assumptions. |
| `THM-LEGALITY-STRATA-001` | A finite turn family has a finite constant-legality stratification. |
| `THM-PARTIAL-BIJECTION-001` | Every reversible legal turn is a partial bijection. |
| `THM-INVERSE-SEMIGROUP-001` | Generated legal motions form an inverse semigroup. |
| `THM-GROUP-REDUCTION-001` | Total domains recover an ordinary group action. |
| `THM-ISOMORPHISM-001` | Derived topology, dynamics, and observations are invariant under atlas isomorphism. |
| `THM-BOUNDARY-NONID-001` | Passive boundary observations cannot identify hidden internal structure in general. |
| `THM-PRODUCT-AUTOMATON-001` | Finite-memory scramble protocols are exact walks on a product automaton. |
| `THM-FINITE-ID-001` | A finite hypothesis family is deterministically identifiable exactly when its experiment signatures separate every pair. |

The full proofs and exact assumptions are in `research/monograph/polytwist-monograph.tex`. This ledger is an index, not a substitute for the proof text.

## 10. Exact proved specimens

Two exact rational affine-convex specimens are fully specified and proved in the monograph.

- `EX-GHOST-A-001`: a cubic body with a displaced rational orthogonal mechanism frame, six affine cuts, exactly twenty-seven atomic chambers, and six exact traces on a selected face.
- `EX-GHOST-B-001`: an anisotropic box with a different rational orthogonal frame and asymmetric levels, exactly twenty-seven atomic chambers, five exact traces on a selected face, and one globally present carrier with an empty trace on that face.

These examples prove that the formalism handles exact offsets, orientations, intersections, trace lengths, and local invisibility without importing a cubic slot model. They are mathematical specimens, not claims of commercial-puzzle reconstruction.

## 11. Valid results retained from the previous ledger

Several earlier ideas remain correct after being placed at the proper level.

### 11.1 Affine trace geometry

The previous plane/face equations and exact trace calculations are retained as the affine-polyhedral specialization of the new trace theory.

### 11.2 Invariant support lattice

Once a finite endpoint permutation \(g\) has been **derived**, the invariant support family

\[
\mathcal L(g)=\{M:gM=M\}
\]

is exactly the Boolean algebra of unions of cycles of \(g\), with generating polynomial

\[
P_g(z)=\prod_{C\in\operatorname{Cyc}(g)}(1+z^{|C|}).
\]

This remains useful for enumeration and symmetry reduction. It cannot define legality before geometry, support, and endpoint correspondence have been proved.

### 11.3 Product-automaton scramble law

A finite-memory scramble protocol remains a Markov process on the product of the exact state graph and the protocol automaton. Integer transfer matrices provide exact word counts and endpoint distributions.

### 11.4 Rational policy calculus

For a finite exact state graph and rational policy \(\pi\), the induced transition matrix, absorbing-chain fundamental matrix, and accumulated Bellman slack remain valid evaluator tools. They are downstream planning mathematics, not part of the mechanism definition.

## 12. Retired or demoted abstractions

### 12.1 Previous tuple \((P,\mathcal S,\mathcal A,\mathcal C)\)

This tuple was directionally useful but under-specified. It did not canonically distinguish connected sign components, bonds from cuts, continuous configuration space from docked state, or declared motions from their legality domains. It is superseded by the Stratified Kinematic Atlas.

### 12.2 “Nonempty sign cells are the physical pieces”

This is true only for an unbonded affine-convex specialization. In the general theory, sign components are atomic chambers and physical pieces arise after the bond quotient.

### 12.3 Slice-Action Code

The covariance quantity

\[
K_{ai}=N^2\operatorname{Cov}(u_a,\sigma_i)
\]

may remain an optional diagnostic after a finite sign-coordinate system and action support have been derived. It is not canonical, does not define a mechanism, and must not support a novelty claim.

### 12.4 Permutation-first support invariance

The condition \(P_am=m\) is a correct finite-slot corollary, not the root legality invariant. The canonical pre-permutation test is bond closure \(D_\beta m=0\), followed by continuous path and docking verification.

### 12.5 Static screw motions as complete actions

An endpoint element of \(SE(3)\) does not specify a legal turn. The path, state-indexed anchor, gate, domain, docking relation, and reverse are load-bearing data.

## 13. Exact derivation architecture

The canonical derivation chain is

\[
\mathfrak P
\to \text{connected sign strata}
\to \text{physical pieces}
\to \operatorname{Conf}(\mathfrak P),\Omega
\to \{\tau_a\}
\to \mathcal G(\mathfrak P)
\to \text{state graph}
\to \text{scramble, planning, and evaluation}.
\]

The observation chain is

\[
(\mathfrak P,x,\text{camera},\text{lighting})
\to \text{exact transformed surfaces}
\to \text{certified tessellation}
\to \text{pixels}.
\]

Each compiler stage must expose independent verification data. A future implementation must be able to explain whether a failure arose from coefficient normalization, stratum construction, piece regularity, gate atomicity, bond closure, swept collision, docking, or serialization.

## 14. Complexity and algorithmic honesty

- Affine hyperplane arrangements in fixed dimension admit classical output-sensitive constructions with polynomial dependence on arrangement complexity.
- General semialgebraic connected-component, incidence, and quantified collision problems admit exact algorithms through real algebraic geometry and quantifier elimination.
- Generic exact quantifier elimination has severe worst-case complexity. The existence of a decision procedure is not a performance claim.
- Specialized certificates for planes, quadrics, axial turns, convex pieces, and low-dimensional joints are a major algorithmic research target.
- Numerical geometry may accelerate candidate generation, but it cannot silently replace exact predicates in canonical artifacts.

## 15. Novelty boundary

Substantial prior art already covers:

- hyperplane arrangements and oriented matroids;
- semialgebraic decomposition and quantifier elimination;
- configuration-space collision and exact motion planning;
- partial actions, inverse semigroups, and groupoids;
- Rubik-type state graphs and algorithms;
- plane-cut puzzle generation, permutation models, and higher-dimensional puzzle simulators.

PolyTwist's defensible contribution candidate is the integrated proof-carrying synthesis of connected cut topology, bond-derived pieces, semialgebraic configuration/docking spaces, state-indexed gates, swept legality, partial algebraic dynamics, and exact benchmark derivation. Whether that synthesis is publishably novel remains subject to the documented prior-art audit. The project does not obtain novelty by renaming established mathematics and hoping reviewers are sleepy.

## 16. Open problems

1. **Canonical serialization:** prove that a practical exact normal form is complete for atlas isomorphism on a useful nontrivial class.
2. **Specialized swept-collision certificates:** replace generic quantifier elimination for important axial, planar, convex, and low-degree cases.
3. **Atlas reconstruction:** characterize what passive views and active experiments can recover, with identifiability bounds.
4. **Curved carriers:** develop exact component/incidence algorithms for sphere, cone, cylinder, and bounded-degree algebraic cuts.
5. **Jumbling and non-docked motion:** classify mechanisms whose action domains pass through intermediate docking families or positive-dimensional state sets.
6. **Manufacturability:** formalize clearance, tolerance, contacts, hinges, hidden cores, and physically realizable assembly constraints.
7. **Canonical complexity measures:** identify invariants that predict inference and planning difficulty without becoming arbitrary feature vectors.
8. **Independent checker design:** define a compact certificate language whose checker is substantially simpler than the atlas compiler.

## 17. Mathematics-first promotion gates

No general mechanism implementation should be presented as canonical until it passes these gates.

### Gate M1: exact cut schema

- exact coefficient representation and normalization;
- affine and bounded-degree semialgebraic carriers;
- connected sign-component semantics;
- closure-incidence and trace certificates.

### Gate M2: physical-piece semantics

- admissible bonds and bond quotient;
- regularity, connectedness, and disjoint-interior proofs;
- seam derivation after quotienting;
- decorated-piece symmetry declarations.

### Gate M3: configuration and turn semantics

- assembly, anchor, joint, clearance, and docking schema;
- exact state-indexed gate semantics;
- exact rigid path representation;
- explicit reverse-template contract.

### Gate M4: legality and partial dynamics

- gate, bond, swept-path, and docking certificates;
- partial-bijection and inverse validation;
- legal-motion groupoid and state-graph derivation;
- blocked-transition witnesses.

### Gate M5: canonical downstream artifacts

- deterministic exact serialization;
- certified mesh derivation;
- observation provenance;
- scramble/product-automaton derivation;
- benchmark/evaluator targets generated only from atlas artifacts;
- independent checker and adversarial fixture suite.

## 18. Current implementation boundary

At implementation milestone `3062274`, the software implements a disciplined but narrow specialization:

- exact rational affine-convex geometry for bounded polyhedral `B`, planar `Φ`, and face-connected `β`;
- exact chamber adjacency, bond quotient, provenance, traces, deterministic triangulations, hashes, diagnostics, and independent verification;
- cubic logical lattices of size 2 through 9;
- one displaced/rotated orthogonal cut frame;
- signed-permutation piece orientations and quarter-turn generators;
- connected rigid bandages with state-dependent closure tests;
- deterministic rendering, benchmark generation, and analysis derived from the compiled geometry and engine;
- evaluator-private ideal-rigid display certificates over exact state and
  actual render matrices, with renderer clearances explicitly marked
  noncanonical;
- deterministic ideal-rigid closure evidence across 18 artifacts, 234 exact
  states, 9,660 sampled animations, 1,380 committed turns, and 1,380 exact
  inverse restorations.

It does **not** implement the general atlas, curved or general semialgebraic cut carriers, noncubic dynamics, exact swept collision, general joints, jumbling, or the complete proof-carrying dynamics compiler described here.

## 19. Immediate proof agenda

1. Formalize an exact serialization grammar for affine-convex atlases and prove soundness under rigid isomorphism.
2. Derive a complete specialized collision certificate for a convex cap rotating about a carrier-normal axis.
3. Prove a piece-regularity criterion for admissible chamber bonds.
4. Define a minimal atlas certificate bundle and an independently checkable proof kernel.
5. Construct exact noncubic specimens: one dodecahedral face-turner and one state-dependent jumbling example.
6. Formalize observation equivalence and active-identification experiment signatures for finite atlas families.
7. Prove the cubic compatibility map and extend the independent checker beyond the implemented affine geometry certificates.

## 20. Provenance checklist

Before promoting any new statement:

- assign a stable claim ID;
- classify the status honestly;
- list exact assumptions and dependencies;
- cite primary literature for imported mathematics;
- record proof or computation paths;
- add counterexample and failure-boundary notes;
- update the theorem ledger, claims registry, source registry, roadmap, and monograph when load-bearing;
- preserve the old statement only when it remains a valid specialization.
