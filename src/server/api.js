// @ts-check

import { compilePuzzle } from '../core/puzzle-compiler.js';
import { PuzzleEngine } from '../core/puzzle-engine.js';
import { analyzeCurrentDynamics } from '../core/dynamics-analysis.js';
import { createPreset, presetCatalog } from '../core/presets.js';
import { createResearchManifest } from '../research/manifest.js';
import { analyzePuzzleGeometry } from '../research/geometry-analysis.js';
import { exploreStateGraph } from '../research/state-graph.js';
import { rankMechanicsExperiments } from '../research/mechanics-hypotheses.js';
import { generateResearchEpisode } from '../research/episode.js';
import { generateResearchSuite } from '../research/dataset.js';
import { evaluatePredictions } from '../research/evaluator.js';
import { RESEARCH_SCHEMAS, schemaCatalog } from '../research/schemas.js';
import { stableDigest } from '../research/canonical.js';
import { renderPuzzlePng } from './software-renderer.js';
import { ENGINE_VERSION, PLATFORM_NAME } from '../version.js';
import { verifyAffineGeometry } from '../geometry/affine-verifier.js';
import { canonicalStringify } from '../geometry/sha256.js';

const API_VERSION = 'v1';
const MAX_BODY_BYTES = 20 * 1024 * 1024;

/** @param {unknown} data @param {number} [status] @param {string} [requestId] */
function jsonResponse(data, status = 200, requestId = createRequestId()) {
  return new Response(JSON.stringify({ ok: status < 400, requestId, data }, null, 2), {
    status,
    headers: commonHeaders({ 'content-type': 'application/json; charset=utf-8' }),
  });
}

/** @param {string} code @param {string} message @param {number} status @param {unknown} [details] @param {string} [requestId] */
function errorResponse(code, message, status, details, requestId = createRequestId()) {
  return new Response(JSON.stringify({
    ok: false,
    requestId,
    error: { code, message, details: details ?? null },
  }, null, 2), {
    status,
    headers: commonHeaders({ 'content-type': 'application/json; charset=utf-8' }),
  });
}

/** @param {Record<string,string>} [extra] */
function commonHeaders(extra = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-request-id',
    'access-control-expose-headers': 'x-request-id,x-kinescope-metadata',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra,
  };
}

function createRequestId() {
  return stableDigest(`${Date.now()}:${Math.random()}`, 'kinescope-request').slice(-24);
}

/** @param {Request} request */
async function readJson(request) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) throw Object.assign(new Error(`Request exceeds ${MAX_BODY_BYTES} bytes.`), { status: 413, code: 'KineScope_BODY_TOO_LARGE' });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw Object.assign(new Error(`Request exceeds ${MAX_BODY_BYTES} bytes.`), { status: 413, code: 'KineScope_BODY_TOO_LARGE' });
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    throw Object.assign(new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`), { status: 400, code: 'KineScope_INVALID_JSON' });
  }
}

/** @param {Record<string,unknown>} body @returns {import('../core/puzzle-compiler.js').PuzzleSpec} */
function resolveSpec(body) {
  if (body.spec && typeof body.spec === 'object') return /** @type {import('../core/puzzle-compiler.js').PuzzleSpec} */ (structuredClone(body.spec));
  const preset = String(body.preset ?? 'ghost-3');
  return createPreset(preset, /** @type {string|number|undefined} */ (body.seed));
}

/** @param {ReturnType<PuzzleEngine['serialize']>|undefined} state @param {ReturnType<typeof compilePuzzle>} puzzle */
function engineFromState(state, puzzle) {
  const engine = new PuzzleEngine(puzzle);
  if (state) engine.load(state);
  return engine;
}

/** @param {ReturnType<typeof compilePuzzle>['geometry']} geometry @param {boolean} includeArtifact */
function canonicalGeometryResponse(geometry, includeArtifact) {
  const response = {
    schema: geometry.schema,
    exactness: structuredClone(geometry.exactness),
    counts: {
      hullPlanes: geometry.normalizedInput.bodyPlanes.length,
      cuts: geometry.normalizedInput.cuts.length,
      atomicCells: geometry.atomicCells.length,
      adjacency: geometry.adjacency.length,
      physicalPieces: geometry.physicalPieces.length,
      exposedSurfaces: geometry.exposedSurfaces.length,
      boundaryTraces: geometry.boundaryTraces.length,
    },
    hashes: structuredClone(geometry.hashes),
    diagnostics: structuredClone(geometry.diagnostics),
    verifier: verifyAffineGeometry(geometry),
  };
  if (includeArtifact) {
    response.artifact = JSON.parse(canonicalStringify(geometry));
  }
  return response;
}

export function createOpenApiDocument() {
  const post = (summary) => ({
    post: {
      summary,
      requestBody: { required: false, content: { 'application/json': { schema: { type: 'object' } } } },
      responses: {
        200: { description: 'Successful response', content: { 'application/json': { schema: { $ref: RESEARCH_SCHEMAS['api-envelope'].$id } } } },
        400: { description: 'Invalid request' },
        500: { description: 'Internal error' },
      },
    },
  });
  return {
    openapi: '3.1.0',
    info: {
      title: `${PLATFORM_NAME} API`,
      version: ENGINE_VERSION,
      description: 'Stateless exact-mechanics, rendering, dataset generation, and evaluation API.',
    },
    servers: [{ url: '/api/v1' }],
    paths: {
      '/health': { get: { summary: 'Health and build metadata', responses: { 200: { description: 'Healthy' } } } },
      '/capabilities': { get: { summary: 'Complete research capability manifest', responses: { 200: { description: 'Manifest' } } } },
      '/openapi.json': { get: { summary: 'OpenAPI 3.1 document', responses: { 200: { description: 'OpenAPI document' } } } },
      '/schemas': { get: { summary: 'JSON Schema catalog', responses: { 200: { description: 'Schemas' } } } },
      '/presets': { get: { summary: 'Preset catalog', responses: { 200: { description: 'Presets' } } } },
      '/compile': post('Compile and analyze a puzzle specification'),
      '/state/create': post('Create an exact state with optional scramble or rollout'),
      '/state/transition': post('Apply one exact transition'),
      '/state/rollout': post('Apply an action sequence'),
      '/state/analyze': post('Compute exact dynamics and optional geometry diagnostics'),
      '/graph/explore': post('Bounded exact breadth-first state graph exploration'),
      '/hypotheses/rank': post('Rank active mechanics-identification experiments'),
      '/episode/generate': post('Generate a public/private interaction episode'),
      '/suite/generate': post('Generate a complete benchmark suite'),
      '/evaluate': post('Evaluate predictions against private suite targets'),
      '/render': post('Render PNG or base64 PNG through the deterministic CPU renderer'),
      '/batch': post('Execute multiple stateless operations in one request'),
    },
    components: { schemas: Object.fromEntries(Object.entries(RESEARCH_SCHEMAS).map(([name, schema]) => [name, schema])) },
  };
}

/** @param {string} route @param {Record<string,unknown>} body @param {URL} url */
async function execute(route, body, url) {
  if (route === '/compile') {
    const spec = resolveSpec(body);
    const puzzle = compilePuzzle(spec);
    return {
      spec,
      compileStats: puzzle.stats,
      canonicalGeometry: canonicalGeometryResponse(
        puzzle.geometry,
        body.includeCanonicalGeometry === true,
      ),
      geometry: analyzePuzzleGeometry(puzzle, {
        includePieces: body.includePieces !== false,
        includeFaces: body.includeFaces === true,
      }),
    };
  }

  if (route === '/state/create') {
    const spec = resolveSpec(body);
    const puzzle = compilePuzzle(spec);
    const engine = new PuzzleEngine(puzzle);
    let generatedScramble = [];
    if (Number(body.scrambleDepth ?? 0) > 0) {
      generatedScramble = engine.scramble(Number(body.scrambleDepth), String(body.seed ?? 'state-create'));
    }
    for (const action of /** @type {string[]} */ (body.sequence ?? [])) engine.applyMove(action);
    return {
      puzzleId: spec.id,
      generatedScramble,
      state: engine.serialize(),
      publicState: {
        fingerprint: engine.stateFingerprint(),
        solved: engine.isSolved(),
        legalActionMask: engine.legalActionMask(),
      },
    };
  }

  if (route === '/state/transition') {
    const spec = resolveSpec(body);
    const puzzle = compilePuzzle(spec);
    const engine = engineFromState(/** @type {any} */ (body.state), puzzle);
    const action = String(body.action ?? '');
    const before = engine.serialize();
    const legality = engine.moveLegality(action);
    if (!legality.legal) return {
      accepted: false,
      action: legality.token,
      state: before,
      violation: legality.violatedBandages,
    };
    const preview = engine.applyMove(action);
    return {
      accepted: true,
      action: preview.token,
      preview,
      stateBefore: before,
      stateAfter: engine.serialize(),
      groundTruthAfter: body.includeGroundTruth === false ? undefined : engine.groundTruth(),
    };
  }

  if (route === '/state/rollout') {
    const spec = resolveSpec(body);
    const puzzle = compilePuzzle(spec);
    const engine = engineFromState(/** @type {any} */ (body.state), puzzle);
    const steps = [];
    for (const raw of /** @type {string[]} */ (body.sequence ?? [])) {
      const beforeFingerprint = engine.stateFingerprint();
      const legality = engine.moveLegality(raw);
      if (!legality.legal) {
        steps.push({ action: legality.token, accepted: false, beforeFingerprint, violation: legality.violatedBandages });
        if (body.stopOnIllegal !== false) break;
        continue;
      }
      engine.applyMove(raw);
      steps.push({ action: legality.token, accepted: true, beforeFingerprint, afterFingerprint: engine.stateFingerprint() });
    }
    return { steps, finalState: engine.serialize(), finalGroundTruth: body.includeGroundTruth === true ? engine.groundTruth() : undefined };
  }

  if (route === '/state/analyze') {
    const spec = resolveSpec(body);
    const puzzle = compilePuzzle(spec);
    const engine = engineFromState(/** @type {any} */ (body.state), puzzle);
    return {
      state: engine.serialize(),
      dynamics: analyzeCurrentDynamics(engine, { maxOrder: Number(body.maxOrder ?? 32) }),
      geometry: body.includeGeometry === false ? undefined : analyzePuzzleGeometry(puzzle, { includePieces: body.includePieces === true }),
      groundTruth: body.includeGroundTruth === false ? undefined : engine.groundTruth(),
    };
  }

  if (route === '/graph/explore') {
    const spec = resolveSpec(body);
    const puzzle = compilePuzzle(spec);
    const engine = engineFromState(/** @type {any} */ (body.state), puzzle);
    return exploreStateGraph(engine, {
      maxStates: Number(body.maxStates ?? 512),
      maxDepth: Number(body.maxDepth ?? 5),
      includeExactStates: body.includeExactStates === true,
      includeTransitions: body.includeTransitions !== false,
      actions: /** @type {string[]|undefined} */ (body.actions),
    });
  }

  if (route === '/hypotheses/rank') {
    const spec = resolveSpec(body);
    return rankMechanicsExperiments(spec, {
      maxSequenceLength: Number(body.maxSequenceLength ?? 2),
      maxExperiments: Number(body.maxExperiments ?? 64),
      prior: /** @type {number[]|undefined} */ (body.prior),
    });
  }

  if (route === '/episode/generate') {
    const spec = resolveSpec(body);
    return generateResearchEpisode(spec, {
      seed: /** @type {string|number|undefined} */ (body.seed),
      scrambleDepth: Number(body.scrambleDepth ?? 5),
      horizon: Number(body.horizon ?? 8),
      visibility: /** @type {any} */ (body.visibility ?? 'fully-withheld'),
      channels: /** @type {string[]|undefined} */ (body.channels),
      includeDynamics: body.includeDynamics !== false,
    });
  }

  if (route === '/suite/generate') {
    return generateResearchSuite({
      seed: /** @type {string|number|undefined} */ (body.seed),
      episodesPerSplit: Number(body.episodesPerSplit ?? 1),
      splits: /** @type {string[]|undefined} */ (body.splits ?? ['validation', 'test-iid', 'test-geometry-ood', 'test-mechanics-ood']),
      horizon: Number(body.horizon ?? 5),
      scrambleDepth: Number(body.scrambleDepth ?? 3),
      includeDiagnostics: body.includeDiagnostics !== false,
    });
  }

  if (route === '/evaluate') {
    if (!body.suite || !Array.isArray(body.predictions)) throw Object.assign(new Error('evaluate requires suite and predictions.'), { status: 400, code: 'KineScope_MISSING_EVALUATION_INPUT' });
    return evaluatePredictions(body.suite, body.predictions, { strictCoverage: body.strictCoverage === true });
  }

  if (route === '/render') {
    const spec = resolveSpec(body);
    const result = renderPuzzlePng({
      spec,
      state: /** @type {any} */ (body.state),
      sequence: /** @type {string[]|undefined} */ (body.sequence),
      mode: /** @type {any} */ (body.mode ?? 'studio'),
      width: Number(body.width ?? 512),
      height: Number(body.height ?? 512),
      camera: /** @type {any} */ (body.camera),
      background: /** @type {any} */ (body.background),
    });
    const format = String(body.format ?? url.searchParams.get('format') ?? 'json');
    if (format === 'png') return { __binary: true, bytes: result.png, contentType: 'image/png', metadata: result.metadata };
    return {
      metadata: result.metadata,
      image: {
        mediaType: 'image/png',
        encoding: 'base64',
        data: Buffer.from(result.png).toString('base64'),
      },
    };
  }

  if (route === '/batch') {
    const operations = /** @type {{path:string,body?:Record<string,unknown>}[]} */ (body.operations ?? []);
    if (!Array.isArray(operations) || operations.length > 64) throw Object.assign(new Error('batch.operations must be an array of at most 64 operations.'), { status: 400, code: 'KineScope_INVALID_BATCH' });
    const results = [];
    for (let index = 0; index < operations.length; index += 1) {
      const operation = operations[index];
      try {
        const data = await execute(normalizeRoute(operation.path), operation.body ?? {}, url);
        if (data?.__binary) {
          results.push({ index, path: operation.path, ok: true, data: { metadata: data.metadata, image: { mediaType: data.contentType, encoding: 'base64', data: Buffer.from(data.bytes).toString('base64') } } });
        } else results.push({ index, path: operation.path, ok: true, data });
      } catch (error) {
        results.push({ index, path: operation.path, ok: false, error: { message: error instanceof Error ? error.message : String(error) } });
        if (body.continueOnError === false) break;
      }
    }
    return { operationCount: operations.length, results };
  }

  throw Object.assign(new Error(`Unknown API route ${route}.`), { status: 404, code: 'KineScope_ROUTE_NOT_FOUND' });
}

/** @param {string} pathname */
function normalizeRoute(pathname) {
  let route = pathname.replace(/^\/api\/v1/, '').replace(/^\/v1/, '');
  if (!route.startsWith('/')) route = `/${route}`;
  return route.replace(/\/$/, '') || '/';
}

/** @param {Request} request */
export async function handleApiRequest(request) {
  const requestId = request.headers.get('x-request-id') ?? createRequestId();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: commonHeaders({ 'x-request-id': requestId }) });
  const url = new URL(request.url);
  const rewrittenRoute = url.searchParams.get('route');
  const route = normalizeRoute(rewrittenRoute ? `/${rewrittenRoute}` : url.pathname);

  try {
    if (request.method === 'GET') {
      if (route === '/health') return jsonResponse({
        status: 'ok',
        platform: PLATFORM_NAME,
        engineVersion: ENGINE_VERSION,
        apiVersion: API_VERSION,
        runtime: 'node',
        deterministicResearchArtifacts: true,
      }, 200, requestId);
      if (route === '/capabilities') return jsonResponse(createResearchManifest(), 200, requestId);
      if (route === '/openapi.json') return jsonResponse(createOpenApiDocument(), 200, requestId);
      if (route === '/schemas') return jsonResponse({ catalog: schemaCatalog(), schemas: RESEARCH_SCHEMAS }, 200, requestId);
      if (route === '/presets') return jsonResponse({
        presets: presetCatalog.map((entry) => {
          const spec = createPreset(entry.id);
          return { id: entry.id, label: entry.label, family: spec.family, size: spec.size, metadata: spec.metadata ?? {} };
        }),
        procedural: [{ id: 'alien', label: 'Seeded procedural alien artifact' }],
      }, 200, requestId);
      const presetMatch = route.match(/^\/presets\/([^/]+)$/);
      if (presetMatch) {
        const spec = createPreset(decodeURIComponent(presetMatch[1]), url.searchParams.get('seed') ?? undefined);
        return jsonResponse({ spec, geometry: analyzePuzzleGeometry(spec) }, 200, requestId);
      }
      return errorResponse('KineScope_ROUTE_NOT_FOUND', `Unknown GET route ${route}.`, 404, null, requestId);
    }

    if (request.method !== 'POST') return errorResponse('KineScope_METHOD_NOT_ALLOWED', 'Only GET, POST, and OPTIONS are supported.', 405, null, requestId);
    const body = await readJson(request);
    const data = await execute(route, body, url);
    if (data?.__binary) {
      return new Response(data.bytes, {
        status: 200,
        headers: commonHeaders({
          'content-type': data.contentType,
          'content-length': String(data.bytes.length),
          'x-request-id': requestId,
          'x-kinescope-metadata': Buffer.from(JSON.stringify(data.metadata)).toString('base64url'),
        }),
      });
    }
    return jsonResponse(data, 200, requestId);
  } catch (error) {
    const status = Number(error?.status ?? 500);
    const code = String(error?.code ?? (status >= 500 ? 'KineScope_INTERNAL_ERROR' : 'KineScope_BAD_REQUEST'));
    return errorResponse(
      code,
      error instanceof Error ? error.message : String(error),
      status,
      status >= 500 ? { type: error?.constructor?.name ?? typeof error } : error?.details,
      requestId,
    );
  }
}
