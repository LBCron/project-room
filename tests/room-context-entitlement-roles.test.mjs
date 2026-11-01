import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { createRoomServer } from '../server/http.mjs';

test('embedded context retains task title for separate private parties and four isolated live work roles', async t => {
  const store = new RoomStore(':memory:'); store.initialize(initialRoom());
  const keys = { owner: store.issueAccessKey('commons', 'owner') };
  const send = (actor, type, data) => store.command(keys[actor], 'commons', { id: crypto.randomUUID(), type, data });
  for (const [id, kind, permissions] of [
    ['accountable', 'agent', ['accept_work', 'complete_work']], ['verifier', 'agent', ['verify']],
    ['decision', 'human', ['decide']], ['party-a', 'agent', []], ['party-b', 'agent', []]
  ]) {
    send('owner', 'member.added', { memberId: id, displayName: id, kind, permissions });
    keys[id] = store.issueAccessKey('commons', id);
  }
  send('owner', 'work.proposed', { workItemId: 'private-roles', title: 'ROLE-TITLE-SENTINEL',
    definitionOfDone: 'ROLE-DONE-SENTINEL', accountableMemberId: 'accountable', verifierMemberId: 'verifier',
    humanDecisionMakerId: 'decision', independentVerificationRequired: false, ownerDecisionRequired: false });
  store.dmConsents.request('commons', 'party-a', 'party-b', 'Synthetic private-role qualification');
  store.dmConsents.decide('commons', 'party-b', 'party-a', 'approve');
  send('party-a', 'message.posted', { messageId: 'private-role-request', toMemberId: 'party-b', workItemId: 'private-roles',
    requestKind: 'reply', body: 'Only these two are private conversation parties' });
  assert.deepEqual([...store.privateWorkParties('commons').get('private-roles')].sort(), ['party-a', 'party-b']);
  const item = store.room('commons').state.workItems['private-roles'];
  assert.equal(item.proposedById, 'owner'); assert.equal(item.accountableMemberId, 'accountable');
  assert.equal(item.verifierMemberId, 'verifier'); assert.equal(item.humanDecisionMakerId, 'decision');
  assert.equal(item.claim, null, 'no overlapping claim-holder eligibility in these controls');
  const server = createRoomServer({ store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const actor of ['owner', 'accountable', 'verifier', 'decision', 'party-a', 'party-b']) {
    for (const view of ['work', 'orientation']) {
      const response = await fetch(origin + '/api/rooms/commons?view=' + view, { headers: { Authorization: `Bearer ${keys[actor]}` } });
      assert.equal(response.status, 200);
      const record = (await response.json()).state.workItems['private-roles'];
      assert.equal(record.title, 'ROLE-TITLE-SENTINEL', actor + '/' + view);
      assert.equal(record.definitionOfDone, 'ROLE-DONE-SENTINEL', actor + '/' + view);
    }
    const response = await fetch(origin + '/api/rooms/commons/context', { headers: { Authorization: `Bearer ${keys[actor]}` } });
    assert.equal(response.status, 200);
    const context = await response.json();
    assert.equal(context.orient.work.find(work => work.id === 'private-roles').title, 'ROLE-TITLE-SENTINEL', actor + '/context');
  }
});
