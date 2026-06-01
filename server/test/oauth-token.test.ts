import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { before, test } from "node:test";
import type { Response } from "express";

process.env.PUBLIC_BASE_URL = "https://bridge.example.com";
process.env.PUBLIC_MCP_RESOURCE = "https://bridge.example.com";
process.env.OAUTH_ISSUER = "https://bridge.example.com";
process.env.OAUTH_SIGNING_SECRET = "test-secret-with-at-least-32-characters";
process.env.ACCESS_TOKEN_TTL_SECONDS = "3600";
process.env.REFRESH_TOKEN_TTL_SECONDS = "31536000";

let createAuthorizationCode: typeof import("../src/oauth/code-store.js").createAuthorizationCode;
let handleToken: typeof import("../src/oauth/token.js").handleToken;
let issueRefreshToken: typeof import("../src/security/jwt.js").issueRefreshToken;
let verifyAccessToken: typeof import("../src/security/jwt.js").verifyAccessToken;
let verifyRefreshToken: typeof import("../src/security/jwt.js").verifyRefreshToken;

before(async () => {
  ({ createAuthorizationCode } = await import("../src/oauth/code-store.js"));
  ({ handleToken } = await import("../src/oauth/token.js"));
  ({ issueRefreshToken, verifyAccessToken, verifyRefreshToken } = await import(
    "../src/security/jwt.js"
  ));
});

test("authorization_code grant returns access and refresh tokens", () => {
  const codeVerifier = "test-code-verifier";
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const code = createAuthorizationCode({
    clientId: "chatgpt",
    redirectUri: "https://chatgpt.com/oauth/callback",
    resource: "https://bridge.example.com",
    scope: "sparky:read sparky:write",
    codeChallenge,
    codeChallengeMethod: "S256",
    subject: "sparkyfitness-single-user",
  });
  const res = createJsonResponse();

  handleToken(
    {
      body: {
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://chatgpt.com/oauth/callback",
        client_id: "chatgpt",
        code_verifier: codeVerifier,
        resource: "https://bridge.example.com",
      },
    } as never,
    res as never,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.token_type, "Bearer");
  assert.equal(res.body.expires_in, 3600);
  assert.equal(res.body.scope, "sparky:read sparky:write");
  assert.equal(verifyAccessToken(res.body.access_token).token_use, "access");
  assert.equal(verifyRefreshToken(res.body.refresh_token).token_use, "refresh");
});

test("refresh_token grant returns a fresh access token without a new code", () => {
  const refreshToken = issueRefreshTokenForTest();
  const res = createJsonResponse();

  handleToken(
    {
      body: {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "sparky:read",
      },
    } as never,
    res as never,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.token_type, "Bearer");
  assert.equal(res.body.scope, "sparky:read");
  assert.equal(verifyAccessToken(res.body.access_token).scope, "sparky:read");
  assert.equal(
    verifyRefreshToken(res.body.refresh_token).scope,
    "sparky:read sparky:write",
  );
});

function issueRefreshTokenForTest() {
  return issueRefreshToken({
    subject: "sparkyfitness-single-user",
    scope: "sparky:read sparky:write",
    resource: "https://bridge.example.com",
  });
}

function createJsonResponse() {
  return {
    statusCode: 200,
    body: undefined as Record<string, any> | undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: Record<string, any>) {
      this.body = body;
      return this;
    },
  } satisfies Partial<Response> & {
    statusCode: number;
    body: Record<string, any> | undefined;
  };
}
