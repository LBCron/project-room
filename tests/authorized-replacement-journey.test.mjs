import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { createRoomServer } from '../server/http.mjs';
import { setTier } from '../server/autonomy-tiers.mjs';
import { claimHistoryLength } from '../server/work-claims.mjs';

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'room-authorized-replacement-'));
  const file = join(directory, 'room.sqlite');
  let store = new RoomStore(file); store.initialize(initialRoom());
  const keys = { owner: store.issueAccessKey('commons', 'owner') };
  const setup = (type, data) => store.command(keys.owner, 'commons', { id: randomUUID(), type, data });
  setup('member.added', { memberId: 'partner', displayName: 'Other owner', kind: 'human', permissions: [] });
  for (const [id, accountableHumanId, permissions] of [
    ['original', 'owner', ['accept_work', 'complete_work']],
    ['replacement', 'partner', ['accept_work', 'complete_work']],
    ['reviewer', 'owner', ['verify']]
  ]) {
    setup('member.added', { memberId: id, displayName: id, kind: 'agent', accountableHumanId, permissions });
    keys[id] = store.issueAccessKey('commons', id);
    setTier(store.db, 'commons', id, 't2_standard', { updatedBy: 'owner', nowMs: Date.now() });
  }
  setup('room.trust_set', { enabled: true });
  let server, origin;
  const start = async () => {
    server = createRoomServer({ store }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => { server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); };
  await start();
  t.after(async () => { await stop(); rmSync(directory, { recursive: true, force: true }); });
  const request = async (actor, path, body) => {
    const response = await fetch(origin + path, { method: body ? 'POST' : 'GET', headers: { Origin: origin,
      authorization: `Bearer ${keys[actor]}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const command = async (actor, type, data, id = randomUUID()) => {
    const out = await request(actor, '/api/rooms/commons/commands', { id, type, data });
    assert.equal(out.status, 201, JSON.stringify(out)); return out.body;
  };
  const mutate = (actor, workItemId, type, data = {}, id) => command(actor, type, { workItemId,
    expectedRevision: store.room('commons').state.workItems[workItemId].revision, ...data }, id);
  const prepare = async () => {
    await command('owner', 'message.posted', { messageId: 'private-source', toMemberId: 'original', body: 'PRIVATE_ORIGINAL_CONTEXT_SENTINEL' });
    await command('owner', 'work.proposed', { workItemId: 'original-task', title: 'Original task',
      definitionOfDone: 'One reviewed shared text result', accountableMemberId: 'original', verifierMemberId: 'reviewer',
      independentVerificationRequired: true, sourceMessageId: 'private-source', mode: 'read' });
    await mutate('original', 'original-task', 'work.accepted');
    await mutate('original', 'original-task', 'work.started');
    await mutate('original', 'original-task', 'work.handoff_recorded', { doneSummary: 'Public partial progress saved',
      nextAction: 'Finish shared text result', limitReason: 'Original host unavailable' });
  };
  return { get store() { return store; }, request, command, mutate, prepare,
    async restart() { await stop(); store = new RoomStore(file); await start(); } };
}

test('explicit replacement survives restart, exact retry and independent review without private-context inheritance', async t => {
  const f = await fixture(t); await f.prepare();
  const original = structuredClone(f.store.room('commons').state.workItems['original-task']);
  await f.command('owner', 'member.access_changed', { memberId: 'original', expectedMemberRevision: 0, permissions: [], active: false });
  await f.restart();
  assert.equal((await f.request('original', '/api/rooms/commons/work-context?workItemId=original-task')).status, 401);
  assert.equal((await f.request('original', '/api/rooms/commons/commands', { id: 'revoked-original-mutation',
    type: 'work.handoff_recorded', data: { workItemId: original.id, expectedRevision: original.revision,
      doneSummary: 'Late old host', nextAction: 'Continue', limitReason: 'Delayed request' } })).status, 401);
  const shared = await f.request('replacement', '/api/rooms/commons/work-context?workItemId=original-task&includeSource=true');
  assert.equal(shared.status, 200);
  assert.equal(shared.body.work.handoff.doneSummary, original.handoff.doneSummary);
  assert.equal(shared.body.context.source.status, 'unavailable');
  assert.equal(JSON.stringify(shared.body).includes('PRIVATE_ORIGINAL_CONTEXT_SENTINEL'), false);
  await f.command('owner', 'work.proposed', { workItemId: 'replacement-task', title: 'Authorized replacement',
    definitionOfDone: 'One reviewed shared text result', accountableMemberId: 'replacement', verifierMemberId: 'reviewer',
    independentVerificationRequired: true, mode: 'read' });
  await f.mutate('owner', 'original-task', 'work.superseded', { supersededByWorkItemId: 'replacement-task', reason: 'Explicit replacement after original access revoked' });
  const next = await f.request('replacement', '/api/rooms/commons/work-context?workItemId=original-task');
  assert.equal(next.body.next.replacement.status, 'available');
  await f.mutate('replacement', 'replacement-task', 'work.accepted');
  await f.mutate('replacement', 'replacement-task', 'work.started');
  const text = 'A shared result produced by the explicitly assigned replacement.';
  const evidenceVersion = 'sha256:' + createHash('sha256').update(text).digest('hex');
  const posted = await f.command('replacement', 'message.posted', { messageId: 'shared-result', workItemId: 'replacement-task', body: text });
  const data = { workItemId: 'replacement-task', expectedRevision: f.store.room('commons').state.workItems['replacement-task'].revision,
    evidenceKind: 'room_text', evidenceMessageId: 'shared-result', evidenceMessageEventId: posted.event.id,
    previousCompletionEventId: null, producerId: 'replacement', summary: 'Shared result ready', evidenceVersion, nextAction: 'Review exact saved result' };
  await f.command('replacement', 'work.completed', data, 'replacement-complete');
  const receipt = structuredClone(f.store.room('commons').state.workItems['replacement-task'].receipt);
  await f.restart();
  const retry = await f.request('replacement', '/api/rooms/commons/commands', { id: 'replacement-complete', type: 'work.completed', data });
  assert.equal(retry.status, 200, JSON.stringify(retry));
  assert.equal(retry.body.duplicate, true);
  const wrongVersion = await f.request('reviewer', '/api/rooms/commons/commands', { id: 'wrong-result-review',
    type: 'verification.recorded', data: { workItemId: 'replacement-task',
      expectedRevision: f.store.room('commons').state.workItems['replacement-task'].revision, result: 'pass',
      completionEventId: receipt.eventId, evidenceVersion: 'sha256:' + '0'.repeat(64), summary: 'Wrong version must not pass' } });
  assert.equal(wrongVersion.status, 422);
  assert.equal(f.store.room('commons').state.workItems['replacement-task'].verification, null);
  await f.mutate('reviewer', 'replacement-task', 'verification.recorded', { result: 'pass', completionEventId: receipt.eventId,
    evidenceVersion, summary: 'Checked exact saved shared text' });
  assert.equal(f.store.workClaims.get('commons', 'replacement-task').state, 'done');
  assert.equal(f.store.room('commons').state.workItems['replacement-task'].receipt.eventId, receipt.eventId);
  const reviewed = structuredClone(f.store.room('commons').state.workItems['replacement-task']);
  assert.equal((await f.request('replacement', '/api/rooms/commons/commands', { id: 'replacement-complete', type: 'work.completed', data })).body.duplicate, true);
  assert.deepEqual(f.store.room('commons').state.workItems['replacement-task'], reviewed, 'late completion retry does not rewind review');
  assert.deepEqual(f.store.room('commons').state.workItems['original-task'].handoff.doneSummary, original.handoff.doneSummary);
});

test('board reassignment alone does not transfer canonical accountability', async t => {
  const f = await fixture(t); await f.prepare();
  const row = f.store.workClaims.get('commons', 'original-task');
  const reassigned = await f.request('owner', '/api/rooms/commons/work-claims/original-task/reassign', {
    newOwner: 'replacement', expectedClaimedAt: row.claimedAt, expectedHistoryLength: claimHistoryLength(row), note: 'Owner requests replacement' });
  assert.equal(reassigned.status, 200, JSON.stringify(reassigned));
  const canonical = f.store.room('commons').state.workItems['original-task'];
  assert.equal(canonical.accountableMemberId, 'original');
  const attempted = await f.request('replacement', '/api/rooms/commons/commands', { id: 'replacement-canonical-handoff',
    type: 'work.handoff_recorded', data: { workItemId: canonical.id, expectedRevision: canonical.revision,
      doneSummary: 'Attempted continuation', nextAction: 'Finish', limitReason: 'Replacement host' } });
  assert.equal(attempted.status, 422, JSON.stringify(attempted));
  assert.match(JSON.stringify(attempted.body), /Only the accountable member/);
});
