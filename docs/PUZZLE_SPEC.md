# Puzzle specification reference

A `PuzzleSpec` is the canonical source for a compiled artifact. Specifications are ordinary JSON and can be edited in the in-app **SPEC** dialog or passed to `compilePuzzle()`.

## Top-level fields

| Field | Required | Meaning |
|---|---:|---|
| `id` | yes | stable machine identifier |
| `name` | yes | human-readable name |
| `family` | yes | experimental family label |
| `description` | yes | concise condition description |
| `size` | yes | cubic logical size, integer `2…9` |
| `outer` | yes | convex external hull |
| `mechanism` | yes | latent cut frame and spacing |
| `moves` | no | custom action generators; defaults to six outer faces |
| `constraints` | no | exact rigid-piece unions and other legality constraints |
| `appearance` | yes | material and palette parameters |
| `validation` | no | topology expectations |
| `metadata` | no | arbitrary experiment annotations |

## Outer hull

### Box shorthand

```json
{
  "outer": {
    "halfSize": [1.5, 1.5, 1.5],
    "chamfer": 0.04,
    "cornerChamfer": 0.03
  }
}
```

`halfSize` gives positive half-extents along world X/Y/Z. `chamfer` adds twelve edge-cut planes. `cornerChamfer` adds eight corner-cut planes.

### Explicit half-spaces

```json
{
  "outer": {
    "planes": [
      { "normal": [1, 0, 0], "constant": 1.5, "tag": "outer:+x" },
      { "normal": [-1, 0, 0], "constant": 1.5, "tag": "outer:-x" },
      { "normal": [0, 1, 0], "constant": 1.5, "tag": "outer:+y" },
      { "normal": [0, -1, 0], "constant": 1.5, "tag": "outer:-y" },
      { "normal": [0, 0, 1], "constant": 1.5, "tag": "outer:+z" },
      { "normal": [0, 0, -1], "constant": 1.5, "tag": "outer:-z" }
    ]
  }
}
```

Each plane uses the feasible convention `normal · point ≤ constant`. Normals are normalized during compilation and constants are scaled accordingly. Planes must enclose a bounded, nondegenerate convex volume.

## Mechanism frame

```json
{
  "mechanism": {
    "origin": [0.045, -0.035, 0.025],
    "eulerDeg": [7.5, -9.5, 5.5],
    "cutSpacing": 1.01
  }
}
```

- `origin` is the world-space pivot and cut-frame origin.
- `eulerDeg` is `[xPitch, yYaw, zRoll]`, applied as `Rz · Ry · Rx`.
- `cutSpacing` is the distance between adjacent logical cut planes.

Keeping the external hull fixed while changing this frame changes geometry and turn axes without changing the exact cubic coordinate algebra.

## Moves

When `moves` is omitted, the compiler creates `R L U D F B` on the six exterior layers.

```json
{
  "moves": [
    { "id": "XMAX", "label": "x outer", "axis": 0, "layer": "max", "quarterTurns": -1 },
    { "id": "XIN", "label": "x inner", "axis": 0, "layer": 1, "quarterTurns": -1 },
    { "id": "YMIN", "label": "y outer", "axis": 1, "layer": "min", "quarterTurns": 1 }
  ]
}
```

- `id` must match `[A-Z][A-Z0-9_-]*` after uppercasing.
- `axis` is `0`, `1`, or `2` in the mechanism frame.
- `layer` is `min`, `max`, or a valid odd/even logical coordinate for the selected size.
- `quarterTurns` is a nonzero integer.

Tokens support inverse and double suffixes: `XIN'`, `XMAX2`. Exact move IDs are resolved before suffix parsing.

## Rigid bandages

Bandages make action legality depend on the exact current state:

```json
{
  "constraints": {
    "bandages": [
      {
        "id": "north-bridge",
        "label": "North bridge",
        "cells": [[2, 2, 2], [2, 1, 2]]
      }
    ]
  }
}
```

`cells` use zero-based `[x,y,z]` lattice indices. The compiler requires every bandage to:

- contain at least two visible cells;
- form one six-neighbor, face-connected cluster;
- remain within the declared puzzle size;
- contain no duplicate cells;
- share no cell with another bandage.

For a move to be legal, every rigid cluster must be wholly selected or wholly unselected. Since selection is evaluated from current exact coordinates, the legal action mask can change after each move. The compiled cluster also stores a volume-weighted centroid used to render the bonded pieces as one visual assembly.

## Public metadata overrides

When mechanics are withheld, agent observations intentionally replace the canonical `id`, `name`, `family`, and `description` with generic public values. A dataset may provide stable condition-safe overrides in `metadata`:

```json
{
  "metadata": {
    "publicId": "eval-artifact-0042",
    "publicName": "Artifact 0042",
    "publicFamily": "held-out-spatial-system",
    "publicDescription": "Infer the available transformations."
  }
}
```

These fields affect only the agent/public view. The compiler, evaluator API, and private episode record preserve the canonical specification. Without overrides, KineScope derives a stable opaque artifact ID and uses a generic description.

## Appearance

```json
{
  "appearance": {
    "palette": "alien",
    "bodyColor": [0.015, 0.02, 0.03],
    "outerColor": [0.45, 0.28, 0.75],
    "accentColor": [0.2, 0.9, 0.75],
    "roughness": 0.24,
    "metallic": 0.7,
    "seed": "material-variant-17"
  }
}
```

Colors are linear-ish RGB triples in `[0,1]`. `palette: "classic"` applies axis-dominant sticker colors. Other palettes use deterministic piece/face variation around `outerColor` and `accentColor`.

## Validation

```json
{
  "validation": {
    "expectedRenderable": 26,
    "strictTopology": true
  }
}
```

A logical lattice includes interior cells. A cell is renderable when its compiled polyhedron has exposed outer area. The default expected renderable count is:

```text
N³ - max(0, N-2)³
```

With `strictTopology: true`, a mismatch rejects compilation rather than silently contaminating a dataset.

## JSON Schema

A machine-readable schema is available at [`schema/puzzle-spec.schema.json`](../schema/puzzle-spec.schema.json). The compiler remains the definitive validator for geometric boundedness and topology because JSON Schema, tragically, cannot determine whether a set of planes encloses a valid polyhedron.
