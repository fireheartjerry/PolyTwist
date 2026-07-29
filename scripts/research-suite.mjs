#!/usr/bin/env node
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { generateResearchSuite, suiteAsJsonl } from '../src/research/dataset.js';

const args = process.argv.slice(2);
const read = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const seed = read('--seed', 'kinescope-suite-001');
const output = resolve(read('--output', 'datasets/kinescope-suite'));
const splits = read('--splits', 'validation,test-iid,test-appearance-ood,test-geometry-ood,test-mechanics-ood,test-compositional-ood,test-adversarial')
  .split(',').map((entry) => entry.trim()).filter(Boolean);
const suite = generateResearchSuite({
  seed,
  splits,
  episodesPerSplit: Number(read('--episodes-per-split', '1')),
  horizon: Number(read('--horizon', '5')),
  scrambleDepth: Number(read('--scramble-depth', '3')),
  includeDiagnostics: !args.includes('--no-diagnostics'),
});
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const files = suiteAsJsonl(suite);
for (const [relative, contents] of Object.entries(files)) {
  const target = join(output, relative);
  await mkdir(resolve(target, '..'), { recursive: true });
  await writeFile(target, contents);
}
if (args.includes('--monolithic')) await writeFile(join(output, 'suite.json'), `${JSON.stringify(suite, null, 2)}\n`);
console.log(JSON.stringify({ output, suiteId: suite.suiteId, suiteDigest: suite.suiteDigest, ...suite.summary }, null, 2));
