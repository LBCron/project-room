// Existing identity import against real local HTTP; no models/live credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, rmSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { join as pathJoin } from 'node:path';
import { join } from '../room-acp/src/join.mjs';
import { importIdentity } from '../room-acp/src/import-identity.mjs';
import { main } from '../room-acp/src/cli.mjs';
import { loadConnection } from '../room-acp/src/credentials.mjs';
import { RoomClient } from '../room-acp/src/room.mjs';
import { saveAgentConnection } from '../client/agent-connection.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { startRoom, FAKE_AGENT } from './room-acp-fixture.mjs';
import { Bridge } from '../room-acp/src/bridge.mjs';

async function setup(t) {
  const f = await startRoom(t);
  const enrolled = await join({ link: f.invite().link, displayName: 'Existing import agent', env: { ...f.env, ROOM_ACP_HOME: pathJoin(f.home, 'old-host') } });
  const source = pathJoin(f.home, 'source');
  saveAgentConnection(source, { version: 1, origin: f.origin, roomId: 'commons', memberId: enrolled.memberId, token: enrolled.identitySecret });
  const env = { ...f.env, ROOM_ACP_HOME: pathJoin(f.home, 'new-host') };
  const request = { identityFrom: source, roomId: 'commons', env };
  const keys = () => f.f.store.agentPlugin.listApiKeys(enrolled.identityId);
  const identities = () => f.f.store.db.prepare('SELECT count(*) n FROM agent_identities').get().n;
  return { ...f, enrolled, source, env, request, keys, identities };
}
function receipts(f) {
  return readdirSync(f.env.ROOM_ACP_HOME).filter(n => /^\.join-[a-f0-9]{64}$/.test(n))
    .map(n => readFileSync(pathJoin(f.env.ROOM_ACP_HOME, n, 'receipt.json'), 'utf8'));
}

test('CLI imports its existing identity with a scoped key, real listener access, private save and no broad bearer', async t => {
  const f = await setup(t), original = readFileSync(pathJoin(f.source, 'connection.json')), before = f.keys().length, lines = [], requests = [];
  const fetchImpl = (url, options) => { requests.push({ url, method: options.method }); return fetch(url, options); };
  assert.equal(await main(['import-identity', '--identity-from', f.source, '--room', 'commons'], { env: f.env, fetchImpl, print: line => lines.push(line) }), 0, lines.join('\n'));
  const saved = loadConnection({}, f.env);
  assert.equal(saved.memberId, f.enrolled.memberId); assert.equal(saved.identityId, f.enrolled.identityId);
  assert.equal(saved.identitySecret, undefined); assert.match(saved.credential, /^rak_/);
  assert.equal(f.identities(), 1); assert.equal(f.keys().length, before + 1);
  assert.deepEqual(readFileSync(pathJoin(f.source, 'connection.json')), original);
  assert.equal(statSync(pathJoin(f.env.ROOM_ACP_HOME, 'commons.json')).mode & 0o777, 0o600);
  const client = new RoomClient({ ...saved });
  await client.checkConnection();
  const beat = await client.heartbeat({ hostId: saved.hostId });
  assert.ok(beat);
  await client.poll({ hostId: saved.hostId, waitMs: 0 });
  await client.post({ body: 'Imported identity keeps the same member' });
  assert.ok(f.messages().some(m => m.body === 'Imported identity keeps the same member' && m.authorId === saved.memberId));
  f.f.store.initialize(initialRoom('second'));
  // Even when the identity is a member elsewhere, this key cannot read it.
  const owner = f.f.store.issueAccessKey('second', 'owner');
  const invitation = f.f.store.invites.create(owner, 'second', { profile: 'contribute' });
  await fetch(f.origin + '/api/agent-invites/redeem', { method: 'POST', headers: { authorization: 'Bearer ' + f.enrolled.identitySecret, 'content-type': 'application/json' }, body: JSON.stringify({ code: invitation.code, displayName: 'Existing import agent' }) });
  await assert.rejects(new RoomClient({ ...saved, roomId: 'second' }).checkConnection(), e => e.status === 403);
  const disk = readFileSync(pathJoin(f.env.ROOM_ACP_HOME, 'commons.json'), 'utf8') + receipts(f).join('');
  assert.ok(!disk.includes(f.enrolled.identitySecret));
  assert.ok(!lines.join('\n').includes(saved.credential)); assert.ok(!lines.join('\n').includes(f.enrolled.identitySecret));
  assert.ok(!requests.some(r => /redeem|rotate|agent-identities/.test(r.url)));
  const beforeRetry = f.keys().length;
  await importIdentity(f.request);
  assert.equal(f.keys().length, beforeRetry);
  assert.equal(loadConnection({}, f.env).credential, saved.credential);
});

test('lost successful issue response remains unknown and retry cannot duplicate keys or invite around it', async t => {
  const f = await setup(t), before = f.keys().length; let issues = 0;
  const fetchImpl = async (url, options) => {
    const response = await fetch(url, options);
    if (url.endsWith('/api/agent-keys') && options.method === 'POST') { issues++; throw Error('synthetic lost response'); }
    return response;
  };
  await assert.rejects(importIdentity({ ...f.request, fetchImpl }));
  assert.equal(f.keys().length, before + 1); assert.equal(loadConnection({}, f.env), null);
  await assert.rejects(importIdentity({ ...f.request, fetchImpl }), /unknown.*label.*Do not issue again/);
  assert.equal(issues, 1); assert.equal(f.keys().length, before + 1);
  const invite = f.invite();
  await assert.rejects(join({ link: invite.link, displayName: 'Different identity', env: f.env }), /unresolved outcome/);
  assert.equal(f.f.store.invites.preview(invite.code).roomId, 'commons');
  assert.ok(!receipts(f).join('').includes(f.enrolled.identitySecret));
});

test('final save failure retains only the scoped result and retry saves it without another issue', async t => {
  const f = await setup(t), before = f.keys().length; let issues = 0;
  const target = pathJoin(f.env.ROOM_ACP_HOME, 'commons.json');
  const fetchImpl = async (url, options) => {
    const response = await fetch(url, options);
    if (url.endsWith('/api/agent-keys') && options.method === 'POST') { issues++; mkdirSync(target); }
    return response;
  };
  await assert.rejects(importIdentity({ ...f.request, fetchImpl }));
  const receipt = receipts(f).join('');
  assert.match(receipt, /rak_/); assert.ok(!receipt.includes(f.enrolled.identitySecret));
  rmSync(target, { recursive: true });
  const saved = await importIdentity(f.request);
  assert.match(saved.credential, /^rak_/); assert.equal(issues, 1); assert.equal(f.keys().length, before + 1);
  assert.equal(saved.memberId, f.enrolled.memberId);
});

test('wrong member, scoped source and insecure source fail before key issuance; logs reveal no broad bearer', async t => {
  const f = await setup(t), before = f.keys().length;
  const path = pathJoin(f.source, 'connection.json'), original = JSON.parse(readFileSync(path));
  for (const change of [{ memberId: 'different-member' }, { token: f.enrolled.credential }]) {
    writeFileSync(path, JSON.stringify({ ...original, ...change }), { mode: 0o600 });
    const lines = [];
    assert.equal(await main(['import-identity', '--identity-from', f.source, '--room', 'commons'], { env: f.env, print: line => lines.push(line) }), 1);
    assert.ok(!lines.join('\n').includes(original.token)); assert.equal(f.keys().length, before);
  }
  writeFileSync(path, JSON.stringify(original)); chmodSync(path, 0o644);
  await assert.rejects(importIdentity(f.request), /private CLI connection/);
  assert.equal(f.keys().length, before);
});

test('concurrent imports share the destination ownership lock and issue only one key', async t => {
  const f = await setup(t), before = f.keys().length; let entered, release;
  const started = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
  const fetchImpl = async (url, options) => {
    const response = await fetch(url, options);
    if (url.endsWith('/api/agent-keys') && options.method === 'POST') { entered(); await held; }
    return response;
  };
  const first = importIdentity({ ...f.request, fetchImpl });
  try { await started; await assert.rejects(importIdentity(f.request), /Another join owns/); }
  finally { release(); }
  await first; assert.equal(f.keys().length, before + 1);
});


test('imported saved connection runs the actual ACP bridge and replies as the original member', async t => {
  const f = await setup(t), connection = await importIdentity(f.request);
  const bridge = new Bridge({ connection, candidate: { id: 'fake', label: 'Fake ACP', command: process.execPath, args: [FAKE_AGENT] }, env: f.env, waitMs: 1000 });
  const done = bridge.run();
  const waitFor = async predicate => {
    const end = Date.now() + 10000;
    while (Date.now() < end) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw Error('Imported bridge did not complete its requested work');
  };
  try {
    await waitFor(() => bridge.fencingToken);
    f.say('@Existing import agent verify the imported identity');
    await waitFor(() => bridge.stats.posted > 0);
    assert.ok(f.messages().some(message => message.authorId === f.enrolled.memberId && message.body.includes('verify the imported identity')));
  } finally { bridge.stop(); await done; }
});
