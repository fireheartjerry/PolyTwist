import test from 'node:test';
import assert from 'node:assert/strict';

import { renderBenchmarkPrompt } from '../src/research/prompt-templates.js';
import { parseModelResponse } from '../src/research/model-response.js';
import { createFunctionProvider, createMockProvider, createSyntheticOracleProvider } from '../src/research/provider-adapters.js';
import { runModelExperiment } from '../src/research/experiment-runner.js';
import { makeSuite, simpleEvaluate } from './model-runner-fixtures.js';

test('prompt construction is deterministic and rejects evaluator-private fields', () => {
  const suite = makeSuite();
  const first = renderBenchmarkPrompt(suite.public.items[0]);
  const second = renderBenchmarkPrompt(structuredClone(suite.public.items[0]));
  assert.deepEqual(first, second);
  assert.match(first.promptDigest, /^kinescope-prompt1-/);
  assert.equal(JSON.stringify(first).includes('target-private'), false);
  const contaminated = structuredClone(suite.public.items[0]);
  contaminated.input.canonicalPuzzleSpec = { answer: 'leak' };
  assert.throws(() => renderBenchmarkPrompt(contaminated), /Evaluator-private field/);
});

test('response parsing is strict and never repairs prose or malformed JSON', () => {
  const valid = parseModelResponse({ itemId: 'item-a', rawResponse: '{"answer":{"legal":true},"confidence":0.75}' });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.parsed.answer, { legal: true });
  const prose = parseModelResponse({ itemId: 'item-a', rawResponse: 'Answer: {"answer":true}' });
  assert.equal(prose.valid, false);
  assert.match(prose.errors[0], /^invalid-json:/);
  const fencedStrict = parseModelResponse({ itemId: 'item-a', rawResponse: '```json\n{"answer":true}\n```' });
  assert.equal(fencedStrict.valid, false);
  const fencedAllowed = parseModelResponse({ itemId: 'item-a', rawResponse: '```json\n{"answer":true}\n```', parserMode: 'single-json-fence' });
  assert.equal(fencedAllowed.valid, true);
  const unknown = parseModelResponse({ itemId: 'item-a', rawResponse: '{"answer":true,"helpfulExtra":3}' });
  assert.equal(unknown.valid, false);
  assert.match(unknown.errors.join(','), /unknown-top-level-keys/);
});

test('runner retries parse failures and preserves raw, parse, prediction, and evaluation layers', async () => {
  const suite = makeSuite();
  const provider = createMockProvider({
    invalidAttempts: 1,
    responses: {
      'item-a': { answer: { legal: true }, confidence: 0.9 },
      'item-b': { answer: { action: 'A1' }, confidence: 0.8 },
    },
  });
  const result = await runModelExperiment({
    suite, provider, evaluate: simpleEvaluate,
    options: { maxRetries: 1, concurrency: 2, seed: 'retry-test' },
  });
  assert.equal(result.manifest.status, 'completed');
  assert.equal(result.transcripts.length, 4);
  assert.equal(result.parseRecords.filter((record) => !record.valid).length, 2);
  assert.equal(result.predictions.length, 2);
  assert.equal(result.evaluation.aggregate.meanPrimaryScore, 1);
  assert.ok(result.transcripts.every((record) => record.request.messages));
  assert.ok(result.predictions.every((prediction) => prediction.metadata.responseDigest));
});

test('private synthetic oracle validates the ceiling while declaring contamination', async () => {
  const suite = makeSuite();
  const result = await runModelExperiment({
    suite, provider: createSyntheticOracleProvider(suite), evaluate: simpleEvaluate,
    options: { maxRetries: 0, seed: 'oracle-test' },
  });
  assert.equal(result.evaluation.aggregate.meanPrimaryScore, 1);
  assert.equal(result.manifest.contamination.usesPrivateTargets, true);
  assert.equal(result.manifest.contamination.evaluationEligible, false);
});

test('resume and cache avoid provider calls without changing request identity', async () => {
  const suite = makeSuite();
  let calls = 0;
  const provider = createFunctionProvider({
    id: 'counting', model: 'counting-v1', estimateCostUsd: () => 0,
    complete(request) {
      calls += 1;
      return {
        rawResponse: JSON.stringify({
          answer: request.itemId === 'item-a' ? { legal: true } : { action: 'A1' },
          confidence: 1,
        }),
        usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
      };
    },
  });
  const first = await runModelExperiment({ suite, provider, evaluate: simpleEvaluate, options: { seed: 'resume-test' } });
  assert.equal(calls, 2);
  calls = 0;
  const resumed = await runModelExperiment({
    suite, provider, evaluate: simpleEvaluate,
    options: { seed: 'resume-test', resumeItemRecords: first.itemRecords, resumePredictions: first.predictions },
  });
  assert.equal(calls, 0);
  assert.ok(resumed.itemRecords.every((record) => record.status === 'resumed'));
  assert.equal(resumed.evaluation.aggregate.meanPrimaryScore, 1);
  calls = 0;
  const cached = await runModelExperiment({
    suite, provider, evaluate: simpleEvaluate,
    options: { seed: 'resume-test', cacheEntries: first.cacheEntries },
  });
  assert.equal(calls, 0);
  assert.ok(cached.itemRecords.every((record) => record.status === 'cache-hit'));
  assert.equal(cached.evaluation.aggregate.meanPrimaryScore, 1);
});

test('budget reservation blocks calls whose estimate exceeds the declared cap', async () => {
  const suite = makeSuite();
  let calls = 0;
  const provider = createFunctionProvider({
    id: 'priced', model: 'priced-v1', estimateCostUsd: () => 0.5,
    complete() {
      calls += 1;
      return { rawResponse: '{"answer":null,"confidence":0}', usage: { costUsd: 0.5 } };
    },
  });
  const result = await runModelExperiment({ suite, provider, options: { maxCostUsd: 0.4, concurrency: 8 } });
  assert.equal(calls, 0);
  assert.equal(result.manifest.counts.budgetExhausted, 2);
  assert.equal(result.manifest.status, 'completed-with-item-failures');
});
