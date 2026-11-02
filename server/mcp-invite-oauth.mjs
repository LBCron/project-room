// Accountless native connection: invitation-capability principals live in
// separate OAuth tables. The provider's legacy userId slot is a grant id here,
// never a Room account or a synthetic human. Secrets remain hash-only.
import { createHash, randomBytes } from 'node:crypto';
import { createOAuthProvider } from './oauth-provider.mjs';
import { mcpInviteOAuthIdentityEpoch, validateMcpInviteOAuthBinding } from './mcp-oauth.mjs';
export const MCP_INVITE_RECOVERY = 'If this connection expired, was revoked, or its invitation was already confirmed, ask the Room sponsor for a fresh agent invitation and reconnect the plugin. A fresh invitation creates a new agent seat; it does not restore the previous seat or extend its 30-day grant.';
const hash = value => createHash('sha256').update(value).digest('hex');
const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rewrite = sql => sql.replaceAll('oauth_provider_', 'oauth_invite_');
export function inviteOAuthDatabase(db) {
  return { prepare: sql => db.prepare(rewrite(sql)), exec: sql => db.exec(rewrite(sql)) };
}
export function ensureMcpInviteOAuthSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS oauth_invite_grants (
    id TEXT PRIMARY KEY, room_id TEXT NOT NULL, identity_id TEXT NOT NULL,
    member_id TEXT NOT NULL, identity_epoch TEXT NOT NULL, invite_hash TEXT NOT NULL, sponsor_member_id TEXT NOT NULL,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS oauth_invite_pending (
    nonce_hash TEXT PRIMARY KEY, request_json TEXT NOT NULL,
    expires_at INTEGER NOT NULL, grant_id TEXT, approval_hash TEXT
  );`);
}
export function createMcpInviteOAuth({ store, clients, resource, issuer = new URL(resource).origin }) {
  const db = store.db;
  ensureMcpInviteOAuthSchema(db);
  const provider = createOAuthProvider({ db: inviteOAuthDatabase(db), tokenKind: 'invite', clock: () => store.now(),
    isBindingActive: (grantId, binding) => Boolean(validateMcpInviteOAuthBinding(store, grantId, binding)) });
  for (const client of clients) provider.registerClient(client);
  const requestFor = params => {
    const request = { clientId: params.get('client_id'), redirectUri: params.get('redirect_uri'),
      scopes: (params.get('scope') || '').split(' ').filter(Boolean), state: params.get('state') ?? undefined,
      codeChallenge: params.get('code_challenge') };
    provider.validateAuthorizationRequest(request);
    if (params.get('code_challenge_method') !== 'S256' || params.get('resource') !== resource)
      throw new Error('Use the advertised resource and PKCE S256');
    return request;
  };
  const begin = params => {
    const request = requestFor(params);
    const nonce = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM oauth_invite_pending WHERE nonce_hash IN (SELECT nonce_hash FROM oauth_invite_pending WHERE expires_at<=? LIMIT 100)').run(store.now());
    if (db.prepare('SELECT count(*) n FROM oauth_invite_pending').get().n >= 2000) throw new Error('Too many pending connections; try again later');
    db.prepare('INSERT INTO oauth_invite_pending(nonce_hash,request_json,expires_at) VALUES(?,?,?)')
      .run(hash(nonce), JSON.stringify(request), store.now() + 600000);
    return { nonce, request };
  };
  const read = nonce => {
    if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) throw new Error('Connection confirmation expired. Restart plugin connection. ' + MCP_INVITE_RECOVERY);
    const pending = db.prepare('SELECT * FROM oauth_invite_pending WHERE nonce_hash=?').get(hash(nonce));
    if (!pending || pending.expires_at <= store.now()) throw new Error('Connection confirmation expired. Restart plugin connection. ' + MCP_INVITE_RECOVERY);
    return { pending, request: JSON.parse(pending.request_json) };
  };
  const codeFrom = text => {
    if (typeof text !== 'string' || text.length > 2048) throw new Error('Paste an agent invitation link or RM code');
    const found = text.trim().match(/(?:^|[\/#=?&])(?:RM-[0-9A-Z]{16})(?=$|[\s&#/?])/i);
    const code = found ? found[0].replace(/^[\/#=?&]/, '') : text.trim();
    if (!/^RM-[0-9A-Z]{16}$/i.test(code)) throw new Error('Paste an agent invitation link or RM code');
    return code;
  };
  const preview = (nonce, input) => {
    const { request } = read(nonce);
    const code = codeFrom(input);
    const invitation = store.invites.preview(code);
    if (invitation.ownerEquivalent && !request.scopes.includes('members:admin')) throw new Error('This connection did not request membership administration (members:admin). Use a connection that requests it, or ask the sponsor for a Member invitation. This invitation has not been used.');
    return { code, invitation, request };
  };
  const approve = (nonce, input, displayName) => store.transaction(() => {
    const { pending, request } = read(nonce);
    if (typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 80) throw new Error('Choose an agent name');
    const approvalHash = hash(JSON.stringify([codeFrom(input).toUpperCase(), displayName.trim()]));
    let grant;
    if (pending.grant_id) {
      if (pending.approval_hash !== approvalHash) throw new Error('This connection was already confirmed with different settings');
      grant = db.prepare('SELECT * FROM oauth_invite_grants WHERE id=?').get(pending.grant_id);
    } else {
      const { code } = preview(nonce, input);
      const joined = store.invites.redeem(code, { displayName, requestId: `native-${hash(nonce)}` });
      const receipt = db.prepare('SELECT * FROM agent_invite_redeem_receipts WHERE request_id=?').get(`native-${hash(nonce)}`);
      const invite = db.prepare('SELECT created_by FROM agent_invite_codes WHERE code_hash=?').get(receipt.code_hash);
      const id = `oig_${randomBytes(24).toString('base64url')}`;
      db.prepare('INSERT INTO oauth_invite_grants(id,room_id,identity_id,member_id,identity_epoch,invite_hash,sponsor_member_id,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(id, joined.roomId, joined.identityId, joined.memberId, mcpInviteOAuthIdentityEpoch(store, joined.identityId, joined.roomId), receipt.code_hash, invite.created_by, store.now(), store.now() + 30 * 86400000);
      db.prepare('UPDATE oauth_invite_pending SET grant_id=?,approval_hash=? WHERE nonce_hash=?').run(id, approvalHash, hash(nonce));
      grant = db.prepare('SELECT * FROM oauth_invite_grants WHERE id=?').get(id);
    }
    const binding = { principalType: 'invited-agent', invitationGrantId: grant.id, resource,
      roomId: grant.room_id, identityId: grant.identity_id, memberId: grant.member_id,
      identityEpoch: grant.identity_epoch };
    const { code } = provider.issueCode({ ...request, userId: grant.id, binding, codeIdempotencyKey: nonce });
    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('iss', issuer);
    if (request.state) redirect.searchParams.set('state', request.state);
    return redirect.href;
  });
  const cancel = nonce => store.transaction(() => {
    const { pending, request } = read(nonce);
    if (pending.grant_id) throw new Error('This connection was already confirmed. Manage the connection in your host, or ask the sponsor to revoke its Room access. ' + MCP_INVITE_RECOVERY);
    db.prepare('DELETE FROM oauth_invite_pending WHERE nonce_hash=?').run(hash(nonce));
    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set('error', 'access_denied');
    redirect.searchParams.set('iss', issuer);
    redirect.searchParams.set('error_description', 'Connection cancelled; your invitation was not used.');
    if (request.state) redirect.searchParams.set('state', request.state);
    return redirect.href;
  });
  return { provider, begin, read, preview, approve, cancel };
}
export function inviteOAuthPage({ nonce, request, invitation = null, code = '', accountUrl, invitationChoice = false }) {
  const hidden = `<input type="hidden" name="nonce" value="${escape(nonce)}">`;
  const consent = invitation
    ? `<p>Room: <strong>${escape(invitation.roomTitle)}</strong></p><p>Invitation sponsor: ${escape(invitation.inviterDisplayName || 'Room member')}</p><p>Room access: ${escape(invitation.ownerEquivalent ? 'delegated administrator' : invitation.profile)}. Requested scopes: ${escape(request.scopes.join(', '))}.</p>${invitation.ownerEquivalent ? '<p>This grants the agent delegated room permissions and, with membership administration consent, tools to manage access requests and agent invitations. It does not transfer room ownership; owner-only settings remain with the owner.</p>' : ''}<p>The sponsor grants access inside this Room. Your ChatGPT tool permissions stay under your control. No Room human account is created or claimed. This Room connection lasts up to 30 days and can be revoked.</p><input type="hidden" name="invitation" value="${escape(code)}"><label>Agent name <input name="display_name" maxlength="80" value="My agent" required></label><button name="decision" value="allow">Connect this agent</button>`
    : '<label>Agent invitation link or RM code <input name="invitation" maxlength="2048" autocomplete="off" required></label><button name="decision" value="preview">Review invitation</button>';
  const account = accountUrl ? `<section aria-labelledby="reconnect-title"><h2 id="reconnect-title">Already connected before?</h2><p>Use your Room account to choose an existing agent and room.</p><a class="primary" data-account-reconnect href="${escape(accountUrl)}">Reconnect existing agent</a></section>` : '';
  const form = `<form id="invite-connection" method="post" action="/oauth/invite">${hidden}${consent}</form>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect to Project Room</title><style>body{font-family:system-ui,sans-serif;max-width:30rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a;line-height:1.5}h1{font-size:1.5rem}h2{font-size:1.1rem}section,details{margin:1.5rem 0}summary{cursor:pointer;font-weight:600}label{display:block;margin:1rem 0}input{display:block;box-sizing:border-box;width:100%;padding:.7rem;font:inherit}button,.primary{display:inline-block;padding:.7rem 1rem;margin:.5rem .3rem .5rem 0;border:1px solid #bbb;border-radius:.5rem;font:inherit}.primary{background:#065dcc;color:white;text-decoration:none}button{background:white;cursor:pointer}a:focus-visible,button:focus-visible,summary:focus-visible,input:focus-visible{outline:3px solid #1468ce;outline-offset:3px}</style></head><body><main><h1>${invitation?'Confirm new agent connection':'Connect to Project Room'}</h1><p>Continue only if you just started this connection in your agent.</p>${account}${invitation?`<p>This invitation creates a new agent seat. It does not reconnect a previous seat.</p>${form}`:`<details${invitationChoice||!accountUrl?' open':''}><summary>Join with an invitation</summary><p>No Project Room signup is required. Confirming creates a new agent seat; use your Room account above to reconnect an existing one.</p>${form}</details>`}<button form="invite-connection" name="decision" value="deny" formnovalidate>Cancel connection</button><p>You can cancel before confirming without using the invitation.</p></main></body></html>`;
}
