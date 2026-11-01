import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { createRoomServer } from '../server/http.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { makeTestSigner } from '../scripts/helpers/signed-evidence.mjs';

test('a claimable handoff successor has a real result submission path', async t => {
  const store = new RoomStore(':memory:'); store.initialize(initialRoom());
  const token = store.issueAccessKey('commons', 'owner');
  const command = (type, data) => store.command(token, 'commons', { id: crypto.randomUUID(), type, data });
  command('room.policy_set', { requireIndependentReview: false, requireOwnerDecision: false });
  const workItemId = 'handoff-source';
  command('work.proposed', { workItemId, title: 'First useful slice', definitionOfDone: 'Record the first result', accountableMemberId: 'owner', verifierMemberId: 'owner', mode: 'read' });
  const mutate = (type, data = {}) => command(type, { workItemId, expectedRevision: store.room('commons').state.workItems[workItemId].revision, ...data });
  mutate('work.accepted');
  mutate('work.handoff_recorded', { doneSummary: 'First slice prepared', nextAction: 'Finish the second useful slice', limitReason: 'Narrow follow-up' });
  const sign = makeTestSigner(store);
  const evidenceVersion = 'sha256:' + 'a'.repeat(64);
  mutate('work.completed', { summary: 'First slice done', nextAction: 'Continue follow-up', producerId: 'owner', evidenceVersion, signedEvidence: sign() });
  mutate('verification.recorded', { result: 'pass', completionEventId: store.room('commons').state.workItems[workItemId].receipt.eventId, evidenceVersion, summary: 'First slice verified' });
  assert.equal(store.workClaims.get('commons', workItemId).state, 'done');
  const successorId = workItemId + '-next';
  assert.equal(store.workClaims.get('commons', successorId).state, 'unclaimed');
  assert.equal(store.room('commons').state.workItems[successorId], undefined, 'mapper has not created a canonical work aggregate');
  const server = createRoomServer({ store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body) => {
    const response = await fetch(origin + path, { method: body ? 'POST' : 'GET',
      headers: { Origin: origin, authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const base = `/api/rooms/commons/work-claims/${successorId}`;
  const claimed = await request(base + '/claim', {});
  assert.equal(claimed.status, 200, JSON.stringify(claimed));
  const started = await request(base + '/update', { state: 'in_progress' });
  assert.equal(started.status, 200, JSON.stringify(started));
  const submitted = await request(base + '/update', { state: 'delivered', note: 'Second slice result is ready' });
  assert.equal(submitted.status, 409, JSON.stringify(submitted));
  assert.equal(submitted.body.workItemId, successorId);
  const nextPath = submitted.body.next.find(next => next.path.includes('/work-context')).path;
  const destination = await request(nextPath);
  t.diagnostic(JSON.stringify({ successorId, claimed: claimed.status, started: started.status,
    submit: submitted.status, advertisedWorkItemId: submitted.body.workItemId, nextPath, destination }));
  assert.equal(destination.status, 200, 'the advertised result path must resolve to real canonical work');
});
