import { randomBytes } from "node:crypto";
import { config } from "../config.js";

export type AuthorizationCodeRecord = {
  clientId: string;
  redirectUri: string;
  resource: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  subject: string;
  expiresAt: number;
};

const codes = new Map<string, AuthorizationCodeRecord>();
const cleanupInterval = setInterval(deleteExpiredAuthorizationCodes, 60_000);
cleanupInterval.unref();

export function createAuthorizationCode(
  record: Omit<AuthorizationCodeRecord, "expiresAt">,
) {
  const code = randomBytes(32).toString("base64url");
  codes.set(code, {
    ...record,
    expiresAt: Date.now() + config.authorizationCodeTtlSeconds * 1000,
  });
  return code;
}

export function consumeAuthorizationCode(code: string) {
  const record = codes.get(code);
  codes.delete(code);
  if (!record || record.expiresAt < Date.now()) return undefined;
  return record;
}

export function deleteExpiredAuthorizationCodes() {
  const now = Date.now();
  for (const [code, record] of codes.entries()) {
    if (record.expiresAt < now) codes.delete(code);
  }
}

export function stopAuthorizationCodeCleanup() {
  clearInterval(cleanupInterval);
}
