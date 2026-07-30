// @ts-check

import { canonicalize, stableDigest } from './canonical.js';

export const RESPONSE_PARSER_MODES = Object.freeze(['strict-json', 'single-json-fence']);

/** @param {unknown} value */
function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** @param {string} raw @param {string} mode */
function parseJsonText(raw, mode) {
  const trimmed = raw.trim();
  if (mode === 'strict-json') return JSON.parse(trimmed);
  if (mode === 'single-json-fence') {
    const match = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
    if (!match) throw new Error('Response is not exactly one JSON code fence.');
    return JSON.parse(match[1]);
  }
  throw new Error(`Unknown response parser mode ${mode}.`);
}

/**
 * Strictly parses one provider response. It does not extract a JSON substring,
 * rewrite quotes, infer missing keys, or otherwise improve the tested answer.
 *
 * @param {{itemId:string,rawResponse:string,attempt?:number,parserMode?:string,requestDigest?:string}} input
 */
export function parseModelResponse(input) {
  const itemId = String(input.itemId);
  const rawResponse = String(input.rawResponse ?? '');
  const attempt = Math.max(0, Math.trunc(input.attempt ?? 0));
  const parserMode = String(input.parserMode ?? 'strict-json');
  const errors = [];
  const warnings = [];
  let parsed = null;
  try {
    parsed = parseJsonText(rawResponse, parserMode);
  } catch (error) {
    errors.push(`invalid-json:${error instanceof Error ? error.message : String(error)}`);
  }
  if (parsed !== null) {
    if (!isPlainObject(parsed)) {
      errors.push('response-must-be-a-json-object');
    } else {
      const object = /** @type {Record<string,unknown>} */ (parsed);
      const allowedKeys = new Set(['answer', 'confidence', 'itemId', 'rationale', 'metadata']);
      const unknownKeys = Object.keys(object).filter((key) => !allowedKeys.has(key));
      if (unknownKeys.length > 0) errors.push(`unknown-top-level-keys:${unknownKeys.sort().join(',')}`);
      if (!Object.prototype.hasOwnProperty.call(object, 'answer')) errors.push('missing-answer');
      if (object.itemId !== undefined && object.itemId !== itemId) errors.push('item-id-mismatch');
      if (object.confidence !== undefined) {
        if (typeof object.confidence !== 'number' || !Number.isFinite(object.confidence)) {
          errors.push('confidence-must-be-finite-number');
        } else if (object.confidence < 0 || object.confidence > 1) {
          errors.push('confidence-out-of-range');
        }
      } else {
        warnings.push('confidence-omitted');
      }
      if (object.rationale !== undefined && typeof object.rationale !== 'string') {
        errors.push('rationale-must-be-string');
      }
      try {
        parsed = canonicalize(parsed);
      } catch (error) {
        errors.push(`non-canonical-json:${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  const recordCore = {
    schema: 'kinescope.parse-record.v1',
    itemId,
    attempt,
    parserMode,
    requestDigest: input.requestDigest ?? null,
    rawDigest: stableDigest(rawResponse, 'kinescope-raw-response'),
    valid: errors.length === 0,
    errors,
    warnings,
    parsed: errors.length === 0 ? parsed : null,
  };
  return {
    ...recordCore,
    parseDigest: stableDigest(recordCore, 'kinescope-parse-record'),
  };
}

/**
 * Converts a valid parse record into the evaluator prediction contract without
 * touching or repairing the answer value.
 *
 * @param {ReturnType<typeof parseModelResponse>} parseRecord
 * @param {{latencyMs?:number,inputTokens?:number,outputTokens?:number,costUsd?:number,metadata?:Record<string,unknown>}} [usage]
 */
export function predictionFromParseRecord(parseRecord, usage = {}) {
  if (!parseRecord.valid || !parseRecord.parsed || typeof parseRecord.parsed !== 'object') {
    throw new Error(`Cannot normalize invalid response for ${parseRecord.itemId}.`);
  }
  const parsed = /** @type {Record<string,unknown>} */ (parseRecord.parsed);
  const prediction = {
    itemId: parseRecord.itemId,
    answer: parsed.answer,
    metadata: {
      parseDigest: parseRecord.parseDigest,
      responseDigest: parseRecord.rawDigest,
      ...(usage.metadata ?? {}),
    },
  };
  if (typeof parsed.confidence === 'number') prediction.confidence = parsed.confidence;
  if (Number.isFinite(usage.latencyMs)) prediction.latencyMs = Math.max(0, Number(usage.latencyMs));
  if (Number.isInteger(usage.inputTokens) && Number(usage.inputTokens) >= 0) prediction.inputTokens = Number(usage.inputTokens);
  if (Number.isInteger(usage.outputTokens) && Number(usage.outputTokens) >= 0) prediction.outputTokens = Number(usage.outputTokens);
  if (Number.isFinite(usage.costUsd) && Number(usage.costUsd) >= 0) prediction.costUsd = Number(usage.costUsd);
  return prediction;
}
