#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runIdealRigidDisplayExperiment } from '../src/research/rigid-display-experiment.js';

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const output = outputIndex >= 0 ? resolve(args[outputIndex + 1]) : null;
const seedIndex = args.indexOf('--seed');
const seed = seedIndex >= 0 ? args[seedIndex + 1] : undefined;
const report = runIdealRigidDisplayExperiment({ seed });
const json = `${JSON.stringify(report, null, 2)}\n`;

if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, json);
  process.stdout.write(`${JSON.stringify({
    valid: report.valid,
    reportDigest: report.reportDigest,
    summary: report.summary,
    output,
  }, null, 2)}\n`);
} else {
  process.stdout.write(json);
}
if (!report.valid) process.exitCode = 1;
