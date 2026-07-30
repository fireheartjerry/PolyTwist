import test from 'node:test';
import assert from 'node:assert/strict';

import { createFunctionProvider, createOpenAICompatibleProvider } from '../src/research/provider-adapters.js';
import { runModelExperiment } from '../src/research/experiment-runner.js';
import {
  bootstrapMeanInterval, compareEvaluationsPaired,
  summarizeEvaluationWithIntervals, twoSidedSignTest,
} from '../src/research/experiment-analysis.js';
import { makeSuite, simpleEvaluate } from './model-runner-fixtures.js';

test('per-attempt timeout aborts the provider and records a timeout transcript', async () => {
  const suite = makeSuite();
  let aborted = false;
  const provider = createFunctionProvider({
    id: 'hanging', model: 'hanging-v1', estimateCostUsd: () => 0,
    complete(_request, context) {
      return new Promise((_resolve, reject) => {
        context.signal.addEventListener('abort', () => {
          aborted = true;
          reject(new DOMException('Aborted by timeout.', 'AbortError'));
        }, { once: true });
      });
    },
  });
  const result = await runModelExperiment({
    suite, provider, options: { maxItems: 1, maxRetries: 0, timeoutMs: 5 },
  });
  assert.equal(aborted, true);
  assert.equal(result.transcripts.length, 1);
  assert.equal(result.transcripts[0].status, 'timeout');
  assert.equal(result.itemRecords[0].status, 'failed');
  assert.equal(result.itemRecords[0].failure.kind, 'timeout');
});

test('OpenAI-compatible adapter preserves raw model text and accounts reported usage', async () => {
  const suite = makeSuite();
  let captured = null;
  const provider = createOpenAICompatibleProvider({
    baseUrl: 'http://local.test/v1', apiKey: 'secret-test-key', model: 'local-model',
    maxOutputTokens: 16, inputCostPerMillion: 1, outputCostPerMillion: 2,
    async fetchImpl(url, init) {
      captured = { url, init };
      return new Response(JSON.stringify({
        id: 'completion-1', model: 'local-model-resolved',
        choices: [{ message: { content: '{"answer":{"legal":true},"confidence":0.6}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      }), { status: 200, headers: { 'x-request-id': 'request-123' } });
    },
  });
  const result = await runModelExperiment({
    suite, provider, evaluate: simpleEvaluate, options: { maxItems: 1, maxRetries: 0 },
  });
  assert.equal(captured.url, 'http://local.test/v1/chat/completions');
  assert.equal(captured.init.headers.authorization, 'Bearer secret-test-key');
  assert.equal(JSON.parse(captured.init.body).response_format.type, 'json_object');
  assert.deepEqual(result.predictions[0].answer, { legal: true });
  assert.equal(result.transcripts[0].response.metadata.providerRequestId, 'request-123');
  assert.ok(Math.abs(result.manifest.usage.costUsd - 0.000011) < 1e-15);
  assert.equal(JSON.stringify(result.manifest).includes('secret-test-key'), false);
});

test('statistical analysis is deterministic and paired by shared item id', () => {
  const intervalA = bootstrapMeanInterval([0, 1, 1, 0.5], { seed: 'stats', samples: 500 });
  const intervalB = bootstrapMeanInterval([0, 1, 1, 0.5], { seed: 'stats', samples: 500 });
  assert.deepEqual(intervalA, intervalB);
  assert.ok(Math.abs(twoSidedSignTest(5, 0) - 0.0625) < 1e-12);
  const evaluationA = {
    suiteId: 'suite', reportDigest: 'a',
    results: [
      { itemId: 'x', taskId: 't', split: 's', status: 'scored', primaryScore: 1 },
      { itemId: 'y', taskId: 't', split: 's', status: 'scored', primaryScore: 0.5 },
    ],
  };
  const evaluationB = {
    suiteId: 'suite', reportDigest: 'b',
    results: [
      { itemId: 'x', taskId: 't', split: 's', status: 'scored', primaryScore: 0 },
      { itemId: 'y', taskId: 't', split: 's', status: 'scored', primaryScore: 0.5 },
    ],
  };
  const summary = summarizeEvaluationWithIntervals(evaluationA, { seed: 'summary', samples: 200 });
  assert.equal(summary.overall.count, 2);
  const comparison = compareEvaluationsPaired(evaluationA, evaluationB, { samples: 200 });
  assert.equal(comparison.sharedItems, 2);
  assert.equal(comparison.wins, 1);
  assert.equal(comparison.ties, 1);
  assert.equal(comparison.losses, 0);
  assert.equal(comparison.meanDelta, 0.5);
});
