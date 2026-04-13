# raindrop-mcp

A Cloudflare Worker that exposes the [Raindrop.io REST API](https://developer.raindrop.io/) as an MCP server.

This project runs as an HTTP MCP endpoint on Cloudflare Workers and forwards the bearer token from each incoming request directly to Raindrop.io. The worker does **not** store a Raindrop token in Cloudflare secrets or local config.

## What it does

- serves an MCP endpoint at `/mcp`
- requires `Authorization: Bearer <raindrop-api-token>` on every MCP request
- forwards that token to the Raindrop.io REST API
- exposes Raindrop tools for users, collections, bookmarks, exports, highlights, and related operations
- provides a simple health endpoint at `/healthz`

## How it works

The worker entrypoint is `src/worker.ts`.

Request flow:

1. A client sends an MCP HTTP request to the worker.
2. The worker reads the `Authorization` header.
3. The bearer token is validated locally.
4. A per-request MCP server instance is created.
5. Tool calls are translated into requests to `https://api.raindrop.io/rest/v1`.
6. The Raindrop API response is returned as MCP tool output.

Because authentication is passed through request-by-request, this worker is stateless with respect to Raindrop credentials.

## Routes

### `GET /healthz`

Returns a simple JSON health response:

```json
{
  "ok": true,
  "service": "raindrop-mcp"
}
```

### `/mcp`

Main MCP HTTP endpoint.

Required header:

```http
Authorization: Bearer <raindrop-api-token>
```

If the header is missing or invalid, the worker returns `401 Unauthorized`.

## Project structure

- `src/worker.ts` - Cloudflare Worker entrypoint
- `src/mcp-server.ts` - MCP server creation
- `src/register-tools.ts` - Raindrop MCP tool definitions
- `src/raindrop-client.ts` - Raindrop REST API client
- `src/auth.ts` - bearer token parsing and auth error handling
- `tests/` - unit and integration tests
- `docs/` - copied/reference Raindrop API documentation
- `wrangler.jsonc` - Cloudflare Worker configuration

## Requirements

- Node.js 20+
- npm
- a Cloudflare account
- Wrangler CLI access via `npx wrangler ...`
- a Raindrop.io API token for runtime requests

## Install

```bash
npm install
```

## Local development

Run the worker locally:

```bash
npm run dev
```

Useful commands:

```bash
npm run build
npm test
npm run cf-typegen
```

Note: the current test command may depend on your local Node/Vitest compatibility. If `npm test` fails during Vitest startup, try a newer Node.js version.

## Configuration

The default Raindrop API base is:

```text
https://api.raindrop.io/rest/v1
```

You can override it with the optional Worker environment variable:

- `RAINDROP_API_BASE`

Example for local development or environment-specific configuration in Wrangler:

```jsonc
{
  "vars": {
    "RAINDROP_API_BASE": "https://api.raindrop.io/rest/v1"
  }
}
```

## Deploy to Cloudflare Workers

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 2. Review Worker config

Current worker configuration lives in `wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "raindrop-mcp",
  "main": "src/worker.ts",
  "compatibility_date": "2026-04-13"
}
```

If needed, update the worker name before deployment.

### 3. Deploy

```bash
npm run deploy
```

This runs:

```bash
wrangler deploy
```

After deploy, Cloudflare will print the Worker URL, typically something like:

```text
https://raindrop-mcp.<your-subdomain>.workers.dev
```

Your MCP endpoint will then be:

```text
https://raindrop-mcp.<your-subdomain>.workers.dev/mcp
```

And the health check endpoint:

```text
https://raindrop-mcp.<your-subdomain>.workers.dev/healthz
```

## Verify deployment

Check health:

```bash
curl https://raindrop-mcp.<your-subdomain>.workers.dev/healthz
```

Example expected response:

```json
{
  "ok": true,
  "service": "raindrop-mcp"
}
```

## Authentication model

This worker does not manage OAuth on behalf of the caller.

Instead, every request to `/mcp` must include a valid Raindrop bearer token:

```http
Authorization: Bearer <raindrop-api-token>
```

That token is forwarded upstream to Raindrop.io for the actual API call.

## Notes for MCP clients

When configuring an MCP client to use this server:

- base URL should point to the deployed worker
- MCP endpoint path is `/mcp`
- include `Authorization: Bearer <raindrop-api-token>` on requests
- use `/healthz` for simple uptime checks

## Example deployment workflow

```bash
cd ~/Downloads/projects/raindrop-mcp
npm install
npm run build
npx wrangler login
npm run deploy
```

## Reference docs

Raindrop API reference content is available under `docs/`.
