// @ts-check

/** @typedef {import('./puzzle-engine.js').PuzzleEngine} PuzzleEngine */

/** @param {number[]} coord */
function coordKey(coord) {
  return coord.join(',');
}

/** @param {Map<string,string>} mapping */
function permutationCycles(mapping) {
  const seen = new Set();
  const cycles = [];
  for (const start of [...mapping.keys()].sort()) {
    if (seen.has(start)) continue;
    const cycle = [];
    let cursor = start;
    while (!seen.has(cursor) && mapping.has(cursor)) {
      seen.add(cursor);
      cycle.push(cursor.split(',').map(Number));
      cursor = mapping.get(cursor) ?? cursor;
    }
    if (cycle.length > 1) cycles.push(cycle);
  }
  return cycles;
}

/**
 * Applies a sequence to a fork and reports the first state-dependent obstruction.
 * @param {PuzzleEngine} engine
 * @param {string[]} tokens
 */
function evaluateSequence(engine, tokens) {
  const simulation = engine.fork();
  /** @type {{token:string,legal:boolean,stateHashBefore:string,stateHashAfter?:string,violatedBandages:{id:string,label:string,selected:number,total:number,pieceIds:string[]}[]}[]} */
  const steps = [];
  for (const token of tokens) {
    const legality = simulation.moveLegality(token);
    steps.push({
      token: legality.token,
      legal: legality.legal,
      stateHashBefore: simulation.stateHash(),
      violatedBandages: legality.violatedBandages,
    });
    if (!legality.legal) {
      return {
        executable: false,
        blockedAt: steps.length - 1,
        steps,
        finalStateHash: simulation.stateHash(),
      };
    }
    simulation.applyMove(token);
    steps[steps.length - 1].stateHashAfter = simulation.stateHash();
  }
  return {
    executable: true,
    blockedAt: null,
    steps,
    finalStateHash: simulation.stateHash(),
  };
}

/**
 * Computes exact, evaluator-facing dynamics metadata at the engine's current state.
 * Nothing in this report is inferred from rendered pixels.
 *
 * @param {PuzzleEngine} engine
 * @param {{maxOrder?:number}} [options]
 */
export function analyzeCurrentDynamics(engine, options = {}) {
  const maxOrder = Math.max(1, Math.min(256, Math.trunc(options.maxOrder ?? 32)));
  const stateHash = engine.stateHash();
  const actionTokens = engine.puzzle.moves.map((move) => move.id);

  const actions = actionTokens.map((token) => {
    const legality = engine.moveLegality(token);
    const definition = legality.definition;
    if (!legality.legal) {
      return {
        token,
        label: definition.label,
        axis: definition.axis,
        layer: definition.layer,
        quarterTurns: definition.quarterTurns,
        legal: false,
        affectedPieceIds: legality.selectedIds,
        violatedBandages: legality.violatedBandages,
        successorStateHash: null,
        orderAtState: null,
        closure: 'blocked-at-start',
        permutationCycles: [],
        transitions: [],
      };
    }

    const beforeCoords = new Map(
      legality.selectedIds.map((pieceId) => [pieceId, [...engine.getCurrentCoord(pieceId)]]),
    );
    const successor = engine.fork();
    successor.applyMove(token);
    const transitions = legality.selectedIds.map((pieceId) => ({
      pieceId,
      from: beforeCoords.get(pieceId),
      to: [...successor.getCurrentCoord(pieceId)],
    }));
    const mapping = new Map(transitions.map((transition) => [coordKey(transition.from ?? []), coordKey(transition.to)]));

    const cycle = engine.fork();
    let orderAtState = null;
    let closure = 'max-order-exceeded';
    for (let step = 1; step <= maxOrder; step += 1) {
      const stepLegality = cycle.moveLegality(token);
      if (!stepLegality.legal) {
        closure = `blocked-after-${step - 1}`;
        break;
      }
      cycle.applyMove(token);
      if (cycle.stateHash() === stateHash) {
        orderAtState = step;
        closure = 'closed';
        break;
      }
    }

    return {
      token,
      label: definition.label,
      axis: definition.axis,
      layer: definition.layer,
      quarterTurns: definition.quarterTurns,
      inverseToken: `${token}'`,
      legal: true,
      affectedPieceIds: legality.selectedIds,
      violatedBandages: [],
      successorStateHash: successor.stateHash(),
      orderAtState,
      closure,
      permutationCycles: permutationCycles(mapping),
      transitions,
    };
  });

  const pairs = [];
  for (let firstIndex = 0; firstIndex < actionTokens.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < actionTokens.length; secondIndex += 1) {
      const first = actionTokens[firstIndex];
      const second = actionTokens[secondIndex];
      const forward = evaluateSequence(engine, [first, second]);
      const reverse = evaluateSequence(engine, [second, first]);
      pairs.push({
        first,
        second,
        forward,
        reverse,
        commutes: forward.executable && reverse.executable
          ? forward.finalStateHash === reverse.finalStateHash
          : null,
      });
    }
  }

  return {
    schema: 'kinescope.dynamics-analysis.v1',
    puzzleId: engine.puzzle.spec.id,
    stateHash,
    maxOrder,
    actionCount: actions.length,
    legalActionMask: engine.legalActionMask(),
    actions,
    pairs,
  };
}
