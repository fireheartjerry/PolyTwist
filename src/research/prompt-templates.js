// @ts-check

import { canonicalJson, stableDigest } from './canonical.js';

const FORBIDDEN_PUBLIC_KEYS = new Set([
  'canonicalPuzzleSpec',
  'canonicalState',
  'exactState',
  'exactTransforms',
  'actionAliases',
  'pieceAliases',
  'aliasToCanonical',
  'canonicalToAlias',
  'privateTarget',
  'verification',
]);

const FORBIDDEN_SCHEMA_VALUES = new Set([
  'kinescope.target-private.v1',
  'kinescope.episode-private.v1',
]);

const TASK_GUIDANCE = Object.freeze({
  'state-tracking': 'Track the latent object state through the full action sequence.',
  'piece-trajectory': 'Identify the persistent pieces that move and their public trajectories.',
  'inverse-dynamics': 'Select the action that best explains the observed state transition.',
  'action-legality': 'Judge whether the proposed action is executable in the shown state.',
  'action-order': 'Determine the action order or the point at which repeated execution blocks.',
  commutation: 'Judge whether the two actions commute from the supplied state.',
  'symbolic-mechanics': 'Infer a reusable structured description of the hidden action mechanics.',
  'active-identification': 'Choose the allowed experiment expected to distinguish the most remaining mechanics hypotheses.',
  'counterfactual-rollout': 'Roll out the stated intervention rather than the original action history.',
  'transition-validity': 'Judge whether the claimed successor is consistent with the public evidence and action.',
  planning: 'Return an executable action sequence that reaches the target within the stated limit.',
  'viewpoint-invariance': 'Judge whether the observations encode the same underlying state despite the camera change.',
  'appearance-mechanics-disentanglement': 'Separate visual appearance changes from changes in transition mechanics.',
  'constraint-localization': 'Identify the public piece aliases implicated in the blocked action.',
  reachability: 'Judge whether the target is reachable from the supplied start state.',
  'uncertainty-calibration': 'Answer the task and report calibrated confidence in that answer.',
});

export const DEFAULT_PROMPT_VERSION = 'kinescope-public-item-json-v1';

export const PROMPT_TEMPLATES = Object.freeze({
  [DEFAULT_PROMPT_VERSION]: Object.freeze({
    system: [
      'You are being evaluated on exact spatial reasoning in an unfamiliar three-dimensional mechanism.',
      'Use only the public evidence in the benchmark item. Do not assume access to hidden puzzle specifications, evaluator targets, private aliases, or exact state.',
      'Return exactly one JSON object and no surrounding prose, markdown, or code fence.',
      'The object must have the form {"answer": <task-specific answer>, "confidence": <number from 0 to 1>}.',
      'Do not add facts that are not supported by the supplied observations.',
    ].join(' '),
  }),
});

/**
 * Rejects evaluator-private material before a provider request is constructed.
 * This is intentionally conservative: an unfamiliar field is allowed, but known
 * private contracts and alias maps are not.
 *
 * @param {unknown} value
 * @param {string} [path]
 * @param {WeakSet<object>} [seen]
 */
function inspectForPrivateData(value, path = '$', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && FORBIDDEN_SCHEMA_VALUES.has(value)) {
      throw new Error(`Evaluator-private schema value found at ${path}.`);
    }
    return;
  }
  const objectValue = /** @type {object} */ (value);
  if (seen.has(objectValue)) throw new Error(`Cyclic benchmark input found at ${path}.`);
  seen.add(objectValue);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectForPrivateData(entry, `${path}[${index}]`, seen));
  } else {
    for (const [key, entry] of Object.entries(/** @type {Record<string,unknown>} */ (value))) {
      if (FORBIDDEN_PUBLIC_KEYS.has(key)) {
        throw new Error(`Evaluator-private field ${key} found at ${path}.${key}.`);
      }
      inspectForPrivateData(entry, `${path}.${key}`, seen);
    }
  }
  seen.delete(objectValue);
}

/** @param {unknown} item */
export function assertPublicBenchmarkItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('A public benchmark item must be an object.');
  }
  const typed = /** @type {Record<string,unknown>} */ (item);
  if (typed.schema !== 'kinescope.item-public.v1') {
    throw new Error('Only kinescope.item-public.v1 items may be sent to a model provider.');
  }
  if (typeof typed.itemId !== 'string' || !typed.itemId) throw new Error('Public item is missing itemId.');
  if (typeof typed.taskId !== 'string' || !typed.taskId) throw new Error('Public item is missing taskId.');
  if (!typed.input || typeof typed.input !== 'object' || Array.isArray(typed.input)) {
    throw new Error(`Public item ${typed.itemId} is missing an object input.`);
  }
  inspectForPrivateData(item);
  return /** @type {any} */ (item);
}

/**
 * @param {unknown} item
 * @param {{promptVersion?:string, systemPromptSuffix?:string, responseSchema?:Record<string,unknown>}} [options]
 */
export function renderBenchmarkPrompt(item, options = {}) {
  const publicItem = assertPublicBenchmarkItem(item);
  const promptVersion = String(options.promptVersion ?? DEFAULT_PROMPT_VERSION);
  const template = PROMPT_TEMPLATES[promptVersion];
  if (!template) throw new Error(`Unknown prompt version ${promptVersion}.`);
  const responseSchema = options.responseSchema ?? {
    type: 'object',
    required: ['answer', 'confidence'],
    additionalProperties: false,
    properties: {
      answer: {},
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  };
  const system = options.systemPromptSuffix
    ? `${template.system} ${String(options.systemPromptSuffix).trim()}`
    : template.system;
  const payload = {
    schema: 'kinescope.public-model-task.v1',
    itemId: publicItem.itemId,
    taskId: publicItem.taskId,
    taskFamily: publicItem.taskFamily ?? null,
    split: publicItem.split ?? null,
    answerType: publicItem.answerType ?? null,
    primaryMetric: publicItem.primaryMetric ?? null,
    guidance: TASK_GUIDANCE[publicItem.taskId] ?? 'Solve the task using only the supplied public evidence.',
    input: publicItem.input,
    metadata: publicItem.metadata ?? {},
    responseContract: responseSchema,
  };
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: canonicalJson(payload, 2) },
  ];
  const promptCore = { promptVersion, messages, responseSchema };
  return {
    schema: 'kinescope.rendered-prompt.v1',
    promptVersion,
    messages,
    responseSchema,
    promptDigest: stableDigest(promptCore, 'kinescope-prompt'),
  };
}
