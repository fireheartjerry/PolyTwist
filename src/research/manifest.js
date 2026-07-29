// @ts-check

import { presetCatalog, createPreset } from '../core/presets.js';
import { compilePuzzle } from '../core/puzzle-compiler.js';
import { TASK_CATALOG, FACTOR_CATALOG, OBSERVATION_CHANNELS, SPLIT_CATALOG, DEFAULT_CAMERA_BANK } from './catalog.js';
import { schemaCatalog } from './schemas.js';
import { stableDigest } from './canonical.js';
import { ENGINE_VERSION, PLATFORM_NAME, PLATFORM_SLUG } from '../version.js';

export function createResearchManifest() {
  const manifest = {
    schema: 'kinescope.platform-manifest.v1',
    platform: {
      name: PLATFORM_NAME,
      slug: PLATFORM_SLUG,
      engineVersion: ENGINE_VERSION,
      purpose: 'Research infrastructure for active inference, abstraction, planning, and generalization over unfamiliar 3D mechanisms.',
    },
    mechanics: {
      exactState: true,
      arithmetic: 'signed-permutation integer rotations over logical cubic lattices',
      deterministicReplay: true,
      reversibleTransitions: true,
      stateDependentLegality: true,
      rigidBandages: true,
      customActionAlphabets: true,
      customConvexHulls: true,
      rotatedAndOffsetCutFrames: true,
      currentLimits: ['cubic logical lattices', 'quarter-turn generators', 'convex piece cells'],
    },
    rendering: {
      browserRenderer: 'WebGL2',
      serverRenderer: 'deterministic CPU rasterizer',
      channels: OBSERVATION_CHANNELS,
      cameraBank: DEFAULT_CAMERA_BANK,
      outputs: ['PNG', 'RGBA bytes', 'render metadata', 'pixel statistics'],
      maximumServerResolution: [2048, 2048],
    },
    research: {
      tasks: TASK_CATALOG,
      factors: FACTOR_CATALOG,
      splits: SPLIT_CATALOG,
      outputs: [
        'public episodes', 'evaluator-private episodes', 'public benchmark items', 'private targets',
        'geometry reports', 'state graphs', 'mechanics hypothesis rankings', 'evaluation reports',
        'JSON', 'JSONL', 'PNG', 'ZIP-compatible file maps',
      ],
      provenance: ['canonical JSON', 'stable deterministic digests', 'seeded generation', 'public/private leakage boundaries'],
    },
    api: {
      style: 'stateless JSON-first REST with optional binary PNG responses',
      basePath: '/api/v1',
      endpoints: [
        'GET /health', 'GET /capabilities', 'GET /openapi.json', 'GET /schemas', 'GET /presets',
        'GET /presets/:id', 'POST /compile', 'POST /state/create', 'POST /state/transition',
        'POST /state/rollout', 'POST /state/analyze', 'POST /graph/explore', 'POST /hypotheses/rank',
        'POST /episode/generate', 'POST /suite/generate', 'POST /evaluate', 'POST /render', 'POST /batch',
      ],
    },
    presets: presetCatalog.map((entry) => {
      const spec = createPreset(entry.id);
      const compiled = compilePuzzle(spec);
      return {
        id: entry.id,
        label: entry.label,
        family: spec.family,
        size: spec.size,
        metadata: spec.metadata ?? {},
        compilation: compiled.stats,
      };
    }),
    schemas: schemaCatalog(),
    reproducibility: {
      dynamicTimestampsInResearchArtifacts: false,
      randomNumberGenerator: 'Mulberry32 seeded by normalized string hashes',
      exactStateDigest: 'collision-free serialized transform signature',
      publicStateFingerprint: 'deterministic 128-bit non-cryptographic identifier',
      caveat: 'Stable digests support reproducibility and equality checks; they are not cryptographic commitments.',
    },
  };
  manifest.manifestDigest = stableDigest(manifest, 'kinescope-manifest');
  return manifest;
}
