// @ts-check

import { BASE_RESEARCH_SCHEMAS } from './base-schemas.js';
import { MODEL_RUN_SCHEMAS } from './model-run-schemas.js';

export const RESEARCH_SCHEMAS = Object.freeze({
  ...BASE_RESEARCH_SCHEMAS,
  ...MODEL_RUN_SCHEMAS,
});

export function schemaCatalog() {
  return Object.entries(RESEARCH_SCHEMAS).map(([name, schema]) => ({
    name,
    id: schema.$id,
    title: schema.title,
  }));
}
