// @ts-check

import { ProviderError } from './provider-adapters.js';

/** @param {unknown} value */
export function finiteNonnegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

/** @param {unknown} value */
export function nonnegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

/** @param {unknown} usage */
export function normalizeUsage(usage) {
  const typed = usage && typeof usage === 'object' ? /** @type {Record<string,unknown>} */ (usage) : {};
  return {
    inputTokens: nonnegativeInteger(typed.inputTokens),
    outputTokens: nonnegativeInteger(typed.outputTokens),
    costUsd: finiteNonnegative(typed.costUsd),
  };
}

/** @param {{inputTokens:number,outputTokens:number,costUsd:number}} target @param {{inputTokens:number,outputTokens:number,costUsd:number}} addition */
export function addUsage(target, addition) {
  target.inputTokens += addition.inputTokens;
  target.outputTokens += addition.outputTokens;
  target.costUsd += addition.costUsd;
}

/** @param {unknown} error */
export function serializeError(error) {
  if (error instanceof ProviderError) return {
    name: error.name,
    message: error.message,
    code: error.code,
    status: error.status,
    retryable: error.retryable,
    details: error.details,
  };
  if (error instanceof Error) return { name: error.name, message: error.message, retryable: true };
  return { name: 'Error', message: String(error), retryable: true };
}

/** @param {unknown} error */
export function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError'
    || error instanceof Error && error.name === 'AbortError';
}

/** @param {(signal:AbortSignal)=>Promise<any>} operation @param {number} timeoutMs */
export async function withTimeout(operation, timeoutMs) {
  const controller = new AbortController();
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const error = new Error(`Provider request exceeded ${timeoutMs} ms.`);
      error.name = 'AbortError';
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** @param {any} provider */
export function providerIdentity(provider) {
  return {
    id: String(provider.id),
    kind: String(provider.kind ?? 'unknown'),
    model: String(provider.model),
    version: provider.version == null ? null : String(provider.version),
    contamination: provider.contamination ?? {
      usesPrivateTargets: false,
      evaluationEligible: true,
      purpose: 'model-evaluation',
    },
  };
}

/** @param {any[]} entries @param {string} key */
export function keyedMap(entries, key) {
  const map = new Map();
  for (const entry of entries ?? []) {
    if (entry && typeof entry === 'object' && typeof entry[key] === 'string') map.set(entry[key], entry);
  }
  return map;
}

/** @param {{maxCostUsd:number}} options */
export function createBudgetManager(options) {
  let spent = 0;
  let reserved = 0;
  let tail = Promise.resolve();
  /** @template T @param {()=>T|Promise<T>} operation */
  async function locked(operation) {
    const previous = tail;
    let release = () => {};
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
  return {
    /** @param {number|null} estimate */
    reserve(estimate) {
      return locked(() => {
        const normalized = estimate === null ? 0 : finiteNonnegative(estimate);
        if (Number.isFinite(options.maxCostUsd)) {
          if (spent >= options.maxCostUsd) return null;
          if (estimate !== null && spent + reserved + normalized > options.maxCostUsd) return null;
        }
        reserved += normalized;
        return { estimate: normalized };
      });
    },
    /** @param {{estimate:number}|null} reservation @param {number} actual */
    settle(reservation, actual) {
      return locked(() => {
        if (reservation) reserved = Math.max(0, reserved - reservation.estimate);
        spent += finiteNonnegative(actual);
        return spent;
      });
    },
    snapshot() {
      return {
        spentUsd: spent,
        reservedUsd: reserved,
        maxCostUsd: Number.isFinite(options.maxCostUsd) ? options.maxCostUsd : null,
      };
    },
  };
}
