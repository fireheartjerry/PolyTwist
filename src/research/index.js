export { canonicalize, canonicalJson, canonicalEqual, deepClone, safeId, stableDigest } from './canonical.js';
export { mean, variance, standardDeviation, quantile, gini, numericSummary, histogram, entropyBits } from './statistics.js';
export { OBSERVATION_CHANNELS, TASK_CATALOG, FACTOR_CATALOG, DEFAULT_CAMERA_BANK, SPLIT_CATALOG } from './catalog.js';
export { RESEARCH_SCHEMAS, schemaCatalog } from './schemas.js';
export { createResearchManifest } from './manifest.js';
export { analyzePuzzleGeometry } from './geometry-analysis.js';
export { runIdealRigidDisplayExperiment } from './rigid-display-experiment.js';
export { exploreStateGraph } from './state-graph.js';
export { enumerateCubeMechanicsHypotheses, applyMechanicsHypothesis, rankMechanicsExperiments } from './mechanics-hypotheses.js';
export { inverseActionToken, createOpaqueActionMap, createOpaquePieceMap, generateResearchEpisode } from './episode.js';
export { generateResearchSuite, suiteAsJsonl } from './dataset.js';
export { evaluatePredictions } from './evaluator.js';
export { DEFAULT_PROMPT_VERSION, PROMPT_TEMPLATES, assertPublicBenchmarkItem, renderBenchmarkPrompt } from './prompt-templates.js';
export { RESPONSE_PARSER_MODES, parseModelResponse, predictionFromParseRecord } from './model-response.js';
export {
  ProviderError,
  createFunctionProvider,
  createMockProvider,
  createDryRunProvider,
  createSyntheticOracleProvider,
  createOpenAICompatibleProvider,
} from './provider-adapters.js';
export { runModelExperiment } from './experiment-runner.js';
export {
  bootstrapMeanInterval,
  twoSidedSignTest,
  summarizeEvaluationWithIntervals,
  compareEvaluationsPaired,
} from './experiment-analysis.js';
