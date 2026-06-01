# health_connector

OAuth-compatible bridge for connecting ChatGPT Apps to an existing private
Sparky MCP server.

This repository does not run Sparky MCP or SparkyFitness. You bring an already
running Sparky stack with a private MCP endpoint. `health_connector` exposes the
ChatGPT-facing OAuth and MCP resource endpoints, then forwards authenticated MCP
requests to your private Sparky MCP server with the configured upstream bearer
token.

```text
ChatGPT -- OAuth bearer --> health_connector -- Sparky bearer --> Sparky MCP
```

## Current Scope

- Public OAuth-compatible MCP endpoint for ChatGPT Apps.
- Authorization-code + PKCE token exchange.
- Refresh-token exchange for renewing ChatGPT access.
- Single-user bridge mode: one bridge deployment maps to one upstream Sparky
  MCP identity.
- Experimental `web/` workspace for future ChatGPT iframe UI. It is not part of
  the production bridge path yet.

## Prerequisites

- Node.js 22 or Docker.
- A private Sparky MCP endpoint reachable from the bridge host.
- A Sparky MCP bearer token for that upstream endpoint.
- A public HTTPS origin for ChatGPT to reach this bridge in production.

## Quick Start

```bash
cp .env.example .env
npm ci
npm run build
npm run dev
```

Set these values in `.env`:

- `PUBLIC_BASE_URL`, `PUBLIC_MCP_RESOURCE`, and `OAUTH_ISSUER`: the public HTTPS
  origin ChatGPT can reach.
- `OAUTH_SIGNING_SECRET`: a strong random secret, at least 32 characters.
- `SPARKY_MCP_URL`: the private upstream Sparky MCP endpoint.
- `SPARKY_MCP_BEARER_TOKEN`: the token required by your Sparky MCP server.

## Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
```

The root `docker-compose.yml` runs only the bridge. It does not start Sparky MCP.

## Endpoints

- `POST /mcp` - authenticated MCP proxy.
- `GET /.well-known/oauth-protected-resource` - MCP protected resource metadata.
- `GET /.well-known/oauth-authorization-server` - OAuth discovery metadata.
- `GET /oauth/authorize` - user consent page for ChatGPT.
- `POST /oauth/authorize` - consent approval/denial.
- `POST /oauth/token` - authorization-code + PKCE and refresh-token exchange.
- `GET /healthz` - deployment health check.

## Single-User Mode

This bridge is intentionally single-user for now. Anyone who can complete the
OAuth consent flow for this bridge receives access to the configured upstream
Sparky MCP identity. Run one bridge per user/account, protect the deployment,
and keep `SPARKY_MCP_BEARER_TOKEN` secret.

## Documentation

- [Configuration](docs/configuration.md)
- [ChatGPT setup](docs/chatgpt-setup.md)
- [Production notes](docs/production.md)
- [Architecture](docs/oauth-mcp-bridge-design.md)

## Development

```bash
npm ci
npm run check
npm test
npm run build
```

The root build targets the server bridge. The `web/` workspace can be checked
with `npm run check --workspace web`, but it is experimental and not documented
as production UI.
