// @ts-check

import { compilePuzzle } from '../core/puzzle-compiler.js';
import { PuzzleEngine } from '../core/puzzle-engine.js';
import { classicPreset, createPreset, presetCatalog } from '../core/presets.js';
import { verifyAffineGeometry } from '../geometry/affine-verifier.js';
import {
  certifyIdealRigidDisplay,
  deriveRigidModelMatrices,
} from '../render/rigid-display-certificate.js';
import { stableDigest } from './canonical.js';

const DEFAULT_PROGRESS_SAMPLES = Object.freeze([0, 0.125, 0.25, 0.5, 0.75, 0.875, 1]);

/** @param {string} token */
function inverseToken(token) {
  if (token.endsWith('2')) return token;
  return token.endsWith("'") ? token.slice(0, -1) : `${token}'`;
}

/**
 * Runs the deterministic closure experiment for the Phase 1 ideal-rigid display slice.
 *
 * @param {{seed?:string,stateCount?:number,progressSamples?:number[]}} [options]
 */
export function runIdealRigidDisplayExperiment(options = {}) {
  const seed = String(options.seed ?? 'ideal-rigid-phase1');
  const stateCount = Math.max(1, Math.trunc(options.stateCount ?? 13));
  const progressSamples = [...(options.progressSamples ?? DEFAULT_PROGRESS_SAMPLES)];
  if (progressSamples.length === 0 || progressSamples.some(
    (value) => !Number.isFinite(value) || value < 0 || value > 1,
  )) {
    throw new Error('Animation progress samples must be finite values in [0, 1].');
  }

  const higherOrderClassicCases = [5, 6, 7, 8, 9].map((size) => ({
    id: `classic-${size}`,
    create: () => {
      const spec = classicPreset();
      spec.id = `classic-${size}`;
      spec.name = `Classic ${size}×${size}`;
      spec.size = size;
      spec.outer.halfSize = [size / 2, size / 2, size / 2];
      spec.validation.expectedRenderable = size ** 3 - (size - 2) ** 3;
      spec.metadata = { ...spec.metadata, scale: size };
      return spec;
    },
  }));
  const proceduralCases = ['a', 'b', 'c', 'd'].map((suffix) => ({
    id: `alien-${suffix}`,
    create: () => createPreset('alien', `${seed}:${suffix}`),
  }));
  const cases = [
    ...presetCatalog.map((entry) => ({
      id: entry.id,
      create: () => entry.create(),
    })),
    ...higherOrderClassicCases,
    ...proceduralCases,
  ];
  const totals = {
    artifactCount: 0,
    stateCount: 0,
    dockedCertificates: 0,
    legalMoveChecks: 0,
    blockedMoveObservations: 0,
    animationCertificates: 0,
    committedTurnCertificates: 0,
    inverseRestorations: 0,
  };
  const failures = [];
  const artifacts = [];

  for (const experimentCase of cases) {
    try {
      const puzzle = compilePuzzle(experimentCase.create());
      const geometryVerification = verifyAffineGeometry(puzzle.geometry);
      const engine = new PuzzleEngine(puzzle);
      const geometryHash = puzzle.geometry.hashes.geometry;
      const scramble = engine.generateScramble(
        stateCount - 1,
        `${seed}:${experimentCase.id}`,
      );
      const actionCoverage = Object.fromEntries(puzzle.moves.map((move) => [
        move.id,
        { legal: 0, blocked: 0, animationCertificates: 0 },
      ]));
      const artifactCounts = {
        stateCount: 0,
        dockedCertificates: 0,
        legalMoveChecks: 0,
        blockedMoveObservations: 0,
        animationCertificates: 0,
        committedTurnCertificates: 0,
        inverseRestorations: 0,
      };

      for (let stateIndex = 0; stateIndex < stateCount; stateIndex += 1) {
        artifactCounts.stateCount += 1;
        const docked = certifyIdealRigidDisplay(
          puzzle,
          engine.transforms,
          deriveRigidModelMatrices(puzzle, engine.transforms),
          null,
          { geometryVerification },
        );
        artifactCounts.dockedCertificates += 1;
        if (!docked.valid) failures.push({
          artifactId: experimentCase.id,
          stateIndex,
          stage: 'docked',
          errors: docked.errors,
        });
        if (docked.geometryHash !== geometryHash) failures.push({
          artifactId: experimentCase.id,
          stateIndex,
          stage: 'docked-hash',
          errors: ['canonical geometry hash changed across an exact state'],
        });

        for (const move of puzzle.moves) {
          const legality = engine.moveLegality(move.id);
          const coverage = actionCoverage[move.id];
          if (!legality.legal) {
            coverage.blocked += 1;
            artifactCounts.blockedMoveObservations += 1;
            continue;
          }
          coverage.legal += 1;
          artifactCounts.legalMoveChecks += 1;
          const preview = engine.previewMove(move.id);
          for (const progress of progressSamples) {
            const certificate = certifyIdealRigidDisplay(
              puzzle,
              engine.transforms,
              deriveRigidModelMatrices(puzzle, engine.transforms, preview, progress),
              preview,
              { geometryVerification },
            );
            coverage.animationCertificates += 1;
            artifactCounts.animationCertificates += 1;
            if (!certificate.valid) failures.push({
              artifactId: experimentCase.id,
              stateIndex,
              move: move.id,
              progress,
              stage: 'animation',
              errors: certificate.errors,
            });
            if (certificate.geometryHash !== geometryHash) failures.push({
              artifactId: experimentCase.id,
              stateIndex,
              move: move.id,
              progress,
              stage: 'animation-hash',
              errors: ['canonical geometry hash changed during animation'],
            });
          }

          const branch = engine.fork();
          const stateHashBefore = branch.stateHash();
          branch.commitPreview(preview);
          const committed = certifyIdealRigidDisplay(
            puzzle,
            branch.transforms,
            deriveRigidModelMatrices(puzzle, branch.transforms),
            null,
            { geometryVerification },
          );
          artifactCounts.committedTurnCertificates += 1;
          if (!committed.valid) failures.push({
            artifactId: experimentCase.id,
            stateIndex,
            move: move.id,
            stage: 'committed',
            errors: committed.errors,
          });
          branch.applyMove(inverseToken(move.id));
          if (branch.stateHash() === stateHashBefore) artifactCounts.inverseRestorations += 1;
          else failures.push({
            artifactId: experimentCase.id,
            stateIndex,
            move: move.id,
            stage: 'inverse',
            errors: ['move followed by its inverse did not restore exact state'],
          });
        }

        if (stateIndex < scramble.length) engine.applyMove(scramble[stateIndex]);
      }

      for (const [moveId, coverage] of Object.entries(actionCoverage)) {
        if (coverage.legal === 0) failures.push({
          artifactId: experimentCase.id,
          move: moveId,
          stage: 'coverage',
          errors: ['primitive action was never observed legal'],
        });
      }
      if (puzzle.constraints.bandages.length > 0 && artifactCounts.blockedMoveObservations === 0) {
        failures.push({
          artifactId: experimentCase.id,
          stage: 'coverage',
          errors: ['bandaged artifact produced no blocked-action observation'],
        });
      }

      totals.artifactCount += 1;
      for (const key of Object.keys(artifactCounts)) totals[key] += artifactCounts[key];
      artifacts.push({
        artifactId: experimentCase.id,
        puzzleId: puzzle.spec.id,
        family: puzzle.spec.family,
        geometryHash,
        sourceExactness: puzzle.geometry.exactness.source,
        logicalPieces: puzzle.stats.logicalPieces,
        renderablePieces: puzzle.stats.renderablePieces,
        bandageCount: puzzle.stats.bandageCount,
        scramble,
        actionCoverage,
        counts: artifactCounts,
        finalStateFingerprint: engine.stateFingerprint(),
      });
    } catch (error) {
      failures.push({
        artifactId: experimentCase.id,
        stage: 'fatal',
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  const reportCore = {
    schema: 'polytwist.ideal-rigid-display-experiment.v1',
    certificationSchema: 'polytwist.ideal-rigid-display-certificate.v1',
    valid: failures.length === 0,
    protocol: {
      seed,
      stateCount,
      progressSamples,
      artifactIds: cases.map((entry) => entry.id),
      assertions: [
        'canonical affine artifact independently verifies',
        'docked exact state certifies',
        'every observed legal primitive move certifies at every animation sample',
        'active vertices preserve mechanism-axis coordinate',
        'committed turn certifies',
        'move followed by inverse restores the exact state',
        'canonical geometry hash is invariant under state and animation',
        'every primitive action is observed legal at least once',
        'bandaged artifacts expose at least one blocked action',
      ],
    },
    summary: totals,
    failures,
    artifacts,
    limitations: [
      'finite deterministic state and animation sampling',
      'not a general swept-volume collision certificate',
      'not a manufacturing tolerance or hidden-core experiment',
    ],
  };
  return {
    ...reportCore,
    reportDigest: stableDigest(reportCore, 'ideal-rigid-display-experiment'),
  };
}
