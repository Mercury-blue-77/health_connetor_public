# Configuration

Create `.env` from `.env.example` and set deployment-specific values.

## Public Bridge URLs

- `PUBLIC_BASE_URL`: public HTTPS origin where ChatGPT reaches this bridge.
- `PUBLIC_MCP_RESOURCE`: canonical MCP resource identifier. Usually the same as
  `PUBLIC_BASE_URL`.
- `OAUTH_ISSUER`: OAuth issuer. Usually the same as `PUBLIC_BASE_URL`.
- `RESOURCE_DOCUMENTATION_URL`: optional documentation URL advertised in
  protected resource metadata.

For local development, defaults use `http://127.0.0.1:8787`. Production must use
HTTPS.

## OAuth

- `OAUTH_SIGNING_SECRET`: HMAC secret for access and refresh tokens. Use a
  random value with at least 32 characters.
- `OAUTH_SCOPES`: space-separated scopes advertised by the bridge.
- `OAUTH_ALLOWED_REDIRECT_ORIGINS`: comma-separated redirect origin allowlist.
  Defaults to `https://chatgpt.com`.
- `ACCESS_TOKEN_TTL_SECONDS`: access-token lifetime. Defaults to `3600`.
- `REFRESH_TOKEN_TTL_SECONDS`: refresh-token lifetime. Defaults to one year.
- `AUTHORIZATION_CODE_TTL_SECONDS`: authorization-code lifetime. Defaults to
  `300`.

## Upstream Sparky MCP

- `SPARKY_MCP_URL`: private upstream Sparky MCP endpoint.
- `SPARKY_MCP_BEARER_TOKEN`: bearer token the bridge sends to Sparky MCP.
- `UPSTREAM_REQUEST_TIMEOUT_MS`: upstream request timeout. Defaults to `30000`.

The upstream Sparky MCP server should not be exposed publicly.

## Diagnostics

- `ADMIN_DIAGNOSTICS_TOKEN`: optional token required by `GET /admin/diagnostics`
  when set.
