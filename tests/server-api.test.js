import test from 'node:test';
import assert from 'node:assert/strict';

import { createPreset } from '../src/core/presets.js';
import { renderPuzzlePng } from '../src/server/software-renderer.js';
import { handleApiRequest } from '../src/server/api.js';


test('software renderer emits deterministic synchronized PNG observations', () => {
  const request = {
    spec: createPreset('ghost-3'),
    sequence: ['R', 'U'],
    mode: 'piece',
    width: 128,
    height: 128,
  };
  const first = renderPuzzlePng(request);
  const second = renderPuzzlePng(request);
  assert.deepEqual(first.png, second.png);
  assert.deepEqual([...first.png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(first.metadata.mode, 'piece');
  assert.ok(first.metadata.statistics.uniquePixelsWritten > 0);
  assert.ok(first.metadata.statistics.visiblePixelFraction <= 1);
  assert.match(first.metadata.imageDigest, /^kinescope-png1-/);

  const depth = renderPuzzlePng({ ...request, mode: 'depth' });
  assert.notEqual(first.metadata.imageDigest, depth.metadata.imageDigest);
});


test('HTTP API serves health, exact transitions, and binary renders', async () => {
  const health = await handleApiRequest(new Request('http://localhost/api/v1/health'));
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.ok, true);
  assert.equal(healthBody.data.platform, 'KineScope');

  const create = await handleApiRequest(new Request('http://localhost/api/v1/state/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ preset: 'classic-2', scrambleDepth: 0 }),
  }));
  const created = await create.json();
  assert.equal(created.ok, true);

  const transition = await handleApiRequest(new Request('http://localhost/api/v1/state/transition', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ preset: 'classic-2', state: created.data.state, action: 'R' }),
  }));
  const transitioned = await transition.json();
  assert.equal(transitioned.data.accepted, true);
  assert.notEqual(transitioned.data.stateBefore.hash, transitioned.data.stateAfter.hash);

  const render = await handleApiRequest(new Request('http://localhost/api/v1/render?format=png', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ preset: 'ghost-2', mode: 'normal', width: 96, height: 96, format: 'png' }),
  }));
  assert.equal(render.status, 200);
  assert.equal(render.headers.get('content-type'), 'image/png');
  const bytes = new Uint8Array(await render.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});


test('Vercel adapter preserves the Fetch API response contract', async () => {
  const { createVercelHandler } = await import('../src/server/vercel-adapter.js');
  const handler = createVercelHandler();
  const output = {
    statusCode: 0,
    headers: {},
    body: Buffer.alloc(0),
    setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
    end(value = Buffer.alloc(0)) { this.body = Buffer.from(value); },
  };
  const request = {
    method: 'GET',
    url: '/api/v1/health',
    headers: { host: 'localhost', 'x-forwarded-proto': 'https' },
    async *[Symbol.asyncIterator]() {},
  };

  await handler(request, output);
  assert.equal(output.statusCode, 200);
  assert.match(String(output.headers['content-type']), /application\/json/);
  const body = JSON.parse(output.body.toString('utf8'));
  assert.equal(body.ok, true);
  assert.equal(body.data.platform, 'KineScope');
});
