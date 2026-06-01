import { config } from "../config.js";

export function oauthAuthorizationServerMetadata() {
  return {
    issuer: config.oauthIssuer,
    authorization_endpoint: `${config.oauthIssuer}/oauth/authorize`,
    token_endpoint: `${config.oauthIssuer}/oauth/token`,
    client_id_metadata_document_supported: true,
    token_endpoint_auth_methods_supported: ["none"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: config.oauthScopes,
  };
}
