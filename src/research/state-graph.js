// @ts-check

import { PuzzleEngine } from '../core/puzzle-engine.js';
import { compilePuzzle } from '../core/puzzle-compiler.js';
import { numericSummary, entropyBits } from './statistics.js';
import { stableDigest } from './canonical.js';
import { ENGINE_VERSION } from '../version.js';

/** @typedef {import('../core/puzzle-compiler.js').PuzzleSpec} PuzzleSpec */
/** @typedef {import('../core/puzzle-compiler.js').CompiledPuzzle} CompiledPuzzle */
/** @typedef {import('../core/puzzle-engine.js').PuzzleEngine} Engine */

/** @param {PuzzleSpec|CompiledPuzzle|Engine} input */
function engineFrom(input) {
  if (input instanceof PuzzleEngine) return input.fork();
  const puzzle = 'pieces' in input && 'moveById' in input ? input : compilePuzzle(input);
  return new PuzzleEngine(puzzle);
}

/** @param {Record<string,boolean>} mask */
function maskKey(mask) {
  return Object.entries(mask).sort(([a], [b]) => a.localeCompare(b)).map(([action, legal]) => `${action}:${Number(legal)}`).join('|');
}

/**
 * Exact bounded breadth-first exploration of a reachable state component.
 * @param {PuzzleSpec|CompiledPuzzle|Engine} input
 * @param {{maxStates?:number,maxDepth?:number,includeExactStates?:boolean,includeTransitions?:boolean,actions?:string[]}} [options]
 */
export function exploreStateGraph(input, options = {}) {
  const initial = engineFrom(input);
  const maxStates = Math.max(1, Math.min(10000, Math.trunc(options.maxStates ?? 512)));
  const maxDepth = Math.max(0, Math.min(64, Math.trunc(options.maxDepth ?? 5)));
  const includeExactStates = options.includeExactStates ?? false;
  const includeTransitions = options.includeTransitions ?? true;
  const actionTokens = options.actions?.length
    ? options.actions.map(String)
    : initial.puzzle.moves.map((move) => move.id);

  const rootHash = initial.stateHash();
  const queue = [{ engine: initial, depth: 0, path: [] }];
  const seen = new Map([[rootHash, 0]]);
  const nodes = [];
  const edges = [];
  const depthCounts = new Map();
  const legalityPatterns = new Map();
  let frontierTruncated = false;
  let blockedTransitions = 0;
  let legalTransitions = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const hash = current.engine.stateHash();
    const nodeId = seen.get(hash);
    if (nodeId === undefined) throw new Error('State graph queue contained an unindexed state.');
    const mask = current.engine.legalActionMask();
    const legalActions = actionTokens.filter((token) => current.engine.moveLegality(token).legal);
    const pattern = maskKey(mask);
    legalityPatterns.set(pattern, (legalityPatterns.get(pattern) ?? 0) + 1);
    depthCounts.set(current.depth, (depthCounts.get(current.depth) ?? 0) + 1);

    const node = {
      nodeId,
      depth: current.depth,
      fingerprint: current.engine.stateFingerprint(),
      solved: current.engine.isSolved(),
      path: [...current.path],
      legalActionMask: mask,
      legalActionCount: legalActions.length,
      blockedActionCount: actionTokens.length - legalActions.length,
    };
    if (includeExactStates) {
      node.exactStateHash = hash;
      node.state = current.engine.serialize();
    }
    nodes[nodeId] = node;

    if (current.depth >= maxDepth) continue;
    for (const token of actionTokens) {
      const legality = current.engine.moveLegality(token);
      if (!legality.legal) {
        blockedTransitions += 1;
        if (includeTransitions) {
          edges.push({
            source: nodeId,
            target: null,
            action: token,
            legal: false,
            violatedConstraints: legality.violatedBandages.map((entry) => entry.id),
          });
        }
        continue;
      }
      legalTransitions += 1;
      const successor = current.engine.fork();
      successor.applyMove(token);
      const successorHash = successor.stateHash();
      let target = seen.get(successorHash);
      let discovered = false;
      if (target === undefined) {
        if (seen.size >= maxStates) {
          frontierTruncated = true;
          target = null;
        } else {
          target = seen.size;
          seen.set(successorHash, target);
          queue.push({ engine: successor, depth: current.depth + 1, path: [...current.path, token] });
          discovered = true;
        }
      }
      if (includeTransitions) {
        edges.push({
          source: nodeId,
          target,
          action: token,
          legal: true,
          discovered,
          successorFingerprint: successor.stateFingerprint(),
        });
      }
    }
  }

  const outDegrees = nodes.map((node) => node.legalActionCount);
  const probabilities = [...legalityPatterns.values()].map((count) => count / nodes.length);
  const report = {
    schema: 'kinescope.state-graph.v1',
    engineVersion: ENGINE_VERSION,
    puzzleId: initial.puzzle.spec.id,
    rootFingerprint: initial.stateFingerprint(),
    configuration: {
      maxStates,
      maxDepth,
      includeExactStates,
      actionTokens,
    },
    truncation: {
      frontierTruncated,
      queuedStatesDiscarded: frontierTruncated,
      stateLimitReached: nodes.length >= maxStates,
    },
    summary: {
      nodeCount: nodes.length,
      edgeCount: includeTransitions ? edges.length : null,
      legalTransitions,
      blockedTransitions,
      uniqueLegalityPatterns: legalityPatterns.size,
      legalityPatternEntropyBits: entropyBits(probabilities),
      solvedStateCount: nodes.filter((node) => node.solved).length,
      outDegree: numericSummary(outDegrees),
      depthCounts: Object.fromEntries([...depthCounts.entries()].sort((a, b) => a[0] - b[0])),
      stronglyConnectedStatus: frontierTruncated || maxDepth < 1 ? 'not-evaluated-on-truncated-graph' : 'directed-reachability-sample-only',
    },
    legalityPatterns: [...legalityPatterns.entries()].map(([key, count]) => ({ key, count, fraction: count / nodes.length })),
    nodes,
    edges: includeTransitions ? edges : undefined,
  };
  report.reportDigest = stableDigest(report, 'kinescope-state-graph');
  return report;
}
