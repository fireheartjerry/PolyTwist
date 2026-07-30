// @ts-check

import { canonicalJson, stableDigest } from './canonical.js';

export class ProviderError extends Error {
  /** @param {string} message @param {{retryable?:boolean,status?:number,code?:string,details?:unknown}} [options] */
  constructor(message, options = {}) {
    super(message);
    this.name = 'ProviderError';
    this.retryable = options.retryable ?? true;
    this.status = options.status ?? null;
    this.code = options.code ?? 'provider-error';
    this.details = options.details ?? null;
  }
}

/**
 * @param {{id:string,kind?:string,model:string,version?:string|null,contamination?:Record<string,unknown>,complete:(request:any,context:any)=>Promise<any>|any,estimateCostUsd?:(request:any)=>number|null}} options
 */
export function createFunctionProvider(options) {
  if (!options || typeof options.complete !== 'function') throw new Error('Function provider requires complete(request, context).');
  return Object.freeze({
    id: String(options.id),
    kind: String(options.kind ?? 'function'),
    model: String(options.model),
    version: options.version == null ? null : String(options.version),
    contamination: Object.freeze({
      usesPrivateTargets: false,
      evaluationEligible: true,
      purpose: 'model-evaluation',
      ...(options.contamination ?? {}),
    }),
    complete: options.complete,
    estimateCostUsd: options.estimateCostUsd,
  });
}

/** @param {unknown} value */
function answerEnvelope(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'answer')) {
    return canonicalJson(value);
  }
  return canonicalJson({ answer: value, confidence: 0 });
}

/**
 * Deterministic provider for plumbing tests. `responses` may be an item-id map,
 * a callback, or a single answer. `invalidAttempts` intentionally emits invalid
 * JSON before returning the configured answer.
 *
 * @param {{responses?:unknown|Record<string,unknown>|((request:any,context:any)=>unknown),invalidAttempts?:number,delayMs?:number,id?:string,model?:string}} [options]
 */
export function createMockProvider(options = {}) {
  const invalidAttempts = Math.max(0, Math.trunc(options.invalidAttempts ?? 0));
  const delayMs = Math.max(0, Math.trunc(options.delayMs ?? 0));
  return createFunctionProvider({
    id: options.id ?? 'mock',
    kind: 'mock',
    model: options.model ?? 'deterministic-mock-v1',
    version: '1',
    contamination: {
      usesPrivateTargets: false,
      evaluationEligible: false,
      purpose: 'pipeline-validation-only',
    },
    async complete(request, context) {
      if (delayMs > 0) await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        context.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Mock request aborted.', 'AbortError'));
        }, { once: true });
      });
      if (context.attempt < invalidAttempts) {
        return { rawResponse: '{not valid json', usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } };
      }
      const configured = typeof options.responses === 'function'
        ? options.responses(request, context)
        : options.responses && typeof options.responses === 'object' && !Array.isArray(options.responses)
          ? /** @type {Record<string,unknown>} */ (options.responses)[request.itemId]
          : options.responses;
      return {
        rawResponse: answerEnvelope(configured ?? null),
        usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
        metadata: { deterministic: true },
      };
    },
    estimateCostUsd: () => 0,
  });
}

export function createDryRunProvider() {
  return createFunctionProvider({
    id: 'dry-run',
    kind: 'dry-run',
    model: 'no-inference',
    version: '1',
    contamination: {
      usesPrivateTargets: false,
      evaluationEligible: false,
      purpose: 'request-materialization-only',
    },
    complete(request) {
      return {
        rawResponse: canonicalJson({ answer: null, confidence: 0 }),
        usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
        metadata: { requestDigest: request.requestDigest, inferencePerformed: false },
      };
    },
    estimateCostUsd: () => 0,
  });
}

/** @param {any} target */
function evaluatorCompatibleAnswer(target) {
  const taskId = target.taskId;
  const value = target.target;
  if (taskId === 'planning') return value?.referencePlan ?? [];
  if (taskId === 'uncertainty-calibration') return { answer: value?.answer, confidence: 1 };
  if (taskId === 'piece-trajectory') return { trajectories: value?.trajectories ?? [] };
  if (taskId === 'constraint-localization') return { implicatedPieces: value?.implicatedPieces ?? [] };
  if (taskId === 'active-identification') return {
    recommendedExperiment: value?.recommendedExperiment,
    normalizedInformationGain: value?.normalizedInformationGain,
  };
  return value;
}

/**
 * Private-target oracle used only to prove that the complete run and evaluator
 * pipeline can attain its expected ceiling. Its contamination label is
 * intentionally impossible to mistake for a model result.
 *
 * @param {{private:{targets:any[]}}} suite
 */
export function createSyntheticOracleProvider(suite) {
  const targets = new Map(suite.private.targets.map((target) => [target.itemId, target]));
  return createFunctionProvider({
    id: 'synthetic-private-oracle',
    kind: 'synthetic-oracle',
    model: 'evaluator-target-oracle-v1',
    version: '1',
    contamination: {
      usesPrivateTargets: true,
      evaluationEligible: false,
      purpose: 'pipeline-ceiling-validation-only',
      warning: 'This provider reads evaluator-private targets and must never be reported as model performance.',
    },
    complete(request) {
      const target = targets.get(request.itemId);
      if (!target) throw new ProviderError(`Private target missing for ${request.itemId}.`, { retryable: false, code: 'missing-target' });
      return {
        rawResponse: canonicalJson({ answer: evaluatorCompatibleAnswer(target), confidence: 1 }),
        usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
        metadata: { targetDigest: stableDigest(target, 'kinescope-private-target') },
      };
    },
    estimateCostUsd: () => 0,
  });
}

/** @param {unknown} content */
function extractOpenAIText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        const typed = /** @type {Record<string,unknown>} */ (part);
        if (typeof typed.text === 'string') return typed.text;
      }
      return '';
    }).join('');
  }
  return '';
}

/** @param {string} baseUrl */
function chatCompletionsUrl(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

/**
 * Adapter for OpenAI-compatible chat-completions servers, including local
 * vLLM/Ollama-style endpoints when they expose that contract.
 *
 * @param {{baseUrl:string,apiKey?:string|null,model:string,id?:string,version?:string|null,headers?:Record<string,string>,temperature?:number,maxOutputTokens?:number,sendJsonResponseFormat?:boolean,inputCostPerMillion?:number,outputCostPerMillion?:number,fetchImpl?:typeof fetch}} options
 */
export function createOpenAICompatibleProvider(options) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('OpenAI-compatible provider requires fetch.');
  const inputRate = Math.max(0, Number(options.inputCostPerMillion ?? 0));
  const outputRate = Math.max(0, Number(options.outputCostPerMillion ?? 0));
  const maxOutputTokens = Math.max(1, Math.trunc(options.maxOutputTokens ?? 2048));
  const endpoint = chatCompletionsUrl(String(options.baseUrl));
  const provider = createFunctionProvider({
    id: options.id ?? 'openai-compatible',
    kind: 'openai-compatible',
    model: options.model,
    version: options.version ?? null,
    contamination: {
      usesPrivateTargets: false,
      evaluationEligible: true,
      purpose: 'model-evaluation',
    },
    async complete(request, context) {
      const body = {
        model: options.model,
        messages: request.messages,
        temperature: Number(options.temperature ?? 0),
        max_tokens: maxOutputTokens,
        seed: request.generation.seed,
      };
      if (options.sendJsonResponseFormat !== false) body.response_format = { type: 'json_object' };
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
            ...(options.headers ?? {}),
          },
          body: JSON.stringify(body),
          signal: context.signal,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new ProviderError(`OpenAI-compatible request failed: ${error instanceof Error ? error.message : String(error)}`, {
          retryable: true,
          code: 'network-error',
        });
      }
      const responseText = await response.text();
      if (!response.ok) {
        throw new ProviderError(`OpenAI-compatible endpoint returned HTTP ${response.status}.`, {
          retryable: response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500,
          status: response.status,
          code: 'http-error',
          details: responseText.slice(0, 2000),
        });
      }
      let payload;
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new ProviderError('OpenAI-compatible endpoint returned non-JSON transport data.', {
          retryable: false,
          code: 'invalid-transport-json',
          details: responseText.slice(0, 2000),
        });
      }
      const rawResponse = extractOpenAIText(payload?.choices?.[0]?.message?.content);
      if (!rawResponse) {
        throw new ProviderError('OpenAI-compatible response contained no message text.', {
          retryable: false,
          code: 'missing-message-content',
          details: payload,
        });
      }
      const inputTokens = Number(payload?.usage?.prompt_tokens ?? 0);
      const outputTokens = Number(payload?.usage?.completion_tokens ?? 0);
      const costUsd = inputTokens * inputRate / 1_000_000 + outputTokens * outputRate / 1_000_000;
      return {
        rawResponse,
        usage: {
          inputTokens: Number.isFinite(inputTokens) ? Math.max(0, Math.trunc(inputTokens)) : 0,
          outputTokens: Number.isFinite(outputTokens) ? Math.max(0, Math.trunc(outputTokens)) : 0,
          costUsd,
        },
        metadata: {
          providerRequestId: response.headers.get('x-request-id') ?? response.headers.get('request-id'),
          responseModel: payload.model ?? null,
          finishReason: payload?.choices?.[0]?.finish_reason ?? null,
          transportDigest: stableDigest(responseText, 'kinescope-provider-transport'),
        },
      };
    },
    estimateCostUsd(request) {
      const text = request.messages.map((message) => message.content).join('\n');
      const roughInputTokens = Math.ceil(text.length / 4);
      return roughInputTokens * inputRate / 1_000_000 + maxOutputTokens * outputRate / 1_000_000;
    },
  });
  return provider;
}
