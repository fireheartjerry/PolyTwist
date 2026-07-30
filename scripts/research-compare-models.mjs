#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  compareEvaluationsPaired,
  summarizeEvaluationWithIntervals,
} from '../src/research/experiment-analysis.js';
import { stableDigest } from '../src/research/canonical.js';

const args = process.argv.slice(2);
const read = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};
const evaluationPaths = String(read('--evaluations', ''))
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => path.resolve(entry));
if (evaluationPaths.length < 2) throw new Error('--evaluations requires at least two comma-separated evaluation JSON files.');
const labels = String(read('--labels', ''))
  .split(',')
  .map((entry) => entry.trim());
const samples = Math.max(1, Math.trunc(Number(read('--bootstrap-samples', 4000))));
const level = Number(read('--confidence-level', 0.95));
const output = path.resolve(read('--output', 'comparison.json'));

const evaluations = await Promise.all(evaluationPaths.map(async (filePath, index) => ({
  path: filePath,
  label: labels[index] || path.basename(path.dirname(filePath)) || `run-${index + 1}`,
  report: JSON.parse(await readFile(filePath, 'utf8')),
})));
const summaries = Object.fromEntries(evaluations.map((entry) => [
  entry.label,
  summarizeEvaluationWithIntervals(entry.report, {
    seed: `kinescope-comparison:${entry.label}`,
    samples,
    level,
  }),
]));
const comparisons = [];
for (let first = 0; first < evaluations.length; first += 1) {
  for (let second = first + 1; second < evaluations.length; second += 1) {
    comparisons.push(compareEvaluationsPaired(
      evaluations[first].report,
      evaluations[second].report,
      {
        labelA: evaluations[first].label,
        labelB: evaluations[second].label,
        seed: `kinescope-pair:${evaluations[first].label}:${evaluations[second].label}`,
        samples,
        level,
      },
    ));
  }
}
const core = {
  schema: 'kinescope.multi-run-comparison.v1',
  inputs: evaluations.map(({ path: filePath, label, report }) => ({
    path: filePath,
    label,
    suiteId: report.suiteId ?? null,
    reportDigest: report.reportDigest ?? null,
  })),
  method: { samples, level, pairing: 'shared itemId' },
  summaries,
  comparisons,
};
const report = { ...core, comparisonSetDigest: stableDigest(core, 'kinescope-comparison-set') };
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, comparisons: comparisons.length, digest: report.comparisonSetDigest }, null, 2));
