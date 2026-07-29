import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from '../src/server/api.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? process.argv[2] ?? 4173);
const host = process.env.HOST ?? '127.0.0.1';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
};

async function nodeRequestToFetch(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://${request.headers.host ?? `127.0.0.1:${port}`}${request.url}`, {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method ?? 'GET') ? undefined : body,
    duplex: body ? 'half' : undefined,
  });
}

async function sendFetchResponse(response, output) {
  output.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output.write(Buffer.from(value));
    }
  }
  output.end();
}

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname;
    if (pathname.startsWith('/api/')) {
      await sendFetchResponse(await handleApiRequest(await nodeRequestToFetch(request)), response);
      return;
    }
    let target = pathname === '/' ? '/index.html' : pathname;
    target = decodeURIComponent(target);
    const absolute = path.resolve(root, `.${target}`);
    if (!absolute.startsWith(root)) throw new Error('Path traversal rejected. Humanity survives another afternoon.');
    let info;
    try { info = await stat(absolute); } catch { info = null; }
    if (!info?.isFile()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    const data = await readFile(absolute);
    response.writeHead(200, {
      'content-type': mime[path.extname(absolute)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    response.end(data);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.stack : String(error));
  }
});

server.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  console.log(`KineScope listening on ${host}:${port}`);
  console.log(`Browser laboratory: http://${displayHost}:${port}`);
  console.log(`API health: http://${displayHost}:${port}/api/v1/health`);
});
