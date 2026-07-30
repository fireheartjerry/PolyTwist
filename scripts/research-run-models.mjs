#!/usr/bin/env node

import { access, appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { summarizeEvaluationWithIntervals } from '../src/research/experiment-analysis.js';
import { runModelExperiment } from '../src/research/experiment-runner.js';
import {
  createDryRunProvider,
  createMockProvider,
  createOpenAICompatibleProvider,
  createSyntheticOracleProvider,
} from '../src/research/provider-adapters.js';

const args = process.argv.slice(2);

function value(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
}

function numberValue(name, fallback) {
  const raw = value(name, null);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number.`);
  return parsed;
}

function listValue(name) {
  const raw = value(name, '');
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function has(name) {
  return args.includes(name);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonl(filePath) {
  if (!await exists(filePath)) return [];
  const text = await readFile(filePath, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSONL in ${filePath} at line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

const suitePath = path.resolve(value('--suite', 'datasets/kinescope-suite/suite.json'));
const outputDir = path.resolve(value('--output', 'runs/kinescope-model-run'));
const providerName = String(value('--provider', 'dry-run'));
const resume = has('--resume');
const useCache = has('--cache');
const allowPrivateOracle = has('--allow-private-oracle');

if (!resume && await exists(outputDir)) {
  const info = await stat(outputDir);
  if (info.isDirectory()) {
    const sentinelFiles = ['transcripts.jsonl', 'predictions.jsonl', 'manifest.json'];
    if ((await Promise.all(sentinelFiles.map((name) => exists(path.join(outputDir, name))))).some(Boolean)) {
      throw new Error(`Output directory ${outputDir} already contains a run. Use --resume or choose a new --output directory.`);
    }
  }
}

await mkdir(outputDir, { recursive: true });
const suite = JSON.parse(await readFile(suitePath, 'utf8'));

let provider;
if (providerName === 'dry-run') {
  provider = createDryRunProvider();
} else if (providerName === 'mock') {
  const responsePath = value('--mock-responses', null);
  const responses = responsePath ? JSON.parse(await readFile(path.resolve(responsePath), 'utf8')) : null;
  provider = createMockProvider({
    responses,
    invalidAttempts: numberValue('--mock-invalid-attempts', 0),
    delayMs: numberValue('--mock-delay-ms', 0),
  });
} else if (providerName === 'synthetic-oracle') {
  if (!allowPrivateOracle) {
    throw new Error('The synthetic oracle reads evaluator-private targets. Re-run with --allow-private-oracle only for pipeline ceiling validation.');
  }
  provider = createSyntheticOracleProvider(suite);
} else if (providerName === 'openai-compatible') {
  const model = value('--model', null);
  const baseUrl = value('--base-url', null);
  if (!model || !baseUrl) throw new Error('openai-compatible requires --model and --base-url.');
  const apiKeyEnvironment = String(value('--api-key-env', 'OPENAI_API_KEY'));
  provider = createOpenAICompatibleProvider({
    id: value('--provider-id', 'openai-compatible'),
    baseUrl,
    model,
    version: value('--model-version', null),
    apiKey: process.env[apiKeyEnvironment] ?? null,
    temperature: numberValue('--temperature', 0),
    maxOutputTokens: numberValue('--max-output-tokens', 2048),
    sendJsonResponseFormat: !has('--no-json-response-format'),
    inputCostPerMillion: numberValue('--input-cost-per-million', 0),
    outputCostPerMillion: numberValue('--output-cost-per-million', 0),
  });
} else {
  throw new Error(`Unknown provider ${providerName}. Use dry-run, mock, synthetic-oracle, or openai-compatible.`);
}

const files = {
  transcripts: path.join(outputDir, 'transcripts.jsonl'),
  parses: path.join(outputDir, 'parse-records.jsonl'),
  items: path.join(outputDir, 'item-records.jsonl'),
  predictions: path.join(outputDir, 'predictions.jsonl'),
  cache: path.join(outputDir, 'response-cache.jsonl'),
};
const appendTails = new Map();
function appendJsonl(filePath, record) {
  const previous = appendTails.get(filePath) ?? Promise.resolve();
  const next = previous.then(() => appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8'));
  appendTails.set(filePath, next);
  return next;
}

const resumeItemRecords = resume ? await readJsonl(files.items) : [];
const resumePredictions = resume ? await readJsonl(files.predictions) : [];
const cacheEntries = useCache ? await readJsonl(files.cache) : [];

const launchConfiguration = {
  schema: 'kinescope.launch-configuration.v1',
  suitePath,
  outputDir,
  provider: {
    id: provider.id,
    kind: provider.kind,
    model: provider.model,
    version: provider.version,
    contamination: provider.contamination,
  },
  options: {
    seed: value('--seed', 'kinescope-model-run-v1'),
    promptVersion: value('--prompt-version', 'kinescope-public-item-json-v1'),
    parserMode: value('--parser-mode', 'strict-json'),
    concurrency: numberValue('--concurrency', 4),
    maxRetries: numberValue('--max-retries', 2),
    retryBackoffMs: numberValue('--retry-backoff-ms', 500),
    timeoutMs: numberValue('--timeout-ms', 120000),
    maxItems: value('--max-items', null) === null ? null : numberValue('--max-items', 0),
    tasks: listValue('--tasks'),
    splits: listValue('--splits'),
    maxCostUsd: value('--max-cost-usd', null) === null ? null : numberValue('--max-cost-usd', 0),
    strictCoverage: has('--strict'),
    resume,
    cache: useCache,
  },
  credentialEnvironment: providerName === 'openai-compatible' ? value('--api-key-env', 'OPENAI_API_KEY') : null,
};
await writeFile(path.join(outputDir, 'launch-configuration.json'), `${JSON.stringify(launchConfiguration, null, 2)}\n`);

const evaluate = has('--skip-evaluation')
  ? undefined
  : (await import('../src/research/evaluator.js')).evaluatePredictions;

const run = await runModelExperiment({
  suite,
  provider,
  evaluate,
  options: {
    seed: launchConfiguration.options.seed,
    promptVersion: launchConfiguration.options.promptVersion,
    parserMode: launchConfiguration.options.parserMode,
    concurrency: launchConfiguration.options.concurrency,
    maxRetries: launchConfiguration.options.maxRetries,
    retryBackoffMs: launchConfiguration.options.retryBackoffMs,
    timeoutMs: launchConfiguration.options.timeoutMs,
    maxItems: launchConfiguration.options.maxItems ?? undefined,
    tasks: launchConfiguration.options.tasks,
    splits: launchConfiguration.options.splits,
    maxCostUsd: launchConfiguration.options.maxCostUsd ?? undefined,
    strictCoverage: launchConfiguration.options.strictCoverage,
    resumeItemRecords,
    resumePredictions,
    cacheEntries,
    temperature: numberValue('--temperature', 0),
    maxOutputTokens: numberValue('--max-output-tokens', 2048),
    environment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      continuousIntegration: Boolean(process.env.CI),
    },
  },
  hooks: {
    onTranscript: (record) => appendJsonl(files.transcripts, record),
    onParseRecord: (record) => appendJsonl(files.parses, record),
    onItemRecord: (record) => appendJsonl(files.items, record),
    onPrediction: (record) => appendJsonl(files.predictions, record),
    onCacheEntry: (record) => appendJsonl(files.cache, record),
  },
});

await Promise.all(appendTails.values());
await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(run.manifest, null, 2)}\n`);
await writeFile(path.join(outputDir, 'evaluation.json'), `${JSON.stringify(run.evaluation, null, 2)}\n`);
if (run.evaluation) {
  const analysis = summarizeEvaluationWithIntervals(run.evaluation, {
    seed: `${run.manifest.seed}:bootstrap`,
    samples: numberValue('--bootstrap-samples', 4000),
    level: numberValue('--confidence-level', 0.95),
  });
  await writeFile(path.join(outputDir, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);
}
await writeFile(path.join(outputDir, 'run-report.json'), `${JSON.stringify(run, null, 2)}\n`);

console.log(JSON.stringify({
  output: outputDir,
  runId: run.manifest.runId,
  runDigest: run.runDigest,
  status: run.manifest.status,
  counts: run.manifest.counts,
  usage: run.manifest.usage,
  contamination: run.manifest.contamination,
  evaluation: run.evaluation?.aggregate ?? null,
}, null, 2));

if (run.manifest.status !== 'completed') process.exitCode = 2;
