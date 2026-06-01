import "dotenv/config";

export type Config = {
  host: string;
  port: number;
  oauthIssuer: string;
  oauthSigningSecret: string;
  publicMcpResource: string;
  oauthScopes: string[];
  oauthAllowedRedirectOrigins: string[];
  adminDiagnosticsToken: string | undefined;
  resourceDocumentationUrl?: string;
  sparkyMcpUrl: string;
  sparkyMcpBearerToken: string | undefined;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  authorizationCodeTtlSeconds: number;
  upstreamRequestTimeoutMs: number;
  version: string;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const validateUrl = (name: string, value: string) => {
  const trimmed = trimTrailingSlash(value);
  try {
    new URL(trimmed);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
  return trimmed;
};
const requiredUrl = (name: string, fallback: string) =>
  validateUrl(name, process.env[name] ?? fallback);
const optionalUrl = (name: string) => {
  const value = process.env[name];
  return value ? validateUrl(name, value) : undefined;
};
const requiredSecret = (name: string, minLength: number) => {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(`${name} must be set and at least ${minLength} characters long.`);
  }
  return value;
};
const positiveInteger = (
  name: string,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
) => {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (
    !Number.isNaN(value) &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= max
  ) {
    return value;
  }
  throw new Error(`${name} must be a finite positive integer up to ${max}.`);
};

const publicBaseUrl = requiredUrl("PUBLIC_BASE_URL", "http://127.0.0.1:8787");
const scopes = (process.env.OAUTH_SCOPES ?? "sparky:read sparky:write")
  .split(/\s+/)
  .map((scope) => scope.trim())
  .filter(Boolean);

export const config: Config = {
  host: process.env.HOST ?? "0.0.0.0",
  port: positiveInteger("PORT", 8787, 65535),
  oauthIssuer: requiredUrl("OAUTH_ISSUER", publicBaseUrl),
  oauthSigningSecret: requiredSecret("OAUTH_SIGNING_SECRET", 32),
  publicMcpResource: requiredUrl("PUBLIC_MCP_RESOURCE", publicBaseUrl),
  oauthScopes: scopes,
  oauthAllowedRedirectOrigins: (
    process.env.OAUTH_ALLOWED_REDIRECT_ORIGINS ?? "https://chatgpt.com"
  )
    .split(",")
    .map((origin) => trimTrailingSlash(origin.trim()))
    .filter(Boolean),
  adminDiagnosticsToken: process.env.ADMIN_DIAGNOSTICS_TOKEN || undefined,
  resourceDocumentationUrl: optionalUrl("RESOURCE_DOCUMENTATION_URL"),
  sparkyMcpUrl: requiredUrl("SPARKY_MCP_URL", "http://127.0.0.1:8788/mcp"),
  sparkyMcpBearerToken: process.env.SPARKY_MCP_BEARER_TOKEN || undefined,
  accessTokenTtlSeconds: positiveInteger("ACCESS_TOKEN_TTL_SECONDS", 3600),
  refreshTokenTtlSeconds: positiveInteger(
    "REFRESH_TOKEN_TTL_SECONDS",
    60 * 60 * 24 * 365,
  ),
  authorizationCodeTtlSeconds: positiveInteger(
    "AUTHORIZATION_CODE_TTL_SECONDS",
    300,
  ),
  upstreamRequestTimeoutMs: positiveInteger("UPSTREAM_REQUEST_TIMEOUT_MS", 30000),
  version: process.env.npm_package_version ?? "0.1.0",
};
