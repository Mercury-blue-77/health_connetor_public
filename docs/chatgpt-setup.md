# ChatGPT Setup

Deploy the bridge at a public HTTPS origin and configure `.env` so
`PUBLIC_BASE_URL`, `PUBLIC_MCP_RESOURCE`, and `OAUTH_ISSUER` all point at that
origin unless you have a specific reason to separate them.

The ChatGPT-facing MCP endpoint is:

```text
https://<public-bridge-host>/mcp
```

The bridge advertises OAuth metadata at:

```text
https://<public-bridge-host>/.well-known/oauth-protected-resource
https://<public-bridge-host>/.well-known/oauth-authorization-server
```

Keep `OAUTH_ALLOWED_REDIRECT_ORIGINS=https://chatgpt.com` unless your ChatGPT
environment requires another trusted origin.

## Verify

```bash
curl https://<public-bridge-host>/healthz
curl https://<public-bridge-host>/.well-known/oauth-protected-resource
curl https://<public-bridge-host>/.well-known/oauth-authorization-server
curl -i -X POST https://<public-bridge-host>/mcp \
  -H 'content-type: application/json' \
  --data '{}'
```

An unauthenticated MCP request should return `401` with a `WWW-Authenticate`
header pointing to the protected resource metadata endpoint.
