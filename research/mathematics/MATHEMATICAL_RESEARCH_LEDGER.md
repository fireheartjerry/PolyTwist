# PolyTwist Mathematical Research Ledger

> **Canonical correction, 2026-07-29:** The full normative ledger is
> `PolyTwist_Mathematical_Monograph_Source/research/mathematics/MATHEMATICAL_RESEARCH_LEDGER.md`.
> The earlier material below is retained as research provenance. In particular,
> nonempty affine sign cells are atomic chambers, not necessarily physical
> pieces; physical pieces arise from the bond quotient `β`.

## Implementation Phase 1 record

At milestone base `3062274`, the affine-convex specialization of the Stratified Kinematic Atlas is implemented:

- exact rational normalization of oriented hull and cut planes;
- exact convex B-rep construction and incremental planar clipping;
- atomic strict-sign chambers under `THM-AFFINE-CONVEX-001`;
- exact paired-face adjacency and face-connected bond quotient under `THM-BOND-001`;
- `outer-hull`, `cut-surface`, and `internal-surface` provenance;
- deterministic triangulations, normalized serialization hashes, diagnostics, and certificates;
- an independent artifact verifier;
- exact reproduction of Rational Ghost Atlas A's 27 chambers and six selected-face traces;
- evaluator-private ideal-rigid display certificates checking proper exact
  orientations, bijective occupancy, rigid render matrices, a common pivot,
  and the declared active layer axis.

This is implementation evidence for existing theorems and example `EX-GHOST-A-001`, not a new theorem or novelty claim. Legacy Euler-frame presets cross a declared `rationalized-numerical` source boundary before exact predicates begin.

The display certificate is also implementation evidence, not a proof of
general path admissibility or manufacturing clearance. It does not change the
status of `OPEN-PATH-CERT-001` or `OPEN-TOLERANCE-001`.

## Canonical objective

PolyTwist studies whether multimodal AI agents can infer, actively experiment on, represent, and plan within previously unseen three-dimensional cut-and-turn mechanisms. This is not primarily a conventional Rubik's Cube solver. The scientific target is **active system identification and exact planning in unfamiliar spatial mechanisms**.

The repository should ultimately organize the project under `puzzles/`, `research/`, and `bench/`. Rendered pixels and meshes are observations. The canonical object is mathematical.

## Puzzle definition versus puzzle state

A puzzle definition is

\[
\mathfrak P=(P,\mathcal S,\mathcal A,\mathcal C),
\]

where \(P\subset\mathbb R^3\) is an ambient solid, \(\mathcal S=\{S_i\}\) is a cutting complex, \(\mathcal A\) is a family of finite screw motions, and \(\mathcal C\) is a family of bandage, lock, collision, or state-dependent constraints.

A puzzle state records the exact placement and orientation of the resulting pieces. A scramble is then a measure on action words or policies acting on that state space. These objects must never be conflated.

## Quantitative cutting geometry

Initially use a compact convex polyhedron

\[
P=\{x\in\mathbb R^3:Bx\le c\}.
\]

Represent each cut as an oriented affine plane

\[
S_i=\{x:n_i^\top x=d_i\},\qquad \|n_i\|=1.
\]

The normal \(n_i\) gives tilt and orientation; the offset \(d_i\) gives position. The visible black lines on a Ghost Cube are not primitive decorations. They are boundary traces

\[
L_i=S_i\cap\partial P.
\]

On each planar face \(F\), \(L_{i,F}=S_i\cap F\) is empty, a point, or a line segment. From the plane and face equations one obtains exact endpoints, Euclidean length, direction, face-relative angle, and incidences with edges and other traces.

For \(\sigma\in\{-1,+1\}^m\), define

\[
C_\sigma=P\cap\bigcap_i\{x:\sigma_i(n_i^\top x-d_i)\ge0\}.
\]

The nonempty cells are the physical pieces. Their realized sign set is \(\Sigma\). For affine cuts of convex \(P\), every nonempty cell is convex.

Each cell should carry exact or certified volume, centroid, surface area, inertia tensor, cut-sign vector, face incidences, adjacency, and symmetry orbit.

## Signed cut-incidence matrix and finite coordinate algebra

Index cuts by rows and cells by columns:

\[
S_{ij}=\sigma_j(i)\in\{-1,+1\}.
\]

This signed cut-incidence matrix is the bridge from continuous geometry to finite action algebra.

Represent each action support as a function \(u_a:\Sigma\to\{0,1\}\). Study

\[
\mathcal A_\Sigma=\mathbb Q[x_1,\ldots,x_m]/I(\Sigma)\cong\mathbb Q^\Sigma
\]

using restricted Walsh characters

\[
\chi_T(\sigma)=\prod_{i\in T}\sigma_i.
\]

Every support has a canonical finite polynomial representation. Its minimum degree, harmonic sparsity, Hilbert profile, and parity dimension become quantitative mechanism-complexity statistics.

A proposed repository-specific coupling is the **Slice-Action Code**

\[
K_{ai}=N\sum_{\sigma\in\Sigma}u_a(\sigma)\sigma_i-
\left(\sum_\sigma u_a(\sigma)\right)
\left(\sum_\sigma\sigma_i\right),
\]

where \(N=|\Sigma|\). Equivalently,

\[
K_{ai}=N^2\operatorname{Cov}(u_a,\sigma_i).
\]

It measures how strongly every action support depends on every cut coordinate. Treat this as provisional and repository-specific pending a direct prior-art audit.

## Finite screw actions

A candidate move is a rigid motion \(g_a=(R_a,t_a)\in SE(3)\), usually a rotation about oriented axis \((p_a,u_a)\) through angle \(\phi_a\):

\[
g_a(x)=p_a+R(u_a,\phi_a)(x-p_a).
\]

Its moving region should be derived from a selector \(u_a\), not merely hardcoded as a piece list.

## Unified Legality Operator

Legality must be a mathematical certificate, not a collection of ad hoc conditionals. Separate:

1. support closure;
2. bandage or rigid-cluster closure;
3. induced permutation invariance;
4. endpoint geometric congruence;
5. continuous collision freedom;
6. state-dependent locks and predicates.

If \(m_a\in\{0,1\}^n\) is the support indicator and \(P_a\) the induced cell-permutation matrix, exact support invariance is

\[
P_am_a=m_a.
\]

If \(b_r\) is a rigid-cluster indicator, the move splits that cluster exactly when

\[
0<b_r^\top m_a<b_r^\top\mathbf1.
\]

Define a certificate vector

\[
\Lambda(x,a)=(\lambda_{\rm support},\lambda_{\rm band},\lambda_{\rm perm},\lambda_{\rm congruence},\lambda_{\rm collision},\lambda_{\rm state})\in\{0,1\}^6
\]

and

\[
\mathsf{Legal}(x,a)=\prod_r\Lambda_r(x,a).
\]

The research goal is a legality residual matrix whose legal action columns are exactly the zero-residual columns. Be explicit that endpoint congruence and swept collision freedom require geometric certificates, not merely combinatorial algebra.

## Invariant action-support lattice

For a finite turn permutation \(g\), define

\[
\mathcal L(g)=\{M:gM=M\}.
\]

A support is invariant exactly when it is a union of cycles of \(g\). Hence

\[
\mathcal L(g)\cong2^{\operatorname{Cyc}(g)},
\qquad
P_g(z)=\prod_{C\in\operatorname{Cyc}(g)}(1+z^{|C|}).
\]

Use conjugacy classes, centralizers, Burnside averaging, and output-sensitive enumeration to generate symmetry-inequivalent candidate mechanisms rather than arbitrary impossible ones.

## Geometry-to-scramble chain

The formal pipeline is

\[
(P,\mathcal S)
\longrightarrow
\Sigma,\{C_\sigma\}
\longrightarrow
\{m_a,P_a,\Lambda_a\}
\longrightarrow
\Omega,\{T_a\}
\longrightarrow
B
\longrightarrow
\text{scramble law}.
\]

A scramble is a declared measure on words or policies, not merely an integer depth. Model restrictions with a finite automaton \(\Gamma=(Q,q_0,F,\delta)\), compose it with the exact state graph, and use an integer transfer matrix

\[
c_{t+1}=c_tB.
\]

Compute exact endpoint distributions, admissible-word counts, geodesic probability, expected optimal distance, collision probability, total variation between protocols, and recurrences from the characteristic polynomial.

## Formal AI policy calculus

Represent a solver as an exact rational policy

\[
\pi(a\mid x)\in\mathbb Q_{\ge0},\qquad \sum_a\pi(a\mid x)=1.
\]

It induces

\[
P_\pi(x,y)=\sum_{a:T_a(x)=y}\pi(a\mid x).
\]

For transient submatrix \(Q\), use the exact fundamental matrix \(N=(I-Q)^{-1}\). Let \(d(x)\) be optimal distance and define Bellman slack

\[
\sigma(x,a)=1+d(T_a(x))-d(x).
\]

Then for a stopped trajectory,

\[
N+d(X_N)-d(X_0)=\sum_{t=0}^{N-1}\sigma(X_t,A_t).
\]

Expected accumulated Bellman slack is a central planning-quality metric.

## Flagship benchmark

Give an agent a strict experiment budget. It may choose moves and viewpoints to identify a hidden mechanism. Evaluate exact expected information gain and transfer to unseen states and related geometries.

The core factorial intervention is:

- same appearance / same mechanics;
- same appearance / different mechanics;
- different appearance / same mechanics;
- different appearance / different mechanics.

This distinguishes genuine mechanism learning from visual template matching.

## Source and novelty discipline

Maintain `research/sources/registry.json`, `research/sources/references.bib`, `research/claims.json`, and `research/NOVELTY_LANDSCAPE.md`. Every source must record full metadata, stable identifier, access date, exact supported claim, and implementation/theorem paths. Prefer primary sources.

Do not call the Slice-Action Code, Unified Legality Operator, legality residual matrix, or complete cut-to-scramble chain historically novel until a serious primary-source audit confirms the narrow claim. Distinguish established mathematics, new synthesis, repository definitions, conjectures, and proved repository theorems.

## Immediate mathematics-first agenda

1. Formalize the cut-and-turn mechanism object and all regularity assumptions.
2. Derive exact face-trace endpoints, lengths, directions, angles, and incidences.
3. Prove finiteness and convexity of the affine cell decomposition.
4. Define when a screw motion induces a unique cell permutation.
5. Complete the Unified Legality Operator and classify which components are matrix-decidable.
6. Construct two fully specified, visibly different Ghost-Cube-like examples from exact cut equations.
7. Prove determinism of the cut-to-state-to-scramble pipeline under stated assumptions.
8. Conduct the novelty audit.
9. Write theorem, source, claims, and continuation ledgers.

## Quality bar

Mathematics should pursue olympiad-style elegance: canonical definitions, short invariants, exact correspondences, sharp examples, and honest assumptions. Algorithms should pursue IOI-style rigor: exact arithmetic, output-sensitive complexity, symmetry reduction, robust predicates, proof certificates, deterministic serialization, independent verification, and explicit resource bounds.

## Honesty boundary

Established or straightforward: affine traces, convex arrangement cells, cycle-union supports, permutation-matrix support invariance, product-automaton scramble measures, and rational finite Markov policies.

Provisional repository-specific concepts: Slice-Action Code, Unified Legality Operator packaging, legality residual matrix, and the integrated cut-to-scramble formalism.

Open problems: general exact swept-collision criteria, reconstruction of commercial puzzle geometry from photographs, curved cuts, nonconvex pieces, tolerancing/manufacturability, and the final novelty boundary.
