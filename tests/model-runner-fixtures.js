import { stableDigest } from '../src/research/canonical.js';

export function makeSuite() {
  const items = [
    {
      schema: 'kinescope.item-public.v1', itemId: 'item-a', taskId: 'action-legality',
      taskFamily: 'constraints', split: 'validation', answerType: 'boolean',
      primaryMetric: 'accuracy', input: { state: { fingerprint: 'opaque-a' }, action: 'A0' },
      metadata: { episodeId: 'episode-1' },
    },
    {
      schema: 'kinescope.item-public.v1', itemId: 'item-b', taskId: 'inverse-dynamics',
      taskFamily: 'dynamics', split: 'validation', answerType: 'action',
      primaryMetric: 'accuracy',
      input: { before: 'opaque-a', after: 'opaque-b', candidateActions: ['A0', 'A1'] },
      metadata: { episodeId: 'episode-1' },
    },
  ];
  const targets = [
    { schema: 'kinescope.target-private.v1', itemId: 'item-a', taskId: 'action-legality', target: { legal: true }, verification: {} },
    { schema: 'kinescope.target-private.v1', itemId: 'item-b', taskId: 'inverse-dynamics', target: { action: 'A1' }, verification: {} },
  ];
  const core = {
    schema: 'kinescope.research-suite.v1', suiteId: 'suite-test',
    public: { items, episodes: [] },
    private: { targets, episodes: [], diagnostics: [] },
  };
  return { ...core, suiteDigest: stableDigest(core, 'suite-test') };
}

export function simpleEvaluate(suite, predictions) {
  const targets = new Map(suite.private.targets.map((target) => [target.itemId, target.target]));
  const predictionMap = new Map(predictions.map((prediction) => [prediction.itemId, prediction.answer]));
  const results = suite.public.items.map((item) => {
    const scored = predictionMap.has(item.itemId);
    const score = scored && JSON.stringify(predictionMap.get(item.itemId)) === JSON.stringify(targets.get(item.itemId)) ? 1 : 0;
    return { itemId: item.itemId, taskId: item.taskId, split: item.split, status: scored ? 'scored' : 'missing', primaryScore: score };
  });
  const core = {
    schema: 'kinescope.evaluation.v1', suiteId: suite.suiteId,
    coverage: { expected: results.length, predicted: predictions.length },
    aggregate: { meanPrimaryScore: results.reduce((sum, row) => sum + row.primaryScore, 0) / results.length },
    results,
  };
  return { ...core, reportDigest: stableDigest(core, 'evaluation') };
}
