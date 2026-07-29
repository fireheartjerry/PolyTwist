import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join } from 'node:path';

async function collect(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else files.push(full);
  }
  return files;
}

const sourceRoots = ['src', 'scripts', 'tests'];
const sourceFiles = (await Promise.all(sourceRoots.map(collect))).flat().filter((file) => /\.(?:m?js)$/.test(file)).sort();
for (const file of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const jsonFiles = [
  'package.json',
  'vercel.json',
  'tsconfig.check.json',
  ...(await collect('schema')).filter((file) => extname(file) === '.json'),
].sort();
for (const file of jsonFiles) JSON.parse(await readFile(file, 'utf-8'));

console.log(`Syntax checked ${sourceFiles.length} JavaScript modules and parsed ${jsonFiles.length} JSON files.`);
