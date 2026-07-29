// @ts-check

import { compilePuzzle } from '../core/puzzle-compiler.js';
import { analyzeCurrentDynamics } from '../core/dynamics-analysis.js';
import { v3 } from '../core/vec3.js';
import { createPreset } from '../core/presets.js';
import { parseMoveToken, PuzzleEngine } from '../core/puzzle-engine.js';
import { createZip } from '../core/zip.js';
import { frameAxis, logicalRotationToWorld } from '../core/frame.js';
import { hashSeed } from '../core/rng.js';
import { OrbitCamera } from './camera.js';
import { axisAngle3, easeInOutCubic, mat4AroundOrigin, mat4Multiply } from './mat4.js';
import { TwistyRenderer } from './webgl-renderer.js';
import { ENGINE_VERSION } from '../version.js';

/** @typedef {import('../core/puzzle-compiler.js').PuzzleSpec} PuzzleSpec */
/** @typedef {import('../core/puzzle-engine.js').MovePreview} MovePreview */
/** @typedef {'studio'|'albedo'|'piece'|'face'|'normal'|'depth'} RenderMode */
/** @typedef {{token:string,resolve:(value:MovePreview)=>void,reject:(reason:unknown)=>void}} QueueItem */
/** @typedef {{preview:MovePreview,startedAt:number,durationMs:number,item:QueueItem}} ActiveMove */

const VERSION = ENGINE_VERSION;

/** @param {Blob} blob @param {string} filename */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** @param {unknown} value */
function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** @param {string} value */
function safeFilename(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'kinescope';
}

/** @param {string} token */
function splitActionSuffix(token) {
  const normalized = token.trim().replace(/[’′]/g, "'");
  if (!normalized) throw new Error('Action token cannot be empty.');
  let body = normalized;
  const inverse = body.endsWith("'");
  if (inverse) body = body.slice(0, -1);
  const doubled = body.endsWith('2');
  if (doubled) body = body.slice(0, -1);
  return { body, suffix: doubled ? '2' : inverse ? "'" : '' };
}

/**
 * Owns exact mechanics, animation, rendering, camera, selection, and dataset export.
 * It deliberately keeps physics/state and graphics separate because debugging one universe
 * at a time is already enough of a hobby.
 */
export class SceneController {
  /** @param {HTMLCanvasElement} canvas @param {PuzzleSpec} initialSpec */
  constructor(canvas, initialSpec) {
    this.canvas = canvas;
    this.renderer = new TwistyRenderer(canvas);
    this.camera = new OrbitCamera(canvas);
    this.puzzle = compilePuzzle(initialSpec);
    this.engine = new PuzzleEngine(this.puzzle);
    this.renderer.setPuzzle(this.puzzle);
    this.fitCameraToPuzzle();
    /** @type {QueueItem[]} */
    this.queue = [];
    /** @type {ActiveMove|null} */
    this.active = null;
    /** @type {string|null} */
    this.selectedPieceId = null;
    /** @type {RenderMode} */
    this.renderMode = 'studio';
    this.unknownMechanics = true;
    this.moveDurationMs = 310;
    this.running = false;
    this.lastFrameTime = performance.now();
    this.lastUiEmit = 0;
    this.frameCounter = 0;
    this.fps = 0;
    this.fpsWindowStart = performance.now();
    /** @type {Set<(snapshot:ReturnType<SceneController['snapshot']>)=>void>} */
    this.listeners = new Set();
    /** @type {Map<string,Float32Array>} */
    this.lastModelMatrices = this.computeModelMatrices(0);

    this.canvas.addEventListener('click', (event) => {
      if (this.camera.lastReleaseWasDrag) return;
      const pieceId = this.renderer.pickPiece(event.clientX, event.clientY, this.camera, this.lastModelMatrices);
      this.selectedPieceId = pieceId;
      this.emit(true);
    });
  }

  /** @param {(snapshot:ReturnType<SceneController['snapshot']>)=>void} listener */
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  /** @param {boolean} [force] */
  emit(force = false) {
    const now = performance.now();
    if (!force && now - this.lastUiEmit < 90) return;
    this.lastUiEmit = now;
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    requestAnimationFrame((time) => this.frame(time));
  }

  stop() {
    this.running = false;
  }

  /** @param {number} time */
  frame(time) {
    if (!this.running) return;
    const deltaSeconds = Math.min(0.1, Math.max(0, (time - this.lastFrameTime) / 1000));
    this.lastFrameTime = time;
    this.camera.update(deltaSeconds);
    this.advanceAnimation(time);
    const progress = this.active ? Math.min(1, Math.max(0, (time - this.active.startedAt) / this.active.durationMs)) : 0;
    this.lastModelMatrices = this.computeModelMatrices(progress);
    const highlights = this.computeHighlights();
    const viewData = this.camera.matrices(this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    this.renderer.render({
      viewData,
      modelMatrices: this.lastModelMatrices,
      mode: this.renderMode,
      highlights,
    });

    this.frameCounter += 1;
    if (time - this.fpsWindowStart >= 500) {
      this.fps = this.frameCounter * 1000 / (time - this.fpsWindowStart);
      this.frameCounter = 0;
      this.fpsWindowStart = time;
      this.emit();
    } else if (this.active) {
      this.emit();
    }
    requestAnimationFrame((next) => this.frame(next));
  }

  /** @param {number} time */
  advanceAnimation(time) {
    if (!this.active && this.queue.length > 0) this.beginNextMove(time);
    if (!this.active) return;
    const progress = (time - this.active.startedAt) / this.active.durationMs;
    if (progress < 1) return;
    const completed = this.active;
    this.active = null;
    try {
      this.engine.commitPreview(completed.preview);
      completed.item.resolve(completed.preview);
    } catch (error) {
      completed.item.reject(error);
      this.rejectQueue(error);
    }
    this.emit(true);
    if (this.queue.length > 0) this.beginNextMove(time);
  }

  /** @param {number} time */
  beginNextMove(time) {
    const item = this.queue.shift();
    if (!item) return;
    try {
      const preview = this.engine.previewMove(item.token);
      const turnMagnitude = Math.abs(preview.quarterTurns) === 2 ? 1.42 : 1;
      this.active = {
        preview,
        startedAt: time,
        durationMs: this.moveDurationMs * turnMagnitude,
        item,
      };
      this.emit(true);
    } catch (error) {
      item.reject(error);
      this.rejectQueue(error);
    }
  }

  /** @param {unknown} reason */
  rejectQueue(reason) {
    if (this.active) {
      this.active.item.reject(reason);
      this.active = null;
    }
    for (const item of this.queue.splice(0)) item.reject(reason);
    this.emit(true);
  }

  /** @param {number} progress */
  computeModelMatrices(progress) {
    /** @type {Map<string,Float32Array>} */
    const matrices = new Map();
    let animatedTurn = null;
    let activeIds = null;
    if (this.active) {
      const eased = easeInOutCubic(progress);
      const axis = frameAxis(this.puzzle.frame, this.active.preview.axis);
      const rotation = axisAngle3(axis, this.active.preview.angleRadians * eased);
      animatedTurn = mat4AroundOrigin(rotation, this.puzzle.frame.origin);
      activeIds = new Set(this.active.preview.selectedIds);
    }

    for (const piece of this.puzzle.pieces) {
      if (!piece.renderable) continue;
      const exact = this.engine.getPieceTransform(piece.id);
      const worldRotation = logicalRotationToWorld(this.puzzle.frame, exact);
      let model = mat4AroundOrigin(worldRotation, this.puzzle.frame.origin);
      if (animatedTurn && activeIds?.has(piece.id)) model = mat4Multiply(animatedTurn, model);
      matrices.set(piece.id, model);
    }
    return matrices;
  }

  computeHighlights() {
    /** @type {Map<string,number>} */
    const highlights = new Map();
    if (this.active) for (const pieceId of this.active.preview.selectedIds) highlights.set(pieceId, 0.18);
    if (this.selectedPieceId) {
      const bandage = this.puzzle.constraints.bandageByPieceId.get(this.selectedPieceId);
      if (bandage && !this.unknownMechanics) {
        for (const pieceId of bandage.pieceIds) highlights.set(pieceId, 0.46);
      }
      highlights.set(this.selectedPieceId, 1);
    }
    return highlights;
  }

  /** @param {string} token @param {{animated?:boolean}} [options] */
  applyMove(token, options = {}) {
    const parsed = parseMoveToken(token, this.puzzle.moveById);
    if (options.animated === false) {
      const preview = this.engine.applyMove(parsed.canonicalToken);
      this.lastModelMatrices = this.computeModelMatrices(0);
      this.emit(true);
      return Promise.resolve(preview);
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ token: parsed.canonicalToken, resolve, reject });
      this.emit(true);
    });
  }

  /** @param {string[]|string} sequence @param {{animated?:boolean}} [options] */
  async applySequence(sequence, options = {}) {
    const tokens = Array.isArray(sequence)
      ? sequence
      : sequence.trim().split(/[\s,]+/).filter(Boolean);
    const results = [];
    for (const token of tokens) results.push(await this.applyMove(token, options));
    return results;
  }

  /** @param {number} length @param {string|number} seed @param {{animated?:boolean}} [options] */
  async scramble(length = 20, seed = 'artifact-001', options = {}) {
    const tokens = this.engine.generateScramble(length, seed);
    if (options.animated === false) {
      for (const token of tokens) this.engine.applyMove(token);
      this.lastModelMatrices = this.computeModelMatrices(0);
      this.emit(true);
      return tokens;
    }
    // Enqueue in one batch so UI clicks cannot splice themselves into the middle of the scramble.
    const promises = tokens.map((token) => this.applyMove(token));
    await Promise.all(promises);
    return tokens;
  }

  cancelMotion(reason = new Error('Motion queue cancelled.')) {
    if (this.active) {
      this.active.item.reject(reason);
      this.active = null;
    }
    for (const item of this.queue.splice(0)) item.reject(reason);
  }

  reset() {
    this.cancelMotion();
    this.engine.reset();
    this.selectedPieceId = null;
    this.lastModelMatrices = this.computeModelMatrices(0);
    this.emit(true);
  }

  undo() {
    this.cancelMotion();
    const changed = this.engine.undo();
    this.lastModelMatrices = this.computeModelMatrices(0);
    this.emit(true);
    return changed;
  }

  redo() {
    this.cancelMotion();
    const changed = this.engine.redo();
    this.lastModelMatrices = this.computeModelMatrices(0);
    this.emit(true);
    return changed;
  }

  clearQueue() {
    this.cancelMotion();
    this.emit(true);
  }

  fitCameraToPuzzle() {
    const vertices = this.puzzle.pieces.flatMap((piece) => piece.polyhedron.vertices);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const vertex of vertices) {
      min[0] = Math.min(min[0], vertex.x); min[1] = Math.min(min[1], vertex.y); min[2] = Math.min(min[2], vertex.z);
      max[0] = Math.max(max[0], vertex.x); max[1] = Math.max(max[1], vertex.y); max[2] = Math.max(max[2], vertex.z);
    }
    const center = v3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2 + 0.08, (min[2] + max[2]) / 2);
    let radius = 0;
    for (const vertex of vertices) {
      radius = Math.max(radius, Math.hypot(vertex.x - center.x, vertex.y - center.y, vertex.z - center.z));
    }
    this.camera.target = center;
    this.camera.distance = Math.max(6.4, Math.min(12.4, radius * 3.04));
    this.camera.maxDistance = Math.max(13, this.camera.distance * 1.7);
  }

  /** @param {PuzzleSpec} spec */
  setPuzzleSpec(spec) {
    const compiled = compilePuzzle(spec);
    this.cancelMotion();
    this.puzzle = compiled;
    this.engine = new PuzzleEngine(compiled);
    this.renderer.setPuzzle(compiled);
    this.camera.reset();
    this.fitCameraToPuzzle();
    this.selectedPieceId = null;
    this.renderMode = 'studio';
    this.lastModelMatrices = this.computeModelMatrices(0);
    this.emit(true);
    return compiled;
  }

  /** @param {string} id @param {string|number} [seed] */
  setPreset(id, seed) {
    return this.setPuzzleSpec(createPreset(id, seed));
  }

  /** @param {RenderMode} mode */
  setRenderMode(mode) {
    if (!['studio', 'albedo', 'piece', 'face', 'normal', 'depth'].includes(mode)) {
      throw new Error(`Unknown render mode: ${mode}`);
    }
    this.renderMode = mode;
    this.emit(true);
  }

  /** @param {number} movesPerSecond */
  setMoveSpeed(movesPerSecond) {
    const speed = Math.max(0.35, Math.min(8, Number(movesPerSecond)));
    this.moveDurationMs = 1000 / speed;
    this.emit(true);
  }

  /** @param {boolean} value */
  setUnknownMechanics(value) {
    this.unknownMechanics = Boolean(value);
    this.emit(true);
  }

  publicPuzzleDescriptor() {
    if (!this.unknownMechanics) {
      return {
        id: this.puzzle.spec.id,
        name: this.puzzle.spec.name,
        family: this.puzzle.spec.family,
        description: this.puzzle.spec.description,
      };
    }
    const metadata = this.puzzle.spec.metadata ?? {};
    const fallbackId = `artifact-${hashSeed(`public:${this.puzzle.spec.id}`).toString(16).padStart(8, '0')}`;
    return {
      id: String(metadata.publicId ?? fallbackId),
      name: String(metadata.publicName ?? 'Unfamiliar Artifact'),
      family: String(metadata.publicFamily ?? 'withheld-mechanics'),
      description: String(metadata.publicDescription ?? 'Infer the object’s spatial transition system through observation and interaction.'),
    };
  }

  agentActionAlphabet() {
    return this.puzzle.moves.map((move, index) => this.unknownMechanics ? `A${index}` : move.id);
  }

  agentLegalActionMask() {
    const internalMask = this.engine.legalActionMask();
    return Object.fromEntries(this.puzzle.moves.map((move, index) => [
      this.unknownMechanics ? `A${index}` : move.id,
      internalMask[move.id],
    ]));
  }

  /** @param {string} token */
  resolveAgentToken(token) {
    if (!this.unknownMechanics) return parseMoveToken(token, this.puzzle.moveById).canonicalToken;
    const normalized = token.trim().replace(/[’′]/g, "'");
    if (!normalized) throw new Error('Action token cannot be empty.');

    // Opaque IDs deliberately end in digits (A0, A1, A2, ...). Check the exact
    // alphabet before interpreting a terminal `2` as a double-turn suffix, or A2
    // becomes the rather less useful action A performed twice. Humans invented
    // overloaded notation; the engine need not inherit the confusion.
    const exactMatch = /^A(\d+)$/i.exec(normalized);
    if (exactMatch) {
      const move = this.puzzle.moves[Number(exactMatch[1])];
      if (move) return move.id;
    }

    const { body, suffix } = splitActionSuffix(normalized);
    const match = /^A(\d+)$/i.exec(body);
    if (!match) throw new Error(`Unknown agent action ${body}. Expected one of ${this.agentActionAlphabet().join(', ')}.`);
    const index = Number(match[1]);
    const move = this.puzzle.moves[index];
    if (!move) throw new Error(`Unknown agent action ${body}. Expected one of ${this.agentActionAlphabet().join(', ')}.`);
    return `${move.id}${suffix}`;
  }

  agentObservation() {
    const actionAlphabet = this.agentActionAlphabet();
    return {
      schema: 'kinescope.agent-observation.v1',
      engineVersion: VERSION,
      puzzle: this.publicPuzzleDescriptor(),
      mechanics: this.unknownMechanics ? 'withheld' : 'disclosed',
      actionAlphabet,
      ...(this.unknownMechanics ? {} : { legalActionMask: this.agentLegalActionMask() }),
      renderMode: this.renderMode,
      camera: this.camera.serialize(),
      stateId: `${this.publicPuzzleDescriptor().id}:${this.engine.stateFingerprint()}`,
    };
  }

  /**
   * Applies a bounded, deterministic camera intervention and returns the resulting pose.
   * This is deliberately expressed in angular/scale deltas so an experiment harness can
   * charge one view action without synthesizing browser pointer events like a tiny ghost.
   * @param {{yawDelta?:number,pitchDelta?:number,distanceScale?:number,targetDelta?:[number,number,number]}} [request]
   */
  requestView(request = {}) {
    const yawDelta = Math.max(-Math.PI, Math.min(Math.PI, Number(request.yawDelta ?? 0)));
    const pitchDelta = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, Number(request.pitchDelta ?? 0)));
    const distanceScale = Math.max(0.45, Math.min(2.2, Number(request.distanceScale ?? 1)));
    const targetDelta = request.targetDelta ?? [0, 0, 0];
    if (!Array.isArray(targetDelta) || targetDelta.length !== 3 || targetDelta.some((value) => !Number.isFinite(Number(value)))) {
      throw new Error('targetDelta must be a finite [x,y,z] vector.');
    }
    this.camera.yaw += yawDelta;
    this.camera.pitch += pitchDelta;
    const pitchLimit = Math.PI / 2 - 0.045;
    this.camera.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.camera.pitch));
    this.camera.distance = Math.max(
      this.camera.minDistance,
      Math.min(this.camera.maxDistance, this.camera.distance * distanceScale),
    );
    this.camera.target = v3(
      this.camera.target.x + Math.max(-2, Math.min(2, Number(targetDelta[0]))),
      this.camera.target.y + Math.max(-2, Math.min(2, Number(targetDelta[1]))),
      this.camera.target.z + Math.max(-2, Math.min(2, Number(targetDelta[2]))),
    );
    this.emit(true);
    return this.camera.serialize();
  }

  /** @param {string} token @param {{animated?:boolean}} [options] */
  async applyAgentAction(token, options = {}) {
    const withheldAtDispatch = this.unknownMechanics;
    let internalToken = '';
    let publicAction = String(token).trim();
    try {
      internalToken = this.resolveAgentToken(token);
      if (withheldAtDispatch) {
        const { body, suffix } = splitActionSuffix(token);
        publicAction = `${body.toUpperCase()}${suffix}`;
      } else {
        publicAction = internalToken;
      }
      await this.applyMove(internalToken, options);
      return {
        schema: 'kinescope.agent-transition.v1',
        action: publicAction,
        accepted: true,
        stateId: this.agentObservation().stateId,
      };
    } catch (error) {
      if (!withheldAtDispatch) throw error;
      const rejected = new Error(`Action ${token} is unavailable in the current state.`);
      rejected.name = 'AgentActionRejectedError';
      // Deliberately do not copy the internal token, bandage labels, selected pieces, or
      // legality diagnostics onto this object. Hidden mechanics should not leak through
      // the error channel merely because the model had the audacity to experiment.
      Object.assign(rejected, {
        code: 'KineScope_ACTION_REJECTED',
        action: token,
      });
      throw rejected;
    }
  }

  /** @param {string[]|string} sequence @param {{animated?:boolean}} [options] */
  async applyAgentSequence(sequence, options = {}) {
    const tokens = Array.isArray(sequence)
      ? sequence
      : sequence.trim().split(/[\s,]+/).filter(Boolean);
    const results = [];
    for (const token of tokens) results.push(await this.applyAgentAction(token, options));
    return results;
  }

  selectedPiece() {
    if (!this.selectedPieceId) return null;
    const piece = this.puzzle.pieceById.get(this.selectedPieceId);
    if (!piece) return null;
    return {
      pieceId: piece.id,
      homeIndex: piece.homeIndex,
      homeCoord: [...piece.homeCoord],
      currentCoord: [...this.engine.getCurrentCoord(piece.id)],
      orientation: [...this.engine.getPieceTransform(piece.id)],
      vertices: piece.polyhedron.vertices.length,
      faces: piece.polyhedron.faces.length,
      triangles: piece.polyhedron.triangles.length,
      volume: piece.polyhedron.volume,
      outerArea: piece.outerArea,
      bandage: this.unknownMechanics ? null : this.engine.bandageForPiece(piece.id),
      outerFaces: piece.polyhedron.faces
        .map((face, index) => ({ index, tag: face.tag, kind: face.kind, area: face.area }))
        .filter((face) => face.kind === 'outer'),
    };
  }

  /** @param {RenderMode} mode @param {{width?:number,height?:number}} [options] */
  capture(mode, options = {}) {
    return this.renderer.capture({
      camera: this.camera,
      modelMatrices: this.lastModelMatrices,
      highlights: this.computeHighlights(),
      mode,
      width: options.width,
      height: options.height,
    });
  }

  /** @param {RenderMode} mode @param {{width?:number,height?:number}} [options] */
  captureClean(mode, options = {}) {
    return this.renderer.capture({
      camera: this.camera,
      modelMatrices: this.lastModelMatrices,
      highlights: new Map(),
      mode,
      width: options.width,
      height: options.height,
    });
  }

  /** @param {{width?:number,height?:number,includeStudio?:boolean}} [options] */
  async exportBundle(options = {}) {
    const width = Math.max(256, Math.min(4096, Math.trunc(options.width ?? 1024)));
    const height = Math.max(256, Math.min(4096, Math.trunc(options.height ?? 1024)));
    const modes = /** @type {RenderMode[]} */ ([
      ...(options.includeStudio === false ? [] : ['studio']),
      'albedo', 'piece', 'face', 'normal', 'depth',
    ]);
    /** @type {{name:string,data:string|Uint8Array|ArrayBuffer|Blob}[]} */
    const entries = [];
    for (const mode of modes) {
      const blob = await this.captureClean(mode, { width, height });
      entries.push({ name: `observations/${mode}.png`, data: blob });
    }

    const publicEpisode = {
      schema: 'kinescope.episode.public.v1',
      engineVersion: VERSION,
      episodeId: `${this.publicPuzzleDescriptor().id}-${this.engine.version}`,
      puzzle: this.publicPuzzleDescriptor(),
      mechanics: this.unknownMechanics ? 'withheld' : 'disclosed',
      actionAlphabet: this.agentActionAlphabet(),
      ...(this.unknownMechanics ? {} : { legalActionMask: this.agentLegalActionMask() }),
      observationFiles: modes.map((mode) => ({ mode, path: `observations/${mode}.png`, width, height })),
      camera: this.camera.serialize(),
      stateId: `${this.publicPuzzleDescriptor().id}:${this.engine.stateFingerprint()}`,
    };
    const privateGroundTruth = {
      schema: 'kinescope.episode.private.v1',
      engineVersion: VERSION,
      generatedAt: new Date().toISOString(),
      puzzleSpec: this.puzzle.spec,
      compiledStats: this.puzzle.stats,
      state: this.engine.serialize(),
      groundTruth: this.engine.groundTruth(),
      dynamics: analyzeCurrentDynamics(this.engine),
      agentActionMap: this.puzzle.moves.map((move, index) => ({
        publicId: this.unknownMechanics ? `A${index}` : move.id,
        internalId: move.id,
      })),
      segmentationLegend: this.renderer.segmentationLegend(),
      camera: this.camera.serialize(),
    };
    entries.push(
      { name: 'episode_public.json', data: prettyJson(publicEpisode) },
      { name: 'private/ground_truth.json', data: prettyJson(privateGroundTruth) },
      {
        name: 'README.txt',
        data:
          'KineScope research sample\n\n' +
          'episode_public.json contains the agent-facing episode.\n' +
          'private/ground_truth.json contains exact mechanics, transforms, and segmentation legends.\n' +
          'Observation PNGs are byte-stable renders from one camera pose.\n',
      },
    );
    return createZip(entries);
  }

  snapshot() {
    const rendererStats = this.renderer.stats();
    const activeProgress = this.active
      ? Math.max(0, Math.min(1, (performance.now() - this.active.startedAt) / this.active.durationMs))
      : 0;
    return {
      version: VERSION,
      puzzle: {
        id: this.puzzle.spec.id,
        name: this.puzzle.spec.name,
        family: this.puzzle.spec.family,
        description: this.puzzle.spec.description,
        spec: this.puzzle.spec,
        stats: this.puzzle.stats,
      },
      mechanics: {
        unknown: this.unknownMechanics,
        moves: this.puzzle.moves,
        legalActionMask: this.engine.legalActionMask(),
        constraints: {
          bandageCount: this.puzzle.stats.bandageCount,
          bandagedPieceCount: this.puzzle.stats.bandagedPieceCount,
        },
      },
      state: {
        solved: this.engine.isSolved(),
        hash: this.engine.stateHash(),
        fingerprint: this.engine.stateFingerprint(),
        version: this.engine.version,
        history: this.engine.history.map((move) => move.token),
        future: this.engine.future.map((move) => move.token),
      },
      motion: {
        activeToken: this.active?.preview.token ?? null,
        activeProgress,
        queuedTokens: this.queue.map((item) => item.token),
        speed: 1000 / this.moveDurationMs,
      },
      selectedPiece: this.selectedPiece(),
      render: {
        mode: this.renderMode,
        fps: this.fps,
        rendererStats,
        camera: this.camera.serialize(),
      },
    };
  }

  publicApi() {
    return Object.freeze({
      version: VERSION,
      getState: () => this.engine.serialize(),
      getGroundTruth: () => this.engine.groundTruth(),
      getPuzzleSpec: () => structuredClone(this.puzzle.spec),
      getSnapshot: () => this.snapshot(),
      getAgentObservation: () => this.agentObservation(),
      listMoves: () => this.puzzle.moves.map((move) => ({ ...move })),
      getLegalActionMask: () => this.engine.legalActionMask(),
      inspectAction: (token) => structuredClone(this.engine.moveLegality(token)),
      analyzeDynamics: (options) => analyzeCurrentDynamics(this.engine, options),
      act: (token, options) => this.applyAgentAction(token, options),
      actSequence: (sequence, options) => this.applyAgentSequence(sequence, options),
      apply: (token, options) => this.applyMove(token, options),
      applySequence: (sequence, options) => this.applySequence(sequence, options),
      scramble: (length, seed, options) => this.scramble(length, seed, options),
      reset: () => this.reset(),
      undo: () => this.undo(),
      redo: () => this.redo(),
      setPreset: (id, seed) => this.setPreset(id, seed),
      setPuzzleSpec: (spec) => this.setPuzzleSpec(spec),
      setMechanicsWithheld: (withheld) => this.setUnknownMechanics(withheld),
      requestView: (request) => this.requestView(request),
      setObservationMode: (mode) => this.setRenderMode(mode),
      capture: (mode, options) => this.capture(mode, options),
      exportBundle: (options) => this.exportBundle(options),
    });
  }

  /**
   * Narrow agent-facing capability surface. It intentionally omits puzzle specs, exact
   * transforms, internal action names, legality oracles, reset, and evaluator analysis.
   * A benchmark runner can expose this object without asking models to exercise restraint.
   */
  agentApi() {
    return Object.freeze({
      version: VERSION,
      observe: () => structuredClone(this.agentObservation()),
      listActions: () => [...this.agentActionAlphabet()],
      act: (token, options) => this.applyAgentAction(token, options),
      actSequence: (sequence, options) => this.applyAgentSequence(sequence, options),
      requestView: (request) => this.requestView(request),
      setObservationMode: (mode) => this.setRenderMode(mode),
      capture: (mode, options) => this.captureClean(mode, options),
    });
  }

  bundleFilename() {
    return `${safeFilename(this.puzzle.spec.id)}-episode-${this.engine.version}.zip`;
  }
}
