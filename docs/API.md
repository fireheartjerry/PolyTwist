# KineScope REST API

The KineScope API is a stateless interface over the exact mechanics engine, research-suite generator, evaluator, and deterministic CPU renderer. The base path is:

```text
/api/v1
```

Every JSON response uses an envelope:

```json
{
  "ok": true,
  "requestId": "...",
  "data": {}
}
```

Errors use:

```json
{
  "ok": false,
  "requestId": "...",
  "error": {
    "code": "KineScope_INVALID_JSON",
    "message": "...",
    "details": null
  }
}
```

The API accepts `x-request-id`, permits cross-origin GET/POST requests, disables response caching, and limits request bodies to 20 MiB. Exact states are serialized into requests and responses, so no server session is required.

## Endpoint inventory

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Runtime and version metadata |
| GET | `/capabilities` | Full research capability manifest |
| GET | `/openapi.json` | OpenAPI 3.1 document |
| GET | `/schemas` | JSON Schema catalog and inline schemas |
| GET | `/presets` | Built-in and procedural preset catalog |
| GET | `/presets/:id` | Canonical preset specification and geometry report |
| POST | `/compile` | Compile a specification and return geometry diagnostics |
| POST | `/state/create` | Create, scramble, and optionally roll out an exact state |
| POST | `/state/transition` | Apply one exact action atomically |
| POST | `/state/rollout` | Apply a sequence with optional continuation after blocked actions |
| POST | `/state/analyze` | Dynamics, geometry, and optional exact ground truth |
| POST | `/graph/explore` | Bounded exact breadth-first state graph |
| POST | `/hypotheses/rank` | Active experiment ranking over candidate mechanics |
| POST | `/episode/generate` | Public/private interaction episode |
| POST | `/suite/generate` | Full multi-task benchmark suite |
| POST | `/evaluate` | Score predictions against private targets |
| POST | `/render` | Deterministic PNG or base64 observation |
| POST | `/batch` | Up to 64 API operations in one request |

## Canonical compilation

`POST /compile` returns a bounded `canonicalGeometry` summary containing:

- schema and exactness boundary;
- hull, cut, chamber, adjacency, piece, surface, and trace counts;
- normalized-input and compiled-geometry SHA-256 hashes;
- stage diagnostics and stated complexity;
- the independent verifier result.

The full artifact is omitted by default. Request it explicitly:

```json
{
  "preset": "ghost-3",
  "includePieces": false,
  "includeFaces": false,
  "includeCanonicalGeometry": true
}
```

The returned `canonicalGeometry.artifact` follows `polytwist.affine-geometry.v1`. Exact `BigInt` values use canonical decimal strings with an `n` suffix, for example `"37n"`. The schema is available through `/schemas` and at `schema/affine-geometry.schema.json`.

## Selecting a puzzle

Most POST endpoints accept either a built-in preset:

```json
{
  "preset": "ghost-3",
  "seed": "optional-procedural-seed"
}
```

or a complete specification:

```json
{
  "spec": {
    "id": "artifact-001",
    "name": "Artifact 001",
    "family": "custom",
    "description": "A custom research object.",
    "size": 3,
    "outer": { "halfSize": [1.5, 1.5, 1.5] },
    "mechanism": {
      "origin": [0.04, -0.03, 0.02],
      "eulerDeg": [7, -9, 5],
      "cutSpacing": 1
    },
    "appearance": { "palette": "ghost" }
  }
}
```

## Exact state lifecycle

Create a state:

```http
POST /api/v1/state/create
```

```json
{
  "preset": "bandaged-relay-3",
  "scrambleDepth": 8,
  "seed": "episode-17"
}
```

The response includes `state`, `generatedScramble`, and a public summary. Pass the exact `state` back to later calls:

```http
POST /api/v1/state/transition
```

```json
{
  "preset": "bandaged-relay-3",
  "state": { "schema": "kinescope.state.v1", "...": "..." },
  "action": "R",
  "includeGroundTruth": true
}
```

Illegal state-dependent actions return `accepted: false` and preserve the input state. This is a normal mechanics result, not an HTTP error.

## Rendering

### Raw PNG

```http
POST /api/v1/render?format=png
```

```json
{
  "preset": "ghost-3",
  "sequence": ["R", "U", "R'"],
  "mode": "piece",
  "width": 512,
  "height": 512,
  "camera": {
    "yaw": 0.72,
    "pitch": 0.38,
    "distance": 8.15,
    "fovDegrees": 38,
    "target": [0, 0.08, 0]
  },
  "format": "png"
}
```

The response body is `image/png`. Dense render metadata is base64url-encoded in the `x-kinescope-metadata` header.

### JSON plus base64 PNG

Set `format` to `json` or omit it. The response contains:

```json
{
  "metadata": {
    "mode": "piece",
    "width": 512,
    "height": 512,
    "stateFingerprint": "lml1-...",
    "imageDigest": "kinescope-png1-...",
    "statistics": {}
  },
  "image": {
    "mediaType": "image/png",
    "encoding": "base64",
    "data": "..."
  }
}
```

## Research generation

### Episode

```http
POST /api/v1/episode/generate
```

```json
{
  "preset": "bandaged-relay-3",
  "seed": "pilot-001",
  "scrambleDepth": 4,
  "horizon": 8,
  "visibility": "fully-withheld",
  "channels": ["studio", "piece", "normal", "depth"],
  "includeDynamics": true
}
```

The response contains separate `public` and `private` objects. The public object uses opaque aliases and observation requests. The private object preserves canonical mechanics, exact states, trajectories, and evaluator metadata.

### Suite

```http
POST /api/v1/suite/generate
```

```json
{
  "seed": "paper-v1",
  "splits": [
    "validation",
    "test-iid",
    "test-geometry-ood",
    "test-mechanics-ood",
    "test-compositional-ood",
    "test-adversarial"
  ],
  "episodesPerSplit": 4,
  "horizon": 8,
  "scrambleDepth": 6,
  "includeDiagnostics": true
}
```

The response includes all public episodes/items and private targets/diagnostics. Large production suites should generally be generated from the CLI and stored as JSONL rather than lovingly forcing one enormous JSON object through every layer of the internet.

## Evaluation

```http
POST /api/v1/evaluate
```

```json
{
  "suite": { "schema": "kinescope.research-suite.v1", "...": "..." },
  "predictions": [
    {
      "itemId": "item-state-tracking-...",
      "answer": { "finalFingerprint": "lml1-..." },
      "confidence": 0.82,
      "latencyMs": 413,
      "inputTokens": 2400,
      "outputTokens": 61,
      "costUsd": 0.014
    }
  ],
  "strictCoverage": true
}
```

Task-specific scorers verify plans by replay, compare structured mechanics fields, compute set precision/recall/F1, evaluate exact states, and aggregate calibration and resource use.

## Batch execution

```http
POST /api/v1/batch
```

```json
{
  "continueOnError": true,
  "operations": [
    { "path": "/state/create", "body": { "preset": "classic-2" } },
    { "path": "/render", "body": { "preset": "ghost-2", "mode": "depth", "width": 128, "height": 128 } },
    { "path": "/hypotheses/rank", "body": { "preset": "ghost-3", "maxSequenceLength": 2 } }
  ]
}
```

Binary render results are converted to base64 within batch responses.

## Deployment model

The API runs locally through `scripts/serve-api.mjs` and on Vercel through the handlers in `api/`. It uses Node runtime features for PNG compression and otherwise keeps no mutable server state. This makes horizontal scaling straightforward and means a worker dying between requests does not erase a precious secret simulator session, because the exact state travels with the request like an adult.
