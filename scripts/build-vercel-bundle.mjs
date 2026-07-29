#!/usr/bin/env node
// @ts-check

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'deployment-vercel');
const ENTRY = path.join(ROOT, 'src/server/api.js');
const nativeRequire = createRequire(import.meta.url);
const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const ts = nativeRequire(path.join(npmRoot, 'typescript/lib/typescript.js'));

/** @param {string} absolute */
function moduleId(absolute) {
  return path.relative(ROOT, absolute).split(path.sep).join('/');
}

/** @param {string} entry */
async function collect(entry) {
  const pending = [entry];
  const visited = new Set();
  const imports = /(?:from\s+|import\s+)(['"])([^'"]+)\1/g;
  while (pending.length) {
    const absolute = pending.pop();
    if (!absolute || visited.has(absolute)) continue;
    visited.add(absolute);
    const source = await readFile(absolute, 'utf8');
    for (const match of source.matchAll(imports)) {
      const specifier = match[2];
      if (!specifier.startsWith('.')) continue;
      let target = path.resolve(path.dirname(absolute), specifier);
      if (!path.extname(target)) target += '.js';
      if (!target.startsWith(path.join(ROOT, 'src'))) throw new Error(`${moduleId(absolute)} imports outside src: ${specifier}`);
      pending.push(target);
    }
  }
  return [...visited].sort();
}

const sources = await collect(ENTRY);
const entries = [];
for (const absolute of sources) {
  const id = moduleId(absolute);
  const source = await readFile(absolute, 'utf8');
  const output = ts.transpileModule(source, {
    fileName: id,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      removeComments: true,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      sourceMap: false,
      inlineSourceMap: false,
    },
  }).outputText.trim();
  entries.push(`${JSON.stringify(id)}:function(require,module,exports){${output}\n}`);
}

const adapter = `import { createRequire as __createRequire } from 'node:module';
import path from 'node:path';
const __nativeRequire=__createRequire(process.cwd()+'/api/index.js');
const __modules={${entries.join(',')}};
const __cache=Object.create(null);
function __resolve(from,spec){
  if(!spec.startsWith('.'))return spec;
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));
  return path.posix.extname(resolved)?resolved:resolved+'.js';
}
function __load(id){
  if(__cache[id])return __cache[id].exports;
  const factory=__modules[id];
  if(!factory)throw new Error('Bundled module not found: '+id);
  const module={exports:{}};
  __cache[id]=module;
  factory((spec)=>{const resolved=__resolve(id,spec);return spec.startsWith('.')?__load(resolved):__nativeRequire(resolved);},module,module.exports);
  return module.exports;
}
const __api=__load('src/server/api.js');
export const handleApiRequest=__api.handleApiRequest;
export const createOpenApiDocument=__api.createOpenApiDocument;
export default async function handler(req,res){
  const protocol=String(req.headers?.['x-forwarded-proto']??'https').split(',')[0].trim();
  const host=req.headers?.host??'localhost';
  const url=new URL(req.url??'/',protocol+'://'+host);
  const chunks=[];
  if(!['GET','HEAD'].includes(req.method??'GET'))for await(const chunk of req)chunks.push(Buffer.from(chunk));
  const request=new Request(url,{method:req.method??'GET',headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});
  const response=await __api.handleApiRequest(request);
  res.statusCode=response.status;
  for(const [key,value] of response.headers)res.setHeader(key,value);
  const bytes=Buffer.from(await response.arrayBuffer());
  res.end(bytes);
}
`;

await rm(OUTPUT, { recursive: true, force: true });
await mkdir(path.join(OUTPUT, 'api'), { recursive: true });
await writeFile(path.join(OUTPUT, 'api/index.js'), adapter);
await writeFile(path.join(OUTPUT, 'index.html'), await readFile(path.join(ROOT, 'dist/index.html')));
await writeFile(path.join(OUTPUT, 'vercel.json'), `${JSON.stringify({
  cleanUrls: true,
  trailingSlash: false,
  functions: { 'api/index.js': { maxDuration: 300 } },
  rewrites: [
    { source: '/api/v1', destination: '/api?route=health' },
    { source: '/api/v1/:path*', destination: '/api?route=:path*' },
  ],
  headers: [
    {
      source: '/api/(.*)',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Cache-Control', value: 'no-store' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
  ],
}, null, 2)}\n`);
await writeFile(path.join(OUTPUT, 'package.json'), `${JSON.stringify({
  name: 'kinescope-deployment',
  version: 'unversioned',
  private: true,
  type: 'module',
}, null, 2)}\n`);
await writeFile(path.join(OUTPUT, 'bundle.json'), `${JSON.stringify({
  schema: 'kinescope.vercel-bundle.v1',
  sourceModuleCount: sources.length,
  apiBytes: Buffer.byteLength(adapter),
  staticBytes: (await readFile(path.join(ROOT, 'dist/index.html'))).byteLength,
}, null, 2)}\n`);
console.log(`Built deployment-vercel with ${sources.length} bundled API modules (${Buffer.byteLength(adapter).toLocaleString()} bytes).`);
