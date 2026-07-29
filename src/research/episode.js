// @ts-check

import { compilePuzzle } from '../core/puzzle-compiler.js';
import { PuzzleEngine } from '../core/puzzle-engine.js';
import { createRng, randomChoice, shuffleInPlace } from '../core/rng.js';
import { analyzeCurrentDynamics } from '../core/dynamics-analysis.js';
import { stableDigest, safeId } from './canonical.js';
import { DEFAULT_CAMERA_BANK, OBSERVATION_CHANNELS } from './catalog.js';
import { ENGINE_VERSION } from '../version.js';

/** @typedef {import('../core/puzzle-compiler.js').PuzzleSpec} PuzzleSpec */

/** @param {string} token */
export function inverseActionToken(token) {
  const normalized = token.trim().replace(/[’′]/g, "'");
  if (normalized.endsWith('2')) return normalized;
  return normalized.endsWith("'") ? normalized.slice(0, -1) : `${normalized}'`;
}

/** @param {string[]} actions @param {string|number} seed */
export function createOpaqueActionMap(actions, seed) {
  const canonical = [...actions].sort();
  const aliases = canonical.map((_, index) => `A${index}`);
  shuffleInPlace(createRng(`action-map:${seed}`), aliases);
  const canonicalToAlias = Object.fromEntries(canonical.map((action, index) => [action, aliases[index]]));
  const aliasToCanonical = Object.fromEntries(canonical.map((action, index) => [aliases[index], action]));
  return { canonicalToAlias, aliasToCanonical, alphabet: [...aliases].sort() };
}

/** @param {string[]} pieceIds @param {string|number} seed */
export function createOpaquePieceMap(pieceIds, seed) {
  const ordered = [...pieceIds].sort();
  const aliases = ordered.map((_, index) => `P${String(index).padStart(3, '0')}`);
  shuffleInPlace(createRng(`piece-map:${seed}`), aliases);
  return {
    canonicalToAlias: Object.fromEntries(ordered.map((pieceId, index) => [pieceId, aliases[index]])),
    aliasToCanonical: Object.fromEntries(ordered.map((pieceId, index) => [aliases[index], pieceId])),
  };
}

/** @param {Record<string,boolean>} mask @param {Record<string,string>} mapping */
function aliasMask(mask, mapping) {
  const entries = Object.entries(mask).map(([action, legal]) => /** @type {[string,boolean]} */ ([mapping[action] ?? action, legal]));
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return Object.fromEntries(entries);
}

/** @param {PuzzleEngine} engine @param {Record<string,string>} actionMap @param {string} episodeId */
function publicState(engine, actionMap, episodeId) {
  return {
    stateId: stableDigest(`${episodeId}:${engine.stateHash()}`, 'kinescope-public-state'),
    fingerprint: engine.stateFingerprint(),
    solved: engine.isSolved(),
    legalActionMask: aliasMask(engine.legalActionMask(), actionMap),
  };
}

/** @param {PuzzleEngine} before @param {PuzzleEngine} after @param {Record<string,string>} pieceMap */
function pieceTrajectories(before, after, pieceMap) {
  return before.puzzle.pieces.map((piece) => ({
    pieceId: pieceMap[piece.id] ?? piece.id,
    from: [...before.getCurrentCoord(piece.id)],
    to: [...after.getCurrentCoord(piece.id)],
    orientationBefore: [...before.getPieceTransform(piece.id)],
    orientationAfter: [...after.getPieceTransform(piece.id)],
    moved: before.getCurrentCoord(piece.id).some((value, index) => value !== after.getCurrentCoord(piece.id)[index]),
  }));
}

/** @param {PuzzleEngine} engine @param {string[]} requested @param {()=>number} rng */
function chooseLegalAction(engine, requested, rng) {
  const legal = requested.filter((action) => engine.moveLegality(action).legal);
  if (legal.length === 0) return null;
  return randomChoice(rng, legal);
}

/**
 * Generates a deterministic, leakage-aware interaction episode with synchronized public and
 * evaluator-private records. Rendering is represented as exact render requests so the same
 * episode can be materialized locally, in CI, or through the HTTP API.
 *
 * @param {PuzzleSpec} spec
 * @param {{seed?:string|number,scrambleDepth?:number,horizon?:number,visibility?:'disclosed'|'notation-withheld'|'identity-withheld'|'fully-withheld',channels?:string[],cameras?:typeof DEFAULT_CAMERA_BANK,includeDynamics?:boolean}} [options]
 */
export function generateResearchEpisode(spec, options = {}) {
  const seed = String(options.seed ?? 'episode-001');
  const puzzle = compilePuzzle(spec);
  const engine = new PuzzleEngine(puzzle);
  const rng = createRng(`episode:${seed}`);
  const horizon = Math.max(1, Math.min(256, Math.trunc(options.horizon ?? 8)));
  const scrambleDepth = Math.max(0, Math.min(256, Math.trunc(options.scrambleDepth ?? 5)));
  const visibility = options.visibility ?? 'fully-withheld';
  const canonicalActions = puzzle.moves.map((move) => move.id);
  const actionAliases = createOpaqueActionMap(canonicalActions, `${seed}:${spec.id}`);
  const pieceAliases = createOpaquePieceMap(puzzle.pieces.map((piece) => piece.id), `${seed}:${spec.id}`);
  const episodeId = `ep-${safeId(spec.id)}-${stableDigest(seed, 'seed').slice(-12)}`;
  const channels = (options.channels ?? OBSERVATION_CHANNELS.map((entry) => entry.id)).filter((channel) =>
    OBSERVATION_CHANNELS.some((entry) => entry.id === channel));
  const cameras = (options.cameras ?? DEFAULT_CAMERA_BANK).map((camera) => structuredClone(camera));

  const scramble = engine.generateScramble(scrambleDepth, `${seed}:scramble`);
  for (const action of scramble) engine.applyMove(action);
  const initialEngine = engine.fork();
  const initialPublic = publicState(engine, actionAliases.canonicalToAlias, episodeId);
  const initialPrivate = {
    state: engine.serialize(),
    groundTruth: engine.groundTruth(),
  };

  const steps = [];
  const privateSteps = [];
  for (let index = 0; index < horizon; index += 1) {
    const before = engine.fork();
    const canonical = chooseLegalAction(engine, canonicalActions, rng);
    if (!canonical) break;
    const alias = actionAliases.canonicalToAlias[canonical];
    const legalityBefore = engine.moveLegality(canonical);
    const beforePublic = publicState(engine, actionAliases.canonicalToAlias, episodeId);
    engine.applyMove(canonical);
    const afterPublic = publicState(engine, actionAliases.canonicalToAlias, episodeId);
    const camera = cameras[index % cameras.length];
    const observationRequests = channels.map((channel) => ({
      channel,
      cameraId: camera.id,
      camera,
      width: 512,
      height: 512,
      stateFingerprint: afterPublic.fingerprint,
    }));
    steps.push({
      step: index,
      stateBefore: beforePublic,
      action: alias,
      stateAfter: afterPublic,
      observationRequests,
      feedback: { accepted: true },
    });
    privateSteps.push({
      step: index,
      canonicalAction: canonical,
      alias,
      legalityBefore: {
        legal: legalityBefore.legal,
        selectedPieceIds: [...legalityBefore.selectedIds],
        violatedBandages: legalityBefore.violatedBandages,
      },
      stateBefore: before.serialize(),
      stateAfter: engine.serialize(),
      pieceTrajectories: pieceTrajectories(before, engine, pieceAliases.canonicalToAlias),
      dynamicsBefore: options.includeDynamics === false ? undefined : analyzeCurrentDynamics(before),
    });
  }

  const publicPuzzle = {
    puzzleInstanceId: stableDigest(`${episodeId}:${spec.id}`, 'kinescope-puzzle-instance'),
    size: spec.size,
    family: visibility === 'disclosed' ? spec.family : 'withheld',
    name: visibility === 'disclosed' ? spec.name : 'Unfamiliar spatial mechanism',
    description: visibility === 'disclosed' ? spec.description : 'Infer the latent mechanics from observations and interventions.',
    actionAlphabet: actionAliases.alphabet,
    observationChannels: channels,
    cameras: cameras.map(({ id, ...camera }) => ({ id, ...camera })),
    visibility,
  };

  const publicEpisode = {
    schema: 'kinescope.episode-public.v1',
    engineVersion: ENGINE_VERSION,
    episodeId,
    seed,
    puzzle: publicPuzzle,
    initialState: initialPublic,
    initialObservationRequests: channels.map((channel) => ({
      channel,
      cameraId: cameras[0].id,
      camera: cameras[0],
      width: 512,
      height: 512,
      stateFingerprint: initialPublic.fingerprint,
    })),
    steps,
    budget: {
      actionBudget: horizon,
      cameraRequestBudget: cameras.length * Math.max(1, horizon),
      consumedActions: steps.length,
    },
  };

  const privateEpisode = {
    schema: 'kinescope.episode-private.v1',
    engineVersion: ENGINE_VERSION,
    episodeId,
    seed,
    canonicalPuzzleSpec: structuredClone(spec),
    compiledStats: structuredClone(puzzle.stats),
    actionAliases,
    pieceAliases,
    scramble,
    initial: initialPrivate,
    steps: privateSteps,
    final: {
      state: engine.serialize(),
      groundTruth: engine.groundTruth(),
      dynamics: options.includeDynamics === false ? undefined : analyzeCurrentDynamics(engine),
    },
  };

  publicEpisode.publicDigest = stableDigest(publicEpisode, 'kinescope-public-episode');
  privateEpisode.privateDigest = stableDigest(privateEpisode, 'kinescope-private-episode');
  return { public: publicEpisode, private: privateEpisode };
}
