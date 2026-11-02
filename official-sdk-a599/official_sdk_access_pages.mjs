import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
const lab = fileURLToPath(new URL('.', import.meta.url)), repo = '/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-mcp-qa2-adapter-1102';
const git = process.env.LOCAL_LAB_GIT ?? 'git', pin = 'a599faa29ff65567e5c080609cb2d000acd33666';
assert.equal(execFileSync(git, ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pin); execFileSync(git, ['-C', repo, 'diff', '--exit-code', 'HEAD', '--']);
const load = path => import(pathToFileURL(repo + '/' + path));
const [{ RoomStore }, { initialRoom }, { AccessRequests }, { createRoomServer }, { linkWithProof }] = await Promise.all(['server/store.mjs', 'server/bootstrap.mjs', 'server/access-requests.mjs', 'server/http.mjs', 'tests/helpers/link-with-proof.mjs'].map(load));
const { Client, StreamableHTTPClientTransport } = await import(pathToFileURL(lab + 'mcp2-reference/node_modules/@modelcontextprotocol/client/dist/index.mjs'));
const store = new RoomStore(':memory:'), roomId = 'sdk-access-queue', now = store.now(); store.now = () => now;
store.initialize(initialRoom(roomId), { representation: 'normalized-current-v1' });
const owner = store.issueAccessKey(roomId, 'owner'), service = new AccessRequests(store);
const admin = store.identities.create('SDK Reviewer'), reader = store.identities.create('SDK Reader');
linkWithProof(store, owner, roomId, admin, { permissions: ['manage_members'] }); linkWithProof(store, owner, roomId, reader, { permissions: [] });
for (let i = 0; i < 51; i++) { const identity = store.identities.create('Requester ' + i); service.request(roomId, { identityId: identity.identityId, displayName: 'Requester ' + i, requestId: 'sdk-request-' + String(i).padStart(3, '0'), requestedPermissions: ['accept_work'], note: 'Synthetic requester note' }, identity.secret); }
const server = createRoomServer({ store }); await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = 'http://127.0.0.1:' + server.address().port, observedRequests = [];
const clients = [];
async function connect(secret, label) {
  const client = new Client({ name: label, version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } }); clients.push(client);
  const localFetch = (url, options = {}) => { assert.equal(new URL(url).origin, origin); const headers = new Headers(options.headers); observedRequests.push({ method: headers.get('mcp-method'), protocol: headers.get('mcp-protocol-version') }); return fetch(url, options); };
  await client.connect(new StreamableHTTPClientTransport(new URL(origin + '/room/mcp'), { fetch: localFetch, requestInit: { headers: { Authorization: 'Bearer ' + secret } } }));
  return client;
}
async function invoke(client, args, toolDefinition) {
  try {
    const r = await client.callTool({ name: 'room_list_access_requests', arguments: { roomId, ...args } }, toolDefinition ? { toolDefinition } : undefined);
    if (!r.isError) return { ok: true, value: r.structuredContent, raw: JSON.stringify(r) };
    const body = r.structuredContent ?? JSON.parse(r.content.find(c => c.type === 'text').text);
    return { ok: false, reason: body.code ?? body.error?.code, status: body.status, raw: JSON.stringify(r) };
  } catch (error) { return { ok: false, reason: error.data?.reason, status: error.data?.status ?? error.data?.httpStatus, rpcCode: error.code, raw: JSON.stringify({ message: error.message, data: error.data }) }; }
}
try {
  const reviewer = await connect(admin.secret, 'Official pending queue reviewer');
  // Room's full-profile extension travels through the real SDK request method.
  const catalog = await reviewer.request({ method: 'tools/list', params: { profile: 'full' } });
  const definition = catalog.tools.find(t => t.name === 'room_list_access_requests'); assert.ok(definition);
  assert.equal(definition.inputSchema.properties.limit.maximum, 50); assert.ok(definition.inputSchema.properties.cursor);
  const omitted = await invoke(reviewer, {}, definition); assert.equal(omitted.ok, false); assert.equal(omitted.reason, 'invalid_request');
  const ids = [], pageSizes = []; let cursor = null, firstCursor = null, pages = 0;
  do {
    const r = await invoke(reviewer, { limit: 25, ...(cursor ? { cursor } : {}) }, definition); assert.equal(r.ok, true, 'SDK page must succeed');
    const p = r.value; assert.ok(p.contentTrust); assert.ok(p.requests.every(row => row.untrusted === true)); assert.ok(p.requests.length <= 25);
    ids.push(...p.requests.map(row => row.requestId)); pageSizes.push(p.requests.length); cursor = p.page.nextCursor; firstCursor ??= cursor; assert.equal(p.sourceWindow.complete, !p.page.hasMore); assert.ok(++pages <= 3);
  } while (cursor);
  assert.deepEqual(ids, Array.from({ length: 51 }, (_, i) => 'sdk-request-' + String(i).padStart(3, '0')));
  const unprivileged = await connect(reader.secret, 'Official pending queue reader');
  const denied = await invoke(unprivileged, { limit: 25, cursor: 'not-a-valid-cursor' }, definition); assert.equal(denied.ok, false); assert.equal(denied.reason, 'access_denied'); assert.equal(denied.raw.includes('Requester'), false);
  service.decide(owner, roomId, 'sdk-request-000', { decision: 'deny' });
  const unaffected = await invoke(reviewer, { limit: 25, cursor: firstCursor }, definition);
  assert.equal(unaffected.ok, true, 'Removing an earlier non-anchor row retains current-per-page continuation');
  service.decide(owner, roomId, 'sdk-request-024', { decision: 'deny' });
  const stale = await invoke(reviewer, { limit: 25, cursor: firstCursor }, definition); assert.equal(stale.ok, false); assert.equal(stale.reason, 'stale_access_request_cursor');
  const restarted = await invoke(reviewer, { limit: 25 }, definition); assert.equal(restarted.ok, true); assert.equal(restarted.value.requests.length, 25);
  assert.ok(observedRequests.length > 0 && observedRequests.every(r => r.protocol === '2026-07-28'));
  const result = { source: pin, client: '@modelcontextprotocol/client@2.4.0', transport: 'real SDK modern StreamableHTTP over loopback', catalogLimitMaximum: 50, pageSizes, uniqueRequests: new Set(ids).size, defaultOversizeRefused: omitted.reason, lowPrivilegeRefusedBeforeCursorDecode: denied.reason, nonAnchorDenialRetainsContinuation: true, decidedAnchorCursorRefused: stale.reason, restartWorks: true, requesterContentTrustPreserved: true, requestCount: observedRequests.length, allRequestProtocolHeadersCorrect: true, scope: 'Disposable local Node HTTP only. No runtime edits, Native, production or whole-suite qualification.' };
  writeFileSync(lab + 'official-sdk-access-pages-receipt.json', JSON.stringify(result, null, 2) + '\n'); console.log('OFFICIAL_SDK_ACCESS_PAGES ' + JSON.stringify(result));
} finally { for (const c of clients) await c.close(); server.closeStreams(); server.closeAllConnections(); await new Promise(r => server.close(r)); store.close(); }
execFileSync(git, ['-C', repo, 'diff', '--exit-code', 'HEAD', '--']);
