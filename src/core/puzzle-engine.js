// @ts-check

import {
  apply3i,
  determinant3i,
  equals3i,
  identity3i,
  isProperCubeRotation,
  key3i,
  multiply3i,
  quarterTurn3i,
} from './mat3i.js';
import { createRng, hashSeed, randomChoice } from './rng.js';

/** @typedef {import('./mat3i.js').Mat3i} Mat3i */
/** @typedef {import('./mat3i.js').Vec3i} Vec3i */
/** @typedef {import('./puzzle-compiler.js').CompiledPuzzle} CompiledPuzzle */
/** @typedef {import('./puzzle-compiler.js').MoveDefinition} MoveDefinition */
/**
 * @typedef {Object} MovePreview
 * @property {string} token
 * @property {string} baseMove
 * @property {0|1|2} axis
 * @property {number} layer
 * @property {number} quarterTurns
 * @property {number} angleRadians
 * @property {string[]} selectedIds
 * @property {Mat3i} rotation
 * @property {string} stateHashBefore
 */
/**
 * @typedef {Object} MoveRecord
 * @property {string} token
 * @property {string} baseMove
 * @property {0|1|2} axis
 * @property {number} layer
 * @property {number} quarterTurns
 * @property {string[]} selectedIds
 * @property {number} sequence
 */

/**
 * @typedef {Object} MoveLegality
 * @property {string} token
 * @property {string} baseMove
 * @property {MoveDefinition} definition
 * @property {number} quarterTurns
 * @property {string[]} selectedIds
 * @property {boolean} legal
 * @property {{id:string,label:string,selected:number,total:number,pieceIds:string[]}[]} violatedBandages
 */

export class IllegalMoveError extends Error {
  /** @param {MoveLegality} legality */
  constructor(legality) {
    const details = legality.violatedBandages
      .map((bandage) => `${bandage.label} (${bandage.selected}/${bandage.total} bonded pieces selected)`)
      .join(', ');
    super(`Move ${legality.token} is mechanically blocked by ${details}.`);
    this.name = 'IllegalMoveError';
    this.code = 'KineScope_ILLEGAL_MOVE';
    this.legacyCode = 'TWISTYWORLD_ILLEGAL_MOVE';
    this.token = legality.token;
    this.violatedBandages = legality.violatedBandages;
  }
}

export class StaleMovePreviewError extends Error {
  /** @param {MovePreview} preview @param {string} currentStateHash */
  constructor(preview, currentStateHash) {
    super(`Move preview ${preview.token} is stale because the exact puzzle state changed before commit.`);
    this.name = 'StaleMovePreviewError';
    this.code = 'KineScope_STALE_PREVIEW';
    this.legacyCode = 'TWISTYWORLD_STALE_PREVIEW';
    this.token = preview.token;
    this.stateHashBefore = preview.stateHashBefore;
    this.currentStateHash = currentStateHash;
  }
}

/** @param {string} token @param {Map<string,MoveDefinition>} moveById */
export function parseMoveToken(token, moveById) {
  const normalized = token.trim().replace(/[’′]/g, "'");
  if (!normalized) throw new Error('Move token cannot be empty.');

  const exact = moveById.get(normalized.toUpperCase());
  if (exact) {
    return { definition: exact, baseMove: exact.id, quarterTurns: exact.quarterTurns, canonicalToken: exact.id };
  }

  let body = normalized;
  const inverse = body.endsWith("'");
  if (inverse) body = body.slice(0, -1);
  const doubled = body.endsWith('2');
  if (doubled) body = body.slice(0, -1);
  const baseMove = body.toUpperCase();
  if (!baseMove) throw new Error(`Invalid move token: ${token}`);
  const definition = moveById.get(baseMove);
  if (!definition) throw new Error(`Move ${baseMove} is not defined for this puzzle.`);
  const multiplier = doubled ? 2 : inverse ? -1 : 1;
  const quarterTurns = definition.quarterTurns * multiplier;
  const canonicalToken = `${baseMove}${doubled ? '2' : inverse ? "'" : ''}`;
  return { definition, baseMove, quarterTurns, canonicalToken };
}

/**
 * Exact twisty-puzzle state machine. Geometry never decides mechanics; it merely observes them.
 */
export class PuzzleEngine {
  /** @param {CompiledPuzzle} puzzle */
  constructor(puzzle) {
    this.puzzle = puzzle;
    /** @type {Map<string,Mat3i>} */
    this.transforms = new Map();
    /** @type {MoveRecord[]} */
    this.history = [];
    /** @type {MoveRecord[]} */
    this.future = [];
    this.version = 0;
    this.sequence = 0;
    this.reset();
  }

  reset() {
    this.transforms.clear();
    for (const piece of this.puzzle.pieces) this.transforms.set(piece.id, identity3i());
    this.history = [];
    this.future = [];
    this.version += 1;
    this.validateOrThrow();
  }

  /** @param {string} pieceId @returns {Mat3i} */
  getPieceTransform(pieceId) {
    const transform = this.transforms.get(pieceId);
    if (!transform) throw new Error(`Unknown piece: ${pieceId}`);
    return transform;
  }

  /** @param {string} pieceId @returns {Vec3i} */
  getCurrentCoord(pieceId) {
    const piece = this.puzzle.pieceById.get(pieceId);
    if (!piece) throw new Error(`Unknown piece: ${pieceId}`);
    return apply3i(this.getPieceTransform(pieceId), piece.homeCoord);
  }

  /** @param {MoveDefinition} definition */
  selectedIdsForDefinition(definition) {
    const selectedIds = [];
    for (const piece of this.puzzle.pieces) {
      const coord = this.getCurrentCoord(piece.id);
      if (coord[definition.axis] === definition.layer) selectedIds.push(piece.id);
    }
    const expected = this.puzzle.spec.size ** 2;
    if (selectedIds.length !== expected) {
      throw new Error(
        `Move ${definition.id} selected ${selectedIds.length} pieces; expected ${expected}. ` +
        'The logical state has become inconsistent.',
      );
    }
    return selectedIds;
  }

  /** @param {string[]} selectedIds */
  evaluateBandages(selectedIds) {
    const selected = new Set(selectedIds);
    const violatedBandages = [];
    for (const bandage of this.puzzle.constraints.bandages) {
      const count = bandage.pieceIds.reduce((sum, pieceId) => sum + Number(selected.has(pieceId)), 0);
      if (count > 0 && count < bandage.pieceIds.length) {
        violatedBandages.push({
          id: bandage.id,
          label: bandage.label,
          selected: count,
          total: bandage.pieceIds.length,
          pieceIds: [...bandage.pieceIds],
        });
      }
    }
    return violatedBandages;
  }

  /** @param {string} token @returns {MoveLegality} */
  moveLegality(token) {
    const parsed = parseMoveToken(token, this.puzzle.moveById);
    const selectedIds = this.selectedIdsForDefinition(parsed.definition);
    const violatedBandages = this.evaluateBandages(selectedIds);
    return {
      token: parsed.canonicalToken,
      baseMove: parsed.baseMove,
      definition: parsed.definition,
      quarterTurns: parsed.quarterTurns,
      selectedIds,
      legal: violatedBandages.length === 0,
      violatedBandages,
    };
  }

  legalActionMask() {
    return Object.fromEntries(this.puzzle.moves.map((move) => [move.id, this.moveLegality(move.id).legal]));
  }

  /** @param {string} pieceId */
  bandageForPiece(pieceId) {
    const bandage = this.puzzle.constraints.bandageByPieceId.get(pieceId);
    return bandage ? { id: bandage.id, label: bandage.label, pieceIds: [...bandage.pieceIds] } : null;
  }

  /** @param {string} token @returns {MovePreview} */
  previewMove(token) {
    const legality = this.moveLegality(token);
    if (!legality.legal) throw new IllegalMoveError(legality);
    const { definition } = legality;
    return {
      token: legality.token,
      baseMove: legality.baseMove,
      axis: definition.axis,
      layer: definition.layer,
      quarterTurns: legality.quarterTurns,
      angleRadians: legality.quarterTurns * Math.PI / 2,
      selectedIds: legality.selectedIds,
      rotation: quarterTurn3i(definition.axis, legality.quarterTurns),
      stateHashBefore: this.stateHash(),
    };
  }

  /**
   * @param {MovePreview} preview
   * @param {{record?:boolean,clearFuture?:boolean}} [options]
   */
  commitPreview(preview, options = {}) {
    const record = options.record ?? true;
    const clearFuture = options.clearFuture ?? record;
    const currentStateHash = this.stateHash();
    if (preview.stateHashBefore !== currentStateHash) {
      throw new StaleMovePreviewError(preview, currentStateHash);
    }

    // Re-derive the exact transition rather than trusting a caller-supplied preview. The
    // preview is an animation contract, not a permission slip to mutate arbitrary pieces.
    const legality = this.moveLegality(preview.token);
    if (!legality.legal) throw new IllegalMoveError(legality);
    const expectedRotation = quarterTurn3i(legality.definition.axis, legality.quarterTurns);
    const sameSelection = legality.selectedIds.length === preview.selectedIds.length &&
      legality.selectedIds.every((pieceId, index) => pieceId === preview.selectedIds[index]);
    if (
      preview.baseMove !== legality.baseMove ||
      preview.axis !== legality.definition.axis ||
      preview.layer !== legality.definition.layer ||
      preview.quarterTurns !== legality.quarterTurns ||
      !sameSelection ||
      !equals3i(preview.rotation, expectedRotation)
    ) {
      throw new Error(`Move preview ${preview.token} does not match the exact current transition.`);
    }

    const next = new Map(this.transforms);
    for (const pieceId of legality.selectedIds) {
      const current = next.get(pieceId);
      if (!current) throw new Error(`Unknown piece in move preview: ${pieceId}`);
      next.set(pieceId, multiply3i(expectedRotation, current));
    }
    const errors = this.validate(next);
    if (errors.length > 0) throw new Error(`Puzzle state invariant failure: ${errors.join('; ')}`);

    this.transforms = next;
    this.version += 1;
    if (record) {
      this.sequence += 1;
      this.history.push({
        token: legality.token,
        baseMove: legality.baseMove,
        axis: legality.definition.axis,
        layer: legality.definition.layer,
        quarterTurns: legality.quarterTurns,
        selectedIds: [...legality.selectedIds],
        sequence: this.sequence,
      });
      if (clearFuture) this.future = [];
    }
  }

  /** @param {string} token */
  applyMove(token) {
    const preview = this.previewMove(token);
    this.commitPreview(preview);
    return preview;
  }

  undo() {
    const record = this.history.at(-1);
    if (!record) return false;
    const inverse = quarterTurn3i(record.axis, -record.quarterTurns);
    const next = new Map(this.transforms);
    for (const pieceId of record.selectedIds) {
      const current = next.get(pieceId);
      if (!current) throw new Error(`Unknown piece in undo record: ${pieceId}`);
      next.set(pieceId, multiply3i(inverse, current));
    }
    const errors = this.validate(next);
    if (errors.length > 0) throw new Error(`Puzzle state invariant failure: ${errors.join('; ')}`);
    this.transforms = next;
    this.history.pop();
    this.future.push(record);
    this.version += 1;
    return true;
  }

  redo() {
    const record = this.future.at(-1);
    if (!record) return false;
    const rotation = quarterTurn3i(record.axis, record.quarterTurns);
    const next = new Map(this.transforms);
    for (const pieceId of record.selectedIds) {
      const current = next.get(pieceId);
      if (!current) throw new Error(`Unknown piece in redo record: ${pieceId}`);
      next.set(pieceId, multiply3i(rotation, current));
    }
    const errors = this.validate(next);
    if (errors.length > 0) throw new Error(`Puzzle state invariant failure: ${errors.join('; ')}`);
    this.transforms = next;
    this.future.pop();
    this.history.push(record);
    this.version += 1;
    return true;
  }

  fork() {
    const copy = new PuzzleEngine(this.puzzle);
    copy.transforms = new Map([...this.transforms].map(([pieceId, transform]) => [pieceId, /** @type {Mat3i} */ ([...transform])]));
    copy.history = this.history.map((record) => ({ ...record, selectedIds: [...record.selectedIds] }));
    copy.future = this.future.map((record) => ({ ...record, selectedIds: [...record.selectedIds] }));
    copy.version = this.version;
    copy.sequence = this.sequence;
    copy.validateOrThrow();
    return copy;
  }

  /**
   * Generates a deterministic scramble without mutating state.
   * Adjacent moves never use the same axis, avoiding the usual human-generated sludge.
   * @param {number} length
   * @param {string|number} seed
   */
  generateScramble(length = 20, seed = 'kinescope') {
    const targetLength = Math.max(0, Math.trunc(length));
    const rng = createRng(seed);
    const suffixes = ['', "'", '2'];
    const tokens = [];
    let previousAxis = -1;
    const simulation = this.fork();

    for (let i = 0; i < targetLength; i += 1) {
      let candidates = simulation.puzzle.moves.filter(
        (move) => move.axis !== previousAxis && simulation.moveLegality(move.id).legal,
      );
      if (candidates.length === 0) {
        candidates = simulation.puzzle.moves.filter((move) => simulation.moveLegality(move.id).legal);
      }
      if (candidates.length === 0) {
        throw new Error(`Scramble generation reached a mechanically locked state after ${i} moves.`);
      }
      const move = randomChoice(rng, candidates);
      const suffix = randomChoice(rng, suffixes);
      const token = `${move.id}${suffix}`;
      simulation.applyMove(token);
      tokens.push(token);
      previousAxis = move.axis;
    }
    return tokens;
  }

  /** @param {number} length @param {string|number} seed */
  scramble(length = 20, seed = 'kinescope') {
    const tokens = this.generateScramble(length, seed);
    for (const token of tokens) this.applyMove(token);
    return tokens;
  }

  isSolved() {
    const identity = identity3i();
    for (const transform of this.transforms.values()) if (!equals3i(transform, identity)) return false;
    return true;
  }

  stateHash() {
    return this.puzzle.pieces.map((piece) => `${piece.id}:${key3i(this.getPieceTransform(piece.id))}`).join('|');
  }

  /**
   * Returns a compact, deterministic, opaque identifier for public episode records.
   *
   * `stateHash()` intentionally remains the collision-free exact state signature used by
   * the mechanics core. Exposing that signature to an agent would also expose every piece
   * orientation, which is a rather generous interpretation of "mechanics withheld". This
   * 128-bit fingerprint is therefore the public equality token; it is not a security or
   * cryptographic commitment.
   */
  stateFingerprint() {
    const signature = this.stateHash();
    const words = ['north', 'east', 'south', 'west'].map((salt) =>
      hashSeed(`kinescope:${salt}:${this.puzzle.spec.id}:${signature}`).toString(16).padStart(8, '0'));
    return `lml1-${words.join('')}`;
  }

  /** @param {Map<string,Mat3i>} [transforms] */
  validate(transforms = this.transforms) {
    const errors = [];
    const occupied = new Map();
    for (const piece of this.puzzle.pieces) {
      const transform = transforms.get(piece.id);
      if (!transform) {
        errors.push(`missing transform for ${piece.id}`);
        continue;
      }
      if (!isProperCubeRotation(transform) || determinant3i(transform) !== 1) {
        errors.push(`invalid orientation for ${piece.id}: ${key3i(transform)}`);
      }
      const coord = apply3i(transform, piece.homeCoord);
      const coordKey = coord.join(',');
      const previous = occupied.get(coordKey);
      if (previous) errors.push(`pieces ${previous} and ${piece.id} occupy ${coordKey}`);
      occupied.set(coordKey, piece.id);
    }
    for (const bandage of this.puzzle.constraints.bandages) {
      const reference = transforms.get(bandage.pieceIds[0]);
      if (!reference) continue;
      for (const pieceId of bandage.pieceIds.slice(1)) {
        const transform = transforms.get(pieceId);
        if (!transform || !equals3i(reference, transform)) {
          errors.push(`bandage ${bandage.id} is split between ${bandage.pieceIds[0]} and ${pieceId}`);
        }
      }
    }
    if (occupied.size !== this.puzzle.pieces.length) {
      errors.push(`occupied ${occupied.size} logical cells for ${this.puzzle.pieces.length} pieces`);
    }
    return errors;
  }

  validateOrThrow() {
    const errors = this.validate();
    if (errors.length > 0) throw new Error(`Puzzle state invariant failure: ${errors.join('; ')}`);
  }

  serialize() {
    return {
      schema: 'kinescope.state.v1',
      puzzleId: this.puzzle.spec.id,
      version: this.version,
      transforms: this.puzzle.pieces.map((piece) => ({
        pieceId: piece.id,
        orientation: [...this.getPieceTransform(piece.id)],
      })),
      history: this.history.map((record) => ({
        token: record.token,
        sequence: record.sequence,
      })),
      solved: this.isSolved(),
      hash: this.stateHash(),
      fingerprint: this.stateFingerprint(),
      legalActionMask: this.legalActionMask(),
    };
  }

  /** @param {ReturnType<PuzzleEngine['serialize']>} state */
  load(state) {
    if (!['kinescope.state.v1', 'twistyworld.state.v1'].includes(state.schema)) {
      throw new Error(`Unsupported state schema: ${state.schema}`);
    }
    if (state.puzzleId !== this.puzzle.spec.id) {
      throw new Error(`State belongs to ${state.puzzleId}, not ${this.puzzle.spec.id}.`);
    }
    const next = new Map();
    for (const entry of state.transforms) {
      if (!this.puzzle.pieceById.has(entry.pieceId)) throw new Error(`Unknown piece in state: ${entry.pieceId}`);
      if (!Array.isArray(entry.orientation) || entry.orientation.length !== 9) {
        throw new Error(`Invalid orientation for ${entry.pieceId}.`);
      }
      next.set(entry.pieceId, /** @type {Mat3i} */ (/** @type {unknown} */ (entry.orientation.map(Number))));
    }
    if (next.size !== this.puzzle.pieces.length) throw new Error('State does not contain every logical piece.');
    const errors = this.validate(next);
    if (errors.length > 0) throw new Error(`Puzzle state invariant failure: ${errors.join('; ')}`);
    this.transforms = next;
    this.history = [];
    this.future = [];
    this.version += 1;
  }

  groundTruth() {
    return {
      puzzleId: this.puzzle.spec.id,
      pieces: this.puzzle.pieces.map((piece) => ({
        pieceId: piece.id,
        homeIndex: piece.homeIndex,
        homeCoord: [...piece.homeCoord],
        currentCoord: [...this.getCurrentCoord(piece.id)],
        orientation: [...this.getPieceTransform(piece.id)],
        renderable: piece.renderable,
        volume: piece.polyhedron.volume,
        outerArea: piece.polyhedron.outerArea,
      })),
      actions: this.puzzle.moves.map((move) => ({ ...move, legal: this.moveLegality(move.id).legal })),
      legalMoves: this.puzzle.moves.map((move) => ({ ...move })),
      legalActionMask: this.legalActionMask(),
      constraints: {
        bandages: this.puzzle.constraints.bandages.map((bandage) => ({
          id: bandage.id,
          label: bandage.label,
          pieceIds: [...bandage.pieceIds],
          cells: bandage.cells.map((cell) => [...cell]),
          centroid: { ...bandage.centroid },
        })),
      },
      stateHash: this.stateHash(),
    };
  }
}
