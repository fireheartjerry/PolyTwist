# PolyTwist Zero-Context Continuation Prompt

You are continuing a serious mathematical AI-research project called **PolyTwist** from its public GitHub repository:

https://github.com/fireheartjerry/PolyTwist

Treat that repository as the canonical shared state. Clone or open it first. Read the repository thoroughly before making changes, especially:

1. `README.md`
2. all files under `research/`
3. all files under `research/mathematics/`
4. `research/mathematics/MATHEMATICAL_RESEARCH_LEDGER.md` completely
5. `research/sources/registry.json`, `research/sources/references.bib`, and `research/claims.json` if present
6. architecture, API, benchmark, validation, and roadmap documents
7. existing tests and schemas
8. the latest Git history

## Project objective

PolyTwist studies whether multimodal AI agents can infer, actively experiment on, represent, and plan within previously unseen three-dimensional twisty-puzzle mechanisms. This is not primarily a standard Rubik's Cube solver. The scientific target is **active system identification and exact planning in unfamiliar cut-and-turn mechanisms**.

The repository should eventually organize work under:

- `puzzles/`: exact puzzle definitions, geometry families, generators, and canonical examples;
- `research/`: mathematical theory, source provenance, experiments, proofs, and papers;
- `bench/`: benchmark tasks, private targets, evaluation, and model results.

Do not treat rendered pixels or triangle meshes as the source of truth. The mathematical mechanism must be canonical, and all rendering and benchmark artifacts must be derived from it.

## Core mathematical distinction

A puzzle definition and a puzzle state are different objects.

Define a mechanism as

\[
\mathfrak P=(P,\mathcal S,\mathcal A,\mathcal C),
\]

where \(P\subset\mathbb R^3\) is an ambient solid, \(\mathcal S=\{S_i\}\) is a quantitative cutting complex, \(\mathcal A\) is a set of finite screw motions or rotation generators, and \(\mathcal C\) contains bandages, locks, collision constraints, and state-dependent legality predicates.

A state records the exact placement and orientation of the resulting pieces. A scramble is a declared measure on action words or policies acting on that exact state space.

## Cutting geometry

Initially model each cut as an affine plane

\[
S_i=\{x:n_i^\top x=d_i\},\qquad \|n_i\|=1.
\]

This must quantitatively determine:

- position through \(d_i\);
- tilt and orientation through \(n_i\);
- visible boundary lines through \(S_i\cap\partial P\);
- exact line-segment endpoints, lengths, directions, and face-relative angles;
- the induced convex cell decomposition.

For \(\sigma\in\{-1,+1\}^m\), define

\[
C_\sigma=P\cap\bigcap_i\{x:\sigma_i(n_i^\top x-d_i)\ge0\}.
\]

The nonempty cells are the physical pieces. The visible black lines on a Ghost Cube are not primitive decorations; they are boundary traces of the cutting surfaces.

## Continuous-to-discrete bridge

Construct the signed cut-incidence matrix

\[
S_{ij}=\sigma_j(i)
\]

with cuts as rows and cells as columns.

Represent action supports as functions on the realized sign set \(\Sigma\), preferably using restricted Walsh characters

\[
\chi_T(\sigma)=\prod_{i\in T}\sigma_i.
\]

Study the finite coordinate algebra

\[
\mathcal A_\Sigma=\mathbb Q[x_1,\ldots,x_m]/I(\Sigma)\cong\mathbb Q^\Sigma.
\]

Every move selector should have a canonical representation and a minimum algebraic degree.

A proposed repository-specific coupling is the **Slice-Action Code**

\[
K_{ai}=N\sum_{\sigma\in\Sigma}u_a(\sigma)\sigma_i-
\left(\sum_\sigma u_a(\sigma)\right)
\left(\sum_\sigma\sigma_i\right),
\]

where \(u_a\) is the move-support indicator and \(N=|\Sigma|\). Equivalently,

\[
K_{ai}=N^2\operatorname{Cov}(u_a,\sigma_i).
\]

Do not claim historical novelty until a thorough primary-source audit is complete.

## Exact legality

The user specifically wants an elegant mathematical operation, matrix, or operator that decides whether a move is legal.

Develop a **Unified Legality Operator** that cleanly separates:

1. support closure;
2. bandage or rigid-cluster closure;
3. permutation invariance;
4. endpoint geometric congruence;
5. continuous collision freedom;
6. state-dependent locks or predicates.

For support indicator \(m_a\) and induced permutation matrix \(P_a\), the exact invariant-support criterion is

\[
P_am_a=m_a.
\]

For rigid-cluster indicator \(b_r\), splitting occurs exactly when

\[
0<b_r^\top m_a<b_r^\top\mathbf1.
\]

Combine primitive certificates into

\[
\Lambda(x,a)\in\{0,1\}^k,
\qquad
\mathsf{Legal}(x,a)=\prod_r\Lambda_r(x,a).
\]

Seek a stronger legality residual matrix whose legal action columns are exactly the zero-residual columns. Be precise about which components reduce to finite algebra and which require continuous geometric verification.

## Action-support search space

For a finite turn permutation \(g\) on the cells, define

\[
\mathcal L(g)=\{M:gM=M\}.
\]

Prove that invariant supports are exactly unions of cycles, hence

\[
\mathcal L(g)\cong2^{\operatorname{Cyc}(g)},
\qquad
P_g(z)=\prod_{C\in\operatorname{Cyc}(g)}(1+z^{|C|}).
\]

Use conjugacy classes, centralizers, Burnside averaging, and output-sensitive enumeration to generate symmetry-inequivalent candidate mechanisms.

## Geometry-to-scramble chain

Make the complete pipeline explicit:

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

A scramble is a measure on words or policies, not merely an integer depth. Model restrictions with a finite automaton \(\Gamma=(Q,q_0,F,\delta)\), compose it with the exact state graph, and use an integer transfer matrix

\[
c_{t+1}=c_tB
\]

to compute exact endpoint laws, admissible-word counts, geodesic probability, total variation between protocols, and recurrences.

## Formal AI evaluation

Represent a solver as a rational policy

\[
\pi(a\mid x)\in\mathbb Q_{\ge0}.
\]

It induces

\[
P_\pi(x,y)=\sum_{a:T_a(x)=y}\pi(a\mid x).
\]

Use exact absorbing-chain calculations when finite. Define Bellman slack

\[
\sigma(x,a)=1+d(T_a(x))-d(x)
\]

and prove the telescoping identity

\[
N+d(X_N)-d(X_0)=\sum_{t=0}^{N-1}\sigma(X_t,A_t).
\]

Expected accumulated Bellman slack should be a central planning-quality metric.

## Flagship experiment

Give a multimodal model a strict experiment budget. It may choose puzzle moves and camera viewpoints to infer a hidden mechanism. Evaluate whether it chooses actions with high exact expected information gain and whether its induced model transfers to unseen states and related puzzle geometries.

The central factorial intervention is:

- same appearance / same mechanics;
- same appearance / different mechanics;
- different appearance / same mechanics;
- different appearance / different mechanics.

This distinguishes true mechanism learning from visual template matching.

## Mathematical and algorithmic quality bar

The user wants olympiad-style elegance and IOI-level rigor.

Mathematics:

- choose definitions that make strong results concise;
- prefer invariants, exact correspondences, canonical normal forms, and short proofs;
- state every assumption explicitly;
- include sharp examples and counterexamples;
- distinguish theorems, conjectures, computational evidence, and design proposals.

Algorithms:

- exact arithmetic where practical;
- output-sensitive geometry algorithms;
- symmetry and group-action reductions;
- robust geometric predicates;
- proof certificates and deterministic digests;
- independent verifiers;
- explicit complexity and resource limits;
- never silently replace exact computation with approximation.

## Scientific provenance

Track every source. Maintain or create:

- `research/sources/registry.json`
- `research/sources/references.bib`
- `research/claims.json`
- `research/NOVELTY_LANDSCAPE.md`

Every source must record complete metadata, stable identifier, access date, exact supported claim, and implementation/theorem paths. Prefer primary sources. Label repository-specific statements honestly and do not claim novelty without direct prior-art comparison.

## Immediate assignment

This round is **mathematics-first**. Do not begin by editing renderer or UI code.

1. Inspect and audit the repository and current mathematical documents.
2. Preserve all useful existing work.
3. Formalize the complete cut-and-turn mechanism object and its regularity assumptions.
4. Derive exact formulas for boundary slice traces: endpoints, lengths, directions, face angles, and incidences.
5. Formalize the cell decomposition and signed cut-incidence matrix.
6. Develop the Unified Legality Operator and determine exactly which conditions reduce to matrix identities.
7. Prove the support-cycle theorem and seek additional concise structural results.
8. Connect geometry formally to the exact state graph and scramble transfer matrix.
9. Construct two fully specified, visibly different Ghost-Cube-like examples from exact cut equations, not hand-authored meshes.
10. Perform a deep novelty and prior-art audit using primary sources.
11. Write detailed Markdown and LaTeX-ready mathematics into the repository.
12. Update the theorem ledger, source registry, claims ledger, and roadmap.
13. Run all relevant symbolic checks and tests, commit meaningful progress, and push it to GitHub.

Audit aggressively for degenerate cuts, ambiguous cell matching, non-unique induced permutations, collision failures, hidden assumptions, and overstated novelty.

At the end, provide:

- precise new definitions and theorems;
- a provenance table separating established and repository-specific results;
- unresolved mathematical risks;
- files changed;
- checks run;
- commit SHA;
- prioritized continuation checklist.
