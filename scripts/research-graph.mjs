#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createPreset } from '../src/core/presets.js';
import { exploreStateGraph } from '../src/research/state-graph.js';

const args = process.argv.slice(2);
const read = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const preset = read('--preset', 'classic-2');
const seed = read('--seed', 'graph-001');
const output = resolve(read('--output', `datasets/${preset}-state-graph.json`));
const report = exploreStateGraph(createPreset(preset, seed), {
  maxStates: Number(read('--max-states', '512')),
  maxDepth: Number(read('--max-depth', '5')),
  includeExactStates: args.includes('--exact-states'),
});
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, puzzleId: report.puzzleId, ...report.summary, reportDigest: report.reportDigest }, null, 2));
