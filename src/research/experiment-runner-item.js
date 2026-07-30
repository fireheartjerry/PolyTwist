// @ts-check

import { stableDigest } from './canonical.js';
import { parseModelResponse, predictionFromParseRecord } from './model-response.js';
import { addUsage, isAbortError, normalizeUsage, serializeError, withTimeout } from './experiment-runner-support.js';

/**
 * Creates the per-item state machine used by the experiment runner.
 * @param {any} context
 */
export function createItemProcessor(context) {
  const {
    runId, provider, identity, promptVersion, parserMode, maxRetries, timeoutMs,
    now, waitBeforeRetry, resumeRecordMap, resumePredictionMap, cacheMap,
    estimateByRequestDigest, budget, transcripts, parseRecords, itemRecords,
    predictions, cacheEntries, emit,
  } = context;

  /** @param {any} preparedItem */
  return async function processItem(preparedItem) {
    const { item, request } = preparedItem;
    const resumed = resumeRecordMap.get(item.itemId);
    const resumedPrediction = resumePredictionMap.get(item.itemId);
    if (resumed?.requestDigest === request.requestDigest && resumedPrediction) {
      const core = {
        schema: 'kinescope.run-item.v1', runId, itemId: item.itemId,
        taskId: item.taskId, split: item.split, requestDigest: request.requestDigest,
        status: 'resumed', attempts: resumed.attempts ?? 0,
        sourceRunId: resumed.runId ?? null,
        predictionDigest: stableDigest(resumedPrediction, 'kinescope-prediction'),
      };
      itemRecords.push({ ...core, itemRecordDigest: stableDigest(core, 'kinescope-run-item') });
      predictions.push(resumedPrediction);
      return;
    }

    const itemStartedAtMs = now();
    const aggregateUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    let successfulPrediction = null;
    let finalFailure = null;
    let attempts = 0;
    let usedCache = false;
    const cached = cacheMap.get(request.requestDigest);

    if (cached) {
      const cachedAtMs = now();
      const core = {
        schema: 'kinescope.raw-transcript.v1', runId, itemId: item.itemId,
        taskId: item.taskId, split: item.split, attempt: 0,
        requestDigest: request.requestDigest, provider: identity, request,
        response: {
          rawResponse: cached.rawResponse,
          usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
          metadata: { cacheHit: true, sourceCacheDigest: cached.cacheDigest ?? null, cachedUsage: cached.usage ?? null },
        },
        status: 'cache-hit', startedAt: new Date(cachedAtMs).toISOString(),
        completedAt: new Date(now()).toISOString(), latencyMs: 0,
      };
      const transcript = { ...core, transcriptDigest: stableDigest(core, 'kinescope-transcript') };
      transcripts.push(transcript);
      await emit('onTranscript', transcript);
      const parsed = parseModelResponse({
        itemId: item.itemId, rawResponse: cached.rawResponse, attempt: 0,
        parserMode, requestDigest: request.requestDigest,
      });
      parseRecords.push(parsed);
      await emit('onParseRecord', parsed);
      if (parsed.valid) {
        usedCache = true;
        successfulPrediction = predictionFromParseRecord(parsed, {
          latencyMs: 0, inputTokens: 0, outputTokens: 0, costUsd: 0,
          metadata: {
            runId, provider: identity, promptVersion, attempt: 0, cacheHit: true,
            contamination: identity.contamination,
          },
        });
      } else {
        finalFailure = { kind: 'invalid-cache-entry', retryable: true, errors: parsed.errors };
      }
    }

    if (!successfulPrediction) {
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        attempts = attempt + 1;
        const estimate = estimateByRequestDigest.get(request.requestDigest) ?? null;
        const reservation = await budget.reserve(estimate);
        if (reservation === null) {
          finalFailure = { kind: 'budget-exhausted', retryable: false, budget: budget.snapshot() };
          break;
        }

        const attemptStartedAtMs = now();
        let providerResult = null;
        let providerError = null;
        let status = 'ok';
        try {
          providerResult = await withTimeout(
            (signal) => Promise.resolve(provider.complete(request, {
              signal, attempt, runId,
              item: { itemId: item.itemId, taskId: item.taskId, split: item.split },
            })),
            timeoutMs,
          );
        } catch (error) {
          providerError = serializeError(error);
          status = isAbortError(error) ? 'timeout' : 'provider-error';
        }
        const attemptCompletedAtMs = now();
        const usage = normalizeUsage(providerResult?.usage);
        await budget.settle(reservation, usage.costUsd);
        addUsage(aggregateUsage, usage);

        const transcriptCore = {
          schema: 'kinescope.raw-transcript.v1', runId, itemId: item.itemId,
          taskId: item.taskId, split: item.split, attempt,
          requestDigest: request.requestDigest, provider: identity, request,
          response: providerError ? null : {
            rawResponse: String(providerResult?.rawResponse ?? ''), usage,
            metadata: providerResult?.metadata ?? {},
          },
          error: providerError, status,
          startedAt: new Date(attemptStartedAtMs).toISOString(),
          completedAt: new Date(attemptCompletedAtMs).toISOString(),
          latencyMs: Math.max(0, attemptCompletedAtMs - attemptStartedAtMs),
        };
        const transcript = {
          ...transcriptCore,
          transcriptDigest: stableDigest(transcriptCore, 'kinescope-transcript'),
        };
        transcripts.push(transcript);
        await emit('onTranscript', transcript);

        if (providerError) {
          finalFailure = { kind: status, retryable: providerError.retryable !== false, error: providerError };
          if (providerError.retryable === false || attempt >= maxRetries) break;
          await waitBeforeRetry(attempt);
          continue;
        }

        const parsed = parseModelResponse({
          itemId: item.itemId,
          rawResponse: String(providerResult?.rawResponse ?? ''),
          attempt, parserMode, requestDigest: request.requestDigest,
        });
        parseRecords.push(parsed);
        await emit('onParseRecord', parsed);
        if (!parsed.valid) {
          finalFailure = { kind: 'parse-error', retryable: true, errors: parsed.errors };
          if (attempt >= maxRetries) break;
          await waitBeforeRetry(attempt);
          continue;
        }

        successfulPrediction = predictionFromParseRecord(parsed, {
          latencyMs: Math.max(0, now() - itemStartedAtMs),
          inputTokens: aggregateUsage.inputTokens,
          outputTokens: aggregateUsage.outputTokens,
          costUsd: aggregateUsage.costUsd,
          metadata: {
            runId, provider: identity, promptVersion, attempt,
            cacheHit: false, contamination: identity.contamination,
          },
        });
        const cacheCore = {
          schema: 'kinescope.response-cache-entry.v1', valid: true,
          requestDigest: request.requestDigest, provider: identity,
          rawResponse: String(providerResult?.rawResponse ?? ''), usage,
          responseMetadata: providerResult?.metadata ?? {}, parseDigest: parsed.parseDigest,
        };
        const cacheEntry = {
          ...cacheCore,
          cacheDigest: stableDigest(cacheCore, 'kinescope-response-cache'),
        };
        cacheEntries.push(cacheEntry);
        cacheMap.set(request.requestDigest, cacheEntry);
        await emit('onCacheEntry', cacheEntry);
        break;
      }
    }

    let itemRecord;
    if (successfulPrediction) {
      const prediction = {
        ...successfulPrediction,
        metadata: { ...(successfulPrediction.metadata ?? {}), requestDigest: request.requestDigest },
      };
      const predictionDigest = stableDigest(prediction, 'kinescope-prediction');
      predictions.push(prediction);
      await emit('onPrediction', { ...prediction, predictionDigest });
      const core = {
        schema: 'kinescope.run-item.v1', runId, itemId: item.itemId,
        taskId: item.taskId, split: item.split, requestDigest: request.requestDigest,
        status: usedCache ? 'cache-hit' : 'succeeded', attempts,
        usage: aggregateUsage, predictionDigest,
        completedAt: new Date(now()).toISOString(),
      };
      itemRecord = { ...core, itemRecordDigest: stableDigest(core, 'kinescope-run-item') };
    } else {
      const core = {
        schema: 'kinescope.run-item.v1', runId, itemId: item.itemId,
        taskId: item.taskId, split: item.split, requestDigest: request.requestDigest,
        status: finalFailure?.kind === 'budget-exhausted' ? 'budget-exhausted' : 'failed',
        attempts, usage: aggregateUsage,
        failure: finalFailure ?? { kind: 'unknown-failure', retryable: false },
        completedAt: new Date(now()).toISOString(),
      };
      itemRecord = { ...core, itemRecordDigest: stableDigest(core, 'kinescope-run-item') };
    }
    itemRecords.push(itemRecord);
    await emit('onItemRecord', itemRecord);
  };
}
