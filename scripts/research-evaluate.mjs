#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { evaluatePredictions } from '../src/research/evaluator.js';

const args = process.argv.slice(2);
const read = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const suitePath = resolve(read('--suite', 'datasets/kinescope-suite/suite.json'));
const predictionsPath = resolve(read('--predictions', 'predictions.json'));
const outputPath = resolve(read('--output', 'evaluation.json'));
const suite = JSON.parse(await readFile(suitePath, 'utf8'));
const predictions = JSON.parse(await readFile(predictionsPath, 'utf8'));
const report = evaluatePredictions(suite, predictions, { strictCoverage: args.includes('--strict') });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, coverage: report.coverage, aggregate: report.aggregate }, null, 2));
