#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createResearchManifest } from '../src/research/manifest.js';

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const output = outputIndex >= 0 ? resolve(args[outputIndex + 1]) : null;
const manifest = createResearchManifest();
const json = `${JSON.stringify(manifest, null, 2)}\n`;
if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, json);
}
process.stdout.write(json);
