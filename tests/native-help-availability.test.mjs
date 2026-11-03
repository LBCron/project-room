import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { AgentRooms } from '../server/agent-rooms.mjs';
import { createRoomServer } from '../server/http.mjs';
import { RoomAgentClient } from '../client/room-agent.mjs';
import { legacyAgentRoom } from './helpers/legacy-agent-room.mjs';
import { helpTools } from '../client/help-actions.mjs';

async function fixture(t, native = true) {
  const store = new RoomStore(':memory:');
  const owner = store.identities.create('Synthetic help owner');
  const roomId = 'help-availability', workItemId = 'task';
  if (native) new AgentRooms(store).create(owner.secret, { roomId, title: 'Help availability', purpose: 'Local synthetic test', visibility: 'private', starter: false });
  else legacyAgentRoom(store, owner, { roomId, title: 'Historical help', purpose: 'Local synthetic test', starter: false });
  store.command(owner.secret, roomId, { id: 'propose', type: 'work.proposed', data: {
    workItemId, title: 'Synthetic task', definitionOfDone: 'One local result', accountableMemberId: owner.identityId, mode: 'read',
    independentVerificationRequired: false, ownerDecisionRequired: false
  } });
  store.command(owner.secret, roomId, { id: 'accept', type: 'work.accepted', data: { workItemId, expectedRevision: 0 } });
  const server = createRoomServer({ store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeStreams(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve)); store.close();
  });
  const client = new RoomAgentClient({ origin, roomId, memberId: owner.identityId, token: owner.secret });
  const rpc = async (name, args) => {
    const response = await fetch(origin + '/mcp', { method: 'POST', headers: {
      authorization: `Bearer ${owner.secret}`, 'content-type': 'application/json'
    }, body: JSON.stringify({ jsonrpc: '2.0', id: 'local', method: 'tools/call', params: { name, arguments: { roomId, ...args } } }) });
    return response.json();
  };
  return { store, owner, roomId, workItemId, client, rpc };
}

test('native selected work omits unsupported help and remains accepted by RoomAgentClient', async t => {
  const f = await fixture(t), before = f.store.headSequence(f.roomId);
  const selected = await f.client.workContext(f.workItemId);
  assert.equal(selected.work.state, 'accepted');
  assert.equal(Object.hasOwn(selected, 'help'), false);
  assert.equal(Object.hasOwn(selected, 'helpContextVersion'), false);
  assert.equal(f.store.headSequence(f.roomId), before);
  assert.throws(() => f.store.snapshot(f.owner.secret, f.roomId, null, 'work', true), error => {
    assert.equal(error.code, 'current_help_context_unavailable');
    assert.match(error.message, /unavailable.*normalized/i);
    return true;
  });
});

test('native hosted help returns explicit unavailable before revision or command work', async t => {
  const f = await fixture(t), before = f.store.headSequence(f.roomId);
  // Neither an omitted nor an explicit revision should enter command assembly.
  const original = f.store.workContext.bind(f.store);
  f.store.workContext = () => { throw new Error('Unsupported help must not fetch a work revision'); };
  t.after(() => { f.store.workContext = original; });
  for (const tool of helpTools) for (const revision of [undefined, 1]) {
    const candidate = { workItemId: f.workItemId, offerId: 'offer', requestId: 'offer-request',
      ...(revision === undefined ? {} : { expectedRevision: revision }), expectedHelpRevision: 1,
      helpEventId: 'invitation', plan: 'One local suggestion', expectedOfferRevision: 0,
      reason: 'Synthetic local reason', externalActivityUnverified: true };
    const args = Object.fromEntries(Object.entries(candidate).filter(([key]) => Object.hasOwn(tool.inputSchema.properties, key)));
    const result = await f.rpc(tool.name, args);
    assert.equal(result.result?.isError, true, JSON.stringify(result));
    assert.equal(result.result.structuredContent.code, 'current_help_context_unavailable');
    assert.match(result.result.structuredContent.message, /unavailable.*normalized/i);
  }
  assert.equal(f.store.headSequence(f.roomId), before);
});

test('historical supported help still publishes and validates selected context', async t => {
  const f = await fixture(t, false);
  assert.equal((await f.client.workContext(f.workItemId)).help.canPublish, true);
  await f.client.command({ id: 'publish-help', type: 'work.help_updated', data: {
    workItemId: f.workItemId, expectedRevision: 1, expectedHelpRevision: 0, status: 'open',
    scope: 'One bounded suggestion', expiresAt: new Date(Date.now() + 3600000).toISOString()
  } });
  const selected = await f.client.workContext(f.workItemId);
  assert.equal(selected.helpContextVersion, 1);
  assert.equal(selected.help.status, 'open');
  assert.equal(selected.help.canWithdraw, true);
});

test('shared help catalog retains legacy tools and tells callers native help is unavailable', () => {
  assert.equal(helpTools.length, 5);
  for (const tool of helpTools) assert.match(tool.description, /unavailable.*normalized/i);
});
