# PolyTwist theorem ledger

**Canonical audit base:** `a970c65ab367b98ea380d48919c449bb63fa8638`  
**Updated:** 2026-07-29  
**Normative proof source:** `research/monograph/polytwist-monograph.tex`

## Status vocabulary

| Status | Meaning |
|---|---|
| Established | Imported mathematics with a primary or authoritative citation. |
| Definition | Repository-specific object; no novelty or truth claim beyond internal consistency. |
| Proved | Complete proof appears in the monograph under explicit assumptions. |
| Proved example | Exact symbolic example verified by explicit witnesses or algebra. |
| Evidence | Deterministic computation only; not promoted to theorem. |
| Conjecture | Plausible statement without proof. |
| Open | Unresolved algorithmic or scientific problem. |
| Retired | Earlier provisional abstraction retained for provenance but removed from the foundation. |

## A. Foundational imported results

| ID | Result | Status | Source | Role in PolyTwist |
|---|---|---|---|---|
| EST-SA-001 | Semialgebraic sets have finitely many connected components and are closed under projection and Boolean operations. | Established | Basu--Pollack--Roy; Bochnak--Coste--Roy | Finiteness of the canonical sign-component stratification and exact definability of turn domains. |
| EST-SA-TRI-001 | Finite semialgebraic families admit compatible finite triangulations/cell decompositions. | Established | Bochnak--Coste--Roy | Certified computational refinements without confusing the refinement with the canonical object. |
| EST-SA-TRIV-001 | Hardt semialgebraic local triviality. | Established | Hardt 1980 | Structural support for finite parameter stratifications. |
| EST-ARR-001 | Hyperplane arrangements form finite face complexes. | Established | Zaslavsky 1975 | Affine cut specialization. |
| EST-OM-001 | Affine arrangement signs form realizable oriented-matroid covectors after homogenization. | Established | Folkman--Lawrence 1978 | Canonical combinatorial shadow of affine cuts. |
| EST-ALG-ARR-001 | Arrangement construction in fixed dimension runs in classical optimal \(O(n^d)\) time. | Established | Edelsbrunner--O'Rourke--Seidel 1986 | Target algorithm for affine global compilation. |
| EST-QE-001 | Real closed fields admit quantifier elimination; CAD is constructive. | Established | Collins 1975; Basu--Pollack--Roy | Complete fallback for general cut, gate, and collision predicates. |
| EST-QE-LB-001 | Generic real quantifier elimination exhibits doubly-exponential lower-bound behavior. | Established | Davenport--Heintz 1988 | Prevents dishonest complexity claims. |
| EST-CSPACE-001 | Rigid-body motion planning is naturally represented in configuration space. | Established | Lozano-P\'{e}rez 1983 | Continuous mechanical state. |
| EST-MOTION-001 | Semialgebraic configuration-space connectivity supports exact motion planning. | Established | Schwartz--Sharir 1983 | Swept-path legality. |
| EST-PARTIAL-001 | Partial group actions correspond to inverse-semigroup actions. | Established | Exel 1998 | Algebra of state-dependent legal turns. |
| EST-INFO-001 | Expected posterior entropy reduction measures experimental information. | Established | Lindley 1956 | Active system-identification objective. |

## B. Repository-specific definitions

| ID | Definition | Status | Monograph label |
|---|---|---|---|
| DEF-SKA-001 | Stratified Kinematic Atlas \((K;B,\Phi,\beta,\mathcal J,\mathcal T,\mathcal O)\). | Definition | `def:ska` |
| DEF-SIGNCOMP-001 | Connected sign-component stratification with closure-incidence order. | Definition | `def:sign-component-stratification` |
| DEF-TRACE-001 | Raw cut trace and bond-quotiented visible mechanical seam. | Definition | `def:visible-seam` |
| DEF-PIECE-001 | Physical piece as an admissible bond component of atomic chambers. | Definition | `def:physical-piece` |
| DEF-CONF-001 | Continuous configuration space and distinguished docked state space. | Definition | `def:configuration-space` |
| DEF-TURN-001 | Turn template: anchor, gate, semialgebraic rigid path, docking, inverse. | Definition | `def:turn-template` |
| DEF-LEGALITY-001 | Exact four-factor legality predicate and structured residual. | Definition | `def:legal-turn` |
| DEF-ACTION-GROUPOID-001 | Legal-motion inverse semigroup and associated action groupoid. | Definition | `def:legal-motion-groupoid` |
| DEF-ATLAS-ISO-001 | Exact rigid atlas isomorphism preserving cuts, bonds, joints, turns, and observations. | Definition | `def:atlas-isomorphism` |

## C. Proved repository theorems

| ID | Theorem | Status | Dependencies | Consequence |
|---|---|---|---|---|
| THM-SIGN-FINITE-001 | The connected sign-component stratification is finite. | Proved | EST-SA-001, DEF-SIGNCOMP-001 | Arbitrary semialgebraic cut systems still yield finite exact combinatorics. |
| THM-AFFINE-CONVEX-001 | In a convex body with affine cuts, every nonempty strict sign region is convex and connected. | Proved | Convexity only | Explains exactly when bare sign vectors suffice. |
| THM-TRACE-CLIP-001 | Affine cut traces on polyhedral faces reduce to exact line construction and interval clipping. | Proved | Linear algebra | Derives endpoints, lengths, orientations, and incidence without rasterization. |
| THM-CUTS-UNDERDET-001 | Body and cuts alone do not determine dynamics. | Proved | Explicit counterexample | Kinematics must be primitive atlas data, not guessed from seams. |
| THM-BOND-001 | A binary chamber selector respects bonds iff \(D_\beta m=0\). | Proved | Graph incidence | Exact bandage-splitting criterion. |
| THM-LEGALITY-FACTORIZATION-001 | Legal execution is equivalent to gate atomicity + bond closure + path admissibility + docking. | Proved | Definitions | Replaces the provisional scalar/operator view with proof obligations. |
| THM-DOMAIN-SEMI-001 | Every turn domain is semialgebraic when atlas data and paths are semialgebraic. | Proved | EST-QE-001 | Exact state-dependent legality has finite symbolic structure. |
| THM-PARTIAL-BIJECTION-001 | Every reversible turn template induces a partial bijection of docked states. | Proved | Reversed path | The correct algebraic primitive is a partial permutation. |
| THM-INVERSE-SEMIGROUP-001 | Generated legal turns form an inverse subsemigroup of the symmetric inverse monoid. | Proved | THM-PARTIAL-BIJECTION-001 | Handles bandaging, locks, and jumbling without forcing total actions. |
| THM-GROUP-REDUCTION-001 | Total legality reduces the system to an ordinary group action and Schreier graph. | Proved | THM-INVERSE-SEMIGROUP-001 | Classical Rubik mechanics are recovered as a special case. |
| THM-LEGALITY-STRATA-001 | A finite turn family induces a finite connected semialgebraic legality stratification with constant action mask. | Proved | THM-DOMAIN-SEMI-001, EST-SA-001 | Canonical state-dependent legality cells. |
| THM-ISOMORPHISM-001 | Atlas isomorphisms preserve cut incidence, pieces, conjugate dynamics, and labeled state graphs. | Proved | DEF-ATLAS-ISO-001 | Representation-invariant benchmark semantics. |
| THM-BOUNDARY-NONID-001 | One-state boundary traces cannot identify hidden internal mechanisms. | Proved | Explicit interior-cut pair | Active experimentation is mathematically necessary, not decorative benchmark theater. |
| THM-PRODUCT-AUTOMATON-001 | Finite-memory scrambles are exact product-automaton walks; finite-horizon laws are transfer-matrix products. | Proved | Finite graph and DFA | Retains the strongest part of the earlier scramble formalism. |
| THM-FINITE-ID-001 | Finite hypotheses are identifiable iff every pair is separated by an admissible experiment; optimal depth is decision-tree depth. | Proved | Elementary decision-tree argument | Exact target for active system identification. |

## D. Exact worked examples

| ID | Example | Status | Exact certificate |
|---|---|---|---|
| EX-GHOST-A-001 | Rational Ghost Atlas A. | Proved example | Rational orthogonal frame; 27 chamber witnesses; exact primitive plane equations; six clipped boundary traces with exact endpoints and lengths. |
| EX-GHOST-B-001 | Rational Ghost Atlas B. | Proved example | Rational orthogonal frame; 27 chamber witnesses; exact primitive plane equations; five traces on one face and a certified nonintersection for the sixth. |

### Implementation evidence (not a theorem-status change)

At implementation milestone `3062274`, the exact affine compiler reproduces `EX-GHOST-A-001` with 27 atomic chambers, six traces on `X=8/5`, and the stated short `1-` trace endpoints. It also exercises `THM-AFFINE-CONVEX-001`, `THM-TRACE-CLIP-001`, and `THM-BOND-001` through deterministic tests and an independent artifact verifier. This computation is evidence only; no theorem or novelty status is promoted.

The Phase 1 ideal-rigid display certificate additionally checks proper exact
orientations, bijective logical occupancy, actual rigid render matrices, a
common mechanism pivot, and the declared active layer axis. This is
implementation evidence only. It neither promotes nor resolves
`OPEN-PATH-CERT-001` or `OPEN-TOLERANCE-001`.

## E. Retained special cases from the previous ledger

The earlier ledger is not discarded; its correct statements are embedded in the stronger theory.

| Earlier object/result | New status |
|---|---|
| Affine cut planes and clipped traces | Retained as the affine-polyhedral specialization of \((B,\Phi)\). |
| Convex arrangement cells indexed by sign vectors | Retained exactly under the hypotheses of THM-AFFINE-CONVEX-001. |
| Support-cycle theorem for permutation actions | Retained after an action permutation is derived from a legal partial map. |
| Condition \(P_am=m\) | Retained as a finite-slot corollary; no longer the foundational bandage test. |
| Product-automaton and transfer-matrix scrambles | Retained and promoted as THM-PRODUCT-AUTOMATON-001. |
| Rational transition probabilities under rational policies | Retained as an immediate corollary of the transfer-matrix theorem. |
| Restricted Walsh analysis | Optional diagnostic on Boolean selector tables, not a canonical puzzle representation. |
| Slice-Action Code and covariance | **Retired as foundational.** It compresses geometry into a chosen statistic and loses topology, collision, and state dependence. |
| Unified Legality Operator \(\mathcal L(s,a)\) | Replaced by the exact domain predicate and structured residual \(\Lambda_x(a)\). |

## F. Conjectures and open problems

| ID | Statement | Status | Promotion requirement |
|---|---|---|---|
| CONJ-CANONICAL-SERIALIZATION-001 | Generic bounded-degree atlases admit practical exact canonical serialization stable under rigid isomorphism and polynomial in output size. | Conjecture | Formal algorithm, complexity proof, adversarial symmetry cases, independent implementation. |
| OPEN-PATH-CERT-001 | Specialized output-sensitive exact collision certificates for axial polyhedral turns. | Open | Sound-and-complete algorithm, exact degeneracy handling, complexity analysis, verifier. |
| OPEN-RECON-001 | Identifiability classes from passive views versus active interaction. | Open | Observation model, impossibility theorems, positive reconstruction results, calibrated experiments. |
| OPEN-CURVED-CUTS-001 | Practical certified decomposition for curved and nonconvex cuts. | Open | Exact benchmark corpus and proof-carrying compiler. |
| OPEN-TOLERANCE-001 | Robust semantics for kerf, clearance, compliance, and manufacturing tolerance. | Open | A mathematically justified uncertainty set and robust legality theorem. |
| OPEN-GROUPOID-INVARIANTS-001 | Which groupoid invariants best predict planning and system-identification difficulty? | Open | Theoretical relation plus controlled benchmark evidence; no arbitrary feature-vector fishing. |

## G. Proof-dependency spine

```text
semialgebraic closure/finiteness
        |
        +--> sign-component finiteness
        |       +--> pieces and trace topology
        |
        +--> quantified turn domains are semialgebraic
                +--> finite legality stratification

turn template + reverse path
        +--> partial bijection
                +--> inverse semigroup / action groupoid
                        +--> group-action special case
                        +--> state graph
                                +--> product-automaton scrambles
                                +--> planning
                                +--> active identification

atlas isomorphism
        +--> stratum/piece equivalence
        +--> conjugate partial dynamics
                +--> representation-invariant evaluation
```

No theorem may be marked `Proved` in this ledger unless its exact assumptions and proof appear in the monograph and its claim ID appears in `research/claims.json`.
