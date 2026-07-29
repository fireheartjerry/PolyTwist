# The Stratified Kinematic Atlas

**Status:** canonical mathematics proposal  
**Date:** 2026-07-29  
**Audit base:** `a970c65ab367b98ea380d48919c449bb63fa8638`

This document is the compact normative specification. The full definitions, proofs, examples, algorithms, and provenance are in `research/monograph/polytwist-monograph.tex`.

## 1. Exact coefficient domain

An exact PolyTwist instance is encoded over an effective ordered coefficient domain `K` with decidable sign. The default target is the field of real algebraic numbers. Floating-point meshes and pixels are derived artifacts and are never authoritative.

## 2. Canonical mechanism object

A **Stratified Kinematic Atlas** is

\[
\mathfrak P=(K;B,\Phi,\beta,\mathcal J,\mathcal T,\mathcal O).
\]

- `B` is a compact, three-dimensional, regular-closed semialgebraic body in \(\mathbb R^3\).
- \(\Phi=(\phi_1,\ldots,\phi_m)\) is an ordered family of continuous oriented semialgebraic cut functions. The carrier of cut \(i\) is \(S_i=B\cap\phi_i^{-1}(0)\).
- \(\beta\) is an admissible bond system joining atomic chambers into rigid physical pieces.
- \(\mathcal J\) is exact assembly data: anchors, fixed bodies, joint relations, clearance rules, nonpenetration, and the docking predicate.
- \(\mathcal T\) is a finite family of exact reversible turn templates.
- \(\mathcal O\) is appearance and sensor data. It may change observations but not mechanics unless explicitly included in a decorated-piece symmetry relation.

The canonical mathematical object is the atlas up to exact rigid isomorphism, not any particular JSON ordering, mesh, camera, or texture.

## 3. Canonical cut stratification

For \(\sigma\in\{-,0,+\}^m\), define

\[
X_\sigma= B\cap\bigcap_{i=1}^{m}\{x:\operatorname{sgn}\phi_i(x)=\sigma_i\}.
\]

The canonical strata are the connected components of every nonempty \(X_\sigma\). Each stratum stores its sign label and its closure-incidence relation

\[
X\preceq Y \quad\Longleftrightarrow\quad X\subseteq\overline Y.
\]

Bare sign vectors are insufficient for curved cuts or nonconvex bodies because one sign condition can have multiple connected components. They become sufficient in the affine-convex specialization, where every strict sign region is convex.

A certified triangulation or cylindrical algebraic decomposition may refine these strata for computation, but the refinement is not the canonical object. Results must quotient back to connected sign components.

## 4. Traces, seams, and topology

The raw boundary trace of carrier \(i\) is

\[
T_i=S_i\cap\partial B.
\]

Trace intersections and closure incidence are inherited from the canonical stratification. For affine cuts on a polyhedral body, every trace segment is computed exactly by intersecting the cut plane with a boundary-face plane and clipping the resulting line against the face inequalities.

A raw trace is not automatically a visible mechanical seam. At a regular trace point, inspect the two adjacent atomic chambers. The trace is a seam exactly when those chambers lie in different physical pieces after the bond quotient. Bonded interfaces disappear from the mechanical seam set; decorative marks remain in \(\mathcal O\).

Thus placement, orientation, angle, offset, endpoint, length, intersection, and topology are derived from \((B,\Phi,\beta)\), not stored as unrelated feature vectors.

## 5. Atomic chambers and physical pieces

The **atomic chambers** are the connected components of

\[
B^\circ\setminus\bigcup_i S_i.
\]

The bond system is a graph or hypergraph over atomic chambers, normally supported on shared codimension-one interfaces. Each admissible bond component \(C\) induces the physical piece

\[
Q_C=\overline{\bigcup_{A\in C}A}.
\]

The atlas validator must prove that every physical piece is a valid regular-closed connected solid and that piece interiors are pairwise disjoint.

Let \(D_\beta\) be any oriented incidence matrix of the bond graph. For a binary chamber selector \(m\),

\[
D_\beta m=0
\]

if and only if the selector is constant on every bonded component. This is the exact bandage-splitting test. The older permutation condition \(P_am=m\) survives only as a finite-slot corollary after an action permutation has already been derived.

## 6. Configuration and docking spaces

For physical pieces \(Q_p\), a raw placement is \(g=(g_p)_p\in SE(3)^{P}\). The continuous admissible configuration space is the quotient

\[
\operatorname{Conf}(\mathfrak P)
=
\{g:\text{anchors, joints, clearance, and interior nonpenetration hold}\}/\sim,
\]

where \(\sim\) removes global gauge and intrinsic decorated-piece symmetries declared by the atlas.

The **docked state space** \(\Omega\subseteq\operatorname{Conf}(\mathfrak P)\) is the exact subset satisfying the docking predicate from \(\mathcal J\). It may be finite, countable, or semialgebraic with positive dimension. Ordinary twisty puzzles usually use a finite orbit inside \(\Omega\).

## 7. Turn templates and legality

A turn template \(a\in\mathcal T\) contains:

1. a state-indexed anchor frame \(F_a(x)\in SE(3)\), frozen at turn start;
2. a semialgebraic gate \(G_a\) in anchor coordinates;
3. a piecewise-semialgebraic rigid path \(\rho_a:[0,1]\to SE(3)\) with \(\rho_a(0)=I\);
4. an endpoint docking predicate and an explicitly declared reverse template \(\bar a\).

The gate classifies each atomic chamber as selected or unselected. A state is in the domain \(D_a\) exactly when all four obligations hold:

- **Gate atomicity:** no atomic chamber straddles the active gate boundary.
- **Bond closure:** \(D_\beta m_x(a)=0\).
- **Swept-path admissibility:** the induced placement path remains in \(\operatorname{Conf}(\mathfrak P)\) for every time parameter.
- **Docking:** the endpoint belongs to \(\Omega\) and satisfies the template's docking relation.

The legality residual is the structured proof object

\[
\Lambda_x(a)=
(r_{\mathrm{gate}},\,D_\beta m_x(a),\,r_{\mathrm{path}},\,r_{\mathrm{dock}}),
\]

not an arbitrary scalar score. Legality is equivalent to the vanishing of all components.

Finite rotations with algebraic endpoint sine and cosine admit exact piecewise-rational half-angle parameterizations, so common axial turns fit the semialgebraic model without treating trigonometric floating point as truth.

## 8. Partial dynamics

Every reversible legal turn induces a partial bijection

\[
\tau_a:D_a\longrightarrow D_{\bar a}.
\]

The generated partial bijections form an inverse subsemigroup of the symmetric inverse monoid on \(\Omega\). The associated legal-motion groupoid has states as objects and reversible legal motion germs as arrows. Its generator-labeled one-skeleton is the scramble/state graph.

If every \(D_a=\Omega\), the partial system collapses to an ordinary group action. Classical unbandaged Rubik-type mechanics are therefore a special case, not the universal starting point.

Because every \(D_a\) is semialgebraic when the atlas data are semialgebraic, a finite turn family induces a finite connected semialgebraic stratification of \(\Omega\) on which the legal-action mask is constant.

## 9. Derivation chain

Every downstream object must be a deterministic derivative of the atlas:

\[
\mathfrak P
\to \text{sign-component stratification}
\to \text{physical pieces}
\to \operatorname{Conf},\Omega
\to \{\tau_a\}
\to \text{legal-motion groupoid}
\to \text{state graph}
\to \text{scramble law and planning tasks}.
\]

In parallel,

\[
(\mathfrak P,x,\text{camera},\text{lighting})
\to \text{exact transformed surfaces}
\to \text{certified mesh}
\to \text{pixels}.
\]

No renderer, benchmark generator, or evaluator may invent an independent state transition or piece partition.

## 10. Canonical invariants

The preferred invariants are exact structures:

- connected sign-component incidence poset;
- affine oriented-matroid covector shadow when applicable;
- chamber adjacency graph and bond quotient;
- piece topology and exact metric geometry;
- atlas automorphism group;
- configuration and docking strata;
- inverse semigroup and legal-motion groupoid;
- orbit, stabilizer, and state-graph structure;
- exact experiment-outcome partitions.

The provisional Slice-Action Code and covariance matrix are retired as foundational objects. They may remain optional diagnostics, but they cannot define a puzzle or support a novelty claim.

## 11. Exact algorithm contract

A conforming compiler should emit proof-carrying artifacts:

- normalized exact input coefficients;
- nonempty-stratum witnesses and sign certificates;
- closure/facet incidence certificates;
- physical-piece regularity and disjoint-interior certificates;
- exact gate extrema or quantified gate proofs;
- bond-kernel certificates;
- swept-collision certificates or counterexample witnesses;
- endpoint docking/congruence certificates;
- transition and inverse certificates;
- canonical hashes derived only after exact normalization.

For affine arrangements in fixed dimension, global arrangement construction has classical \(O(n^d)\) algorithms. For general semialgebraic cuts and swept collision, quantifier elimination supplies a complete fallback, but generic worst-case complexity is severe. The architecture must state that plainly rather than smuggling numerical optimism into a theorem.

## 12. Novelty boundary

Plane-cut puzzle generation, permutation representations, rendering, and higher-dimensional user-defined puzzle simulators all have substantial prior art. PolyTwist's defensible research target is the integrated exact synthesis:

1. connected sign-component cut topology;
2. bond-quotiented physical pieces;
3. semialgebraic configuration and docking spaces;
4. state-indexed exact gate selection;
5. swept-path legality;
6. inverse-semigroup/groupoid dynamics;
7. proof-carrying derivation into rendering, planning, and active system identification.

Whether the full synthesis is novel remains a literature-audit question. Repository-specific definitions and theorems are labeled as such in `research/claims.json`; no novelty is inferred merely because the notation is new.
