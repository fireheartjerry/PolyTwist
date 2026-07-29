#!/usr/bin/env node
// @ts-check

import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

/** Collect only modules reachable from the browser entrypoint. This keeps Node-only
 * server/research modules out of the static import map rather than asking a browser
 * to politely ignore `node:zlib` forever.
 * @param {string} entrypoint
 */
async function collectReachableJavaScript(entrypoint) {
  const pending = [entrypoint];
  const visited = new Set();
  const importPattern = /(?:from\s+|import\s+)(['"])([^'"]+)\1/g;
  while (pending.length) {
    const absolute = pending.pop();
    if (!absolute || visited.has(absolute)) continue;
    visited.add(absolute);
    const source = await readFile(absolute, 'utf8');
    const relative = path.relative(ROOT, absolute).split(path.sep).join('/');
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[2];
      if (!specifier.startsWith('.')) continue;
      let target = path.resolve(path.dirname(absolute), specifier);
      if (!path.extname(target)) target += '.js';
      if (!target.startsWith(path.join(ROOT, 'src'))) {
        throw new Error(`Browser module ${relative} imports outside src: ${specifier}`);
      }
      pending.push(target);
    }
  }
  return [...visited].sort();
}

/** @param {string} source @param {string} relative */
function rewriteRelativeImports(source, relative) {
  const resolve = (specifier) => {
    if (!specifier.startsWith('.')) return specifier;
    return `lml/${path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier))}`;
  };
  return source
    .replace(/from\s+(['"])([^'"]+)\1/g, (match, quote, specifier) =>
      `from ${quote}${resolve(specifier)}${quote}`)
    .replace(/import\s+(['"])([^'"]+)\1/g, (match, quote, specifier) =>
      `import ${quote}${resolve(specifier)}${quote}`);
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

const modules = {};
for (const absolute of await collectReachableJavaScript(path.join(ROOT, 'src/main.js'))) {
  const relative = path.relative(ROOT, absolute).split(path.sep).join('/');
  const rewritten = rewriteRelativeImports(await readFile(absolute, 'utf8'), relative);
  modules[`lml/${relative}`] = `data:text/javascript;base64,${Buffer.from(rewritten).toString('base64')}`;
}

let html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
const css = await readFile(path.join(ROOT, 'app.css'), 'utf8');
const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
html = html.replace('<link rel="stylesheet" href="./app.css">', `<style>\n${css}\n</style>`);
html = html.replace('<script type="module" src="./src/main.js"></script>', '');
const bootstrap = [
  `<!-- KineScope ${packageJson.version} single-file research build -->`,
  `<script type="importmap">${JSON.stringify({ imports: modules })}</script>`,
  '<script type="module">import "lml/src/main.js";</script>',
].join('\n');
html = html.replace('</body>', `${bootstrap}\n</body>`);

await writeFile(path.join(DIST, 'index.html'), html);
await writeFile(path.join(DIST, 'build.json'), `${JSON.stringify({
  schema: 'kinescope.static-build.v1',
  version: packageJson.version,
  moduleCount: Object.keys(modules).length,
  entrypoint: 'index.html',
}, null, 2)}\n`);

console.log(`Built dist/index.html (${Buffer.byteLength(html).toLocaleString()} bytes, ${Object.keys(modules).length} modules).`);
