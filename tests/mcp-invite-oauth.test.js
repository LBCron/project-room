// Exercises server/routes/mcp-invite-oauth.mjs through the normal Node boot and real consent HTTP requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { RoomStore } from '../server/store.mjs';
import { createMcpInviteOAuth } from '../server/mcp-invite-oauth.mjs';
import { solveIdentityMintProof } from '../server/agent-identities.mjs';
import { mcpOAuthPrincipalDescriptor, resolveMcpOAuthPrincipal, authorizeMcpOAuthDescriptor, listMcpOAuthAgents, validateMcpOAuthBinding } from '../server/mcp-oauth.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { createRoomServer } from '../server/http.mjs';
import { defaultServerArgs } from '../server/boot-options.mjs';
const CLIENT = { clientId: 'native-test', name: 'Native test agent', redirectUris: ['https://client.example/callback'] };
const origin = 'https://room.example', resource = origin + '/mcp';
const verifier = 'x'.repeat(43), challenge = createHash('sha256').update(verifier).digest('base64url');
const fetch = (url, options = {}) => new Promise((resolve, reject) => {
  const req = request(url, { method: options.method || 'GET', headers: { Host: 'room.example', ...options.headers } }, res => {
    const chunks = []; res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
  }); req.on('error', reject); req.end(options.body?.toString());
});
async function setup(t, { client = CLIENT, clients = [client] } = {}) {
  const store = new RoomStore(':memory:'); store.initialize(initialRoom());
  const owner = store.issueAccessKey('commons', 'owner');
  const invitation = store.invites.create(owner, 'commons', { profile: 'member' });
  const accountsBefore = store.db.prepare('SELECT count(*) n FROM accounts').get().n;
  const server = createRoomServer(defaultServerArgs({ store, origin, env: { ROOM_MCP_OAUTH_CLIENTS: JSON.stringify(clients) } }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const start = () => fetch(base + '/oauth/authorize?' + new URLSearchParams({ client_id: client.clientId, redirect_uri: client.redirectUris[0], scope: 'rooms:read chat:read chat:write work:read work:write', state: 'native-state', code_challenge: challenge, code_challenge_method: 'S256', resource, connection: 'invite' }));
  const initial = await start(); assert.equal(initial.status, 200);
  const html = await initial.text(); assert.match(html, /No Project Room signup/);
  const nonce = html.match(/name="nonce" value="([^"]+)"/)[1];
  const cookie = initial.headers.get('set-cookie').split(';')[0];
  const submit = (decision, extras = {}, selectedCookie = cookie) => fetch(base + '/oauth/invite', { method: 'POST', headers: { Cookie: selectedCookie, Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ nonce, decision, invitation: `https://room.example/#agent-invite/${invitation.code}`, display_name: 'Friend native agent', ...extras }) });
  const exchange = changes => fetch(base + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: client.clientId, redirect_uri: client.redirectUris[0], code_verifier: verifier, resource, ...changes }) });
  const rpc = async (token, name = 'room_check_access', args = {}) => {
    const response = await fetch(base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
    return { status: response.status, body: await response.json() };
  };
  return { store, owner, base, invitation, accountsBefore, start, submit, exchange, rpc };
}
test('invitation native OAuth needs no account, survives lost consent response without duplicate seats, and acts as the agent', async t => {
  const f = await setup(t);
  const metadata = await (await fetch(f.base + '/.well-known/oauth-authorization-server')).json();
  const protectedResource = await (await fetch(f.base + '/.well-known/oauth-protected-resource/mcp')).json();
  assert.equal(metadata.authorization_response_iss_parameter_supported, true);
  assert.equal(metadata.issuer, origin);
  assert.deepEqual(protectedResource.authorization_servers, [metadata.issuer]);
  const preview = await f.submit('preview'); assert.equal(preview.status, 200);
  assert.match(await preview.text(), /Invitation sponsor/);
  assert.equal(f.store.db.prepare('SELECT redeemed_at FROM agent_invite_codes').get().redeemed_at, null);
  const allowed = await f.submit('allow'); assert.equal(allowed.status, 302, await allowed.text());
  const location = allowed.headers.get('location'), code = new URL(location).searchParams.get('code');
  assert.match(code, /^iac_/);
  assert.equal(new URL(location).searchParams.get('state'), 'native-state');
  assert.equal(new URL(location).searchParams.get('iss'), origin);
  assert.equal((await f.submit('allow', { display_name: 'Different agent' })).status, 400);
  const retry = await f.submit('allow'); assert.equal(retry.status, 302); assert.equal(retry.headers.get('location'), location);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM agent_invite_redeem_receipts').get().n, 1);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM oauth_invite_grants').get().n, 1);
  const wrong = await f.exchange({ grant_type: 'authorization_code', code, resource: 'https://wrong.example/mcp' }); assert.equal(wrong.status, 400);
  const exchanged = await f.exchange({ grant_type: 'authorization_code', code }); assert.equal(exchanged.status, 200, await exchanged.clone().text());
  const tokens = await exchanged.json(); assert.match(tokens.access_token, /^iat_/);
  const stored = JSON.stringify(['oauth_invite_codes', 'oauth_invite_access_tokens', 'oauth_invite_refresh_tokens', 'oauth_invite_pending', 'oauth_invite_grants'].map(table => f.store.db.prepare(`SELECT * FROM ${table}`).all()));
  for (const secret of [f.invitation.code, code, tokens.access_token, tokens.refresh_token]) assert.ok(!stored.includes(secret));
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM accounts').get().n, f.accountsBefore);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM oauth_provider_access_tokens').get().n, 0);
  const restarted = createMcpInviteOAuth({ store: f.store, clients: [CLIENT], resource });
  const sponsorAccount = f.store.db.prepare("SELECT account_id FROM member_accounts WHERE room_id='commons' AND member_id='owner'").get().account_id;
  assert.equal(listMcpOAuthAgents(f.store, sponsorAccount, resource).length, 0, 'Room accountability is not agent controller proof');
  const invitedGrant = f.store.db.prepare('SELECT * FROM oauth_invite_grants').get();
  assert.equal(validateMcpOAuthBinding(f.store, sponsorAccount, { resource, roomId: 'commons', identityId: invitedGrant.identity_id, memberId: invitedGrant.member_id, humanMemberId: 'owner', identityEpoch: invitedGrant.identity_epoch }), null);
  const slot=f.store.createAccountSessionSlot();
  const sponsorSession=f.store.loginAccountSession(slot.token,f.store.issueAccountAccessKey(sponsorAccount),0);
  const beforeCodes=f.store.db.prepare('SELECT count(*) n FROM oauth_provider_codes').get().n;
  const forgedOwned={resource,roomId:'commons',identityId:invitedGrant.identity_id,memberId:invitedGrant.member_id,humanMemberId:'owner',identityEpoch:invitedGrant.identity_epoch,principalType:'account-owned-agent',accountEpoch:String(f.store.db.prepare('SELECT auth_epoch FROM accounts WHERE id=?').get(sponsorAccount).auth_epoch)};
  const takeover=await fetch(f.base+'/oauth/authorize',{method:'POST',headers:{Cookie:`__Host-account_session=${slot.token}`,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':sponsorSession.csrf},body:JSON.stringify({client_id:CLIENT.clientId,redirect_uri:CLIENT.redirectUris[0],scope:'rooms:read',code_challenge:challenge,code_challenge_method:'S256',resource,agent_binding:JSON.stringify(forgedOwned),decision:'allow'})});
  assert.equal(new URL(takeover.headers.get('location')).searchParams.get('error'),'access_denied','sponsoring an invitation does not authorize an account-owned-agent grant');
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM oauth_provider_codes').get().n,beforeCodes);
  const principal = resolveMcpOAuthPrincipal({ store: f.store, provider: restarted.provider, token: tokens.access_token, resource, roomId: 'commons' });
  assert.equal(principal.principalType, 'invited-agent');
  const descriptor = mcpOAuthPrincipalDescriptor(principal);
  assert.ok(authorizeMcpOAuthDescriptor({ store: f.store, inviteProvider: restarted.provider, resource, descriptor }));
  assert.equal(authorizeMcpOAuthDescriptor({ store: f.store, inviteProvider: restarted.provider, resource, descriptor: { ...descriptor, memberId: 'owner' } }), null);
  assert.ok(!JSON.stringify(descriptor).includes(tokens.access_token));
  const access = await f.rpc(tokens.access_token); assert.equal(access.status, 200); assert.equal(access.body.result?.structuredContent.scope, 'room');
  const posted = await f.rpc(tokens.access_token, 'room_post_message', { id: 'native-hi', body: 'My existing agent joined without creating a Room account.' });
  assert.equal(posted.body.error, undefined, JSON.stringify(posted.body)); assert.notEqual(posted.body.result?.isError, true, JSON.stringify(posted.body));
  assert.throws(() => f.store.authenticate(tokens.access_token, 'commons'), /outside its resource/);
  const after = await f.submit('allow'); assert.equal(after.status, 400); // consumed code never resurrected
  const refreshed = await f.exchange({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }); assert.equal(refreshed.status, 200);
  const next = await refreshed.json();
  const denied = await f.rpc(next.access_token, 'room_create_agent_invite', {}); assert.ok(denied.body.error || denied.body.result?.isError);
  const grant = f.store.db.prepare('SELECT * FROM oauth_invite_grants').get();
  const member = f.store.room('commons').state.members[grant.member_id];
  f.store.command(f.owner, 'commons', { id: 'remove-native', type: 'member.access_changed', data: { memberId: member.id, expectedMemberRevision: member.revision, active: false, permissions: member.permissions } });
  assert.equal((await f.rpc(next.access_token)).status, 401);
  assert.equal(authorizeMcpOAuthDescriptor({ store: f.store, inviteProvider: restarted.provider, resource, descriptor }), null);
  assert.equal((await f.exchange({ grant_type: 'refresh_token', refresh_token: next.refresh_token })).status, 400);
});
test('accountless consent refuses CSRF, expired/revoked invites and owner invites without consuming them', async t => {
  const f = await setup(t);
  assert.equal((await f.submit('allow', {}, '')).status, 403);
  const ownerInvite = f.store.invites.create(f.owner, 'commons', { ownerEquivalent: true });
  assert.equal((await f.submit('allow', { invitation: ownerInvite.code })).status, 400);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM agent_invite_redeem_receipts').get().n, 0);
  f.store.db.prepare('UPDATE agent_invite_codes SET revoked_at=?').run(Date.now());
  assert.equal((await f.submit('allow')).status, 400);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM oauth_invite_grants').get().n, 0);
});

for (const mutation of ['identity-revoked', 'identity-rotated', 'grant-expired', 'invite-revoked']) test(`accountless grant stops after ${mutation}`, async t => {
  const f = await setup(t);
  const allowed = await f.submit('allow');
  const code = new URL(allowed.headers.get('location')).searchParams.get('code');
  const exchanged = await f.exchange({ grant_type: 'authorization_code', code });
  const tokens = await exchanged.json();
  const grant = f.store.db.prepare('SELECT * FROM oauth_invite_grants').get();
  if (mutation === 'identity-revoked') f.store.db.prepare('UPDATE agent_identities SET revoked_at=? WHERE identity_id=?').run(Date.now(), grant.identity_id);
  if (mutation === 'identity-rotated') f.store.db.prepare('UPDATE agent_identities SET secret_hash=? WHERE identity_id=?').run('changed-verifier', grant.identity_id);
  if (mutation === 'grant-expired') f.store.db.prepare('UPDATE oauth_invite_grants SET expires_at=0').run();
  if (mutation === 'invite-revoked') f.store.db.prepare('UPDATE agent_invite_codes SET revoked_at=?').run(Date.now());
  assert.equal((await f.rpc(tokens.access_token)).status, 401);
  const rejected = await f.exchange({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).recovery, /fresh agent invitation/);
});

test('accountless native agent discovers work, submits, revises and reads exact independent approval', async t => {
  const f = await setup(t);
  const allowed = await f.submit('allow');
  const code = new URL(allowed.headers.get('location')).searchParams.get('code');
  const tokens = await (await f.exchange({ grant_type: 'authorization_code', code })).json();
  const call = async (name, args = {}) => {
    const reply = await f.rpc(tokens.access_token, name, args);
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    assert.equal(reply.body.error, undefined, JSON.stringify(reply.body));
    assert.notEqual(reply.body.result?.isError, true, JSON.stringify(reply.body));
    return reply.body.result.structuredContent;
  };
  const { memberId } = await call('room_check_access');
  // The producer, verifier and human decision-maker occupy distinct seats.
  f.store.command(f.owner, 'commons', { id: 'native-reviewer-seat', type: 'member.added',
    data: { memberId: 'native-reviewer', displayName: 'Independent reviewer', kind: 'agent', permissions: ['verify'] } });
  const reviewer = f.store.issueAccessKey('commons', 'native-reviewer');
  f.store.command(f.owner, 'commons', { id: 'first-native-task', type: 'work.proposed', data: {
    workItemId: 'native-first-task', title: 'Suggest a useful first step',
    definitionOfDone: 'One concrete step and why it helps', accountableMemberId: memberId,
    mode: 'read', verifierMemberId: 'native-reviewer', independentVerificationRequired: true,
    ownerDecisionRequired: true, humanDecisionMakerId: 'owner',
  } });
  const discovered = await call('room_list_work', { focus: 'needs_me' });
  assert.ok(discovered.work.some(work => work.id === 'native-first-task'));
  const selected = await call('room_read_work', { workItemId: 'native-first-task' });
  assert.equal(selected.next.action, 'accept');
  assert.equal(selected.next.addressedToViewer, true);
  const accepted = await call('room_accept_work', { workItemId: 'native-first-task' });
  const started = await call('room_start_work', { workItemId: 'native-first-task' });
  const blockInput = { workItemId: 'native-first-task', reason: 'Need a clearer test scope', nextAction: 'Keep it to one read task' };
  const blocked = await call('room_block_work', blockInput);
  const resolveInput = { workItemId: 'native-first-task', resolution: 'One bounded read task is sufficient' };
  const resolved = await call('room_resolve_blocker', resolveInput);
  await call('room_start_work', { workItemId: 'native-first-task', requestId: 'native-after-scope-start' });
  const body = 'Start by checking the shared brief and propose a bounded task with a named reviewer.';
  const receipt = await call('room_post_message', { id: 'native-first-result', body, workItemId: 'native-first-task' });
  const preview = await call('room_read_result', { workItemId: 'native-first-task', draftMessageId: 'native-first-result' });
  const evidence = preview.result.text;
  assert.equal(evidence.postedById, memberId);
  assert.equal(evidence.body, body);
  assert.equal(evidence.messageEventId, receipt.event.id);
  assert.match(evidence.evidenceVersion, /^sha256:[0-9a-f]{64}$/);
  await call('room_submit_text_result', { workItemId: 'native-first-task', summary: 'Suggested first step',
    nextAction: 'Review the proposed step', evidenceMessageId: evidence.messageId, evidenceMessageEventId: evidence.messageEventId,
    evidenceVersion: evidence.evidenceVersion,
    previousCompletionEventId: preview.current.completionEventId, producerId: memberId,
  });
  assert.equal(f.store.room('commons').state.workItems['native-first-task'].state, 'completed');
  const workItemId = 'native-first-task';
  const read = () => call('room_read_work', { workItemId });
  const ownerCommand = async (type, data, credential = f.owner) => {
    const response = await fetch(f.base + '/api/rooms/commons/commands', { method: 'POST',
      headers: { Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: crypto.randomUUID(), type, data }) });
    assert.equal(response.status, 201, await response.clone().text());
    return response.json();
  };
  const review = async (result, exact, summary) => {
    const response = await fetch(f.base + '/api/rooms/commons/work-result?' + new URLSearchParams({
      workItemId, completionEventId: exact.result.receipt.eventId,
    }), { headers: { Authorization: 'Bearer ' + reviewer } });
    assert.equal(response.status, 200);
    const inspected = await response.json();
    assert.equal(inspected.result.text.body, exact.result.text.body);
    return ownerCommand('verification.recorded', {
      workItemId, expectedRevision: (await read()).work.revision, result,
      completionEventId: inspected.result.receipt.eventId, evidenceVersion: inspected.result.text.evidenceVersion,
      summary, nextAction: 'Add a reconnect check',
    }, reviewer);
  };
  const first = await call('room_read_result', { workItemId });
  assert.equal((await read()).next.action, 'verify');
  assert.equal((await read()).next.memberId, 'native-reviewer');
  const selfReview = await f.rpc(tokens.access_token, 'room_record_verification', {
    workItemId, result: 'pass', completionEventId: first.result.receipt.eventId,
    evidenceVersion: first.result.text.evidenceVersion, summary: 'Self approval must be refused',
  });
  assert.ok(selfReview.body.error || selfReview.body.result?.isError);
  await review('fail', first, 'Missing a concrete reconnect check');
  assert.ok((await call('room_list_work', { focus: 'needs_me' })).work.some(work => work.id === workItemId));
  assert.equal((await read()).work.state, 'blocked');
  await call('room_resolve_blocker', { workItemId, resolution: 'Will add reconnect and duplicate-result checks' });
  await call('room_start_work', { workItemId, requestId: 'native-rework-start', expectedRevision: (await read()).work.revision });
  const revisedBody = 'Reconnect the existing agent, ask it for one task result, and verify exactly one result appears.';
  await call('room_post_message', { id: 'native-revised-result', workItemId, body: revisedBody });
  const revised = await call('room_read_result', { workItemId, draftMessageId: 'native-revised-result' });
  const text = revised.result.text;
  const revisedSubmission = { requestId: 'native-revised-submit', workItemId,
    summary: 'Added reconnect check', nextAction: 'Review revised text', producerId: memberId,
    evidenceMessageId: text.messageId, evidenceMessageEventId: text.messageEventId,
    evidenceVersion: text.evidenceVersion, previousCompletionEventId: revised.current.completionEventId };
  await call('room_submit_text_result', revisedSubmission);
  const second = await call('room_read_result', { workItemId });
  assert.notEqual(second.result.receipt.eventId, first.result.receipt.eventId);
  assert.equal(second.result.text.body, revisedBody);
  await review('pass', first, 'Historical first-version check cannot approve revised evidence');
  assert.equal((await read()).work.verification, null);
  await review('pass', second, 'Revised result contains a bounded reconnect check');
  assert.equal((await read()).next.action, 'decide');
  assert.equal((await read()).work.decision, null);
  const rationale = await ownerCommand('message.posted', { messageId: 'native-owner-rationale', body: 'Exact revised result accepted.' });
  await ownerCommand('owner.decision_recorded', { workItemId, expectedRevision: (await read()).work.revision,
    decision: 'approved', completionEventId: second.result.receipt.eventId,
    evidenceVersion: second.result.text.evidenceVersion, reason: 'Exact revised result accepted.',
    sourceMessageId: rationale.event.data.messageId });
  const duplicate = await call('room_submit_text_result', revisedSubmission);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.eventId, second.result.receipt.eventId);
  assert.equal(duplicate.currentStateVerified, false);
  for (const [name, original] of [['room_accept_work', accepted], ['room_start_work', started]]) {
    const replay = await call(name, { workItemId });
    assert.equal(replay.duplicate, true);
    assert.equal(replay.eventId, original.eventId);
  }
  for (const [name, args, original] of [['room_block_work', blockInput, blocked], ['room_resolve_blocker', resolveInput, resolved]]) {
    const replay = await call(name, args);
    assert.equal(replay.duplicate, true);
    assert.equal(replay.eventId, original.eventId);
  }
  const changed = await f.rpc(tokens.access_token, 'room_submit_text_result', { ...revisedSubmission, summary: 'Changed retry content' });
  assert.equal(changed.body.result.structuredContent.code, 'idempotency_conflict');
  const explicitRevision = await f.rpc(tokens.access_token, 'room_submit_text_result', { ...revisedSubmission, expectedRevision: (await read()).work.revision });
  assert.equal(explicitRevision.body.result.structuredContent.code, 'idempotency_conflict');
  const approved = await read();
  assert.equal(approved.work.verification.independenceConfirmed, true);
  assert.equal(approved.work.decision.decision, 'approved');
  assert.equal(approved.work.decision.completionEventId, second.result.receipt.eventId);
  assert.equal((await call('room_read_result', { workItemId, completionEventId: first.result.receipt.eventId })).result.text.body, body);

  const unknown = await f.rpc(tokens.access_token, 'room_post_message', { id: 'native-unknown-task', body: 'Do not save', workItemId: 'missing-task' });
  assert.ok(unknown.body.error || unknown.body.result?.isError, 'existing store validation rejects an unknown task');
  assert.equal(f.store.room('commons').state.messages.some(message => message.id === 'native-unknown-task'), false);
  const malformed = await f.rpc(tokens.access_token, 'room_post_message', { body: 'Do not save', workItemId: '../other-room' });
  assert.equal(malformed.body.error?.code, -32602);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM accounts').get().n, f.accountsBefore);
  f.store.db.prepare('UPDATE agent_invite_codes SET revoked_at=?').run(Date.now());
  assert.equal((await f.rpc(tokens.access_token, 'room_submit_text_result', revisedSubmission)).status, 401,
    'a saved receipt does not bypass current OAuth revocation');
});

test('native consent cancellation is CSRF-bound, preserves the invitation and returns no credentials', async t => {
  const f = await setup(t);
  assert.equal((await f.submit('deny', {}, '')).status, 403);
  const cancelled = await f.submit('deny'); assert.equal(cancelled.status, 302);
  const redirect = new URL(cancelled.headers.get('location'));
  assert.equal(redirect.origin, 'https://client.example');
  assert.equal(redirect.searchParams.get('error'), 'access_denied');
  assert.equal(redirect.searchParams.get('iss'), origin);
  assert.equal(redirect.searchParams.get('state'), 'native-state');
  assert.equal(redirect.searchParams.has('code'), false);
  assert.equal(f.store.db.prepare('SELECT redeemed_at FROM agent_invite_codes').get().redeemed_at, null);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM oauth_invite_grants').get().n, 0);
  const retry = await f.submit('allow'); assert.equal(retry.status, 400);
  assert.match((await retry.json()).error_description, /Restart plugin connection/);
});

test('expired or already-confirmed consent gives actionable recovery without making another seat', async t => {
  const f = await setup(t);
  assert.equal((await f.submit('allow')).status, 302);
  const cancelled = await f.submit('deny'); assert.equal(cancelled.status, 400);
  assert.match((await cancelled.json()).error_description, /already confirmed/);
  f.store.db.prepare('UPDATE oauth_invite_pending SET expires_at=0').run();
  const expired = await f.submit('allow'); assert.equal(expired.status, 400);
  const error = await expired.json();
  assert.match(error.error_description, /fresh agent invitation/);
  assert.match(error.recovery, /new agent seat/);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM oauth_invite_grants').get().n, 1);
});

test('hosted portable public client preserves the existing client and separates two friend consents', async t => {
  const config = JSON.parse(readFileSync(new URL('../cloudflare/wrangler.jsonc', import.meta.url), 'utf8'));
  const clients = JSON.parse(config.env.production.vars.ROOM_MCP_OAUTH_CLIENTS);
  const legacy = clients.find(c => c.clientId === 'project-room-chatgpt');
  assert.deepEqual(legacy.redirectUris, ['https://chatgpt.com/connector/oauth/f2CkgruSTvvC']);
  const client = clients.find(c => c.clientId === 'project-room-chatgpt-portable');
  assert.deepEqual(client.redirectUris, ['https://chatgpt.com/connector_platform_oauth_redirect']);
  const packaged = JSON.parse(readFileSync(new URL('../examples/integrations/chatgpt-dot/hosted-mcp.json', import.meta.url), 'utf8')).mcpServers['project-room'];
  assert.equal(packaged.url, config.env.production.vars.ROOM_ORIGIN + '/mcp');
  assert.equal(packaged.extensions['com.openai'].auth.resource, packaged.url);
  assert.deepEqual(packaged.extensions['com.openai'].auth.client, { mode: 'provided', clientId: client.clientId, tokenEndpointAuthMethod: 'none' });
  const f = await setup(t, { client, clients });
  const first = await f.submit('allow');
  const firstRedirect = new URL(first.headers.get('location'));
  assert.equal(firstRedirect.origin + firstRedirect.pathname, client.redirectUris[0]);
  assert.equal(firstRedirect.searchParams.get('iss'), origin);
  const firstTokens = await (await f.exchange({ grant_type: 'authorization_code', code: firstRedirect.searchParams.get('code') })).json();
  const secondInvite = f.store.invites.create(f.owner, 'commons', { profile: 'member' });
  const secondStart = await f.start();
  const nonce = (await secondStart.text()).match(/name="nonce" value="([^"]+)"/)[1];
  const cookie = secondStart.headers.get('set-cookie').split(';')[0];
  const second = await f.submit('allow', { nonce, invitation: secondInvite.code, display_name: 'Second friend' }, cookie);
  assert.equal(second.status, 302);
  const secondCode = new URL(second.headers.get('location')).searchParams.get('code');
  assert.notEqual(secondCode, firstRedirect.searchParams.get('code'));
  const secondTokens = await (await f.exchange({ grant_type: 'authorization_code', code: secondCode })).json();
  const firstAccess = await f.rpc(firstTokens.access_token), secondAccess = await f.rpc(secondTokens.access_token);
  assert.notEqual(firstAccess.body.result.structuredContent.memberId, secondAccess.body.result.structuredContent.memberId);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM accounts').get().n, f.accountsBefore);
  for (const [registered, expected] of [[legacy, 200], [{ ...client, redirectUris: ['https://evil.example/callback'] }, 400]]) {
    const response = await fetch(f.base + '/oauth/authorize?' + new URLSearchParams({ client_id: registered.clientId, redirect_uri: registered.redirectUris[0], scope: 'rooms:read', code_challenge: challenge, code_challenge_method: 'S256', resource }));
    assert.equal(response.status, expected);
    assert.equal(response.headers.get('location'), null);
  }
});

// Claude custom connectors (claude.com/docs/connectors/building/authentication):
// hosted Claude surfaces send exactly https://claude.ai/api/mcp/auth_callback,
// and Claude accepts a user-entered client ID with no secret as a public client.
test('hosted Claude public client retains explicit invitation consent at the published callback', async t => {
  const config = JSON.parse(readFileSync(new URL('../cloudflare/wrangler.jsonc', import.meta.url), 'utf8'));
  const clients = JSON.parse(config.env.production.vars.ROOM_MCP_OAUTH_CLIENTS);
  const client = clients.find(c => c.clientId === 'project-room-claude');
  assert.ok(client, 'production registers project-room-claude');
  assert.deepEqual(client.redirectUris, ['https://claude.ai/api/mcp/auth_callback']);
  assert.ok(clients.find(c => c.clientId === 'project-room-chatgpt'), 'existing ChatGPT client is kept');
  const f = await setup(t, { client, clients });
  for (const changes of [
    { redirect_uri: 'https://example.invalid/callback' },
    { code_challenge_method: 'plain' },
    { resource: 'https://example.invalid/mcp' },
  ]) {
    const response = await fetch(f.base + '/oauth/authorize?' + new URLSearchParams({
      client_id: client.clientId, redirect_uri: client.redirectUris[0], scope: 'rooms:read',
      code_challenge: challenge, code_challenge_method: 'S256', resource, connection: 'invite', ...changes,
    }));
    assert.equal(response.status, 400, JSON.stringify(changes));
    assert.equal(response.headers.get('location'), null, 'invalid authorization must not redirect to an untrusted callback');
  }
  const allowed = await f.submit('allow');
  assert.ok([302, 303].includes(allowed.status), 'Claude rejects 307; the authorization response must be 302 or 303');
  const redirect = new URL(allowed.headers.get('location'));
  assert.equal(redirect.origin + redirect.pathname, 'https://claude.ai/api/mcp/auth_callback');
  assert.equal(redirect.searchParams.get('iss'), origin);
  const tokens = await (await f.exchange({ grant_type: 'authorization_code', code: redirect.searchParams.get('code') })).json();
  assert.equal(typeof tokens.access_token, 'string');
});

test('public lobby native OAuth connects a guest without an invitation and fences removal', async t => {
  const f = await setup(t);
  const room = 'project-room-lobby';
  f.store.initialize(initialRoom(room),{representation:'normalized-current-v1'});
  const owner = f.store.issueAccessKey(room, 'owner');
  f.store.command(owner, room, { id:'publish-lobby', type:'room.public_page_set', data:{enabled:true} });
  f.store.command(owner, room, { id:'open-lobby', type:'room.join_link_set', data:{enabled:true} });
  f.store.publicFace.enable(room, 'owner');
  const accountsBefore = f.store.db.prepare('SELECT count(*) n FROM accounts').get().n;
  const start = await f.start();
  const html = await start.text();
  assert.match(html, /Join the public lobby/);
  const nonce = html.match(/name="nonce" value="([^"]+)"/)[1];
  const cookie = start.headers.get('set-cookie').split(';')[0];
  const submit = (name='Lobby agent') => fetch(f.base + '/oauth/invite', {method:'POST', headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({nonce,decision:'allow_public',display_name:name})});
  f.store.room=()=>{throw Error('whole room hydration forbidden during lobby connection');};
  const allowed = await submit(); assert.equal(allowed.status,302,await allowed.clone().text());
  assert.equal((await submit()).headers.get('location'),allowed.headers.get('location'));
  assert.equal((await submit('Other name')).status,400);
  const code = new URL(allowed.headers.get('location')).searchParams.get('code');
  const token = await f.exchange({grant_type:'authorization_code',code}); assert.equal(token.status,200,await token.clone().text());
  const tokens = await token.json();
  const grant = f.store.db.prepare('SELECT * FROM oauth_invite_grants').get();
  assert.equal(grant.room_id,room); assert.equal(grant.invite_hash,'public-lobby-guest-v1');
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM accounts').get().n,accountsBefore);
  const access = await f.rpc(tokens.access_token); assert.equal(access.status,200,JSON.stringify(access.body));
  const denied = await f.rpc(tokens.access_token,'room_create_agent_invite',{}); assert.ok(denied.body.error || denied.body.result?.isError);
  const refreshed=await f.exchange({grant_type:'refresh_token',refresh_token:tokens.refresh_token});
  assert.equal(refreshed.status,200,await refreshed.clone().text());
  const refreshedTokens=await refreshed.json();
  assert.equal((await f.rpc(refreshedTokens.access_token)).status,200);
  const member = f.store.roomAuthority(room,{memberId:grant.member_id}).members[grant.member_id];
  f.store.command(owner, room, { id:'remove-lobby-agent', type:'member.access_changed', data:{memberId:member.id,expectedMemberRevision:member.revision,active:false,permissions:member.permissions} });
  assert.equal((await f.rpc(refreshedTokens.access_token)).status,401);
  assert.equal((await f.exchange({grant_type:'refresh_token',refresh_token:refreshedTokens.refresh_token})).status,400);
});

test('public lobby consent requires current publication, open join and CSRF, with no partial identity', async t => {
  const f=await setup(t), room='project-room-lobby';
  f.store.initialize(initialRoom(room),{representation:'normalized-current-v1'});
  const owner=f.store.issueAccessKey(room,'owner');
  f.store.command(owner,room,{id:'publish',type:'room.public_page_set',data:{enabled:true}});
  f.store.command(owner,room,{id:'open',type:'room.join_link_set',data:{enabled:true}});
  f.store.publicFace.enable(room,'owner');
  const start=await f.start(), html=await start.text(), nonce=html.match(/name="nonce" value="([^"]+)"/)[1], cookie=start.headers.get('set-cookie').split(';')[0];
  const submit=(selectedCookie=cookie) => fetch(f.base+'/oauth/invite',{method:'POST',headers:{Cookie:selectedCookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({nonce,decision:'allow_public',display_name:'Open guest'})});
  const before=f.store.db.prepare('SELECT count(*) n FROM agent_identities').get().n;
  assert.equal((await submit('')).status,403);
  f.store.command(owner,room,{id:'close',type:'room.join_link_set',data:{enabled:false}});
  assert.equal((await submit()).status,400);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM agent_identities').get().n,before);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM oauth_invite_grants').get().n,0);
  f.store.command(owner,room,{id:'reopen',type:'room.join_link_set',data:{enabled:true}});
  f.store.publicFace.disable(room,'owner');
  assert.equal((await submit()).status,400);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM agent_identities').get().n,before);
});

test('public lobby consent keeps anonymous mint proof and supports a browser challenge', async t => {
  const f=await setup(t), room='project-room-lobby';
  f.store.initialize(initialRoom(room),{representation:'normalized-current-v1'}); const owner=f.store.issueAccessKey(room,'owner');
  f.store.command(owner,room,{id:'publish',type:'room.public_page_set',data:{enabled:true}});
  f.store.command(owner,room,{id:'open',type:'room.join_link_set',data:{enabled:true}});
  f.store.publicFace.enable(room,'owner');
  f.store.identities.proofFreePerAddress=0;
  const start=await f.start(),html=await start.text(),nonce=html.match(/name="nonce" value="([^"]+)"/)[1],cookie=start.headers.get('set-cookie').split(';')[0];
  const submit=proof=>fetch(f.base+'/oauth/invite',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({nonce,decision:'allow_public',display_name:'Proof agent',...(proof?{proof}:{})})});
  const challenge=await submit(); assert.equal(challenge.status,200); assert.match(challenge.headers.get('content-security-policy'),/script-src 'sha256-/);
  assert.match(await challenge.text(),/Verifying your connection/);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM oauth_invite_grants').get().n,0);
  const proof=solveIdentityMintProof('Proof agent',f.store.now(),f.store.identities.powBits);
  assert.equal((await submit(proof)).status,302);
});

for (const mutation of ['identity-revoked', 'identity-rotated', 'grant-expired', 'grant-revoked']) test(`public guest OAuth stops after ${mutation}`, async t => {
  const f=await setup(t), room='project-room-lobby';
  f.store.initialize(initialRoom(room),{representation:'normalized-current-v1'}); const owner=f.store.issueAccessKey(room,'owner');
  f.store.command(owner,room,{id:'publish',type:'room.public_page_set',data:{enabled:true}});
  f.store.command(owner,room,{id:'open',type:'room.join_link_set',data:{enabled:true}});
  f.store.publicFace.enable(room,'owner');
  const start=await f.start(),html=await start.text(),nonce=html.match(/name="nonce" value="([^"]+)"/)[1],cookie=start.headers.get('set-cookie').split(';')[0];
  const submit=()=>fetch(f.base+'/oauth/invite',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({nonce,decision:'allow_public',display_name:'Fence agent'})});
  const allowed=await submit(); assert.equal(allowed.status,302,await allowed.clone().text());
  const code=new URL(allowed.headers.get('location')).searchParams.get('code');
  const exchanged=await f.exchange({grant_type:'authorization_code',code}); assert.equal(exchanged.status,200);
  const tokens=await exchanged.json(),grant=f.store.db.prepare('SELECT * FROM oauth_invite_grants').get();
  if(mutation==='identity-revoked') f.store.db.prepare('UPDATE agent_identities SET revoked_at=? WHERE identity_id=?').run(Date.now(),grant.identity_id);
  if(mutation==='identity-rotated') f.store.db.prepare('UPDATE agent_identities SET secret_hash=? WHERE identity_id=?').run('changed-verifier',grant.identity_id);
  if(mutation==='grant-expired') f.store.db.prepare('UPDATE oauth_invite_grants SET expires_at=? WHERE id=?').run(f.store.now()-1,grant.id);
  if(mutation==='grant-revoked') f.store.db.prepare('UPDATE oauth_invite_grants SET revoked_at=? WHERE id=?').run(Date.now(),grant.id);
  assert.equal((await f.rpc(tokens.access_token)).status,401);
  assert.equal((await f.exchange({grant_type:'refresh_token',refresh_token:tokens.refresh_token})).status,400);
  assert.equal((await submit()).status,400);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM oauth_invite_grants').get().n,1);
});

test('active public guest refresh keeps the same seat beyond thirty days', async t=>{
  const f=await setup(t),room='project-room-lobby';
  f.store.initialize(initialRoom(room),{representation:'normalized-current-v1'});
  const owner=f.store.issueAccessKey(room,'owner');
  f.store.command(owner,room,{id:'publish',type:'room.public_page_set',data:{enabled:true}});
  f.store.command(owner,room,{id:'open',type:'room.join_link_set',data:{enabled:true}});
  f.store.publicFace.enable(room,'owner');
  const initial=await f.start(),html=await initial.text(),nonce=html.match(/name="nonce" value="([^"]+)"/)[1],cookie=initial.headers.get('set-cookie').split(';')[0];
  const allowed=await fetch(f.base+'/oauth/invite',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({nonce,decision:'allow_public',display_name:'Long running guest'})});
  assert.equal(allowed.status,302,await allowed.clone().text());
  const code=new URL(allowed.headers.get('location')).searchParams.get('code');
  let tokens=await (await f.exchange({grant_type:'authorization_code',code})).json();
  const grant=f.store.db.prepare('SELECT * FROM oauth_invite_grants').get(),start=f.store.now();
  for(const day of [29,31,59]){
    f.store.now=()=>start+day*86400000;
    const response=await f.exchange({grant_type:'refresh_token',refresh_token:tokens.refresh_token});
    assert.equal(response.status,200,await response.clone().text());tokens=await response.json();
    const access=await f.rpc(tokens.access_token);assert.equal(access.status,200,JSON.stringify(access.body));
    assert.equal(access.body.result.structuredContent.memberId,grant.member_id);
  }
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM oauth_invite_grants').get().n,1);
});

test('independent review: public OAuth stays room-scoped and respects guest history', async t => {
 const f=await setup(t),room='project-room-lobby';
 f.store.initialize(initialRoom(room),{representation:'normalized-current-v1'});const owner=f.store.issueAccessKey(room,'owner');
 f.store.command(owner,room,{id:'review-publish',type:'room.public_page_set',data:{enabled:true}});
 f.store.command(owner,room,{id:'review-open',type:'room.join_link_set',data:{enabled:true}});
 f.store.publicFace.enable(room,'owner');
 f.store.command(owner,room,{id:'review-before',type:'message.posted',data:{messageId:'review-before',body:'private pre-join review sentinel'}});
 const initial=await f.start(),html=await initial.text(),nonce=html.match(/name="nonce" value="([^"]+)"/)[1],cookie=initial.headers.get('set-cookie').split(';')[0];
 const allowed=await fetch(f.base+'/oauth/invite',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({nonce,decision:'allow_public',display_name:'Independent Review Guest'})});
 assert.equal(allowed.status,302,await allowed.clone().text());const code=new URL(allowed.headers.get('location')).searchParams.get('code');const exchange=await f.exchange({grant_type:'authorization_code',code});assert.equal(exchange.status,200);const token=(await exchange.json()).access_token;
 f.store.command(owner,room,{id:'review-after',type:'message.posted',data:{messageId:'review-after',body:'visible after join sentinel'}});
 const messages=await f.rpc(token,'room_read_messages',{after:0});assert.equal(messages.status,200);assert.doesNotMatch(JSON.stringify(messages.body),/private pre-join review sentinel/);assert.match(JSON.stringify(messages.body),/visible after join sentinel/);
 const cross=await f.rpc(token,'room_check_access',{roomId:'commons'});assert.ok(cross.status===401||cross.body.error||cross.body.result?.isError);
 const invite=await f.rpc(token,'room_create_agent_invite',{});assert.ok(invite.body.error||invite.body.result?.isError);
 f.store.command(owner,room,{id:'independent-current-task',type:'work.proposed',data:{workItemId:'independent-current-task',title:'Review one public setup step',definitionOfDone:'One specific improvement',accountableMemberId:'owner',mode:'read'}});
 for(let i=0;i<6;i++)f.store.command(owner,room,{id:'guest-page-'+i,type:'work.proposed',data:{workItemId:'guest-page-'+i,title:'Follow-up '+i,definitionOfDone:'A short answer',accountableMemberId:'owner',mode:'read'}});
 let pointer={focus:'all',limit:2},ids=[];for(let i=0;i<10;i++){const res=await f.rpc(token,'room_list_work',pointer);assert.ok(!res.body.error&&!res.body.result?.isError,JSON.stringify(res.body));const page=res.body.result.structuredContent;ids.push(...page.work.map(w=>w.id));if(!page.page.nextRead)break;pointer=page.page.nextRead.arguments;}assert.equal(ids.length,7);assert.equal(new Set(ids).size,7);assert.ok(ids.includes('independent-current-task'));
 const all=await f.rpc(token,'room_list_work',{focus:'all'});assert.equal(all.status,200,JSON.stringify(all.body));assert.ok(!all.body.error&&!all.body.result?.isError,JSON.stringify(all.body));assert.ok(all.body.result.structuredContent.page.nextRead,JSON.stringify(all.body));
 const detail=await f.rpc(token,'room_read_work',{workItemId:'independent-current-task'});assert.equal(detail.status,200,JSON.stringify(detail.body));assert.ok(!detail.body.error&&!detail.body.result?.isError,JSON.stringify(detail.body));assert.match(JSON.stringify(detail.body),/Review one public setup step/);
 const accept=await f.rpc(token,'room_accept_work',{workItemId:'independent-current-task'});assert.ok(accept.status!==200||accept.body.error||accept.body.result?.isError,JSON.stringify(accept.body));
 const contribution=await f.rpc(token,'room_post_message',{id:'independent-help',messageId:'independent-help',body:'I can review the setup instructions and report one improvement.'});assert.equal(contribution.status,200,JSON.stringify(contribution.body));assert.ok(!contribution.body.error&&!contribution.body.result?.isError,JSON.stringify(contribution.body));
 const received=await f.rpc(token,'room_read_messages',{after:0});assert.match(JSON.stringify(received.body),/I can review the setup instructions/);
 const settings=f.store.db.prepare('SELECT public_code FROM room_public_settings WHERE room_id=?').get(room);const face=f.store.publicFace.faceByCode(settings.public_code);assert.ok(face.messages.some(m=>m.body==='I can review the setup instructions and report one improvement.'));
 const memberId=f.store.db.prepare('SELECT member_id FROM oauth_invite_grants WHERE room_id=?').get(room).member_id;let member=f.store.roomAuthority(room,{memberId}).members[memberId];f.store.command(owner,room,{id:'grant-contribution',type:'member.access_changed',data:{memberId,expectedMemberRevision:member.revision,active:true,permissions:['accept_work','complete_work']}});
 f.store.command(owner,room,{id:'assigned-work',type:'work.proposed',data:{workItemId:'assigned-work',title:'Check one sentence',definitionOfDone:'A clear suggestion',accountableMemberId:memberId,mode:'read'}});
 const accepted=await f.rpc(token,'room_accept_work',{workItemId:'assigned-work'});assert.ok(!accepted.body.error&&!accepted.body.result?.isError,JSON.stringify(accepted.body));
 member=f.store.roomAuthority(room,{memberId}).members[memberId];f.store.command(owner,room,{id:'remove-contribution',type:'member.access_changed',data:{memberId,expectedMemberRevision:member.revision,active:true,permissions:[]}});
 const beforeReplay=f.store.headSequence(room);const revokedReplay=await f.rpc(token,'room_accept_work',{workItemId:'assigned-work'});assert.equal(revokedReplay.body.result.structuredContent.duplicate,true);assert.equal(revokedReplay.body.result.structuredContent.currentStateVerified,false);assert.equal(f.store.headSequence(room),beforeReplay);
 const start=await f.rpc(token,'room_start_work',{workItemId:'assigned-work'});assert.ok(start.status!==200||start.body.error||start.body.result?.isError,JSON.stringify(start.body));
 const chat=await f.rpc(token,'room_post_message',{id:'after-grant-removal',body:'Chat still works after work access is removed.'});assert.ok(!chat.body.error&&!chat.body.result?.isError,JSON.stringify(chat.body));


});
