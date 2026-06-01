# OAuth MCP Bridge Design

Date: 2026-05-31

## Problem

ChatGPT Apps expect authenticated MCP servers to use OAuth 2.1 with protected
resource metadata, OAuth discovery, authorization-code flow, and PKCE. An
already-running private Sparky MCP server expects a bearer token directly. The
two authentication models do not match.

## Decision

Run `health_connector` as a public OAuth-to-bearer bridge. It does not run
Sparky MCP or SparkyFitness; operators provide the upstream Sparky MCP endpoint.

```text
ChatGPT -> health_connector -> Sparky MCP -> SparkyFitness
```

The bridge owns the ChatGPT-facing OAuth flow and forwards MCP traffic to the
private Sparky MCP with `Authorization: Bearer <SPARKY_MCP_BEARER_TOKEN>`.

## Components

- MCP resource server: `POST /mcp`, protected by bridge access tokens.
- OAuth authorization server:
  - `GET /.well-known/oauth-authorization-server`
  - `GET /oauth/authorize`
  - `POST /oauth/authorize`
  - `POST /oauth/token`
- Protected resource metadata:
  - `GET /.well-known/oauth-protected-resource`
- Upstream proxy:
  - Preserves MCP protocol headers.
  - Replaces ChatGPT's bridge bearer token with the Sparky MCP bearer token.

## V1 Constraints

- Single-user authorization.
- Authorization codes are stored in memory.
- Access and refresh tokens are HMAC-signed JWTs.
- Refresh tokens let ChatGPT renew access without another browser
  authorization until `REFRESH_TOKEN_TTL_SECONDS` elapses.
- No dynamic client registration endpoint. ChatGPT can use Client ID Metadata
  Documents as advertised by discovery metadata.

These choices keep the deployment small and are appropriate for one bridge
container per upstream Sparky MCP identity. Multi-user token linking can be
added later with a persistent store and encrypted Sparky token records.

## Required Environment

- `PUBLIC_BASE_URL`: public HTTPS origin of the bridge.
- `PUBLIC_MCP_RESOURCE`: canonical MCP resource identifier. Usually the same as
  `PUBLIC_BASE_URL`.
- `OAUTH_ISSUER`: OAuth issuer. Usually the same as `PUBLIC_BASE_URL`.
- `OAUTH_SIGNING_SECRET`: HMAC secret for signing and verifying bridge access
  tokens and refresh tokens.
- `REFRESH_TOKEN_TTL_SECONDS`: refresh-token lifetime for the HMAC-signed
  refresh tokens. Defaults to one year.
- `SPARKY_MCP_URL`: private upstream MCP endpoint.
- `SPARKY_MCP_BEARER_TOKEN`: upstream Sparky MCP bearer token.
- `OAUTH_ALLOWED_REDIRECT_ORIGINS`: comma-separated redirect origins. Defaults
  to `https://chatgpt.com`.
- `ADMIN_DIAGNOSTICS_TOKEN`: optional token for `GET /admin/diagnostics`.
- `UPSTREAM_REQUEST_TIMEOUT_MS`: upstream MCP request timeout. Defaults to
  `30000`.

## Security Notes

- The upstream Sparky MCP must stay private.
- The Sparky bearer token is never returned to ChatGPT or the browser.
- The bridge validates access token signature, issuer, audience, expiration,
  and subject on every MCP request. Refresh tokens are verified with the same
  signing secret before issuing renewed access tokens.
- The token endpoint validates authorization-code binding and PKCE.
- Production deployment must use HTTPS; ChatGPT OAuth redirect URIs are HTTPS.
