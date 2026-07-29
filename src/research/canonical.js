// @ts-check

import { hashSeed } from '../core/rng.js';

/**
 * Recursively normalizes a JSON-compatible value so object key order, undefined values,
 * non-finite numbers, and negative zero cannot quietly alter provenance digests.
 * @param {unknown} value
 * @returns {unknown}
 */
export function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON cannot contain non-finite numbers.');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (typeof value === 'object') {
    const output = {};
    for (const key of Object.keys(/** @type {Record<string,unknown>} */ (value)).sort()) {
      const entry = /** @type {Record<string,unknown>} */ (value)[key];
      if (entry !== undefined) output[key] = canonicalize(entry);
    }
    return output;
  }
  throw new Error(`Canonical JSON cannot encode ${typeof value}.`);
}

/** @param {unknown} value @param {number} [space] */
export function canonicalJson(value, space = 0) {
  return JSON.stringify(canonicalize(value), null, space);
}

/**
 * Stable 128-bit research identifier assembled from four independent 32-bit seeded hashes.
 * It is intended for reproducibility and equality checks, not cryptographic commitments.
 * @param {unknown} value
 * @param {string} [namespace]
 */
export function stableDigest(value, namespace = 'lml') {
  const canonical = typeof value === 'string' ? value : canonicalJson(value);
  const salts = ['north', 'east', 'south', 'west'];
  const words = salts.map((salt) => hashSeed(`${namespace}:${salt}:${canonical}`).toString(16).padStart(8, '0'));
  return `${namespace.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}1-${words.join('')}`;
}

/** @param {unknown} value */
export function deepClone(value) {
  return structuredClone(value);
}

/** @param {unknown} a @param {unknown} b */
export function canonicalEqual(a, b) {
  return canonicalJson(a) === canonicalJson(b);
}

/** @param {string|number} value @param {number} [maxLength] */
export function safeId(value, maxLength = 72) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength) || 'item';
}
