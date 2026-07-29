// @ts-check

import { compilePuzzle } from './puzzle-compiler.js';
import { createRng, randomRange } from './rng.js';

/** @typedef {import('./puzzle-compiler.js').PuzzleSpec} PuzzleSpec */


/** @returns {PuzzleSpec} */
export function classic2Preset() {
  return {
    id: 'classic-2',
    name: 'Classic 2×2',
    family: 'orthogonal-cube',
    description: 'A compact exact control intended for exhaustive and bounded state-graph experiments.',
    size: 2,
    outer: { halfSize: [1, 1, 1], chamfer: 0.03, cornerChamfer: 0.02 },
    mechanism: { origin: [0, 0, 0], eulerDeg: [0, 0, 0], cutSpacing: 1 },
    appearance: {
      palette: 'classic',
      bodyColor: [0.028, 0.033, 0.043],
      roughness: 0.3,
      metallic: 0.03,
    },
    validation: { expectedRenderable: 8, strictTopology: true },
    metadata: { mechanicsVisibility: 'known', difficulty: 'graph-control', scale: 2 },
  };
}

/** @returns {PuzzleSpec} */
export function ghost2Preset() {
  return {
    id: 'ghost-2',
    name: 'Ghost Frame 2×2',
    family: 'tilted-frame-shapemod',
    description: 'A compact shape-changing mechanism for exact graph exploration under irregular geometry.',
    size: 2,
    outer: { halfSize: [1.03, 1.03, 1.03], chamfer: 0.038, cornerChamfer: 0.026 },
    mechanism: { origin: [0.028, -0.022, 0.018], eulerDeg: [7.0, -8.0, 5.0], cutSpacing: 1 },
    appearance: {
      palette: 'ghost',
      bodyColor: [0.025, 0.029, 0.038],
      outerColor: [0.55, 0.61, 0.69],
      accentColor: [0.22, 0.76, 1],
      roughness: 0.26,
      metallic: 0.72,
    },
    validation: { expectedRenderable: 8, strictTopology: true },
    metadata: { mechanicsVisibility: 'hidden', difficulty: 'graph-ood-shape', scale: 2 },
  };
}

/** @returns {PuzzleSpec} */
export function classicPreset() {
  return {
    id: 'classic-3',
    name: 'Classic 3×3',
    family: 'orthogonal-cube',
    description: 'Canonical mechanics and color cues. The control condition, because science occasionally needs one.',
    size: 3,
    outer: { halfSize: [1.5, 1.5, 1.5], chamfer: 0.035, cornerChamfer: 0.025 },
    mechanism: { origin: [0, 0, 0], eulerDeg: [0, 0, 0], cutSpacing: 1 },
    appearance: {
      palette: 'classic',
      bodyColor: [0.028, 0.033, 0.043],
      roughness: 0.3,
      metallic: 0.03,
    },
    validation: { expectedRenderable: 26, strictTopology: true },
    metadata: { mechanicsVisibility: 'known', difficulty: 'baseline' },
  };
}

/** @returns {PuzzleSpec} */
export function ghostPreset() {
  return {
    id: 'ghost-3',
    name: 'Ghost Frame 3',
    family: 'tilted-frame-shapemod',
    description: 'A cube-shaped hull cut in a displaced mechanism frame, producing irregular pieces and shape-shifting turns.',
    size: 3,
    outer: { halfSize: [1.53, 1.53, 1.53], chamfer: 0.045, cornerChamfer: 0.03 },
    mechanism: { origin: [0.045, -0.035, 0.025], eulerDeg: [7.5, -9.5, 5.5], cutSpacing: 1.01 },
    appearance: {
      palette: 'ghost',
      bodyColor: [0.025, 0.029, 0.038],
      outerColor: [0.55, 0.61, 0.69],
      accentColor: [0.22, 0.76, 1],
      roughness: 0.26,
      metallic: 0.72,
    },
    validation: { expectedRenderable: 26, strictTopology: true },
    metadata: { mechanicsVisibility: 'hidden', difficulty: 'ood-shape' },
  };
}


/** @returns {PuzzleSpec} */
export function ghost4Preset() {
  return {
    id: 'ghost-4',
    name: 'Ghost Frame 4×4',
    family: 'tilted-frame-shapemod',
    description: 'A 4×4 shape-mod with 64 exact logical cells and 56 visible pieces, useful for scaling and longer-horizon tracking.',
    size: 4,
    outer: { halfSize: [2.04, 2.04, 2.04], chamfer: 0.048, cornerChamfer: 0.032 },
    mechanism: { origin: [0.035, -0.025, 0.02], eulerDeg: [5.5, -7.5, 4.2], cutSpacing: 1 },
    appearance: {
      palette: 'ghost',
      bodyColor: [0.022, 0.027, 0.036],
      outerColor: [0.48, 0.57, 0.68],
      accentColor: [0.23, 0.8, 1],
      roughness: 0.25,
      metallic: 0.7,
    },
    validation: { expectedRenderable: 56, strictTopology: true },
    metadata: { mechanicsVisibility: 'hidden', difficulty: 'long-horizon', scale: 4 },
  };
}

/** @returns {PuzzleSpec} */
export function classic4Preset() {
  return {
    id: 'classic-4',
    name: 'Classic 4×4',
    family: 'orthogonal-cube',
    description: 'A larger orthogonal control with exact outer-face generators and hidden interior logical cells.',
    size: 4,
    outer: { halfSize: [2, 2, 2], chamfer: 0.035, cornerChamfer: 0.025 },
    mechanism: { origin: [0, 0, 0], eulerDeg: [0, 0, 0], cutSpacing: 1 },
    appearance: {
      palette: 'classic',
      bodyColor: [0.028, 0.033, 0.043],
      roughness: 0.3,
      metallic: 0.03,
    },
    validation: { expectedRenderable: 56, strictTopology: true },
    metadata: { mechanicsVisibility: 'known', difficulty: 'scale-control', scale: 4 },
  };
}

/** @returns {PuzzleSpec} */
export function bandagedRelayPreset() {
  return {
    id: 'bandaged-relay-3',
    name: 'Bandaged Relay 3',
    family: 'state-dependent-bandaged-shapemod',
    description: 'A visually ordinary shape-mod with bonded piece clusters that make action legality depend on the current exact state.',
    size: 3,
    outer: { halfSize: [1.54, 1.5, 1.57], chamfer: 0.052, cornerChamfer: 0.034 },
    mechanism: { origin: [0.025, -0.02, 0.018], eulerDeg: [4.8, -6.4, 3.7], cutSpacing: 1 },
    constraints: {
      bandages: [
        {
          id: 'north-bridge',
          label: 'North bridge',
          cells: [[2, 2, 2], [2, 1, 2]],
        },
        {
          id: 'south-key',
          label: 'South key',
          cells: [[0, 0, 0], [0, 0, 1]],
        },
      ],
    },
    appearance: {
      palette: 'bandaged',
      bodyColor: [0.018, 0.024, 0.034],
      outerColor: [0.24, 0.46, 0.66],
      accentColor: [0.28, 0.92, 0.76],
      roughness: 0.24,
      metallic: 0.62,
      seed: 'bandaged-relay-3',
    },
    validation: { expectedRenderable: 26, strictTopology: true },
    metadata: {
      mechanicsVisibility: 'withheld',
      difficulty: 'state-dependent-legality',
      hiddenConstraintFamily: 'rigid-bandages',
    },
  };
}

/** @returns {PuzzleSpec} */
export function axisPreset() {
  return {
    id: 'axis-3',
    name: 'Axis Prism 3',
    family: 'diagonal-axis-shapemod',
    description: 'A stronger diagonal cut frame with a rectangular hull. Same latent group, profoundly less cooperative silhouette.',
    size: 3,
    outer: { halfSize: [1.46, 1.58, 1.42], chamfer: 0.055, cornerChamfer: 0.04 },
    mechanism: { origin: [0.025, 0.015, -0.03], eulerDeg: [10, 12, 15], cutSpacing: 1.02 },
    appearance: {
      palette: 'axis',
      bodyColor: [0.02, 0.025, 0.035],
      outerColor: [0.12, 0.36, 0.72],
      accentColor: [0.43, 0.9, 1],
      roughness: 0.22,
      metallic: 0.58,
    },
    validation: { expectedRenderable: 26, strictTopology: true },
    metadata: { mechanicsVisibility: 'hidden', difficulty: 'hard-shape' },
  };
}

/** @returns {PuzzleSpec} */
export function mirrorPrismPreset() {
  return {
    id: 'mirror-prism-3',
    name: 'Mirror Prism 3',
    family: 'anisotropic-hull-shapemod',
    description: 'An anisotropic hull wrapped around ordinary cubic mechanics, separating appearance from transition structure.',
    size: 3,
    outer: { halfSize: [1.7, 1.35, 1.48], chamfer: 0.05, cornerChamfer: 0.035 },
    mechanism: { origin: [0, 0, 0], eulerDeg: [0, 0, 0], cutSpacing: 0.94 },
    appearance: {
      palette: 'mirror',
      bodyColor: [0.025, 0.027, 0.033],
      outerColor: [0.72, 0.73, 0.76],
      accentColor: [1, 0.62, 0.2],
      roughness: 0.2,
      metallic: 0.85,
    },
    validation: { expectedRenderable: 26, strictTopology: true },
    metadata: { mechanicsVisibility: 'known', difficulty: 'appearance-transfer' },
  };
}

/**
 * Generates an unseen but topologically valid shape-mod. Invalid candidates are rejected
 * by the same compiler used for dataset generation.
 * @param {string|number} seed
 * @returns {PuzzleSpec}
 */
export function alienPreset(seed = 'artifact-001') {
  const rng = createRng(seed);
  let lastError = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const localSeed = `${seed}:${attempt}`;
    const hue = randomRange(rng, 175, 315);
    const spec = /** @type {PuzzleSpec} */ ({
      id: `alien-${String(seed).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      name: `Alien Artifact ${String(seed).slice(0, 12)}`,
      family: 'procedural-unseen-mechanics',
      description: 'A deterministic procedural shape-mod reserved for out-of-distribution mechanics discovery.',
      size: 3,
      outer: {
        halfSize: [
          randomRange(rng, 1.42, 1.62),
          randomRange(rng, 1.42, 1.62),
          randomRange(rng, 1.42, 1.62),
        ],
        chamfer: randomRange(rng, 0.025, 0.075),
        cornerChamfer: randomRange(rng, 0.018, 0.05),
      },
      mechanism: {
        origin: [
          randomRange(rng, -0.055, 0.055),
          randomRange(rng, -0.055, 0.055),
          randomRange(rng, -0.055, 0.055),
        ],
        eulerDeg: [
          randomRange(rng, -10.5, 10.5),
          randomRange(rng, -10.5, 10.5),
          randomRange(rng, -10.5, 10.5),
        ],
        cutSpacing: randomRange(rng, 0.97, 1.05),
      },
      appearance: {
        palette: 'alien',
        bodyColor: [0.015, 0.02, 0.03],
        outerColor: hslToRgb(hue, 0.52, 0.5),
        accentColor: hslToRgb((hue + 92) % 360, 0.8, 0.62),
        roughness: randomRange(rng, 0.18, 0.34),
        metallic: randomRange(rng, 0.48, 0.82),
        seed: localSeed,
      },
      validation: { expectedRenderable: 26, strictTopology: true },
      metadata: { mechanicsVisibility: 'withheld', split: 'procedural-ood', seed: localSeed },
    });

    try {
      compilePuzzle(spec);
      return spec;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not generate a valid alien puzzle for seed ${seed}: ${String(lastError)}`);
}

/** @param {number} h @param {number} s @param {number} l @returns {[number,number,number]} */
export function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t0) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)];
}

export const presetCatalog = [
  { id: 'ghost-2', label: 'Ghost Frame 2×2', create: ghost2Preset },
  { id: 'classic-2', label: 'Classic 2×2', create: classic2Preset },
  { id: 'ghost-3', label: 'Ghost Frame 3×3', create: ghostPreset },
  { id: 'ghost-4', label: 'Ghost Frame 4×4', create: ghost4Preset },
  { id: 'axis-3', label: 'Axis Prism 3×3', create: axisPreset },
  { id: 'bandaged-relay-3', label: 'Bandaged Relay 3×3', create: bandagedRelayPreset },
  { id: 'mirror-prism-3', label: 'Mirror Prism 3×3', create: mirrorPrismPreset },
  { id: 'classic-3', label: 'Classic 3×3', create: classicPreset },
  { id: 'classic-4', label: 'Classic 4×4', create: classic4Preset },
];

/** @param {string} id @param {string|number} [seed] */
export function createPreset(id, seed) {
  if (id === 'alien') return alienPreset(seed);
  const entry = presetCatalog.find((preset) => preset.id === id);
  if (!entry) throw new Error(`Unknown preset: ${id}`);
  return entry.create();
}
