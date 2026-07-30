#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { renderBenchmarkPrompt } from '../src/research/prompt-templates.js';
import { mean, quantile } from '../src/research/statistics.js';
import { stableDigest } from '../src/research/canonical.js';

const args = process.argv.slice(2);
const read = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};
const suitePath = path.resolve(read('--suite', 'datasets/kinescope-suite/suite.json'));
const pricingPath = path.resolve(read('--pricing', 'research/experiments/provider-matrix.example.json'));
const outputPath = path.resolve(read('--output', 'cost-plan.json'));
const maxOutputTokens = Math.max(1, Math.trunc(Number(read('--max-output-tokens', 2048))));
const charsPerToken = Math.max(1, Number(read('--chars-per-token', 4)));
const repeats = Math.max(1, Math.trunc(Number(read('--repeats', 1))));
const suite = JSON.parse(await readFile(suitePath, 'utf8'));
const pricing = JSON.parse(await readFile(pricingPath, 'utf8'));
const itemEstimates = suite.public.items.map((item) => {
  const prompt = renderBenchmarkPrompt(item, { promptVersion: read('--prompt-version', 'kinescope-public-item-json-v1') });
  const characters = prompt.messages.reduce((sum, message) => sum + message.content.length, 0);
  return {
    itemId: item.itemId,
    taskId: item.taskId,
    split: item.split,
    inputCharacters: characters,
    estimatedInputTokens: Math.ceil(characters / charsPerToken),
    reservedOutputTokens: maxOutputTokens,
  };
});
const models = (pricing.models ?? []).map((model) => {
  const modelRepeats = Math.max(1, Math.trunc(Number(model.repeats ?? repeats)));
  const inputTokens = itemEstimates.reduce((sum, item) => sum + item.estimatedInputTokens, 0) * modelRepeats;
  const outputTokens = itemEstimates.reduce((sum, item) => sum + item.reservedOutputTokens, 0) * modelRepeats;
  const inputRate = Math.max(0, Number(model.inputCostPerMillion ?? 0));
  const outputRate = Math.max(0, Number(model.outputCostPerMillion ?? 0));
  return {
    id: model.id,
    provider: model.provider,
    model: model.model,
    repeats: modelRepeats,
    inputTokens,
    outputTokens,
    estimatedMaximumCostUsd: inputTokens * inputRate / 1_000_000 + outputTokens * outputRate / 1_000_000,
    ratesUsdPerMillion: { input: inputRate, output: outputRate },
    pricingVerifiedAt: model.pricingVerifiedAt ?? null,
  };
});
const inputCounts = itemEstimates.map((item) => item.estimatedInputTokens);
const core = {
  schema: 'kinescope.cost-plan.v1',
  suiteId: suite.suiteId ?? null,
  suiteDigest: suite.suiteDigest ?? null,
  assumptions: {
    approximation: `UTF-16 character count divided by ${charsPerToken}; provider tokenizers may differ materially`,
    outputReservation: maxOutputTokens,
    defaultRepeats: repeats,
    excludesRetries: true,
    excludesProviderMinimumCharges: true,
    ratesMustBeVerifiedBeforeLaunch: true,
  },
  itemCount: itemEstimates.length,
  promptInputTokenSummary: {
    mean: mean(inputCounts),
    median: quantile(inputCounts, 0.5),
    p95: quantile(inputCounts, 0.95),
    maximum: inputCounts.length ? Math.max(...inputCounts) : null,
  },
  models,
  estimatedMaximumCostUsd: models.reduce((sum, model) => sum + model.estimatedMaximumCostUsd, 0),
  itemEstimates,
};
const report = { ...core, costPlanDigest: stableDigest(core, 'kinescope-cost-plan') };
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, itemCount: report.itemCount, models: models.length, estimatedMaximumCostUsd: report.estimatedMaximumCostUsd }, null, 2));
