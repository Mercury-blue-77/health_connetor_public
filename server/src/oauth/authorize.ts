import type { Request, Response } from "express";
import { config } from "../config.js";
import { createAuthorizationCode } from "./code-store.js";

type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  responseType: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  scope: string;
  state?: string;
};

export function handleAuthorize(req: Request, res: Response) {
  const parsed = parseAuthorizationRequest(req.query);
  if (!parsed.ok) {
    res.status(400).send(renderErrorPage(parsed.error));
    return;
  }

  res
    .status(200)
    .type("html")
    .send(renderConsentPage(parsed.value));
}

export function handleAuthorizeApproval(req: Request, res: Response) {
  const parsed = parseAuthorizationRequest(req.body);
  if (!parsed.ok) {
    res.status(400).send(renderErrorPage(parsed.error));
    return;
  }

  if (req.body.decision !== "approve") {
    redirectWithParams(res, parsed.value.redirectUri, {
      error: "access_denied",
      state: parsed.value.state,
    });
    return;
  }

  const code = createAuthorizationCode({
    clientId: parsed.value.clientId,
    redirectUri: parsed.value.redirectUri,
    resource: parsed.value.resource,
    scope: parsed.value.scope,
    codeChallenge: parsed.value.codeChallenge,
    codeChallengeMethod: parsed.value.codeChallengeMethod,
    subject: "sparkyfitness-single-user",
  });

  redirectWithParams(res, parsed.value.redirectUri, {
    code,
    state: parsed.value.state,
  });
}

function parseAuthorizationRequest(
  input: Request["query"] | Request["body"],
): { ok: true; value: AuthorizationRequest } | { ok: false; error: string } {
  const clientId = first(input.client_id);
  const redirectUri = first(input.redirect_uri);
  const responseType = first(input.response_type);
  const codeChallenge = first(input.code_challenge);
  const codeChallengeMethod = first(input.code_challenge_method);
  const resource = first(input.resource);
  const requestedScope = first(input.scope);
  const state = first(input.state);

  if (!clientId) return { ok: false, error: "client_id is required." };
  if (!redirectUri) return { ok: false, error: "redirect_uri is required." };
  if (responseType !== "code") {
    return { ok: false, error: "Only response_type=code is supported." };
  }
  if (!codeChallenge) {
    return { ok: false, error: "code_challenge is required." };
  }
  if (codeChallengeMethod !== "S256") {
    return { ok: false, error: "Only code_challenge_method=S256 is supported." };
  }
  if (resource !== config.publicMcpResource) {
    return { ok: false, error: "Invalid resource parameter." };
  }
  try {
    const parsedRedirectUri = new URL(redirectUri);
    if (
      !config.oauthAllowedRedirectOrigins.includes(parsedRedirectUri.origin)
    ) {
      return { ok: false, error: "redirect_uri origin is not allowed." };
    }
  } catch {
    return { ok: false, error: "redirect_uri must be an absolute URL." };
  }

  return {
    ok: true,
    value: {
      clientId,
      redirectUri,
      responseType,
      codeChallenge,
      codeChallengeMethod,
      resource,
      scope: normalizeScopes(requestedScope),
      state,
    },
  };
}

function normalizeScopes(requestedScope: string | undefined) {
  const supported = new Set(config.oauthScopes);
  const requested = (requestedScope ?? config.oauthScopes.join(" "))
    .split(/\s+/)
    .filter(Boolean);
  const accepted = requested.filter((scope) => supported.has(scope));
  return (accepted.length ? accepted : config.oauthScopes).join(" ");
}

function first(value: unknown) {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : undefined;
  return value === undefined ? undefined : String(value);
}

function redirectWithParams(
  res: Response,
  redirectUri: string,
  params: Record<string, string | undefined>,
) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  res.redirect(url.toString());
}

function renderConsentPage(request: AuthorizationRequest) {
  const hiddenFields = Object.entries({
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    response_type: request.responseType,
    code_challenge: request.codeChallenge,
    code_challenge_method: request.codeChallengeMethod,
    resource: request.resource,
    scope: request.scope,
    state: request.state,
  })
    .filter(([, value]) => value !== undefined)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value ?? "")}">`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SparkyFitness Authorization</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; color: #172026; background: #f6f8fa; }
    main { max-width: 560px; margin: 64px auto; padding: 32px; background: white; border: 1px solid #d8dee4; border-radius: 8px; }
    h1 { margin-top: 0; font-size: 24px; }
    code { word-break: break-all; }
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    button { border: 1px solid #1f6feb; border-radius: 6px; padding: 10px 14px; cursor: pointer; }
    .approve { color: white; background: #1f6feb; }
    .deny { color: #24292f; background: white; border-color: #d0d7de; }
  </style>
</head>
<body>
  <main>
    <h1>Authorize ChatGPT</h1>
    <p>Allow ChatGPT to access the SparkyFitness MCP bridge with these scopes:</p>
    <p><code>${escapeHtml(request.scope)}</code></p>
    <form method="post" action="/oauth/authorize">
      ${hiddenFields}
      <div class="actions">
        <button class="approve" type="submit" name="decision" value="approve">Authorize</button>
        <button class="deny" type="submit" name="decision" value="deny">Deny</button>
      </div>
    </form>
  </main>
</body>
</html>`;
}

function renderErrorPage(message: string) {
  return `<!doctype html><html lang="en"><body><h1>Authorization error</h1><p>${escapeHtml(message)}</p></body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
