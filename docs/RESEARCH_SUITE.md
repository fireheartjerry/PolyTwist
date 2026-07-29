# Research suite

KineScope provides a JSON-first experimental system rather than a single fixed benchmark. The design goal is to preserve enough exact information now that later research questions can be answered without regenerating every episode because somebody eventually realizes they wanted piece-level trajectories, camera provenance, or a legality certificate.

## Design principles

1. **Exact private truth:** canonical mechanics, exact states, piece transforms, constraints, and verification certificates remain available to the evaluator.
2. **Controlled public information:** action names, puzzle identity, legality, piece identity, and sensor channels can be disclosed or withheld independently.
3. **Deterministic provenance:** seeds, canonical JSON, public/private digests, engine version, and suite digest make generation reproducible.
4. **Task independence:** one episode can support multiple perception, dynamics, algebra, planning, and calibration tasks.
5. **Observation independence:** the suite stores synchronized render requests; images can be materialized locally or through the server renderer.
6. **Dense output:** reports retain raw per-item records and aggregate summaries. Storage is cheaper than discovering after submission that the one omitted field was the useful one.

## Task catalog

| Task | Family | Primary output | Core question |
|---|---|---|---|
| `state-tracking` | dynamics | exact state fingerprint | Can the model roll the latent state forward? |
| `piece-trajectory` | object permanence | persistent piece paths | Can it track objects through shape change and occlusion? |
| `inverse-dynamics` | dynamics | action | Which hidden transformation occurred? |
| `action-legality` | constraints | boolean | Is the action executable in this state? |
| `action-order` | algebra | integer/closure | How many repetitions return to the state, or where is execution blocked? |
| `commutation` | algebra | boolean/null | Do two transformations commute from this state? |
| `symbolic-mechanics` | system identification | structured model | Can the model induce a reusable action algebra? |
| `active-identification` | active learning | experiment/policy | Which action maximizes expected information gain? |
| `counterfactual-rollout` | causal reasoning | exact state | What changes under an intervention on the action history? |
| `transition-validity` | causal reasoning | boolean | Is a displayed transition consistent with the mechanism? |
| `planning` | planning | action sequence | Can the model reach a verified target state? |
| `viewpoint-invariance` | perception | state equivalence | Does state identity survive camera changes? |
| `appearance-mechanics-disentanglement` | representation | structured relation | Can appearance and transition semantics be separated? |
| `constraint-localization` | constraints | piece set | Which pieces or rigid clusters cause blockage? |
| `reachability` | planning | boolean/certificate | Is a target in the reachable component? |
| `uncertainty-calibration` | metacognition | answer + confidence | Does confidence track actual correctness? |

## Split catalog

- `train`
- `validation`
- `test-iid`
- `test-appearance-ood`
- `test-geometry-ood`
- `test-mechanics-ood`
- `test-compositional-ood`
- `test-adversarial`

A split is attached to every public item and private target. The current procedural policy selects different preset families, appearance interventions, mechanics remappings, bandages, and alien artifact seeds by split. Researchers can replace that policy while retaining the same data contracts and evaluator.

## Factor catalog

The manifest records factors for:

- appearance;
- outer geometry;
- cut-frame alignment;
- mechanics semantics;
- constraints;
- puzzle scale;
- public visibility;
- camera/view regime;
- temporal input;
- scramble depth;
- distribution split.

The included 2×2 appearance/mechanics factorial uses conditions `A0M0`, `A1M0`, `A0M1`, and `A1M1` to isolate changes in visual appearance from changes in action semantics.

## Public/private structure

A generated suite has the top-level schema:

```json
{
  "schema": "kinescope.research-suite.v1",
  "suiteId": "suite-...",
  "engineVersion": "unversioned",
  "configuration": {},
  "catalogs": {},
  "summary": {},
  "public": {
    "episodes": [],
    "items": []
  },
  "private": {
    "episodes": [],
    "targets": [],
    "diagnostics": []
  },
  "provenance": {},
  "publicDigest": "...",
  "privateDigest": "...",
  "suiteDigest": "..."
}
```

### Public episode

A public episode contains:

- opaque episode and puzzle-instance identifiers;
- condition-safe puzzle metadata;
- disclosed or neutralized action alphabet;
- visibility policy;
- observation requests with channel, camera, dimensions, state fingerprint, and synchronization metadata;
- initial state token;
- attempted action trace and public transition receipts.

### Private episode

The paired evaluator episode contains:

- canonical puzzle specification;
- action and piece alias maps;
- exact scramble;
- exact serialized state at each step;
- exact piece trajectories and orientations;
- legal/blocked action diagnostics;
- exact dynamics reports;
- final state and ground truth;
- deterministic provenance digests.

### Public benchmark item

Each item records:

- task and task family;
- split;
- answer type and primary metric;
- task-specific model input;
- episode/puzzle linkage and generation metadata.

### Private target

Each private target stores the expected answer plus task-specific verification data. Planning targets, for example, preserve a reference plan and exact goal state while the evaluator also replays submitted plans against the canonical puzzle.

## Diagnostics

### Geometry report

`analyzePuzzleGeometry` records:

- compiler statistics;
- exact piece counts and bandage counts;
- per-piece volume, area, bounds, centroid, compactness, irregularity, face count, triangle count, exposed-area fraction, and constraint membership;
- aggregate means, variance, quantiles, extrema, Gini coefficients, entropy, and histograms;
- topology checks and observability/leakage metadata;
- stable report digest.

### State graph

`exploreStateGraph` performs bounded exact breadth-first search and records:

- node depths and state fingerprints;
- legal and blocked outgoing actions;
- optional exact serialized states;
- legal/blocked transition edges;
- depth counts, out-degree statistics, legality-pattern counts, and entropy;
- truncation status and deterministic graph digest.

### Mechanics hypotheses

The active-identification module enumerates the 24 proper orientation-preserving signed-axis mappings of the cube frame. It transforms candidate action semantics, simulates candidate experiments, partitions the posterior by predicted observation, and ranks sequences by exact expected information gain.

This is a principled oracle baseline for active system identification, not merely “try moves that seem interesting,” the experimental-design strategy historically favored by both toddlers and underprepared language models.

## Evaluation output

The evaluator emits:

- coverage and unknown prediction IDs;
- per-item status, score, metrics, verification result, latency, token counts, and cost;
- task-level and split-level counts, means, exact successes, missing counts, and resource totals;
- expected calibration error and calibration bins;
- total and mean resource metrics;
- deterministic report digest.

Supported task-aware scoring includes exact match, exact state success, set precision/recall/F1, structured field F1, plan replay, information-gain ratio, Brier score, and ECE.

## JSONL materialization

`npm run research:suite` writes:

```text
manifest.json
public/episodes.jsonl
public/items.jsonl
private/episodes.jsonl
private/targets.jsonl
private/diagnostics.jsonl
```

Pass `--monolithic` to also write `suite.json`. The JSONL form is recommended for large runs because it streams cleanly into Python, DuckDB, Polars, Spark, or whatever data tool is currently being declared the final end of software history.

## Observation materialization

Suite episodes store deterministic render requests rather than embedding every image into the monolithic JSON. A runner can materialize those requests through:

- the browser WebGL2 capture API;
- the local/server `/api/v1/render` endpoint;
- batched render requests through `/api/v1/batch`.

The evaluator-private episode supplies the canonical specification and exact state needed to produce each public observation without leaking those fields to the tested model.
