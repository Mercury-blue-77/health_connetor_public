import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

export type AccessTokenClaims = {
  iss: string;
  aud: string;
  sub: string;
  scope: string;
  iat: number;
  exp: number;
  token_use?: "access";
};

export type RefreshTokenClaims = {
  iss: string;
  aud: string;
  sub: string;
  scope: string;
  iat: number;
  exp: number;
  token_use: "refresh";
};

const encodeJson = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const sign = (input: string) =>
  createHmac("sha256", config.oauthSigningSecret)
    .update(input)
    .digest("base64url");

export function issueAccessToken(input: {
  subject: string;
  scope: string;
  resource: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const claims: AccessTokenClaims = {
    iss: config.oauthIssuer,
    aud: input.resource,
    sub: input.subject,
    scope: input.scope,
    iat: now,
    exp: now + config.accessTokenTtlSeconds,
    token_use: "access",
  };

  return issueToken(header, claims);
}

export function issueRefreshToken(input: {
  subject: string;
  scope: string;
  resource: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const claims: RefreshTokenClaims = {
    iss: config.oauthIssuer,
    aud: input.resource,
    sub: input.subject,
    scope: input.scope,
    iat: now,
    exp: now + config.refreshTokenTtlSeconds,
    token_use: "refresh",
  };

  return issueToken(header, claims);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const claims = verifyToken<AccessTokenClaims>(token);
  if (claims.token_use && claims.token_use !== "access") {
    throw new Error("Invalid token use.");
  }
  return claims;
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  const claims = verifyToken<RefreshTokenClaims>(token);
  if (claims.token_use !== "refresh") throw new Error("Invalid token use.");
  return claims;
}

function issueToken(header: JwtHeader, claims: AccessTokenClaims | RefreshTokenClaims) {
  const unsigned = `${encodeJson(header)}.${encodeJson(claims)}`;
  return `${unsigned}.${sign(unsigned)}`;
}

function verifyToken<T extends AccessTokenClaims | RefreshTokenClaims>(
  token: string,
): T {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token.");

  const [encodedHeader, encodedClaims, signature] = parts;
  const unsigned = `${encodedHeader}.${encodedClaims}`;
  const expectedSignature = sign(unsigned);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Invalid access token signature.");
  }

  const header = JSON.parse(
    Buffer.from(encodedHeader, "base64url").toString("utf8"),
  ) as Partial<JwtHeader>;
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error("Unsupported token header.");
  }

  const claims = JSON.parse(
    Buffer.from(encodedClaims, "base64url").toString("utf8"),
  ) as T;
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== config.oauthIssuer) throw new Error("Invalid issuer.");
  if (claims.aud !== config.publicMcpResource) throw new Error("Invalid audience.");
  if (claims.exp <= now) throw new Error("Token expired.");
  if (!claims.sub) throw new Error("Missing subject.");

  return claims;
}
