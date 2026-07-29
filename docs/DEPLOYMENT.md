# Deployment

KineScope exposes one stateless Fetch-style API implementation through three runtime adapters. The mechanics, renderer, benchmark generator, and evaluator are shared rather than reimplemented per host, because having different scientific truth on localhost and in production would be a particularly inventive way to ruin reproducibility.

## Local combined server

```bash
npm run serve
```

Environment variables:

- `HOST`: bind address, default `127.0.0.1`.
- `PORT`: listening port, default `4173`.

For a network-visible process:

```bash
HOST=0.0.0.0 PORT=4173 npm run serve
```

## Docker

```bash
docker build -t kinescope:unversioned .
docker run --rm -p 4173:4173 kinescope:unversioned
```

The image includes a health check against `/api/v1/health` and serves both the browser laboratory and API.

## Vercel

The repository includes `vercel.json` and Node adapters under `api/`. Import the repository as a Vercel project or run:

```bash
vercel
vercel --prod
```

The server API is stateless, so independent requests can fan out across serverless workers. Large suite generation, deep state-graph exploration, and high-resolution CPU rendering should use a function duration appropriate to the experiment. For sustained high-throughput dataset generation, the Docker server or a dedicated worker pool avoids serverless cold starts and request-duration ceilings.

## Research deployment guidance

- Pin the engine version and suite digest in every run manifest.
- Store public items and evaluator-private targets separately.
- Record API capability output before a run.
- Persist request bodies or their canonical digests.
- Treat generated PNG metadata and exact state fingerprints as provenance, not decoration.
- Use `/api/v1/batch` for short independent calls; use multiple workers for large independent episodes.
