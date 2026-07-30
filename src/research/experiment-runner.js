// @ts-check

import { hashSeed } from '../core/rng.js';
import { stableDigest } from './canonical.js';
import { renderBenchmarkPrompt } from './prompt-templates.js';
import {
  addUsage, createBudgetManager, keyedMap, normalizeUsage,
  providerIdentity, serializeError,
} from './experiment-runner-support.js';
import { createItemProcessor } from './experiment-runner-item.js';

/**
 * Runs a public benchmark suite against one provider. Provider output, parsing,
 * normalization, and evaluator scoring remain separate artifacts.
 * @param {any} input
 */
export async function runModelExperiment(input) {
  const suite = input.suite;
  const provider = input.provider;
  const options = input.options ?? {};
  const hooks = input.hooks ?? {};
  if (!suite?.public?.items || !Array.isArray(suite.public.items)) throw new Error('Experiment runner requires suite.public.items.');
  if (!provider || typeof provider.complete !== 'function') throw new Error('Experiment runner requires a provider adapter.');

  const identity = providerIdentity(provider);
  const seed = String(options.seed ?? 'kinescope-model-run-v1');
  const promptVersion = String(options.promptVersion ?? 'kinescope-public-item-json-v1');
  const parserMode = String(options.parserMode ?? 'strict-json');
  const requestedConcurrency = Math.max(1, Math.trunc(options.concurrency ?? 4));
  const maxRetries = Math.max(0, Math.trunc(options.maxRetries ?? 2));
  const retryBackoffMs = Math.max(0, Math.trunc(options.retryBackoffMs ?? 0));
  const timeoutMs = Math.max(1, Math.trunc(options.timeoutMs ?? 120_000));
  const maxItems = Number.isFinite(options.maxItems) ? Math.max(0, Math.trunc(options.maxItems)) : Infinity;
  const maxCostUsd = Number.isFinite(options.maxCostUsd) ? Math.max(0, Number(options.maxCostUsd)) : Infinity;
  const tasks = new Set((options.tasks ?? []).map(String));
  const splits = new Set((options.splits ?? []).map(String));
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0;
  const maxOutputTokens = Math.max(1, Math.trunc(options.maxOutputTokens ?? 2048));
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const waitBeforeRetry = async (attempt) => {
    if (retryBackoffMs > 0) await sleep(Math.min(8_000, retryBackoffMs * 2 ** attempt));
  };

  const selectedItems = suite.public.items
    .filter((item) => tasks.size === 0 || tasks.has(item.taskId))
    .filter((item) => splits.size === 0 || splits.has(item.split))
    .sort((a, b) => String(a.itemId).localeCompare(String(b.itemId)))
    .slice(0, maxItems);
  const prepared = selectedItems.map((item) => {
    const rendered = renderBenchmarkPrompt(item, {
      promptVersion,
      systemPromptSuffix: options.systemPromptSuffix,
    });
    const generation = {
      temperature,
      maxOutputTokens,
      seed: hashSeed(`${seed}:${item.itemId}`),
    };
    const requestCore = {
      schema: 'kinescope.model-request.v1', itemId: item.itemId,
      taskId: item.taskId, split: item.split, provider: identity,
      promptVersion, promptDigest: rendered.promptDigest,
      messages: rendered.messages, responseSchema: rendered.responseSchema, generation,
    };
    const requestDigest = stableDigest(requestCore, 'kinescope-model-request');
    return { item, request: { ...requestCore, requestId: requestDigest, requestDigest } };
  });

  const runIdentity = {
    schema: 'kinescope.run-identity.v1', suiteId: suite.suiteId ?? null,
    suiteDigest: suite.suiteDigest ?? null,
    itemRequests: prepared.map((entry) => entry.request.requestDigest),
    provider: identity, seed, promptVersion, parserMode,
    execution: { maxRetries, retryBackoffMs, timeoutMs, temperature, maxOutputTokens },
  };
  const runId = stableDigest(runIdentity, 'kinescope-run');
  const startedAt = new Date(now()).toISOString();
  const resumeRecordMap = keyedMap(options.resumeItemRecords ?? [], 'itemId');
  const resumePredictionMap = keyedMap(options.resumePredictions ?? [], 'itemId');
  const cacheMap = new Map();
  for (const entry of options.cacheEntries ?? []) {
    if (entry?.valid === true && typeof entry.requestDigest === 'string' && typeof entry.rawResponse === 'string') {
      cacheMap.set(entry.requestDigest, entry);
    }
  }

  const estimateByRequestDigest = new Map();
  let allCostEstimatesKnown = typeof provider.estimateCostUsd === 'function';
  if (allCostEstimatesKnown) {
    for (const entry of prepared) {
      try {
        const estimated = provider.estimateCostUsd(entry.request);
        if (!Number.isFinite(estimated) || Number(estimated) < 0) { allCostEstimatesKnown = false; break; }
        estimateByRequestDigest.set(entry.request.requestDigest, Number(estimated));
      } catch { allCostEstimatesKnown = false; break; }
    }
  }
  if (!allCostEstimatesKnown) estimateByRequestDigest.clear();
  const effectiveConcurrency = Number.isFinite(maxCostUsd) && !allCostEstimatesKnown ? 1 : requestedConcurrency;
  const budget = createBudgetManager({ maxCostUsd });
  const transcripts = [];
  const parseRecords = [];
  const itemRecords = [];
  const predictions = [];
  const cacheEntries = [];
  let queueIndex = 0;
  const emit = async (name, record) => {
    const callback = hooks[name];
    if (typeof callback === 'function') await callback(record);
  };
  const processItem = createItemProcessor({
    runId, provider, identity, promptVersion, parserMode, maxRetries, timeoutMs,
    now, waitBeforeRetry, resumeRecordMap, resumePredictionMap, cacheMap,
    estimateByRequestDigest, budget, transcripts, parseRecords, itemRecords,
    predictions, cacheEntries, emit,
  });
  async function worker() {
    while (true) {
      const index = queueIndex++;
      if (index >= prepared.length) return;
      await processItem(prepared[index]);
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(effectiveConcurrency, Math.max(1, prepared.length)) },
    () => worker(),
  ));

  transcripts.sort((a, b) => String(a.itemId).localeCompare(String(b.itemId)) || a.attempt - b.attempt);
  parseRecords.sort((a, b) => String(a.itemId).localeCompare(String(b.itemId)) || a.attempt - b.attempt);
  itemRecords.sort((a, b) => String(a.itemId).localeCompare(String(b.itemId)));
  predictions.sort((a, b) => String(a.itemId).localeCompare(String(b.itemId)));
  cacheEntries.sort((a, b) => String(a.requestDigest).localeCompare(String(b.requestDigest)));

  let evaluation = null;
  let evaluationError = null;
  if (typeof input.evaluate === 'function') {
    try {
      evaluation = await input.evaluate(suite, predictions, { strictCoverage: options.strictCoverage ?? false });
    } catch (error) {
      evaluationError = serializeError(error);
    }
  }
  const completedAt = new Date(now()).toISOString();
  const counts = {
    selectedItems: prepared.length,
    succeeded: itemRecords.filter((record) => ['succeeded', 'cache-hit', 'resumed'].includes(record.status)).length,
    failed: itemRecords.filter((record) => record.status === 'failed').length,
    budgetExhausted: itemRecords.filter((record) => record.status === 'budget-exhausted').length,
    resumed: itemRecords.filter((record) => record.status === 'resumed').length,
    cacheHits: itemRecords.filter((record) => record.status === 'cache-hit').length,
    providerAttempts: transcripts.filter((record) => record.status !== 'cache-hit').length,
    parseFailures: parseRecords.filter((record) => !record.valid).length,
    predictions: predictions.length,
  };
  const totalUsage = itemRecords.reduce((accumulator, record) => {
    addUsage(accumulator, normalizeUsage(record.usage));
    return accumulator;
  }, { inputTokens: 0, outputTokens: 0, costUsd: 0 });
  const status = evaluationError
    ? 'completed-with-evaluation-error'
    : counts.failed > 0 || counts.budgetExhausted > 0
      ? 'completed-with-item-failures'
      : 'completed';
  const manifestCore = {
    schema: 'kinescope.run-manifest.v1', runId,
    suiteId: suite.suiteId ?? null, suiteDigest: suite.suiteDigest ?? null,
    status, provider: identity, contamination: identity.contamination,
    prompt: { version: promptVersion, parserMode },
    execution: {
      requestedConcurrency, effectiveConcurrency, maxRetries, retryBackoffMs,
      timeoutMs, maxItems: Number.isFinite(maxItems) ? maxItems : null,
      tasks: [...tasks].sort(), splits: [...splits].sort(), temperature,
      maxOutputTokens, maxCostUsd: Number.isFinite(maxCostUsd) ? maxCostUsd : null,
      unknownCostForcesSerialExecution: Number.isFinite(maxCostUsd) && !allCostEstimatesKnown,
    },
    seed, environment: options.environment ?? {}, startedAt, completedAt,
    counts, usage: totalUsage, budget: budget.snapshot(), evaluationError,
  };
  const manifest = {
    ...manifestCore,
    manifestDigest: stableDigest(manifestCore, 'kinescope-run-manifest'),
  };
  const reportCore = {
    schema: 'kinescope.model-run.v1', manifest, itemRecords, transcripts,
    parseRecords, predictions, evaluation, cacheEntries,
  };
  return {
    ...reportCore,
    runDigest: stableDigest({
      manifestDigest: manifest.manifestDigest,
      itemRecordDigests: itemRecords.map((record) => record.itemRecordDigest),
      transcriptDigests: transcripts.map((record) => record.transcriptDigest),
      parseDigests: parseRecords.map((record) => record.parseDigest),
      predictionDigests: predictions.map((prediction) => stableDigest(prediction, 'kinescope-prediction')),
      evaluationDigest: evaluation?.reportDigest ?? null,
    }, 'kinescope-model-run'),
  };
}
