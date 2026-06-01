# Production Notes

`health_connector` is designed to be exposed publicly. Your upstream Sparky MCP
server is not.

## Deployment Checklist

- Put the bridge behind HTTPS.
- Expose only the bridge, not the upstream Sparky MCP server.
- Use a strong random `OAUTH_SIGNING_SECRET`.
- Keep `SPARKY_MCP_BEARER_TOKEN` out of logs and source control.
- Keep `OAUTH_ALLOWED_REDIRECT_ORIGINS` narrow.
- Run one bridge per upstream Sparky MCP identity while the project is in
  single-user mode.
- Rotate the upstream Sparky MCP bearer token if the bridge host is compromised.

## Docker

The root `docker-compose.yml` builds and runs only the bridge:

```bash
docker compose up -d --build
```

It expects `.env` in the repository root.

## Experimental Web Workspace

The `web/` workspace contains early ChatGPT iframe UI experiments. It is kept in
the repository so the integration can evolve, but it is not required to run the
bridge and should not be treated as production-ready UI.
