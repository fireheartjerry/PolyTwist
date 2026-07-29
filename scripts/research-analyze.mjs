#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createPreset } from '../src/core/presets.js';
import { analyzePuzzleGeometry } from '../src/research/geometry-analysis.js';

const args = process.argv.slice(2);
const preset = args[0] ?? 'ghost-3';
const seed = args[1] ?? 'analysis-001';
const outputIndex = args.indexOf('--output');
const output = outputIndex >= 0 ? resolve(args[outputIndex + 1]) : null;
const includeFaces = args.includes('--faces');
const report = analyzePuzzleGeometry(createPreset(preset, seed), { includeFaces });
const json = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, json);
}
process.stdout.write(json);
