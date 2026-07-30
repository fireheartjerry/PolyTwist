// @ts-check

import { compilePuzzle } from '../core/puzzle-compiler.js';
import { PuzzleEngine } from '../core/puzzle-engine.js';
import { canonicalEqual, stableDigest } from './canonical.js';
import { mean } from './statistics.js';
import { ENGINE_VERSION } from '../version.js';

/**
 * @typedef {{
 *   suiteId:string,
 *   suiteDigest?:string,
 *   public:{items:any[]},
 *   private:{targets:any[],episodes:any[]}
 * }} EvaluationSuite
 */

/** @param {unknown} value */
function normalizeScalar(value) {
  if (typeof value === 'string') return value.trim().toLowerCase();
  return value;
}

/** @param {unknown} predicted @param {unknown} expected */
function exactScore(predicted, expected) {
  if (typeof predicted !== 'object' || predicted === null || typeof expected !== 'object' || expected === null) {
    return Number(normalizeScalar(predicted) === normalizeScalar(expected));
  }
  return Number(canonicalEqual(predicted, expected));
}

/** @param {unknown} value */
function toSet(value) {
  if (Array.isArray(value)) return new Set(value.map((entry) => JSON.stringify(entry)));
  if (value && typeof value === 'object') return new Set(Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([key]) => key));
  return new Set();
}

/** @param {unknown} predicted @param {unknown} expected */
function setScores(predicted, expected) {
  const p = toSet(predicted);
  const e = toSet(expected);
  let intersection = 0;
  for (const entry of p) if (e.has(entry)) intersection += 1;
  const precision = p.size ? intersection / p.size : e.size === 0 ? 1 : 0;
  const recall = e.size ? intersection / e.size : p.size === 0 ? 1 : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  return { precision, recall, f1 };
}

/** @param {unknown} value @param {string} [prefix] @returns {Map<string,string>} */
function flatten(value, prefix = '') {
  const output = new Map();
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      for (const [key, val] of flatten(entry, `${prefix}[${index}]`)) output.set(key, val);
    });
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      for (const [nested, val] of flatten(entry, prefix ? `${prefix}.${key}` : key)) output.set(nested, val);
    }
  } else {
    output.set(prefix || '$', JSON.stringify(normalizeScalar(value)));
  }
  return output;
}

/** @param {unknown} predicted @param {unknown} expected */
function structuredScores(predicted, expected) {
  const p = flatten(predicted);
  const e = flatten(expected);
  let correct = 0;
  for (const [key, value] of p) if (e.get(key) === value) correct += 1;
  const precision = p.size ? correct / p.size : e.size === 0 ? 1 : 0;
  const recall = e.size ? correct / e.size : p.size === 0 ? 1 : 0;
  return {
    precision,
    recall,
    f1: precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0,
    predictedFields: p.size,
    expectedFields: e.size,
    correctFields: correct,
  };
}

/** @param {string} token @param {Record<string,string>} aliasToCanonical */
function decodeAction(token, aliasToCanonical) {
  const normalized = String(token).trim().replace(/[’′]/g, "'");
  const inverse = normalized.endsWith("'");
  const doubled = normalized.endsWith('2');
  const base = inverse || doubled ? normalized.slice(0, -1) : normalized;
  const canonical = aliasToCanonical[base] ?? base;
  return `${canonical}${doubled ? '2' : inverse ? "'" : ''}`;
}

/** @param {unknown} answer @param {Record<string,unknown>} verification */
function verifyPlan(answer, verification) {
  const answerObject = /** @type {any} */ (answer);
  const typedVerification = /** @type {any} */ (verification);
  const plan = Array.isArray(answer)
    ? answer
    : answer && typeof answer === 'object' && Array.isArray(answerObject.actions)
      ? answerObject.actions
      : null;
  if (!plan) return { success: false, score: 0, reason: 'answer-is-not-an-action-sequence' };
  const spec = typedVerification.puzzleSpec;
  const startState = typedVerification.startState;
  const goalState = typedVerification.goalState;
  const aliasToCanonical = typedVerification.aliasToCanonical ?? {};
  if (!spec || !startState || !goalState) return { success: false, score: 0, reason: 'missing-private-verification-data' };
  try {
    const engine = new PuzzleEngine(compilePuzzle(spec));
    engine.load(startState);
    for (const raw of plan) {
      const token = decodeAction(String(raw), /** @type {Record<string,string>} */ (aliasToCanonical));
      if (!engine.moveLegality(token).legal) return { success: false, score: 0, reason: `illegal-action:${token}` };
      engine.applyMove(token);
    }
    const success = engine.stateHash() === goalState.hash;
    return {
      success,
      score: Number(success),
      reason: success ? 'goal-reached' : 'wrong-final-state',
      planLength: plan.length,
      finalFingerprint: engine.stateFingerprint(),
    };
  } catch (error) {
    return { success: false, score: 0, reason: `verification-error:${error instanceof Error ? error.message : String(error)}` };
  }
}

/** @param {unknown} answer @param {unknown} target @param {string} taskId @param {Record<string,unknown>} verification */
function scoreAnswer(answer, target, taskId, verification) {
  const answerObject = /** @type {any} */ (answer);
  const targetObject = /** @type {any} */ (target);
  if (taskId === 'planning') {
    const plan = verifyPlan(answer, verification);
    return { primary: plan.score, metrics: { goalSuccess: plan.score }, verification: plan };
  }
  if (taskId === 'piece-trajectory') {
    const result = setScores(answerObject?.trajectories ?? answer, targetObject?.trajectories ?? target);
    return { primary: result.f1, metrics: { pieceTrajectoryPrecision: result.precision, pieceTrajectoryRecall: result.recall, pieceTrajectoryF1: result.f1 } };
  }
  if (taskId === 'constraint-localization') {
    const result = setScores(answerObject?.implicatedPieces ?? answer, targetObject?.implicatedPieces ?? target);
    return { primary: result.f1, metrics: { setPrecision: result.precision, setRecall: result.recall, setF1: result.f1 } };
  }
  if (['symbolic-mechanics', 'appearance-mechanics-disentanglement'].includes(taskId)) {
    const result = structuredScores(answer, target);
    return { primary: result.f1, metrics: { fieldPrecision: result.precision, fieldRecall: result.recall, fieldF1: result.f1 } };
  }
  if (taskId === 'active-identification') {
    const expectedSequence = targetObject?.recommendedExperiment;
    const predictedSequence = answerObject?.recommendedExperiment ?? answerObject?.sequence ?? answer;
    const exact = exactScore(predictedSequence, expectedSequence);
    const predictedGain = Number(answerObject?.normalizedInformationGain ?? 0);
    const expectedGain = Number(targetObject?.normalizedInformationGain ?? 1);
    const gainRatio = expectedGain > 0 ? Math.max(0, Math.min(1, predictedGain / expectedGain)) : exact;
    return { primary: exact ? 1 : gainRatio, metrics: { exactBestExperiment: exact, normalizedInformationGainRatio: gainRatio } };
  }
  if (taskId === 'uncertainty-calibration') {
    const predictedAnswer = answerObject?.answer;
    const confidence = Math.max(0, Math.min(1, Number(answerObject?.confidence ?? 0)));
    const correct = exactScore(predictedAnswer, targetObject?.answer);
    const brier = (confidence - correct) ** 2;
    return { primary: correct, metrics: { accuracy: correct, confidence, brier } };
  }
  if (taskId === 'state-tracking' || taskId === 'counterfactual-rollout') {
    const predicted = answerObject?.finalFingerprint ?? answerObject?.fingerprint ?? answer;
    const expected = targetObject?.finalFingerprint ?? targetObject?.fingerprint ?? target;
    const score = exactScore(predicted, expected);
    return { primary: score, metrics: { exactStateSuccess: score } };
  }
  if (taskId === 'reachability') {
    const score = exactScore(answerObject?.reachable ?? answer, targetObject?.reachable ?? target);
    return { primary: score, metrics: { verifiedAccuracy: score } };
  }
  const score = exactScore(answer, target);
  return { primary: score, metrics: { exactMatch: score } };
}

/** @param {number[]} confidences @param {number[]} correctness @param {number} [bins] */
function calibration(confidences, correctness, bins = 10) {
  const rows = [];
  let ece = 0;
  for (let index = 0; index < bins; index += 1) {
    const lower = index / bins;
    const upper = (index + 1) / bins;
    const members = confidences.map((confidence, memberIndex) => ({ confidence, correct: correctness[memberIndex] }))
      .filter((entry) => entry.confidence >= lower && (index === bins - 1 ? entry.confidence <= upper : entry.confidence < upper));
    if (members.length === 0) {
      rows.push({ lower, upper, count: 0, meanConfidence: null, accuracy: null, gap: null });
      continue;
    }
    const meanConfidence = mean(members.map((entry) => entry.confidence)) ?? 0;
    const accuracy = mean(members.map((entry) => entry.correct)) ?? 0;
    const gap = Math.abs(meanConfidence - accuracy);
    ece += members.length / confidences.length * gap;
    rows.push({ lower, upper, count: members.length, meanConfidence, accuracy, gap });
  }
  return { ece, bins: rows };
}

/**
 * Scores predictions against the evaluator-private target partition of a suite.
 * @param {EvaluationSuite} suite
 * @param {{itemId:string,answer:unknown,confidence?:number,latencyMs?:number,inputTokens?:number,outputTokens?:number,costUsd?:number,metadata?:Record<string,unknown>}[]} predictions
 * @param {{strictCoverage?:boolean}} [options]
 */
export function evaluatePredictions(suite, predictions, options = {}) {
  const items = new Map(suite.public.items.map((item) => [item.itemId, item]));
  const targets = new Map(suite.private.targets.map((target) => [target.itemId, target]));
  const predictionMap = new Map(predictions.map((prediction) => [prediction.itemId, prediction]));
  const results = [];
  const unknownPredictionIds = predictions.filter((prediction) => !items.has(prediction.itemId)).map((prediction) => prediction.itemId);

  for (const [id, item] of items) {
    const target = targets.get(id);
    if (!target) throw new Error(`Suite is missing private target for ${id}.`);
    const prediction = predictionMap.get(id);
    if (!prediction) {
      results.push({
        itemId: id,
        taskId: item.taskId,
        split: item.split,
        status: 'missing',
        primaryScore: 0,
        metrics: { missing: 1 },
      });
      continue;
    }
    const verification = { ...(target.verification ?? {}) };
    if (item.taskId === 'planning') {
      const episode = suite.private.episodes.find((entry) => entry.episodeId === item.metadata.episodeId);
      if (episode) verification.puzzleSpec = episode.canonicalPuzzleSpec;
    }
    const scored = scoreAnswer(prediction.answer, target.target, item.taskId, verification);
    results.push({
      itemId: id,
      taskId: item.taskId,
      split: item.split,
      status: 'scored',
      primaryScore: scored.primary,
      metrics: scored.metrics,
      verification: scored.verification,
      usage: {
        latencyMs: Number.isFinite(prediction.latencyMs) ? prediction.latencyMs : null,
        inputTokens: Number.isFinite(prediction.inputTokens) ? prediction.inputTokens : null,
        outputTokens: Number.isFinite(prediction.outputTokens) ? prediction.outputTokens : null,
        costUsd: Number.isFinite(prediction.costUsd) ? prediction.costUsd : null,
      },
    });
  }

  const group = (key) => Object.fromEntries([...new Set(results.map((result) => result[key]))].sort().map((value) => {
    const subset = results.filter((result) => result[key] === value);
    return [value, {
      count: subset.length,
      scored: subset.filter((result) => result.status === 'scored').length,
      meanPrimaryScore: mean(subset.map((result) => result.primaryScore)),
      exactSuccessCount: subset.filter((result) => result.primaryScore === 1).length,
      missingCount: subset.filter((result) => result.status === 'missing').length,
      meanLatencyMs: mean(subset.map((result) => result.usage?.latencyMs).filter(Number.isFinite)),
      totalInputTokens: subset.reduce((sum, result) => sum + (result.usage?.inputTokens ?? 0), 0),
      totalOutputTokens: subset.reduce((sum, result) => sum + (result.usage?.outputTokens ?? 0), 0),
      totalCostUsd: subset.reduce((sum, result) => sum + (result.usage?.costUsd ?? 0), 0),
    }];
  }));

  const calibrationRows = results.filter((result) => result.taskId === 'uncertainty-calibration' && result.status === 'scored');
  const calibrationReport = calibrationRows.length
    ? calibration(
      calibrationRows.map((result) => Number(result.metrics.confidence ?? 0)),
      calibrationRows.map((result) => Number(result.metrics.accuracy ?? 0)),
    )
    : { ece: null, bins: [] };

  const report = {
    schema: 'kinescope.evaluation.v1',
    engineVersion: ENGINE_VERSION,
    suiteId: suite.suiteId,
    suiteDigest: suite.suiteDigest,
    configuration: { strictCoverage: options.strictCoverage ?? false },
    coverage: {
      expected: items.size,
      submitted: predictionMap.size,
      scored: results.filter((result) => result.status === 'scored').length,
      missing: results.filter((result) => result.status === 'missing').length,
      unknownPredictionIds,
      fraction: items.size ? results.filter((result) => result.status === 'scored').length / items.size : 0,
    },
    aggregate: {
      meanPrimaryScore: mean(results.map((result) => result.primaryScore)),
      exactSuccessRate: mean(results.map((result) => Number(result.primaryScore === 1))),
      byTask: group('taskId'),
      bySplit: group('split'),
      calibration: calibrationReport,
      usage: {
        meanLatencyMs: mean(results.map((result) => result.usage?.latencyMs).filter(Number.isFinite)),
        totalInputTokens: results.reduce((sum, result) => sum + (result.usage?.inputTokens ?? 0), 0),
        totalOutputTokens: results.reduce((sum, result) => sum + (result.usage?.outputTokens ?? 0), 0),
        totalCostUsd: results.reduce((sum, result) => sum + (result.usage?.costUsd ?? 0), 0),
      },
    },
    results,
  };
  if (options.strictCoverage && report.coverage.missing > 0) report.invalid = true;
  report.reportDigest = stableDigest(report, 'kinescope-evaluation');
  return report;
}
