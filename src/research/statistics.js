// @ts-check

/** @param {number[]} values */
export function mean(values) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** @param {number[]} values */
export function variance(values) {
  const average = mean(values);
  if (average === null) return null;
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
}

/** @param {number[]} values */
export function standardDeviation(values) {
  const value = variance(values);
  return value === null ? null : Math.sqrt(value);
}

/** @param {number[]} values @param {number} q */
export function quantile(values, q) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.max(0, Math.min(1, q)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const alpha = position - lower;
  return sorted[lower] * (1 - alpha) + sorted[upper] * alpha;
}

/** @param {number[]} values */
export function gini(values) {
  if (values.length === 0) return null;
  const sorted = values.map((value) => Math.max(0, value)).sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0;
  let weighted = 0;
  for (let index = 0; index < sorted.length; index += 1) weighted += (index + 1) * sorted[index];
  return (2 * weighted) / (sorted.length * total) - (sorted.length + 1) / sorted.length;
}

/** @param {number[]} values */
export function numericSummary(values) {
  const finite = values.filter(Number.isFinite);
  const average = mean(finite);
  const std = standardDeviation(finite);
  return {
    count: finite.length,
    min: finite.length ? Math.min(...finite) : null,
    max: finite.length ? Math.max(...finite) : null,
    mean: average,
    standardDeviation: std,
    coefficientOfVariation: average && std !== null ? std / Math.abs(average) : null,
    q05: quantile(finite, 0.05),
    q25: quantile(finite, 0.25),
    median: quantile(finite, 0.5),
    q75: quantile(finite, 0.75),
    q95: quantile(finite, 0.95),
    gini: gini(finite),
  };
}

/**
 * Fixed-width histogram with explicit edges for machine-readable reports.
 * @param {number[]} values
 * @param {number} [bins]
 */
export function histogram(values, bins = 10) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { edges: [], counts: [] };
  const minimum = Math.min(...finite);
  const maximum = Math.max(...finite);
  if (minimum === maximum) return { edges: [minimum, maximum], counts: [finite.length] };
  const count = Math.max(1, Math.min(128, Math.trunc(bins)));
  const width = (maximum - minimum) / count;
  const edges = Array.from({ length: count + 1 }, (_, index) => minimum + index * width);
  const counts = Array(count).fill(0);
  for (const value of finite) {
    const index = Math.min(count - 1, Math.floor((value - minimum) / width));
    counts[index] += 1;
  }
  return { edges, counts };
}

/** @param {number[]} probabilities */
export function entropyBits(probabilities) {
  let entropy = 0;
  for (const probability of probabilities) {
    if (probability > 0) entropy -= probability * Math.log2(probability);
  }
  return entropy;
}
