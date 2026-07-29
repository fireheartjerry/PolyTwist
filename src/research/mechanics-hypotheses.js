// @ts-check

import { compilePuzzle } from '../core/puzzle-compiler.js';
import { PuzzleEngine } from '../core/puzzle-engine.js';
import { determinant3i, apply3i, key3i } from '../core/mat3i.js';
import { entropyBits } from './statistics.js';
import { stableDigest } from './canonical.js';

/** @typedef {import('../core/puzzle-compiler.js').PuzzleSpec} PuzzleSpec */
/** @typedef {import('../core/mat3i.js').Mat3i} Mat3i */

/** @param {number[]} values */
function permutations(values) {
  if (values.length <= 1) return [values];
  const output = [];
  for (let index = 0; index < values.length; index += 1) {
    const head = values[index];
    const rest = values.slice(0, index).concat(values.slice(index + 1));
    for (const tail of permutations(rest)) output.push([head, ...tail]);
  }
  return output;
}

/**
 * Enumerates the 24 orientation-preserving signed permutation matrices of the cube.
 * @returns {{id:string,matrix:Mat3i,axisMap:{source:0|1|2,target:0|1|2,sign:-1|1}[]}[]}
 */
export function enumerateCubeMechanicsHypotheses() {
  const output = [];
  for (const permutation of permutations([0, 1, 2])) {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const signs = [sx, sy, sz];
      const matrix = Array(9).fill(0);
      for (let source = 0; source < 3; source += 1) matrix[permutation[source] * 3 + source] = signs[source];
      const typed = /** @type {Mat3i} */ (/** @type {unknown} */ (matrix));
      if (determinant3i(typed) !== 1) continue;
      const axisMap = [0, 1, 2].map((source) => ({
        source: /** @type {0|1|2} */ (source),
        target: /** @type {0|1|2} */ (permutation[source]),
        sign: /** @type {-1|1} */ (signs[source]),
      }));
      output.push({ id: `H${String(output.length).padStart(2, '0')}`, matrix: typed, axisMap });
    }
  }
  return output;
}

/** @param {PuzzleSpec} input @param {{matrix:Mat3i,id:string}} hypothesis */
export function applyMechanicsHypothesis(input, hypothesis) {
  const spec = structuredClone(input);
  const sourceMoves = compilePuzzle(spec).moves;
  spec.moves = sourceMoves.map((move) => {
    const basis = /** @type {readonly [number,number,number]} */ ([Number(move.axis === 0), Number(move.axis === 1), Number(move.axis === 2)]);
    const mapped = apply3i(hypothesis.matrix, basis);
    const targetAxis = /** @type {0|1|2} */ (mapped.findIndex((value) => value !== 0));
    const sign = mapped[targetAxis];
    return {
      id: move.id,
      label: move.label,
      axis: targetAxis,
      layer: move.layer * sign,
      quarterTurns: move.quarterTurns * sign,
    };
  });
  spec.metadata = {
    ...(spec.metadata ?? {}),
    mechanicsHypothesis: hypothesis.id,
    mechanicsTransform: key3i(hypothesis.matrix),
  };
  return spec;
}

/** @param {PuzzleEngine} engine @param {string[]} sequence */
function rolloutSignature(engine, sequence) {
  const legality = [];
  for (const token of sequence) {
    const result = engine.moveLegality(token);
    legality.push(result.legal);
    if (!result.legal) return `blocked:${legality.map(Number).join('')}:${result.violatedBandages.map((b) => b.id).sort().join(',')}`;
    engine.applyMove(token);
  }
  return `state:${engine.stateHash()}`;
}

/** @param {string[]} alphabet @param {number} maxLength */
function candidateSequences(alphabet, maxLength) {
  const output = [];
  const extend = (prefix, depth) => {
    if (depth > 0) output.push(prefix);
    if (depth >= maxLength) return;
    for (const token of alphabet) extend([...prefix, token], depth + 1);
  };
  extend([], 0);
  return output;
}

/**
 * Ranks active experiments by the exact partition they induce over a finite mechanics hypothesis set.
 * @param {PuzzleSpec} input
 * @param {{maxSequenceLength?:number,maxExperiments?:number,hypotheses?:ReturnType<typeof enumerateCubeMechanicsHypotheses>,prior?:number[]}} [options]
 */
export function rankMechanicsExperiments(input, options = {}) {
  const hypotheses = options.hypotheses ?? enumerateCubeMechanicsHypotheses();
  const maxSequenceLength = Math.max(1, Math.min(4, Math.trunc(options.maxSequenceLength ?? 2)));
  const maxExperiments = Math.max(1, Math.min(1000, Math.trunc(options.maxExperiments ?? 64)));
  const alphabet = compilePuzzle(input).moves.map((move) => move.id);
  const rawPrior = options.prior?.length === hypotheses.length ? options.prior.map((value) => Math.max(0, value)) : hypotheses.map(() => 1);
  const priorTotal = rawPrior.reduce((sum, value) => sum + value, 0) || 1;
  const prior = rawPrior.map((value) => value / priorTotal);
  const priorEntropyBits = entropyBits(prior);

  const compiled = hypotheses.map((hypothesis) => ({
    hypothesis,
    puzzle: compilePuzzle(applyMechanicsHypothesis(input, hypothesis)),
  }));

  const experiments = candidateSequences(alphabet, maxSequenceLength).map((sequence) => {
    const partitions = new Map();
    for (let index = 0; index < compiled.length; index += 1) {
      const signature = rolloutSignature(new PuzzleEngine(compiled[index].puzzle), sequence);
      if (!partitions.has(signature)) partitions.set(signature, []);
      partitions.get(signature).push(index);
    }
    let posteriorEntropy = 0;
    const outcomes = [];
    for (const [signature, indices] of partitions) {
      const mass = indices.reduce((sum, index) => sum + prior[index], 0);
      if (mass <= 0) continue;
      const posterior = indices.map((index) => prior[index] / mass);
      posteriorEntropy += mass * entropyBits(posterior);
      outcomes.push({
        signatureDigest: stableDigest(signature, 'kinescope-outcome'),
        probability: mass,
        hypothesisIds: indices.map((index) => hypotheses[index].id),
        count: indices.length,
      });
    }
    const informationGainBits = priorEntropyBits - posteriorEntropy;
    return {
      sequence,
      sequenceLength: sequence.length,
      distinctOutcomes: partitions.size,
      priorEntropyBits,
      expectedPosteriorEntropyBits: posteriorEntropy,
      informationGainBits,
      normalizedInformationGain: priorEntropyBits > 0 ? informationGainBits / priorEntropyBits : 0,
      worstCaseRemainingHypotheses: Math.max(...outcomes.map((outcome) => outcome.count)),
      outcomes: outcomes.sort((a, b) => b.probability - a.probability),
    };
  });

  experiments.sort((a, b) =>
    b.informationGainBits - a.informationGainBits ||
    a.worstCaseRemainingHypotheses - b.worstCaseRemainingHypotheses ||
    a.sequenceLength - b.sequenceLength ||
    a.sequence.join(' ').localeCompare(b.sequence.join(' ')),
  );

  const report = {
    schema: 'kinescope.hypothesis-ranking.v1',
    puzzleId: input.id,
    hypothesisFamily: 'orientation-preserving-signed-axis-remappings',
    hypothesisCount: hypotheses.length,
    priorEntropyBits,
    hypotheses: hypotheses.map((hypothesis, index) => ({
      id: hypothesis.id,
      matrix: [...hypothesis.matrix],
      axisMap: hypothesis.axisMap,
      priorProbability: prior[index],
    })),
    configuration: { maxSequenceLength, maxExperiments, alphabet },
    experiments: experiments.slice(0, maxExperiments),
  };
  report.reportDigest = stableDigest(report, 'kinescope-hypothesis-ranking');
  return report;
}
