// @ts-check

import { compilePuzzle } from '../core/puzzle-compiler.js';
import { PuzzleEngine } from '../core/puzzle-engine.js';
import { createPreset, alienPreset } from '../core/presets.js';
import { createRng } from '../core/rng.js';
import { createDisentanglementGroup } from '../core/benchmark-suite.js';
import { analyzePuzzleGeometry } from './geometry-analysis.js';
import { exploreStateGraph } from './state-graph.js';
import { rankMechanicsExperiments } from './mechanics-hypotheses.js';
import { generateResearchEpisode, inverseActionToken } from './episode.js';
import { stableDigest, safeId } from './canonical.js';
import { TASK_CATALOG, SPLIT_CATALOG } from './catalog.js';
import { ENGINE_VERSION, PLATFORM_NAME } from '../version.js';

/** @typedef {import('../core/puzzle-compiler.js').PuzzleSpec} PuzzleSpec */

/** @param {string} id @param {string} taskId @param {string} split @param {object} input @param {object} metadata */
function publicItem(id, taskId, split, input, metadata) {
  const task = TASK_CATALOG.find((entry) => entry.id === taskId);
  if (!task) throw new Error(`Unknown task ${taskId}.`);
  return {
    schema: 'kinescope.item-public.v1',
    itemId: id,
    taskId,
    taskFamily: task.family,
    split,
    answerType: task.answerType,
    primaryMetric: task.primaryMetric,
    input,
    metadata,
  };
}

/** @param {string} itemId @param {string} taskId @param {unknown} target @param {object} verification */
function targetItem(itemId, taskId, target, verification = {}) {
  return {
    schema: 'kinescope.target-private.v1',
    itemId,
    taskId,
    target,
    verification,
  };
}

/** @param {string} base @param {string} task @param {number} index */
function itemId(base, task, index) {
  return `item-${safeId(task)}-${safeId(base)}-${String(index).padStart(3, '0')}`;
}

/** @param {Record<string,string>} canonicalToAlias @param {string[]} sequence */
function aliasSequence(canonicalToAlias, sequence) {
  return sequence.map((token) => {
    const inverse = token.endsWith("'");
    const doubled = token.endsWith('2');
    const base = inverse || doubled ? token.slice(0, -1) : token;
    return `${canonicalToAlias[base] ?? base}${doubled ? '2' : inverse ? "'" : ''}`;
  });
}

/** @param {ReturnType<typeof generateResearchEpisode>} episode @param {string} split @param {number} ordinal */
function buildEpisodeTasks(episode, split, ordinal) {
  const pub = episode.public;
  const priv = episode.private;
  const base = `${pub.episodeId}-${ordinal}`;
  const publicItems = [];
  const targets = [];
  const steps = priv.steps;
  if (steps.length === 0) return { publicItems, targets };
  const first = steps[0];
  const last = steps.at(-1);
  if (!last) return { publicItems, targets };
  let serial = 0;
  const add = (taskId, input, target, verification = {}, metadata = {}) => {
    const id = itemId(base, taskId, serial++);
    publicItems.push(publicItem(id, taskId, split, input, {
      episodeId: pub.episodeId,
      puzzleInstanceId: pub.puzzle.puzzleInstanceId,
      ordinal,
      ...metadata,
    }));
    targets.push(targetItem(id, taskId, target, verification));
  };

  add('state-tracking', {
    initialState: pub.initialState,
    actionSequence: pub.steps.map((step) => step.action),
    observations: pub.steps.flatMap((step) => step.observationRequests.filter((request) => request.channel === 'studio')),
  }, {
    finalFingerprint: pub.steps.at(-1)?.stateAfter.fingerprint,
  }, { finalState: priv.final.state });

  add('piece-trajectory', {
    stateBefore: pub.steps[0].stateBefore,
    action: pub.steps[0].action,
    observations: pub.steps[0].observationRequests,
  }, {
    trajectories: first.pieceTrajectories.map(({ orientationBefore, orientationAfter, ...entry }) => entry),
  }, { exactTrajectories: first.pieceTrajectories });

  add('inverse-dynamics', {
    stateBefore: pub.steps[0].stateBefore,
    stateAfter: pub.steps[0].stateAfter,
    candidateActions: pub.puzzle.actionAlphabet,
    observations: pub.steps[0].observationRequests,
  }, { action: first.alias });

  const dynamics = first.dynamicsBefore;
  let localizationAdded = false;
  if (dynamics) {
    const blocked = dynamics.actions.find((action) => !action.legal);
    const selected = blocked ?? dynamics.actions[ordinal % dynamics.actions.length];
    const alias = priv.actionAliases.canonicalToAlias[selected.token];
    add('action-legality', {
      state: pub.steps[0].stateBefore,
      action: alias,
      observations: pub.initialObservationRequests,
    }, { legal: selected.legal }, { canonicalAction: selected.token, violatedBandages: selected.violatedBandages });

    if (blocked) {
      localizationAdded = true;
      add('constraint-localization', {
        state: pub.steps[0].stateBefore,
        blockedAction: priv.actionAliases.canonicalToAlias[blocked.token],
        observations: pub.initialObservationRequests,
      }, {
        implicatedPieces: blocked.violatedBandages.flatMap((bandage) =>
          bandage.pieceIds.map((pieceId) => priv.pieceAliases.canonicalToAlias[pieceId])).sort(),
        constraintCount: blocked.violatedBandages.length,
      }, {
        canonicalAction: blocked.token,
        violatedBandages: blocked.violatedBandages,
      });
    }

    const orderAction = dynamics.actions.find((action) => action.legal) ?? dynamics.actions[0];
    add('action-order', {
      state: pub.steps[0].stateBefore,
      action: priv.actionAliases.canonicalToAlias[orderAction.token],
    }, { orderAtState: orderAction.orderAtState, closure: orderAction.closure });

    const pair = dynamics.pairs[ordinal % Math.max(1, dynamics.pairs.length)];
    if (pair) add('commutation', {
      state: pub.steps[0].stateBefore,
      first: priv.actionAliases.canonicalToAlias[pair.first],
      second: priv.actionAliases.canonicalToAlias[pair.second],
    }, { commutes: pair.commutes }, { exact: pair });
  }

  const canonicalMechanics = compilePuzzle(priv.canonicalPuzzleSpec).moves;
  add('symbolic-mechanics', {
    episode: pub,
    requestedFields: ['actions', 'inverses', 'axis-partition', 'state-dependent-legality'],
  }, {
    actions: canonicalMechanics.map((move) => ({
      action: priv.actionAliases.canonicalToAlias[move.id],
      inverse: `${priv.actionAliases.canonicalToAlias[move.id]}'`,
      axisClass: `axis-${move.axis}`,
      layerSign: Math.sign(move.layer),
      quarterTurnSign: Math.sign(move.quarterTurns),
    })),
    stateDependentLegality: Boolean(priv.canonicalPuzzleSpec.constraints?.bandages?.length),
    constraintFamily: priv.canonicalPuzzleSpec.constraints?.bandages?.length ? 'rigid-bandage' : 'none',
  }, {
    canonicalActions: canonicalMechanics,
    aliasToCanonical: priv.actionAliases.aliasToCanonical,
    constraints: priv.canonicalPuzzleSpec.constraints ?? { bandages: [] },
  });

  const ranking = rankMechanicsExperiments(priv.canonicalPuzzleSpec, { maxSequenceLength: 1, maxExperiments: 6 });
  add('active-identification', {
    actionAlphabet: pub.puzzle.actionAlphabet,
    hypothesisCount: ranking.hypothesisCount,
    actionBudget: 1,
  }, {
    recommendedExperiment: aliasSequence(priv.actionAliases.canonicalToAlias, ranking.experiments[0].sequence),
    normalizedInformationGain: ranking.experiments[0].normalizedInformationGain,
    ranking: ranking.experiments.map((entry) => ({
      sequence: aliasSequence(priv.actionAliases.canonicalToAlias, entry.sequence),
      normalizedInformationGain: entry.normalizedInformationGain,
    })),
  }, { exactRanking: ranking });

  const originalSequence = priv.steps.map((step) => step.canonicalAction);
  const replaceIndex = Math.min(Math.floor(originalSequence.length / 2), originalSequence.length - 1);
  const counterfactual = [...originalSequence];
  counterfactual[replaceIndex] = inverseActionToken(counterfactual[replaceIndex]);
  const counterEngine = new PuzzleEngine(compilePuzzle(priv.canonicalPuzzleSpec));
  for (const action of priv.scramble) counterEngine.applyMove(action);
  let counterExecutable = true;
  for (const action of counterfactual) {
    if (!counterEngine.moveLegality(action).legal) { counterExecutable = false; break; }
    counterEngine.applyMove(action);
  }
  add('counterfactual-rollout', {
    initialState: pub.initialState,
    originalSequence: pub.steps.map((step) => step.action),
    intervention: {
      type: 'replace-with-inverse',
      index: replaceIndex,
      replacement: aliasSequence(priv.actionAliases.canonicalToAlias, [counterfactual[replaceIndex]])[0],
    },
  }, {
    executable: counterExecutable,
    finalFingerprint: counterExecutable ? counterEngine.stateFingerprint() : null,
  }, { finalState: counterExecutable ? counterEngine.serialize() : null });

  const validTransition = ordinal % 2 === 0;
  const corruptedSuccessor = {
    stateId: stableDigest(`${base}:corrupt-transition`, 'kinescope-corrupt-state'),
    fingerprint: stableDigest(`${base}:corrupt-transition-fingerprint`, 'kinescope-corrupt-fingerprint'),
    solved: false,
    legalActionMask: pub.steps[0].stateAfter.legalActionMask,
  };
  add('transition-validity', {
    stateBefore: pub.steps[0].stateBefore,
    action: pub.steps[0].action,
    claimedStateAfter: validTransition ? pub.steps[0].stateAfter : corruptedSuccessor,
  }, { valid: validTransition }, { reason: validTransition ? 'exact-engine-transition' : 'synthetic-impossible-successor' });

  const reverseCanonical = [...originalSequence].reverse().map(inverseActionToken);
  add('planning', {
    startState: pub.steps.at(-1)?.stateAfter,
    targetState: pub.initialState,
    actionAlphabet: pub.puzzle.actionAlphabet,
    maximumLength: reverseCanonical.length + 2,
  }, {
    referencePlan: aliasSequence(priv.actionAliases.canonicalToAlias, reverseCanonical),
    goalFingerprint: pub.initialState.fingerprint,
  }, {
    startState: priv.final.state,
    goalState: priv.initial.state,
    aliasToCanonical: priv.actionAliases.aliasToCanonical,
  });

  add('viewpoint-invariance', {
    first: { state: pub.initialState, render: pub.initialObservationRequests[0] },
    second: { state: pub.initialState, render: { ...pub.initialObservationRequests[0], camera: pub.puzzle.cameras.at(-1) } },
  }, { equivalent: true });

  if (!localizationAdded) {
    add('constraint-localization', {
      state: pub.steps[0].stateBefore,
      blockedAction: null,
      observations: pub.initialObservationRequests,
    }, {
      implicatedPieces: [],
      constraintCount: 0,
    }, { reason: 'no-state-dependent-obstruction-in-this-condition' });
  }

  const reachable = ordinal % 2 === 0;
  const invalidState = structuredClone(priv.initial.state);
  if (!reachable && invalidState.transforms.length > 0) {
    invalidState.transforms[0].orientation = [-1, 0, 0, 0, 1, 0, 0, 0, 1];
    invalidState.hash = stableDigest(invalidState.transforms, 'invalid-state');
    invalidState.fingerprint = stableDigest(invalidState.transforms, 'invalid-fingerprint');
  }
  add('reachability', {
    startState: pub.initialState,
    targetState: reachable
      ? pub.steps.at(-1)?.stateAfter
      : { fingerprint: stableDigest(`${base}:improper-orientation`, 'kinescope-impossible-target') },
    maximumCertificateLength: originalSequence.length,
  }, {
    reachable,
    certificate: reachable ? pub.steps.map((step) => step.action) : null,
  }, {
    exactTarget: reachable ? priv.final.state : invalidState,
    reason: reachable ? 'constructive-rollout' : 'target-violates-proper-rotation-invariant',
    validatorExpectedToReject: !reachable,
  });

  add('uncertainty-calibration', {
    query: {
      type: 'inverse-dynamics',
      stateBefore: pub.steps[0].stateBefore,
      stateAfter: pub.steps[0].stateAfter,
      candidateActions: pub.puzzle.actionAlphabet,
    },
    responseFormat: { answer: 'action', confidence: 'number-in-[0,1]' },
  }, { answer: first.alias });

  return { publicItems, targets };
}

/** @param {string} split @param {number} index @param {string} seed */
function specForSplit(split, index, seed) {
  if (split === 'test-appearance-ood') return createPreset(index % 2 ? 'mirror-prism-3' : 'axis-3');
  if (split === 'test-geometry-ood') return index % 2 ? createPreset('ghost-4') : alienPreset(`${seed}:geometry:${index}`);
  if (split === 'test-mechanics-ood') return index % 2 ? createPreset('bandaged-relay-3') : createDisentanglementGroup(`${seed}:mechanics:${index}`).conditions[2].spec;
  if (split === 'test-compositional-ood') return createDisentanglementGroup(`${seed}:composition:${index}`).conditions[3].spec;
  if (split === 'test-adversarial') return index % 2 ? createPreset('bandaged-relay-3') : alienPreset(`${seed}:adversarial:${index}`);
  if (split === 'train') return index % 2 ? createPreset('classic-3') : createPreset('ghost-3');
  if (split === 'validation') return index % 2 ? createPreset('axis-3') : createPreset('classic-3');
  return index % 2 ? createPreset('ghost-3') : createPreset('classic-3');
}

/**
 * Generates a broad, JSON-first benchmark suite. Images remain deterministic render requests
 * unless `materialize` is handled by a caller or the HTTP batch endpoint.
 *
 * @param {{seed?:string|number,episodesPerSplit?:number,splits?:string[],horizon?:number,scrambleDepth?:number,includeDiagnostics?:boolean}} [options]
 */
export function generateResearchSuite(options = {}) {
  const seed = String(options.seed ?? 'kinescope-suite-001');
  const splits = options.splits?.length ? options.splits : SPLIT_CATALOG.map((entry) => entry.id);
  const episodesPerSplit = Math.max(1, Math.min(128, Math.trunc(options.episodesPerSplit ?? 2)));
  const horizon = Math.max(2, Math.min(64, Math.trunc(options.horizon ?? 6)));
  const scrambleDepth = Math.max(0, Math.min(64, Math.trunc(options.scrambleDepth ?? 4)));
  const episodesPublic = [];
  const episodesPrivate = [];
  const publicItems = [];
  const privateTargets = [];
  const puzzleDiagnostics = [];
  const rng = createRng(`suite:${seed}`);

  let ordinal = 0;
  for (const split of splits) {
    if (!SPLIT_CATALOG.some((entry) => entry.id === split)) throw new Error(`Unknown split ${split}.`);
    for (let index = 0; index < episodesPerSplit; index += 1) {
      const spec = specForSplit(split, index, seed);
      const episodeSeed = `${seed}:${split}:${String(index).padStart(4, '0')}:${Math.floor(rng() * 1e9)}`;
      const episode = generateResearchEpisode(spec, {
        seed: episodeSeed,
        horizon,
        scrambleDepth,
        visibility: split === 'train' ? 'notation-withheld' : 'fully-withheld',
      });
      episode.public.split = split;
      episode.private.split = split;
      episodesPublic.push(episode.public);
      episodesPrivate.push(episode.private);
      const tasks = buildEpisodeTasks(episode, split, ordinal++);
      publicItems.push(...tasks.publicItems);
      privateTargets.push(...tasks.targets);
      if (options.includeDiagnostics !== false) {
        puzzleDiagnostics.push({
          split,
          puzzleId: spec.id,
          geometry: analyzePuzzleGeometry(spec, { includePieces: false }),
          stateGraph: spec.size <= 3 ? exploreStateGraph(spec, { maxStates: 96, maxDepth: 2 }) : null,
        });
      }
    }
  }

  for (let splitIndex = 0; splitIndex < splits.length; splitIndex += 1) {
    const split = splits[splitIndex];
    const factorial = createDisentanglementGroup(`${seed}:factorial-task:${split}`);
    const pairCodes = splitIndex % 2 === 0 ? ['A0M0', 'A1M0'] : ['A0M0', 'A0M1'];
    const firstCondition = factorial.conditions.find((condition) => condition.code === pairCodes[0]);
    const secondCondition = factorial.conditions.find((condition) => condition.code === pairCodes[1]);
    if (!firstCondition || !secondCondition) throw new Error('Factorial condition generation failed.');
    const id = itemId(`${seed}-${split}`, 'appearance-mechanics-disentanglement', splitIndex);
    const artifact = (condition, label) => ({
      artifactId: stableDigest(`${factorial.groupId}:${condition.code}`, 'kinescope-factorial-artifact'),
      label,
      size: condition.spec.size,
      actionAlphabet: condition.actionSemantics.map((move, index) => `A${index}`),
      observationRequests: ['studio', 'albedo', 'piece', 'normal', 'depth'].map((channel) => ({
        channel,
        cameraId: 'canonical',
        width: 512,
        height: 512,
      })),
    });
    publicItems.push(publicItem(id, 'appearance-mechanics-disentanglement', split, {
      first: artifact(firstCondition, 'artifact-a'),
      second: artifact(secondCondition, 'artifact-b'),
      question: 'Determine whether the two artifacts share appearance parameters and whether they share latent action semantics.',
    }, { factorialGroup: factorial.groupId, pairCodes }));
    privateTargets.push(targetItem(id, 'appearance-mechanics-disentanglement', {
      sameAppearance: pairCodes[0][1] === pairCodes[1][1],
      sameMechanics: pairCodes[0][3] === pairCodes[1][3],
    }, {
      firstSpec: firstCondition.spec,
      secondSpec: secondCondition.spec,
      firstActionSemantics: firstCondition.actionSemantics,
      secondActionSemantics: secondCondition.actionSemantics,
      pairCodes,
    }));
  }

  const taskCounts = Object.fromEntries(TASK_CATALOG.map((task) => [task.id, publicItems.filter((item) => item.taskId === task.id).length]));
  const splitCounts = Object.fromEntries(splits.map((split) => [split, publicItems.filter((item) => item.split === split).length]));
  const suiteCore = {
    schema: 'kinescope.research-suite.v1',
    platform: PLATFORM_NAME,
    engineVersion: ENGINE_VERSION,
    seed,
    suiteId: `suite-${stableDigest({ seed, splits, episodesPerSplit, horizon, scrambleDepth }, 'kinescope-suite').slice(-20)}`,
    configuration: { seed, splits, episodesPerSplit, horizon, scrambleDepth },
    catalogs: { tasks: TASK_CATALOG, splits: SPLIT_CATALOG },
    summary: {
      episodeCount: episodesPublic.length,
      publicItemCount: publicItems.length,
      privateTargetCount: privateTargets.length,
      taskCounts,
      splitCounts,
      puzzleCount: new Set(episodesPrivate.map((episode) => episode.canonicalPuzzleSpec.id)).size,
    },
    public: {
      episodes: episodesPublic,
      items: publicItems,
    },
    private: {
      episodes: episodesPrivate,
      targets: privateTargets,
      diagnostics: puzzleDiagnostics,
    },
    provenance: {
      deterministic: true,
      generatedAt: null,
      source: 'KineScope procedural generator',
      warning: 'The private partition contains evaluator-only mechanics and exact states. Publishing it beside a hidden test set would be a remarkably efficient way to invalidate the benchmark.',
    },
  };
  suiteCore.publicDigest = stableDigest(suiteCore.public, 'kinescope-suite-public');
  suiteCore.privateDigest = stableDigest(suiteCore.private, 'kinescope-suite-private');
  suiteCore.suiteDigest = stableDigest({
    schema: suiteCore.schema,
    engineVersion: suiteCore.engineVersion,
    configuration: suiteCore.configuration,
    publicDigest: suiteCore.publicDigest,
    privateDigest: suiteCore.privateDigest,
  }, 'kinescope-suite-bundle');
  return suiteCore;
}

/** @param {ReturnType<typeof generateResearchSuite>} suite */
export function suiteAsJsonl(suite) {
  return {
    'manifest.json': `${JSON.stringify({
      schema: suite.schema,
      platform: suite.platform,
      engineVersion: suite.engineVersion,
      seed: suite.seed,
      suiteId: suite.suiteId,
      configuration: suite.configuration,
      summary: suite.summary,
      catalogs: suite.catalogs,
      provenance: suite.provenance,
      publicDigest: suite.publicDigest,
      privateDigest: suite.privateDigest,
      suiteDigest: suite.suiteDigest,
    }, null, 2)}\n`,
    'public/episodes.jsonl': `${suite.public.episodes.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'public/items.jsonl': `${suite.public.items.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'private/episodes.jsonl': `${suite.private.episodes.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'private/targets.jsonl': `${suite.private.targets.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'private/diagnostics.jsonl': `${suite.private.diagnostics.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
  };
}
