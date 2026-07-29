import { writeFile } from 'node:fs/promises';
import { analyzeCurrentDynamics } from '../src/core/dynamics-analysis.js';
import { compilePuzzle } from '../src/core/puzzle-compiler.js';
import { PuzzleEngine } from '../src/core/puzzle-engine.js';
import { createPreset } from '../src/core/presets.js';

const args = process.argv.slice(2);
const presetId = args[0] ?? 'ghost-3';
const seed = args[1] ?? 'artifact-001';
const sequenceIndex = args.indexOf('--sequence');
const outputIndex = args.indexOf('--output');
const maxOrderIndex = args.indexOf('--max-order');
const sequence = sequenceIndex >= 0 ? (args[sequenceIndex + 1] ?? '') : '';
const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
const maxOrder = maxOrderIndex >= 0 ? Number(args[maxOrderIndex + 1]) : 32;

const engine = new PuzzleEngine(compilePuzzle(createPreset(presetId, seed)));
if (sequence) {
  for (const token of sequence.trim().split(/[\s,]+/).filter(Boolean)) engine.applyMove(token);
}
const report = analyzeCurrentDynamics(engine, { maxOrder });
const json = `${JSON.stringify(report, null, 2)}\n`;
console.log(json);
if (output) await writeFile(output, json);
