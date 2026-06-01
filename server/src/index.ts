import "dotenv/config";
import express from "express";
import { config } from "./config.js";
import { handleAuthorize, handleAuthorizeApproval } from "./oauth/authorize.js";
import { oauthAuthorizationServerMetadata } from "./oauth/metadata.js";
import { handleToken } from "./oauth/token.js";
import { requireBridgeAccessToken } from "./security/auth-middleware.js";
import { proxyMcpRequest } from "./upstream/mcp-proxy.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", true);

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "2mb", type: ["application/json", "application/*+json"] }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    version: config.version,
    uptime: process.uptime(),
  });
});

app.get("/admin/diagnostics", (req, res) => {
  if (
    !config.adminDiagnosticsToken ||
    req.header("x-admin-token") !== config.adminDiagnosticsToken
  ) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  res.status(200).json({
    ok: true,
    issuer: config.oauthIssuer,
    resource: config.publicMcpResource,
    sparkyMcpUrl: config.sparkyMcpUrl,
    hasSparkyMcpBearerToken: Boolean(config.sparkyMcpBearerToken),
  });
});

app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: config.publicMcpResource,
    authorization_servers: [config.oauthIssuer],
    scopes_supported: config.oauthScopes,
    resource_documentation: config.resourceDocumentationUrl,
    bearer_methods_supported: ["header"],
  });
});

app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json(oauthAuthorizationServerMetadata());
});

app.get("/oauth/authorize", handleAuthorize);
app.post("/oauth/authorize", handleAuthorizeApproval);
app.post("/oauth/token", handleToken);

app.all("/mcp", requireBridgeAccessToken, proxyMcpRequest);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.listen(config.port, config.host, () => {
  console.log(
    `SparkyFitness OAuth MCP bridge listening on http://${config.host}:${config.port}/mcp`,
  );
});
