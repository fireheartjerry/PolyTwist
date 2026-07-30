import { handleApiRequest } from './api.js';

/**
 * Adapt Vercel/Node IncomingMessage + ServerResponse objects to the platform's
 * Fetch-style deterministic API. Keeping this adapter thin means the exact
 * API logic remains shared by local, container, test, and serverless runtimes.
 */
export function createVercelHandler(apiHandler = handleApiRequest) {
  return async function vercelHandler(request, response) {
    try {
      const protocol = String(request.headers?.['x-forwarded-proto'] ?? 'https')
        .split(',')[0]
        .trim();
      const host = request.headers?.host ?? 'localhost';
      const url = new URL(request.url ?? '/', `${protocol}://${host}`);
      const method = request.method ?? 'GET';
      const chunks = [];

      if (!['GET', 'HEAD'].includes(method)) {
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
      }

      const body = chunks.length > 0 ? Uint8Array.from(Buffer.concat(chunks)).buffer : undefined;
      const fetchRequest = new Request(url, {
        method,
        headers: request.headers,
        body,
      });
      const fetchResponse = await apiHandler(fetchRequest);

      response.statusCode = fetchResponse.status;
      for (const [key, value] of fetchResponse.headers) response.setHeader(key, value);
      response.end(Buffer.from(await fetchResponse.arrayBuffer()));
    } catch (error) {
      response.statusCode = 500;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({
        ok: false,
        error: {
          code: 'KineScope_SERVER_ADAPTER_FAILURE',
          message: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  };
}

export const vercelHandler = createVercelHandler();
