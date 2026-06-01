import type { Request, Response } from "express";
import { config } from "../config.js";
import {
  issueAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
} from "../security/jwt.js";
import { consumeAuthorizationCode } from "./code-store.js";
import { verifyPkce } from "./pkce.js";

export function handleToken(req: Request, res: Response) {
  const grantType = first(req.body.grant_type);

  if (grantType === "authorization_code") {
    handleAuthorizationCodeGrant(req, res);
    return;
  }
  if (grantType === "refresh_token") {
    handleRefreshTokenGrant(req, res);
    return;
  }

  sendTokenError(
    res,
    "unsupported_grant_type",
    "Only authorization_code and refresh_token are supported.",
  );
}

function handleAuthorizationCodeGrant(req: Request, res: Response) {
  const code = first(req.body.code);
  const redirectUri = first(req.body.redirect_uri);
  const clientId = first(req.body.client_id);
  const codeVerifier = first(req.body.code_verifier);
  const resource = first(req.body.resource);

  if (!code || !redirectUri || !clientId || !codeVerifier || !resource) {
    sendTokenError(
      res,
      "invalid_request",
      "code, redirect_uri, client_id, code_verifier, and resource are required.",
    );
    return;
  }

  const record = consumeAuthorizationCode(code);
  if (!record) {
    sendTokenError(res, "invalid_grant", "Authorization code is invalid or expired.");
    return;
  }
  if (
    record.redirectUri !== redirectUri ||
    record.clientId !== clientId ||
    record.resource !== resource
  ) {
    sendTokenError(res, "invalid_grant", "Authorization code binding mismatch.");
    return;
  }
  if (
    !verifyPkce({
      codeVerifier,
      codeChallenge: record.codeChallenge,
      codeChallengeMethod: record.codeChallengeMethod,
    })
  ) {
    sendTokenError(res, "invalid_grant", "PKCE verification failed.");
    return;
  }

  const accessToken = issueAccessToken({
    subject: record.subject,
    scope: record.scope,
    resource: record.resource,
  });
  const refreshToken = issueRefreshToken({
    subject: record.subject,
    scope: record.scope,
    resource: record.resource,
  });

  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: config.accessTokenTtlSeconds,
    refresh_token: refreshToken,
    scope: record.scope,
  });
}

function handleRefreshTokenGrant(req: Request, res: Response) {
  const refreshToken = first(req.body.refresh_token);
  const requestedScope = first(req.body.scope);

  if (!refreshToken) {
    sendTokenError(res, "invalid_request", "refresh_token is required.");
    return;
  }

  try {
    const claims = verifyRefreshToken(refreshToken);
    const scope = normalizeRefreshScope(requestedScope, claims.scope);
    if (!scope) {
      sendTokenError(res, "invalid_scope", "Requested scope exceeds refresh token grant.");
      return;
    }
    const accessToken = issueAccessToken({
      subject: claims.sub,
      scope,
      resource: claims.aud,
    });
    const nextRefreshToken = issueRefreshToken({
      subject: claims.sub,
      scope: claims.scope,
      resource: claims.aud,
    });

    res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: config.accessTokenTtlSeconds,
      refresh_token: nextRefreshToken,
      scope,
    });
  } catch {
    sendTokenError(res, "invalid_grant", "Refresh token is invalid or expired.");
  }
}

function normalizeRefreshScope(
  requestedScope: string | undefined,
  grantedScope: string,
) {
  if (!requestedScope) return grantedScope;

  const granted = new Set(grantedScope.split(/\s+/).filter(Boolean));
  const requested = requestedScope.split(/\s+/).filter(Boolean);
  if (!requested.length) return grantedScope;
  if (requested.some((scope) => !granted.has(scope))) return undefined;
  return requested.join(" ");
}

function sendTokenError(
  res: Response,
  error: string,
  errorDescription: string,
) {
  res.status(400).json({
    error,
    error_description: errorDescription,
  });
}

function first(value: unknown) {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : undefined;
  return value === undefined ? undefined : String(value);
}
