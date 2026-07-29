# Benchmark protocol

This protocol describes a first paper-scale use of KineScope. It is intentionally stricter than “show several cube images to several models and report whichever percentage looks least embarrassing.”

## Core research question

> Can a multimodal agent actively infer, represent, and transfer the latent mechanics of an unfamiliar three-dimensional system from limited visual interaction?

## Primary hypotheses

1. **Active identification:** model-selected experiments reduce mechanics uncertainty more efficiently than passive demonstrations or fixed action sweeps.
2. **Symbolic abstraction:** a learned action representation supports longer-horizon prediction and planning than direct frame-to-frame prediction alone.
3. **Disentanglement:** models preserve inferred mechanics across appearance changes and reject false transfer when visually similar objects implement different mechanics.
4. **State-dependent constraints:** rigid bandages and changing legality expose failures that remain hidden on unconstrained cubes.
5. **OOD transfer:** performance degrades differently under appearance, geometry, mechanics, and compositional shifts.

## Experimental conditions

### Information regimes

- fully disclosed mechanics;
- notation withheld;
- identity withheld;
- fully withheld mechanics;
- optional legality-query condition;
- optional active-view condition.

### Interaction budgets

Report action, view, observation-channel, and token budgets separately. A model that obtains fifty views and two hundred experiments should not be compared to one receiving a single image under the shared scientific unit “attempt,” unless arithmetic has finally been abolished.

Recommended pilot budgets:

- 0, 2, 5, and 10 mechanics experiments;
- 1, 3, and 6 camera views;
- shallow, medium, and deep planning horizons;
- at least three independent generation seeds per condition.

### Baselines

- random legal action;
- fixed canonical sweep;
- passive demonstration only;
- oracle expected-information-gain policy;
- exact-state planner with disclosed mechanics;
- text-only symbolic condition;
- image-only or language-suppressed condition where supported.

## Dataset splits

Use development data from `train` and `validation`. Keep test mechanics and exact targets private.

Report:

- `test-iid`;
- `test-appearance-ood`;
- `test-geometry-ood`;
- `test-mechanics-ood`;
- `test-compositional-ood`;
- `test-adversarial`.

The most important comparison is the interaction between model, information regime, and split, not a single averaged score that allows excellent color recognition to compensate for catastrophic mechanics induction.

## Leakage controls

The tested policy must not receive:

- canonical puzzle specification;
- action alias map;
- exact piece transforms;
- private state hash;
- constraint definitions;
- evaluator dynamics;
- private targets;
- server render metadata that includes evaluator-only identifiers.

Public state fingerprints are opaque and compact. Public observation requests may reference opaque state tokens but should not encode piece IDs or action semantics.

The browser reference harness should expose only `window.kineScopeAgent`. Server-side runners should place private generation/evaluation in a process or trust boundary inaccessible to the model.

## Output contract

Predictions should be JSON, even when a natural-language rationale is also collected. Each record should include:

```json
{
  "itemId": "item-...",
  "answer": {},
  "confidence": 0.0,
  "latencyMs": 0,
  "inputTokens": 0,
  "outputTokens": 0,
  "costUsd": 0.0,
  "metadata": {
    "model": "...",
    "promptVersion": "...",
    "attempt": 0
  }
}
```

Free-form rationales can support qualitative analysis but should not be the primary score. Grading beautifully narrated confusion is not system identification.

## Metrics

Report at minimum:

- exact state success;
- legality balanced accuracy;
- inverse-dynamics accuracy;
- symbolic field F1;
- normalized information gain;
- planning goal success and plan length;
- transition-validity balanced accuracy;
- constraint-localization set F1;
- reachability verified accuracy;
- calibration error and Brier score;
- action/view efficiency;
- latency, token use, and estimated cost.

For each metric, report mean, confidence interval across episodes/seeds, per-split result, and failure count. Pairwise tests should respect shared generated instances when conditions are paired.

## Ablations

Recommended ablations:

- remove multi-view input;
- remove active action selection;
- expose canonical notation;
- expose legality mask;
- replace Ghost/Axis geometry with ordinary cubes;
- remove bandages;
- hold appearance constant while changing mechanics;
- hold mechanics constant while changing appearance;
- remove symbolic intermediate output;
- perturb camera calibration;
- corrupt one transition and measure detection.

## Human comparison

A small human study can record action choices, requested views, time, confidence, and induced symbolic descriptions. The scientifically useful comparison is strategy and sample efficiency, not declaring a winner in the ancient competition between biological and silicon confusion.

## Reproducibility package

Release together:

- source commit and engine version;
- frozen public development suite;
- private test generator or delayed private targets;
- suite configuration and all seeds;
- OpenAPI/schema snapshots;
- model prompts and tool wrappers;
- raw predictions and traces;
- evaluation reports;
- environment, hardware, latency, token, and cost metadata;
- a clear list of post-hoc analyses.
