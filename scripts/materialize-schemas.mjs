import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RESEARCH_SCHEMAS, schemaCatalog } from '../src/research/schemas.js';
import { ENGINE_VERSION, PLATFORM_NAME } from '../src/version.js';

const output = path.resolve(process.argv[2] ?? 'schema/research');
await mkdir(output, { recursive: true });

for (const [name, schema] of Object.entries(RESEARCH_SCHEMAS)) {
  await writeFile(path.join(output, `${name}.schema.json`), `${JSON.stringify(schema, null, 2)}\n`);
}

await writeFile(path.join(output, 'catalog.json'), `${JSON.stringify({
  schema: 'kinescope.schema-catalog.v1',
  platform: PLATFORM_NAME,
  engineVersion: ENGINE_VERSION,
  schemas: schemaCatalog(),
}, null, 2)}\n`);

console.log(`Wrote ${Object.keys(RESEARCH_SCHEMAS).length} research schemas and catalog to ${output}`);
