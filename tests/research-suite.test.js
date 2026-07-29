import test from 'node:test';
import assert from 'node:assert/strict';

import { createPreset } from '../src/core/presets.js';
import { createResearchManifest } from '../src/research/manifest.js';
import { analyzePuzzleGeometry } from '../src/research/geometry-analysis.js';
import { exploreStateGraph } from '../src/research/state-graph.js';
import {
  enumerateCubeMechanicsHypotheses,
  rankMechanicsExperiments,
} from '../src/research/mechanics-hypotheses.js';
import { generateResearchEpisode } from '../src/research/episode.js';
import { generateResearchSuite, suiteAsJsonl } from '../src/research/dataset.js';
import { evaluatePredictions } from '../src/research/evaluator.js';
import { TASK_CATALOG } from '../src/research/catalog.js';


test('research manifest and geometry reports are deterministic and dense', () => {
  const first = createResearchManifest();
  const second = createResearchManifest();
  assert.deepEqual(first, second);
  assert.equal(first.platform.name, 'KineScope');
  assert.equal(first.research.tasks.length, 16);
  assert.ok(first.api.endpoints.length >= 15);

  const geometry = analyzePuzzleGeometry(createPreset('ghost-3'));
  assert.equal(geometry.schema, 'kinescope.geometry-analysis.v1');
  assert.equal(geometry.pieces.length, 27);
  assert.equal(geometry.topologyChecks.allPositiveVolume, true);
  assert.ok(geometry.distributions.volume.summary.count > 0);
  assert.match(geometry.reportDigest, /^kinescope-geometry1-/);
});


test('bounded state graph records state-dependent legality without mutating mechanics', () => {
  const graph = exploreStateGraph(createPreset('bandaged-relay-3'), {
    maxStates: 64,
    maxDepth: 2,
    includeTransitions: true,
  });
  assert.equal(graph.schema, 'kinescope.state-graph.v1');
  assert.ok(graph.summary.nodeCount > 1);
  assert.ok(graph.summary.blockedTransitions > 0);
  assert.ok(graph.summary.uniqueLegalityPatterns > 1);
  assert.ok(graph.edges.some((edge) => edge.legal === false));
});


test('active mechanics discovery enumerates 24 proper cube hypotheses and ranks experiments', () => {
  const hypotheses = enumerateCubeMechanicsHypotheses();
  assert.equal(hypotheses.length, 24);
  assert.equal(new Set(hypotheses.map((entry) => entry.matrix.join(','))).size, 24);
  const ranking = rankMechanicsExperiments(createPreset('ghost-3'), {
    maxSequenceLength: 2,
    maxExperiments: 12,
  });
  assert.equal(ranking.hypothesisCount, 24);
  assert.equal(ranking.experiments.length, 12);
  assert.ok(ranking.experiments[0].informationGainBits > 0);
  assert.ok(ranking.experiments[0].informationGainBits >= ranking.experiments.at(-1).informationGainBits);
});


test('public episodes withhold exact mechanics while private episodes preserve them', () => {
  const episode = generateResearchEpisode(createPreset('bandaged-relay-3'), {
    seed: 'episode-test',
    scrambleDepth: 1,
    horizon: 3,
    visibility: 'fully-withheld',
  });
  const publicJson = JSON.stringify(episode.public);
  assert.equal(episode.public.puzzle.family, 'withheld');
  assert.ok(episode.public.puzzle.actionAlphabet.every((action) => /^A\d+$/.test(action)));
  assert.equal(publicJson.includes('canonicalPuzzleSpec'), false);
  assert.equal(publicJson.includes('aliasToCanonical'), false);
  assert.equal(publicJson.includes('orientation'), false);
  assert.ok(episode.private.canonicalPuzzleSpec.constraints.bandages.length > 0);
  assert.equal(episode.private.steps.length, episode.public.steps.length);
});


test('research suite spans every task and exports JSONL partitions', () => {
  const options = {
    seed: 'suite-test',
    splits: ['validation'],
    episodesPerSplit: 1,
    horizon: 3,
    scrambleDepth: 1,
    includeDiagnostics: false,
  };
  const first = generateResearchSuite(options);
  const second = generateResearchSuite(options);
  assert.equal(first.suiteDigest, second.suiteDigest);
  assert.deepEqual(first.public, second.public);
  for (const task of TASK_CATALOG) assert.ok(first.summary.taskCounts[task.id] > 0, task.id);
  assert.equal(first.public.items.length, first.private.targets.length);
  const files = suiteAsJsonl(first);
  assert.match(files['public/items.jsonl'], /state-tracking/);
  assert.match(files['private/targets.jsonl'], /referencePlan/);
  assert.match(files['manifest.json'], /suiteDigest/);
});


test('evaluator gives perfect score to target-consistent predictions and reports coverage', () => {
  const suite = generateResearchSuite({
    seed: 'evaluation-test',
    splits: ['validation'],
    episodesPerSplit: 1,
    horizon: 3,
    scrambleDepth: 1,
    includeDiagnostics: false,
  });
  const targetById = new Map(suite.private.targets.map((target) => [target.itemId, target]));
  const predictions = suite.public.items.map((item) => {
    const target = targetById.get(item.itemId).target;
    let answer = target;
    if (item.taskId === 'planning') answer = target.referencePlan;
    if (item.taskId === 'uncertainty-calibration') answer = { answer: target.answer, confidence: 1 };
    if (item.taskId === 'piece-trajectory') answer = { trajectories: target.trajectories };
    if (item.taskId === 'constraint-localization') answer = { implicatedPieces: target.implicatedPieces };
    if (item.taskId === 'active-identification') answer = {
      recommendedExperiment: target.recommendedExperiment,
      normalizedInformationGain: target.normalizedInformationGain,
    };
    return { itemId: item.itemId, answer, latencyMs: 5, inputTokens: 10, outputTokens: 2 };
  });
  const report = evaluatePredictions(suite, predictions, { strictCoverage: true });
  assert.equal(report.coverage.fraction, 1);
  assert.equal(report.coverage.missing, 0);
  assert.equal(report.aggregate.meanPrimaryScore, 1);
  assert.equal(report.invalid, undefined);
});
