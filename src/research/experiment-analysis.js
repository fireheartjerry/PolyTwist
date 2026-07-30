// @ts-check

import { stableDigest } from './canonical.js';
import { bootstrapMeanInterval, twoSidedSignTest } from './bootstrap-statistics.js';

export { bootstrapMeanInterval, twoSidedSignTest } from './bootstrap-statistics.js';

/** @param {any} evaluation */
function scoredRows(evaluation) {
  if (!evaluation?.results || !Array.isArray(evaluation.results)) throw new Error('Evaluation report is missing results.');
  return evaluation.results.filter((row) => row.status === 'scored' && Number.isFinite(row.primaryScore));
}

/**
 * Adds deterministic bootstrap intervals to an evaluator report without
 * changing the evaluator's exact per-item scores.
 *
 * @param {any} evaluation
 * @param {{seed?:string,samples?:number,level?:number}} [options]
 */
export function summarizeEvaluationWithIntervals(evaluation, options = {}) {
  const rows = scoredRows(evaluation);
  const seed = String(options.seed ?? 'kinescope-evaluation-analysis-v1');
  const interval = (name, subset) => bootstrapMeanInterval(subset.map((row) => row.primaryScore), {
    ...options,
    seed: `${seed}:${name}`,
  });
  const byTask = Object.fromEntries([...new Set(rows.map((row) => row.taskId))].sort().map((taskId) => [
    taskId,
    interval(`task:${taskId}`, rows.filter((row) => row.taskId === taskId)),
  ]));
  const bySplit = Object.fromEntries([...new Set(rows.map((row) => row.split))].sort().map((split) => [
    split,
    interval(`split:${split}`, rows.filter((row) => row.split === split)),
  ]));
  const core = {
    schema: 'kinescope.evaluation-analysis.v1',
    suiteId: evaluation.suiteId ?? null,
    evaluationDigest: evaluation.reportDigest ?? null,
    method: {
      confidenceInterval: 'deterministic percentile bootstrap over scored benchmark items',
      samples: Math.max(1, Math.trunc(options.samples ?? 4000)),
      level: Math.min(0.999, Math.max(0.5, Number(options.level ?? 0.95))),
      seed,
    },
    overall: interval('overall', rows),
    byTask,
    bySplit,
    scoredItems: rows.length,
  };
  return { ...core, analysisDigest: stableDigest(core, 'kinescope-evaluation-analysis') };
}

/**
 * Paired item-level comparison of two evaluation reports. Ties are excluded
 * from the sign test but retained in the descriptive summary.
 *
 * @param {any} evaluationA
 * @param {any} evaluationB
 * @param {{labelA?:string,labelB?:string,seed?:string,samples?:number,level?:number}} [options]
 */
export function compareEvaluationsPaired(evaluationA, evaluationB, options = {}) {
  const rowsA = new Map(scoredRows(evaluationA).map((row) => [row.itemId, row]));
  const rowsB = new Map(scoredRows(evaluationB).map((row) => [row.itemId, row]));
  const sharedIds = [...rowsA.keys()].filter((itemId) => rowsB.has(itemId)).sort();
  const pairs = sharedIds.map((itemId) => {
    const a = rowsA.get(itemId);
    const b = rowsB.get(itemId);
    return {
      itemId,
      taskId: a.taskId,
      split: a.split,
      scoreA: a.primaryScore,
      scoreB: b.primaryScore,
      delta: a.primaryScore - b.primaryScore,
    };
  });
  const tolerance = 1e-12;
  const wins = pairs.filter((pair) => pair.delta > tolerance).length;
  const losses = pairs.filter((pair) => pair.delta < -tolerance).length;
  const ties = pairs.length - wins - losses;
  const deltaInterval = bootstrapMeanInterval(pairs.map((pair) => pair.delta), {
    seed: options.seed ?? 'kinescope-paired-comparison-v1',
    samples: options.samples,
    level: options.level,
  });
  const core = {
    schema: 'kinescope.paired-comparison.v1',
    labelA: options.labelA ?? 'A',
    labelB: options.labelB ?? 'B',
    evaluationDigestA: evaluationA.reportDigest ?? null,
    evaluationDigestB: evaluationB.reportDigest ?? null,
    sharedItems: pairs.length,
    excludedOnlyInA: [...rowsA.keys()].filter((itemId) => !rowsB.has(itemId)).sort(),
    excludedOnlyInB: [...rowsB.keys()].filter((itemId) => !rowsA.has(itemId)).sort(),
    wins,
    ties,
    losses,
    meanDelta: deltaInterval.mean,
    meanDeltaInterval: deltaInterval,
    twoSidedSignTestP: twoSidedSignTest(wins, losses),
    pairs,
  };
  return { ...core, comparisonDigest: stableDigest(core, 'kinescope-paired-comparison') };
}
