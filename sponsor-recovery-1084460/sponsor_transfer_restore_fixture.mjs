// Local-only actual Native fixture, bundled against a frozen checkout.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ProjectRoom } from './room.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { AccessRequests } from '../server/access-requests.mjs';
import { linkWithProof } from '../tests/helpers/link-with-proof.mjs';
import { auditRecovery } from '../server/recovery.mjs';
import { exportNdjsonText } from '../server/room-export.mjs';
import { restoreProgress } from '../server/restore-admission.mjs';
import { listMcpOAuthAgents, validateMcpOAuthBinding } from '../server/mcp-oauth.mjs';
import { createOAuthProvider } from '../server/oauth-provider.mjs';

const resource = 'https://room.example/mcp', clientId = 'restore-sponsor-client', callback = 'https://client.example/callback', verifier = 'v'.repeat(43);
const hash = text => createHash('sha256').update(text).digest('hex');
const provider = s => createOAuthProvider({ db: s.db, clock: () => s.now(), isBindingActive: (id, binding) => !!validateMcpOAuthBinding(s, id, binding) });
const tables = ['access_requests', 'events', 'commands', 'identity_links', 'member_accounts', 'agent_connections', 'agent_connection_operations', 'credentials', 'oauth_provider_codes', 'oauth_provider_access_tokens', 'oauth_provider_refresh_tokens'];
function enumeration(s, f) {
  let hydrationError = null;
  try { s.room('commons'); } catch (error) { hydrationError = error.code ?? error.message; }
  return { defaultRecipientSeatListed: listMcpOAuthAgents(s, f.recipientAccountId, resource).some(c => c.binding.memberId === 'claude'), configuredRecipientSeatListed: listMcpOAuthAgents(s, f.recipientAccountId, resource, { preferredRoomId: 'commons', preferredMemberId: 'claude' }).some(c => c.binding.memberId === 'claude'), hydrationError };
}
function fingerprint(s) {
  return Object.fromEntries(tables.map(table => {
    const rows = s.db.prepare(`SELECT * FROM ${table}`).all().map(row => JSON.stringify(row)).sort();
    return [table, { rows: rows.length, sha256: hash(rows.join('\n')) }];
  }));
}
function security(s, f) {
  const p = provider(s);
  return {
    oldAccessDenied: p.verifyAccessToken(f.oldPair.accessToken, { resource }) === null,
    oldAccessRowStillUnrevoked: s.db.prepare('SELECT revoked FROM oauth_provider_access_tokens WHERE token_hash=?').get(hash(f.oldPair.accessToken)).revoked === 0,
    oldRefreshRowStillUnrevoked: s.db.prepare('SELECT revoked FROM oauth_provider_refresh_tokens WHERE token_hash=?').get(hash(f.oldPair.refreshToken)).revoked === 0,
    recipientAccessAllowed: p.verifyAccessToken(f.recipientPair.accessToken, { resource })?.binding.memberId === 'claude',
    unrelatedAccessAllowed: p.verifyAccessToken(f.unrelatedPair.accessToken, { resource })?.binding.memberId === f.unrelatedMemberId,
    managedCredentialRevoked: s.db.prepare('SELECT revoked FROM credentials WHERE hash=?').get(hash(f.managedKey)).revoked === 1,
    oldSponsorCannotSelectSeat: !listMcpOAuthAgents(s, f.sponsorAccountId, resource, { preferredRoomId: 'commons', preferredMemberId: 'claude' }).some(c => c.binding.memberId === 'claude'),
    recipientSelectsSameSeat: listMcpOAuthAgents(s, f.recipientAccountId, resource, { preferredRoomId: 'commons', preferredMemberId: 'claude' }).some(c => c.binding.memberId === 'claude'),
  };
}
export class SponsorRestoreRoom extends ProjectRoom {
  async fetch(request) {
    const path = new URL(request.url).pathname, s = this.store;
    if (path === '/__seed') {
      s.initialize(initialRoom('commons'), { representation: 'normalized-current-v1' });
      const owner = s.issueAccessKey('commons', 'owner'), ownerSession = s.createSession(owner);
      s.command(owner, 'commons', { id: 'add-recipient', type: 'member.added', data: { memberId: 'john', displayName: 'Recipient', kind: 'human', permissions: [] } });
      const identity = s.identities.create('Managed adoption seat'), proof = s.identities.mintLinkCode(identity.identityId, identity.secret, { roomId: 'commons' });
      // Managed room credentials use opaque keys; rak_ is a different API-key path.
      const managedKey = createHash('sha256').update('synthetic-managed-restore-key').digest('base64url');
      assert.match(managedKey, /^[A-Za-z0-9_-]{43}$/);
      s.agentConnections.apply(ownerSession.token, 'commons', { action: 'create', requestId: 'managed-seat-create', memberId: 'claude', displayName: 'Managed adoption seat', access: 'collaborate', expectedOwnerRevision: 0, expiresAt: s.now() + 3600000, keyHash: hash(managedKey), identityId: identity.identityId, identityLinkCode: proof.linkCode }, ownerSession.session.sessionBinding);
      assert.equal(s.authenticate(managedKey).member.id, 'claude');
      const unrelated = s.identities.create('Unrelated seat'); linkWithProof(s, owner, 'commons', unrelated, { permissions: ['accept_work'] });
      const sponsor = s.bindHumanAccount('commons', 'owner'), recipient = s.bindHumanAccount('commons', 'john');
      const slot = s.createAccountSessionSlot(), auth = s.loginAccountSession(slot.token, s.issueAccountAccessKey(recipient.id), 0);
      const p = provider(s); p.registerClient({ clientId, name: 'Local restore client', redirectUris: [callback] });
      const code = (accountId, memberId) => {
        const choice = listMcpOAuthAgents(s, accountId, resource, { preferredRoomId: 'commons', preferredMemberId: memberId }).find(c => c.binding.memberId === memberId);
        assert.ok(choice, 'Fixture account must select its existing seat');
        return p.issueCode({ clientId, userId: accountId, redirectUri: callback, scopes: ['chat:read'], codeChallenge: createHash('sha256').update(verifier).digest('base64url'), binding: choice.binding }).code;
      };
      const exchange = c => p.exchangeCode({ code: c, clientId, redirectUri: callback, codeVerifier: verifier, resource });
      const oldPair = exchange(code(sponsor.id, 'claude')), oldPendingCode = code(sponsor.id, 'claude'), unrelatedPair = exchange(code(sponsor.id, unrelated.identityId));
      assert.ok(p.verifyAccessToken(oldPair.accessToken, { resource }), 'Pre-transfer managed access must work'); assert.ok(p.verifyAccessToken(unrelatedPair.accessToken, { resource }), 'Unrelated access must work');
      const beforeMember = s.agentSponsorAuthority('commons', ['claude']).members.claude;
      const access = new AccessRequests(s); access.sponsorTransfers.request(slot.token, 'commons', { memberId: 'claude', requestId: 'restore-adoption' }, auth.sessionBinding);
      assert.equal(access.decide(owner, 'commons', 'restore-adoption', { decision: 'approve' }).status, 'approved');
      const recipientPair = exchange(code(recipient.id, 'claude'));
      const f = { owner, managedKey, oldPair, oldPendingCode, unrelatedPair, recipientPair, unrelatedMemberId: unrelated.identityId, sponsorAccountId: sponsor.id, recipientAccountId: recipient.id };
      const afterMember = s.agentSponsorAuthority('commons', ['claude']).members.claude;
      assert.equal(afterMember.identityId, beforeMember.identityId); assert.deepEqual(afterMember.permissions, beforeMember.permissions); assert.equal(afterMember.accountableHumanId, 'john');
      const safeSecurity = security(s, f); console.log('SPONSOR_SOURCE_SECURITY ' + JSON.stringify(safeSecurity));
      assert.ok(Object.values(safeSecurity).every(v => v === true), 'Source security observation failed'); auditRecovery(s);
      await this.ctx.storage.put('fixture', f);
      return Response.json({ seeded: true, approved: true, sourceAuditPassed: true });
    }
    if (path === '/__adopt-fixture') { await this.ctx.storage.put('fixture', await request.json()); return Response.json({ saved: true }); }
    const f = await this.ctx.storage.get('fixture');
    if (path === '/__export') return Response.json({ body: exportNdjsonText(s.db), fixture: f, tables: fingerprint(s), member: s.agentSponsorAuthority('commons', ['claude']).members.claude, security: security(s, f), enumeration: enumeration(s, f) });
    if (path === '/__frontier') {
      const state = restoreProgress(s.db), r = state.progress?.audit?.report;
      const frontier = r ? { stage: r.stage, table: r.tableIndex, after: r.rowAfter, source: r.source ? { row: r.source.rowid, column: r.source.column, phase: r.source.phase, offset: r.source.offset, blob: r.source.blobIndex, output: r.source.output.length, carry: r.source.carry } : null, sort: r.table } : state.progress;
      return Response.json({ sha256: hash(JSON.stringify(frontier)) });
    }
    if (path === '/__snapshot') { auditRecovery(s); return Response.json({ tables: fingerprint(s), member: s.agentSponsorAuthority('commons', ['claude']).members.claude, security: security(s, f), enumeration: enumeration(s, f), restore: restoreProgress(s.db), frozenGuards: s.db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'restore_frozen_*'").get().n }); }
    if (path === '/__exercise') {
      const p = provider(s), refusesGrant = fn => { try { fn(); } catch (error) { assert.equal(error.code, 'invalid_grant'); return true; } throw Error('Old grant unexpectedly accepted'); };
      assert.throws(() => s.authenticate(f.managedKey), e => e.status === 401);
      const oldRefreshRefused = refusesGrant(() => p.refresh({ refreshToken: f.oldPair.refreshToken, clientId, resource }));
      const oldCodeRefused = refusesGrant(() => p.exchangeCode({ code: f.oldPendingCode, clientId, redirectUri: callback, codeVerifier: verifier, resource }));
      const recipient = p.refresh({ refreshToken: f.recipientPair.refreshToken, clientId, resource }), unrelated = p.refresh({ refreshToken: f.unrelatedPair.refreshToken, clientId, resource });
      assert.equal(p.verifyAccessToken(recipient.accessToken, { resource }).binding.memberId, 'claude');
      assert.equal(p.verifyAccessToken(unrelated.accessToken, { resource }).binding.memberId, f.unrelatedMemberId);
      const head = s.headSequence('commons'); const decided = new AccessRequests(s).decide(f.owner, 'commons', 'restore-adoption', { decision: 'approve' }); assert.equal(decided.status, 'approved'); assert.equal(s.headSequence('commons'), head);
      auditRecovery(s);
      return Response.json({ oldManagedKeyRefused: true, oldRefreshRefused, oldCodeRefused, recipientRefreshWorks: true, unrelatedRefreshWorks: true, exactDecisionRetryAddsNoEvent: true, finalAuditPassed: true });
    }
    return super.fetch(request);
  }
}
export default { fetch(request, env) { const u = new URL(request.url), surface = u.searchParams.get('surface') ?? 'target'; assert.ok(['source', 'target'].includes(surface)); u.searchParams.delete('surface'); const headers = new Headers(request.headers); headers.set('Host', 'room.example'); headers.set('x-room-visitor-ip', '192.0.2.12'); return env.ROOM.getByName(surface).fetch(new Request(u, { method: request.method, headers, ...(!['GET', 'HEAD'].includes(request.method) ? { body: request.body } : {}) })); } };
