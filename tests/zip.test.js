import test from 'node:test';
import assert from 'node:assert/strict';

import { crc32, createZip } from '../src/core/zip.js';

test('CRC-32 matches the canonical test vector', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(crc32(bytes), 0xcbf43926);
});

test('dependency-free ZIP writer emits local and end records', async () => {
  const blob = await createZip([
    { name: 'hello.txt', data: 'hello' },
    { name: 'data/state.json', data: '{"ok":true}' },
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(blob.type, 'application/zip');
});
