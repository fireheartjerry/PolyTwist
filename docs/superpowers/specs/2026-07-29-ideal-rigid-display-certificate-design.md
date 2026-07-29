# Ideal-rigid display certificate

**Status:** approved design checkpoint  
**Scope:** Phase 1 convex planar-cut cubic mechanisms

## Objective

Make the renderer's physical claims machine-checkable without claiming
manufacturability or general continuous collision certification.

The certificate describes an ideal rigid-body display. It does not require a
procedural artifact to copy the seam layout, materials, or silhouette of any
commercial Ghost Cube.

## Contract

Add a pure verifier that consumes a compiled puzzle, an exact engine state, and
optional active-move data. It emits deterministic JSON under
`polytwist.ideal-rigid-display-certificate.v1`.

The certificate checks:

1. canonical geometry passes the independent affine verifier;
2. every exact piece orientation is a proper signed-permutation rotation;
3. logical piece occupancy is bijective;
4. every derived render matrix is a proper rigid transform about the declared
   mechanism origin;
5. an active move selects exactly one logical layer and rotates all selected
   pieces around its declared mechanism axis;
6. the canonical geometry hash is unchanged by state transitions.

The renderer's centroid homothety (`0.962`) and outer-face lift (`0.006`) are
reported as noncanonical presentation parameters. They may improve visible
piece separation, but they never affect geometry hashes, legality, state, or
mechanics.

## Interpretation

For the supported cubic planar-cut adapter, a layer turn preserves mechanism
coordinate along its rotation axis. Selected pieces therefore remain inside
the same axial slab while unselected pieces remain outside it. The certificate
will report this restricted layer-separation invariant.

It will not call that result a general swept-volume collision certificate.
Curved carriers, jumbling, locks, tolerance stacks, hidden cores, friction,
compliance, retention, and arbitrary joint paths remain outside Phase 1.
Bonded nonconvex unions receive rigid-transform checks, but no claim that the
renderer-only centroid contraction is a manufacturing clearance model.

## Integration

- Implement the verifier as a small pure module under `src/render/`.
- Reuse existing affine and engine validation; do not duplicate the geometry
  compiler.
- Include the certificate in research geometry analysis and private
  ground-truth exports, not in mechanics-withheld public observations.
- Keep serialization deterministic and preserve the canonical geometry hash.

## Minimal verification

One focused test will cover a Ghost preset at rest, after a turn, and during a
declared move preview. It must reject one corrupted non-rigid matrix. Existing
geometry, rotation, render-data, research-suite, and browser checks remain the
regression suite.

Acceptance requires:

- the focused test first fails for the missing certificate;
- the implementation passes the focused test;
- the existing research-critical suite remains green;
- a live browser turn leaves the geometry hash unchanged and produces no
  runtime error.
