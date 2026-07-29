// @ts-check

export const OBSERVATION_CHANNELS = Object.freeze([
  {
    id: 'studio',
    kind: 'rgb',
    dtype: 'uint8',
    channels: 4,
    description: 'Human-oriented physically inspired shaded render.',
  },
  {
    id: 'albedo',
    kind: 'rgb',
    dtype: 'uint8',
    channels: 4,
    description: 'Unlit surface color, isolating material appearance from illumination.',
  },
  {
    id: 'piece',
    kind: 'segmentation',
    dtype: 'uint8',
    channels: 4,
    description: 'Collision-free piece-instance IDs encoded as exact RGB bytes.',
  },
  {
    id: 'face',
    kind: 'segmentation',
    dtype: 'uint8',
    channels: 4,
    description: 'Collision-free global face IDs encoded as exact RGB bytes.',
  },
  {
    id: 'normal',
    kind: 'geometry',
    dtype: 'uint8',
    channels: 4,
    description: 'World-space normals mapped from [-1,1] to [0,255].',
  },
  {
    id: 'depth',
    kind: 'geometry',
    dtype: 'uint8',
    channels: 4,
    description: 'Camera-normalized depth proxy with exact camera metadata.',
  },
]);

export const TASK_CATALOG = Object.freeze([
  {
    id: 'state-tracking',
    family: 'dynamics',
    answerType: 'state',
    primaryMetric: 'exact-state-success',
    description: 'Predict the exact latent state after a legal action sequence.',
  },
  {
    id: 'piece-trajectory',
    family: 'object-permanence',
    answerType: 'piece-trajectories',
    primaryMetric: 'piece-trajectory-f1',
    description: 'Track persistent piece identities through shape-changing transformations.',
  },
  {
    id: 'inverse-dynamics',
    family: 'dynamics',
    answerType: 'categorical-action',
    primaryMetric: 'accuracy',
    description: 'Infer which latent action transformed one state into another.',
  },
  {
    id: 'action-legality',
    family: 'constraints',
    answerType: 'boolean',
    primaryMetric: 'balanced-accuracy',
    description: 'Predict state-dependent action legality under hidden mechanical constraints.',
  },
  {
    id: 'action-order',
    family: 'algebra',
    answerType: 'integer-or-closure',
    primaryMetric: 'exact-match',
    description: 'Infer the local order or obstruction closure of a primitive action.',
  },
  {
    id: 'commutation',
    family: 'algebra',
    answerType: 'boolean-or-null',
    primaryMetric: 'macro-f1',
    description: 'Determine whether two actions commute from the current state.',
  },
  {
    id: 'symbolic-mechanics',
    family: 'system-identification',
    answerType: 'structured-model',
    primaryMetric: 'field-f1',
    description: 'Recover a reusable symbolic model of actions, inverses, axes, layers, and constraints.',
  },
  {
    id: 'active-identification',
    family: 'active-learning',
    answerType: 'action-or-policy',
    primaryMetric: 'normalized-information-gain',
    description: 'Select experiments that maximally reduce uncertainty over candidate mechanics.',
  },
  {
    id: 'counterfactual-rollout',
    family: 'causal-reasoning',
    answerType: 'state',
    primaryMetric: 'exact-state-success',
    description: 'Predict the result of replacing, removing, or inverting an earlier action.',
  },
  {
    id: 'transition-validity',
    family: 'causal-reasoning',
    answerType: 'boolean',
    primaryMetric: 'balanced-accuracy',
    description: 'Detect impossible, corrupted, or mechanism-inconsistent transitions.',
  },
  {
    id: 'planning',
    family: 'planning',
    answerType: 'action-sequence',
    primaryMetric: 'goal-success',
    description: 'Reach a target state under exact, potentially state-dependent mechanics.',
  },
  {
    id: 'viewpoint-invariance',
    family: 'perception',
    answerType: 'equivalence',
    primaryMetric: 'accuracy',
    description: 'Recognize state identity across camera changes and partial observations.',
  },
  {
    id: 'appearance-mechanics-disentanglement',
    family: 'representation',
    answerType: 'structured-model',
    primaryMetric: 'invariance-gap',
    description: 'Separate rendered appearance and geometry from latent transition semantics.',
  },
  {
    id: 'constraint-localization',
    family: 'constraints',
    answerType: 'piece-set',
    primaryMetric: 'set-f1',
    description: 'Identify hidden rigid clusters or other causes of state-dependent blockage.',
  },
  {
    id: 'reachability',
    family: 'planning',
    answerType: 'boolean-with-certificate',
    primaryMetric: 'verified-accuracy',
    description: 'Classify whether a target lies in the reachable state component and provide a certificate when possible.',
  },
  {
    id: 'uncertainty-calibration',
    family: 'metacognition',
    answerType: 'probabilistic',
    primaryMetric: 'brier-and-ece',
    description: 'Measure whether confidence tracks correctness under visual and mechanical ambiguity.',
  },
]);

export const FACTOR_CATALOG = Object.freeze([
  { id: 'appearance', levels: ['canonical', 'material-randomized', 'texture-shift', 'lighting-shift'] },
  { id: 'outer-geometry', levels: ['cube', 'anisotropic', 'chamfered', 'custom-convex'] },
  { id: 'cut-frame', levels: ['aligned', 'rotated', 'offset', 'rotated-and-offset'] },
  { id: 'mechanics', levels: ['canonical', 'axis-remapped', 'direction-remapped', 'custom-layer-alphabet'] },
  { id: 'constraints', levels: ['none', 'rigid-bandage', 'state-dependent-legality'] },
  { id: 'scale', levels: ['2x2', '3x3', '4x4', '5x5-plus'] },
  { id: 'visibility', levels: ['disclosed', 'notation-withheld', 'identity-withheld', 'fully-withheld'] },
  { id: 'view', levels: ['single', 'multi-view', 'active-view', 'partial-occlusion'] },
  { id: 'temporal-input', levels: ['static', 'before-after', 'short-video', 'interactive-rollout'] },
  { id: 'scramble-depth', levels: ['solved', 'shallow', 'medium', 'deep'] },
  { id: 'split', levels: ['iid', 'appearance-ood', 'geometry-ood', 'mechanics-ood', 'compositional-ood', 'adversarial'] },
]);

export const DEFAULT_CAMERA_BANK = Object.freeze([
  { id: 'canonical', yaw: 0.72, pitch: 0.38, distance: 8.15, fovDegrees: 38, target: [0, 0.08, 0] },
  { id: 'front-high', yaw: 0.02, pitch: 0.58, distance: 8.0, fovDegrees: 38, target: [0, 0.05, 0] },
  { id: 'rear-low', yaw: 3.25, pitch: -0.18, distance: 8.4, fovDegrees: 40, target: [0, 0.02, 0] },
  { id: 'side', yaw: 1.58, pitch: 0.18, distance: 7.8, fovDegrees: 36, target: [0, 0.06, 0] },
  { id: 'far-context', yaw: 5.55, pitch: 0.3, distance: 10.2, fovDegrees: 44, target: [0, 0.08, 0] },
]);

export const SPLIT_CATALOG = Object.freeze([
  {
    id: 'train',
    description: 'Familiar geometry and disclosed mechanics for development or representation learning.',
  },
  {
    id: 'validation',
    description: 'Held-out states and seeds with familiar factor support.',
  },
  {
    id: 'test-iid',
    description: 'New states from factor combinations present during development.',
  },
  {
    id: 'test-appearance-ood',
    description: 'Unseen materials, lighting, and color systems with familiar mechanics.',
  },
  {
    id: 'test-geometry-ood',
    description: 'Unseen hulls and cut frames with familiar abstract mechanics.',
  },
  {
    id: 'test-mechanics-ood',
    description: 'Unseen action semantics or state-dependent constraints.',
  },
  {
    id: 'test-compositional-ood',
    description: 'Simultaneously unseen combinations of appearance, geometry, mechanics, and observability.',
  },
  {
    id: 'test-adversarial',
    description: 'Counterfactual, corrupted, impossible, or leakage-sensitive evaluation cases.',
  },
]);
