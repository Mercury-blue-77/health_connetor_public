# Security Policy

## Supported Versions

The `main` branch is the supported development line until tagged releases are
published.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately through GitHub Security
Advisories if available for this repository, or by opening a private channel
with the maintainers before publishing details.

Do not include real OAuth signing secrets, upstream Sparky MCP bearer tokens, or
personal health data in reports.

## Deployment Notes

This bridge is intended to be public-facing, while the upstream Sparky MCP
server remains private. Production deployments must use HTTPS, strong random
secrets, and a narrow `OAUTH_ALLOWED_REDIRECT_ORIGINS` allowlist.
