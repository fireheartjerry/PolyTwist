// @ts-check

import { createRng } from '../core/rng.js';
import { mean, quantile } from './statistics.js';

/** @param {unknown[]} values */
function finiteValues(values) {
  return values.map(Number).filter(Number.isFinite);
}

/**
 * Deterministic nonparametric bootstrap interval for a scalar mean.
 * @param {number[]} values
 * @param {{seed?:string,samples?:number,level?:number}} [options]
 */
export function bootstrapMeanInterval(values, options = {}) {
  const clean = finiteValues(values);
  const samples = Math.max(1, Math.trunc(options.samples ?? 4000));
  const level = Math.min(0.999, Math.max(0.5, Number(options.level ?? 0.95)));
  if (clean.length === 0) {
    return { count: 0, mean: null, level, lower: null, upper: null, samples, method: 'percentile-bootstrap' };
  }
  const rng = createRng(options.seed ?? 'kinescope-bootstrap-v1');
  const bootstrapMeans = new Array(samples);
  for (let sample = 0; sample < samples; sample += 1) {
    let total = 0;
    for (let index = 0; index < clean.length; index += 1) {
      total += clean[Math.floor(rng() * clean.length)];
    }
    bootstrapMeans[sample] = total / clean.length;
  }
  bootstrapMeans.sort((a, b) => a - b);
  const alpha = (1 - level) / 2;
  return {
    count: clean.length,
    mean: mean(clean),
    level,
    lower: quantile(bootstrapMeans, alpha),
    upper: quantile(bootstrapMeans, 1 - alpha),
    samples,
    method: 'percentile-bootstrap',
  };
}

/** @param {number} z */
function logGamma(z) {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.984369578019571e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  let x = 0.99999999999980993;
  const shifted = z - 1;
  for (let index = 0; index < coefficients.length; index += 1) x += coefficients[index] / (shifted + index + 1);
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

/** @param {number[]} logs */
function logSumExp(logs) {
  if (logs.length === 0) return -Infinity;
  const maximum = Math.max(...logs);
  return maximum + Math.log(logs.reduce((sum, value) => sum + Math.exp(value - maximum), 0));
}

/** @param {number} n @param {number} k */
function logBinomialProbability(n, k) {
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1) - n * Math.log(2);
}

/**
 * Exact two-sided sign-test p-value under the fair-coin null, evaluated in log
 * space to remain stable for large paired samples.
 * @param {number} wins
 * @param {number} losses
 */
export function twoSidedSignTest(wins, losses) {
  const w = Math.max(0, Math.trunc(wins));
  const l = Math.max(0, Math.trunc(losses));
  const n = w + l;
  if (n === 0) return 1;
  const tail = Math.min(w, l);
  const logs = [];
  for (let k = 0; k <= tail; k += 1) logs.push(logBinomialProbability(n, k));
  return Math.min(1, 2 * Math.exp(logSumExp(logs)));
}
