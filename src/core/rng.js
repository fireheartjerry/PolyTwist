// @ts-check

/** @param {string|number} seed */
export function hashSeed(seed) {
  const text = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Deterministic Mulberry32 PRNG.
 * @param {string|number} seed
 */
export function createRng(seed) {
  let state = hashSeed(seed);
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {()=>number} rng @param {number} min @param {number} max */
export function randomRange(rng, min, max) {
  return min + (max - min) * rng();
}

/** @template T @param {()=>number} rng @param {readonly T[]} values @returns {T} */
export function randomChoice(rng, values) {
  if (values.length === 0) throw new Error('Cannot choose from an empty array.');
  return values[Math.floor(rng() * values.length)];
}

/** @template T @param {()=>number} rng @param {T[]} values */
export function shuffleInPlace(rng, values) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
