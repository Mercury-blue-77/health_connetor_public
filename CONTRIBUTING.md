# Contributing

Thanks for helping improve `health_connector`.

## Development

```bash
npm ci
npm run check
npm test
npm run build
```

The server is the supported bridge implementation. The `web/` workspace is
experimental and should not be treated as production-ready UI.

## Pull Requests

- Keep changes focused on the OAuth-to-Sparky-MCP bridge.
- Do not commit secrets, private hostnames, personal file paths, or local
  deployment notes.
- Add or update tests for OAuth, token, proxy, or security-sensitive behavior.
- Update docs when configuration or deployment behavior changes.
