import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createBenchmarkSuite } from '../src/core/benchmark-suite.js';

const args = process.argv.slice(2);
const read = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const groups = Number(read('--groups', '8'));
const seed = read('--seed', 'suite-001');
const output = resolve(read('--output', 'datasets/spec-suite.json'));
const suite = createBenchmarkSuite({ groups, seed });
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(suite, null, 2)}\n`);
console.log(JSON.stringify({
  output,
  schema: suite.schema,
  design: suite.design,
  groups: suite.groupCount,
  conditions: suite.conditionCount,
}, null, 2));
