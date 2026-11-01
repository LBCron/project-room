import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { createRoomServer } from '../server/http.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { AgentRooms } from '../server/agent-rooms.mjs';
import { createHostedRoomMcp } from '../server/mcp-room-profile.mjs';

test('conditional room context refreshes when a newly posted board claim changes orientation', async t => {
  const store = new RoomStore(':memory:');
  store.initialize(initialRoom());
  const token = store.issueAccessKey('commons', 'owner');
  const server = createRoomServer({ store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeStreams(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve)); store.close();
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body) => {
    const response = await fetch(origin + path, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${token}`, Origin: origin, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json();
    assert.ok(response.ok, JSON.stringify({ status: response.status, result }));
    return result;
  };
  const before = await request('/api/rooms/commons/context');
  const id = 'context-cache-new-claim';
  assert.equal(before.orient.availableClaims.some(item => item.id === id), false);
  await request('/api/rooms/commons/work-claims', { id, title: 'A newly available useful task' });
  const full = await request('/api/rooms/commons/context');
  assert.equal(full.orient.availableClaims.some(item => item.id === id), true, 'fresh full read sees the new claim');
  const conditional = await request(`/api/rooms/commons/context?since_version=${before.context_version}`);
  t.diagnostic(JSON.stringify({ beforeVersion: before.context_version, fullVersion: full.context_version,
    beforeAvailable: before.orient.availableClaims.map(item => item.id), fullAvailable: full.orient.availableClaims.map(item => item.id),
    conditionalNotModified: conditional.not_modified, conditionalHasOrient: Object.hasOwn(conditional, 'orient') }));
  assert.notEqual(conditional.not_modified, true, 'changed orientation must not be hidden behind not_modified');
  assert.notEqual(conditional.context_version, before.context_version);
  assert.equal(conditional.orient.availableClaims.some(item => item.id === id), true);
});

test('hosted MCP conditional context refreshes a changed current board projection', async t => {
  const store = new RoomStore(':memory:');
  t.after(() => store.close());
  const identity = store.identities.create('Context freshness owner');
  const rooms = new AgentRooms(store);
  const roomId = 'context-freshness-mcp';
  rooms.create(identity.secret, { roomId, title: 'Context freshness', purpose: 'Synthetic current-board probe', kind: 'personal' });
  const mcp = createHostedRoomMcp(store, { agentRooms: rooms });
  const context = async since => {
    const reply = await mcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
      name: 'get_room_context', arguments: { roomId, ...(since ? { since_version: since } : {}) }
    } }, { authorization: `Bearer ${identity.secret}` });
    assert.ok(reply.result && !reply.result.isError, JSON.stringify(reply));
    return reply.result.structuredContent;
  };
  const before = await context();
  const id = 'mcp-context-new-board';
  store.workClaims.set(roomId, { id, title: 'A new current board task', state: 'unclaimed', owner: null, history: [] });
  const full = await context();
  assert.equal(full.orient.availableClaims.some(item => item.id === id), true);
  const conditional = await context(before.context_version);
  t.diagnostic(JSON.stringify({ protocol: 'hosted MCP', beforeVersion: before.context_version, fullVersion: full.context_version,
    conditionalNotModified: conditional.not_modified, conditionalHasOrient: Object.hasOwn(conditional, 'orient') }));
  assert.notEqual(conditional.not_modified, true, 'MCP must refresh the changed current board projection');
  assert.notEqual(conditional.context_version, before.context_version);
  assert.equal(conditional.orient.availableClaims.some(item => item.id === id), true);
});
