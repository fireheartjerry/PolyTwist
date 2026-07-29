import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT ?? process.argv[2] ?? 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const decoded = decodeURIComponent(url.pathname);
    const relative = normalize(decoded).replace(/^[/\\]+/, '');
    let path = resolve(join(root, relative || 'index.html'));
    if (!path.startsWith(root)) throw new Error('Path traversal rejected.');
    if (statSync(path).isDirectory()) path = join(path, 'index.html');
    response.writeHead(200, {
      'Content-Type': mime[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'X-Content-Type-Options': 'nosniff',
    });
    createReadStream(path).pipe(response);
  } catch (error) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Not found\n${error instanceof Error ? error.message : String(error)}\n`);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`KineScope running at http://127.0.0.1:${port}`);
});
