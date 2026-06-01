import { createHash, timingSafeEqual } from "node:crypto";

export function verifyPkce(input: {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}) {
  if (input.codeChallengeMethod !== "S256") return false;

  const digest = createHash("sha256")
    .update(input.codeVerifier)
    .digest("base64url");

  const actual = Buffer.from(digest);
  const expected = Buffer.from(input.codeChallenge);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
