import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const repo = process.env.PROJECT_ROOM_TEST_REPO;
const git = process.env.PROJECT_ROOM_TEST_GIT || 'git';
const pin = process.env.PROJECT_ROOM_TEST_SHA;
if (!repo || !/^[a-f0-9]{40}$/.test(pin ?? '')) throw Error('Set PROJECT_ROOM_TEST_REPO and PROJECT_ROOM_TEST_SHA');
assert.equal(execFileSync(git, ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pin);
execFileSync(git, ['-C', repo, 'diff', '--exit-code', 'HEAD', '--']);
const [{ RoomStore }, { createRoomServer }] = await Promise.all(['server/store.mjs', 'server/http.mjs'].map(p => import(pathToFileURL(`${repo}/${p}`))));

test('account logout while an offer upload is held refuses the old session without writes', { timeout: 5000 }, async t => {
  const store = new RoomStore(':memory:');
  store.createAccount('synthetic-owner');
  const slot = store.createAccountSessionSlot();
  const session = store.loginAccountSession(slot.token, store.issueAccountAccessKey('synthetic-owner'), 0);
  const server = createRoomServer({ store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: origin, Cookie: `account_session=${slot.token}`, 'X-Session-Binding': session.sessionBinding,
    'X-CSRF-Token': session.csrf, 'X-Project-Room-Auth': 'account', 'Content-Type': 'application/json' };
  const create = await fetch(`${origin}/api/account-rooms`, { method: 'POST', headers,
    body: JSON.stringify({ roomId: 'fence-room', title: 'Fence room', purpose: 'Local session fence test', kind: 'personal', displayName: 'Owner' }) });
  assert.equal(create.status, 201, await create.clone().text());
  const read = await fetch(`${origin}/api/rooms/fence-room`, { headers });
  const snapshot = await read.json(); assert.equal(read.status, 200); assert.equal(snapshot.representation, 'normalized-current-v1');
  const offer = { requestId: 'held-create', offerId: 'held-offer', reviewerMemberIds: [snapshot.viewerId], terms: {
    kind: 'task', title: 'Held offer', summary: 'Synthetic test', acceptanceCriteria: ['A result'], reward: { kind: 'unpaid' }, approvalPolicy: { mode: 'human' } } };
  const original = store.authenticateAccountSession.bind(store); let notify;
  const authenticated = new Promise(resolve => { notify = resolve; }); let armed = true;
  store.authenticateAccountSession = (...args) => { const value = original(...args); if (armed && args[1] === 'fence-room') { armed = false; notify(); } return value; };
  const payload = JSON.stringify(offer); let held;
  const outcome = new Promise((resolve, reject) => {
    held = httpRequest(`${origin}/api/rooms/fence-room/project-offers`, { method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) } }, response => {
      let body = ''; response.on('data', chunk => { body += chunk; }); response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
    });
    held.on('error', reject); held.write(payload.slice(0, 1));
  });
  t.after(() => held.destroy()); await authenticated;
  const logout = await fetch(`${origin}/api/account-session`, { method: 'DELETE', headers, body: JSON.stringify({ expectedSessionRevision: session.sessionRevision }) });
  assert.equal(logout.status, 200, await logout.clone().text());
  held.end(payload.slice(1));
  const result = await outcome;
  assert.equal(result.status, 401, JSON.stringify(result));
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM project_offers').get().n, 0);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM project_offer_requests').get().n, 0);
});
