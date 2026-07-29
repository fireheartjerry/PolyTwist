// @ts-check

import { compilePuzzle, defaultFaceMoves } from './puzzle-compiler.js';
import { alienPreset, hslToRgb } from './presets.js';
import { createRng, randomRange } from './rng.js';
import { ENGINE_VERSION } from '../version.js';

/** @typedef {import('./puzzle-compiler.js').PuzzleSpec} PuzzleSpec */

/** @param {string|number} value */
function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'group';
}

/**
 * Changes only rendered material parameters. Geometry, piece decomposition, and action
 * semantics remain byte-for-byte identical.
 * @param {PuzzleSpec} input
 * @param {string|number} seed
 * @returns {PuzzleSpec}
 */
export function withAppearanceVariant(input, seed) {
  const spec = structuredClone(input);
  const rng = createRng(`appearance:${seed}`);
  const hue = randomRange(rng, 0, 360);
  spec.appearance = {
    ...spec.appearance,
    palette: 'factorial-appearance-variant',
    bodyColor: hslToRgb((hue + 202) % 360, 0.18, 0.055),
    outerColor: hslToRgb(hue, randomRange(rng, 0.45, 0.72), randomRange(rng, 0.38, 0.58)),
    accentColor: hslToRgb((hue + randomRange(rng, 75, 155)) % 360, 0.82, 0.62),
    roughness: randomRange(rng, 0.16, 0.58),
    metallic: randomRange(rng, 0.08, 0.9),
    seed: `appearance:${seed}`,
  };
  spec.metadata = { ...spec.metadata, appearanceVariant: 'A1' };
  return spec;
}

/**
 * Changes only the hidden action semantics. The initial geometry and all material parameters
 * remain identical, while each familiar action ID is remapped to another mechanism axis.
 * @param {PuzzleSpec} input
 * @returns {PuzzleSpec}
 */
export function withMechanicsVariant(input) {
  const spec = structuredClone(input);
  spec.moves = defaultFaceMoves(spec.size).map((move) => ({
    ...move,
    axis: /** @type {0|1|2} */ ((move.axis + 1) % 3),
  }));
  spec.metadata = { ...spec.metadata, mechanicsVariant: 'M1-axis-cycle' };
  return spec;
}

/**
 * Creates a controlled 2×2 appearance/mechanics factorial group.
 * @param {string|number} seed
 */
export function createDisentanglementGroup(seed) {
  const groupId = safeId(seed);
  const base = alienPreset(`factorial:${seed}`);
  base.metadata = { ...base.metadata, factorialGroup: groupId, appearanceVariant: 'A0', mechanicsVariant: 'M0' };

  const conditions = [
    { code: 'A0M0', spec: structuredClone(base) },
    { code: 'A1M0', spec: withAppearanceVariant(base, seed) },
    { code: 'A0M1', spec: withMechanicsVariant(base) },
    { code: 'A1M1', spec: withMechanicsVariant(withAppearanceVariant(base, seed)) },
  ];

  return {
    groupId,
    conditions: conditions.map(({ code, spec }) => {
      spec.id = `factorial-${groupId}-${code.toLowerCase()}`;
      spec.name = `Factorial ${groupId} ${code}`;
      spec.description = `Controlled ${code} condition for appearance–mechanics disentanglement.`;
      spec.metadata = { ...spec.metadata, factorialGroup: groupId, condition: code };
      const compiled = compilePuzzle(spec);
      return {
        code,
        spec,
        compileStats: compiled.stats,
        actionSemantics: compiled.moves,
      };
    }),
  };
}

/**
 * @param {{groups?:number,seed?:string|number}} [options]
 */
export function createBenchmarkSuite(options = {}) {
  const count = Math.max(1, Math.min(512, Math.trunc(options.groups ?? 8)));
  const seed = options.seed ?? 'suite-001';
  const groups = [];
  for (let index = 0; index < count; index += 1) {
    groups.push(createDisentanglementGroup(`${seed}:${String(index).padStart(4, '0')}`));
  }
  return {
    schema: 'kinescope.spec-suite.v1',
    engineVersion: ENGINE_VERSION,
    seed: String(seed),
    design: '2x2-appearance-mechanics-factorial',
    groupCount: groups.length,
    conditionCount: groups.length * 4,
    groups,
  };
}
