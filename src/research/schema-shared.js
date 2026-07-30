// @ts-check

export const schemaId = (name) => `https://kinescope.dev/schema/${name}.schema.json`;

export const usageProperties = {
  inputTokens: { type: 'integer', minimum: 0 },
  outputTokens: { type: 'integer', minimum: 0 },
  costUsd: { type: 'number', minimum: 0 },
};

export const digestSchema = { type: 'string', pattern: '^[a-z0-9-]+1-[0-9a-f]{32}$' };
