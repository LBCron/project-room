import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import { pathToFileURL } from 'node:url';
const [checkout, flag] = process.argv.slice(2); assert.ok(checkout && (!flag || flag === '--assert-fixed'));
const pin = process.env.LOCAL_LAB_EXPECT_PIN ?? '1084460ddcf6d22d36aeb6e8deed24e91e6ba927', git = process.env.LOCAL_LAB_GIT ?? 'git';
assert.equal(execFileSync(git, ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pin); execFileSync(git, ['-C', checkout, 'diff', '--exit-code', 'HEAD', '--']);
const load = p => import(pathToFileURL(checkout + '/' + p));
const [{ RoomStore }, { initialRoom }, { createRoomServer }, { AccessRequests }, { linkWithProof }, { listMcpOAuthAgents }] = await Promise.all(['server/store.mjs', 'server/bootstrap.mjs', 'server/http.mjs', 'server/access-requests.mjs', 'tests/helpers/link-with-proof.mjs', 'server/mcp-oauth.mjs'].map(load));
const origin = 'https://room.example', resource = origin + '/mcp', callback = 'https://client.example/callback', observations = [];
for (const representation of ['legacy', 'normalized-current-v1']) {
  const s = new RoomStore(':memory:'); s.initialize(initialRoom('commons'), representation === 'legacy' ? {} : { representation });
  const owner = s.issueAccessKey('commons', 'owner'); s.command(owner, 'commons', { id: 'add-human', type: 'member.added', data: { memberId: 'john', displayName: 'Recipient', kind: 'human', permissions: [] } });
  const account = s.bindHumanAccount('commons', 'john'), slot = s.createAccountSessionSlot(), auth = s.loginAccountSession(slot.token, s.issueAccountAccessKey(account.id), 0);
  const identity = s.identities.create('Existing adopted agent'); linkWithProof(s, owner, 'commons', identity, { memberId: 'claude', permissions: ['accept_work'] });
  const access = new AccessRequests(s); access.sponsorTransfers.request(slot.token, 'commons', { memberId: 'claude', requestId: 'enumeration-adoption' }, auth.sessionBinding); access.decide(owner, 'commons', 'enumeration-adoption', { decision: 'approve' });
  let hydrationError = null; try { s.room('commons'); } catch (error) { hydrationError = error.code ?? error.message; }
  const configured = { preferredRoomId: 'commons', preferredMemberId: 'claude' };
  const defaultListed = listMcpOAuthAgents(s, account.id, resource).some(c => c.binding.memberId === 'claude');
  const configuredListed = listMcpOAuthAgents(s, account.id, resource, configured).some(c => c.binding.memberId === 'claude');
  assert.equal(configuredListed, true);
  const clients = [{ clientId: 'without-preference', name: 'General client', redirectUris: [callback] }, { clientId: 'with-preference', name: 'Configured client', redirectUris: [callback], ...configured }];
  const server = createRoomServer({ store: s, origin, mcpOAuthClients: clients }); await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const responses = [];
    for (const client of clients) {
      const query = new URLSearchParams({ client_id: client.clientId, redirect_uri: callback, scope: 'rooms:read chat:read', code_challenge: createHash('sha256').update('v'.repeat(43)).digest('base64url'), code_challenge_method: 'S256', resource, state: 'synthetic-enumeration-repro', connection: 'account' });
      const result = await new Promise((resolve, reject) => { const req = request(`http://127.0.0.1:${server.address().port}/oauth/authorize?${query}`, { headers: { Host: 'room.example', Cookie: '__Host-account_session=' + slot.token } }, res => { const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, html: Buffer.concat(chunks).toString() })); }); req.on('error', reject); req.end(); });
      assert.ok([200, 409].includes(result.status)); const error = result.html.startsWith('{') ? JSON.parse(result.html).error : null;
      responses.push({ client: client.clientId, status: result.status, error, selectableAgentBinding: /name="agent_binding"/.test(result.html), title: /<title>([^<]+)<\/title>/.exec(result.html)?.[1] ?? null, formFields: [...result.html.matchAll(/name="([a-z_]+)"/g)].map(m => m[1]) });
    }
    assert.equal(responses[1].status, 200, 'Configured account consent remains the positive control');
    assert.equal(responses[1].selectableAgentBinding, true, 'Configured consent must offer the existing seat');
    observations.push({ representation, hydrationError, defaultListed, configuredListed, httpConsent: responses });
  } finally { server.closeStreams(); server.closeAllConnections(); await new Promise(r => server.close(r)); s.close(); }
}
const contractSatisfied = observations.every(o => o.defaultListed && o.httpConsent[0].selectableAgentBinding);
console.log('SPONSOR_DEFAULT_ENUMERATION ' + JSON.stringify({ source: pin, observations, defaultEnumerationContractSatisfied: contractSatisfied, scope: 'Disposable Node HTTP/repository reproduction, supported by separate actual Native before/after-restore observation. No production or runtime edits.' }));
if (flag === '--assert-fixed') assert.equal(contractSatisfied, true, 'Default OAuth consent must enumerate an adopted seat in both representations');
