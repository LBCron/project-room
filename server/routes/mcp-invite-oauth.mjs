import { randomBytes } from "node:crypto";
import { ServiceError } from "../store.mjs";
import { inviteOAuthPage, MCP_INVITE_RECOVERY } from "../mcp-invite-oauth.mjs";

export function renderInviteOAuthPage(res, view, request) {
  res.setHeader("Cache-Control", "no-store");
  // Browser form POSTs need their same-origin Origin for strict CSRF checks.
  // no-referrer makes Chromium send Origin:null; external referrers stay hidden.
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", `default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' ${new URL(request.redirectUri).origin}`);
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  return res.end(inviteOAuthPage(view));
}
async function handleInviteConsent(ctx) {
  const { req, res, remoteAddress, inviteOAuth, rate, checkOrigin, readText, cookie, json } = ctx;
  if (!inviteOAuth) return json(res, 404, { error: "native_connection_unavailable" });
  rate(`oauth-invite-confirm:${remoteAddress}`, 30);
  checkOrigin(req, true);
  const text = await readText(req, 16384, () => new ServiceError(413, "too_large", "Request is too large"));
  const data = Object.fromEntries(new URLSearchParams(text));
  const nonce = typeof data.nonce === "string" && /^[A-Za-z0-9_-]{43}$/.test(data.nonce) ? data.nonce : null;
  const cookieNonce = nonce ? cookie(req, `oauth_invite_${nonce.slice(0, 16)}`) : null;
  if (!nonce || cookieNonce !== nonce) return json(res, 403, { error: "csrf_denied" });
  try {
    if (data.decision === "allow" || data.decision === "deny") {
      const redirect = data.decision === "deny" ? inviteOAuth.cancel(nonce) : inviteOAuth.approve(nonce, data.invitation, data.display_name);
      res.writeHead(302, { Location: redirect, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
      return res.end();
    }
    const viewed = inviteOAuth.preview(nonce, data.invitation);
    return renderInviteOAuthPage(res, { nonce, ...viewed }, viewed.request);
  } catch (error) { return json(res, 400, { error: "invitation_connection_failed", error_description: error.message, recovery: MCP_INVITE_RECOVERY }); }
}
export const MCP_INVITE_OAUTH_ROUTES = [{
  id: "mcp.invite.consent", method: "POST", path: "/oauth/invite", auth: "none",
  capability: null, events: [], scope: "worker", handler: handleInviteConsent,
  parity: "exempt:human native plugin consent; agent uses the resulting scoped OAuth grant",
  schema: { response: { type: "object" } },
}];

// Public client metadata registration shares the configured native OAuth
// callbacks. It never creates membership, sponsorship or a token grant.
async function handleMcpRegistration(ctx) {
  const {req,res,store,remoteAddress,rate,body,json,reject,oauthResource,mcpRedirects,oauthProvider,inviteOAuth}=ctx;
  if(!oauthResource)return reject(404,"not_found","Not found");
        rate(`oauth-register:${remoteAddress}`, 20);
        const data = await body(req);
        if (!Array.isArray(data.redirect_uris) || !data.redirect_uris.length || data.redirect_uris.length > 5
          || data.redirect_uris.some(uri => typeof uri !== "string" || !mcpRedirects.has(uri))
          || data.token_endpoint_auth_method && data.token_endpoint_auth_method !== "none"
          || data.grant_types && (!Array.isArray(data.grant_types) || data.grant_types.some(type => !["authorization_code", "refresh_token"].includes(type)))
          || data.response_types && (!Array.isArray(data.response_types) || data.response_types.some(type => type !== "code")))
          return json(res, 400, {error:"invalid_client_metadata"});
        if (store.db.prepare("SELECT count(*) n FROM (SELECT 1 FROM oauth_provider_clients LIMIT 1025)").get().n >= 1024)
          return json(res, 503, {error:"temporarily_unavailable"});
        const name = data.client_name ?? "MCP connector";
        if (typeof name !== "string" || !name.trim() || name.length > 80)
          return json(res, 400, {error:"invalid_client_metadata"});
        const clientId = "mcp_dcr_" + randomBytes(18).toString("base64url");
        const client = {clientId,name,redirectUris:[...new Set(data.redirect_uris)]};
        oauthProvider.registerClient(client);
        inviteOAuth?.provider.registerClient(client);
        res.setHeader("Cache-Control", "no-store");
        return json(res, 201, {client_id:clientId,client_name:name,redirect_uris:client.redirectUris,
          token_endpoint_auth_method:"none",grant_types:["authorization_code","refresh_token"],response_types:["code"]});
}
export const MCP_REGISTER_OAUTH_ROUTES = [{
  id: "mcp.oauth.register", method: "POST", path: "/oauth/register", auth: "none",
  capability: null, events: [], scope: "worker", handler: handleMcpRegistration,
  parity: "exempt:public OAuth client metadata registration; consent grants are separate",
  schema: { response: { type: "object" } },
}];
