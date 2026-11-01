import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { createRoomServer } from '../server/http.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { AgentRooms } from '../server/agent-rooms.mjs';
import { createHostedRoomMcp } from '../server/mcp-room-profile.mjs';

const storageFault = () => Object.assign(new Error('synthetic private driver detail'), { errcode: 10 });

test('HTTP full and conditional context refuse failed board reads and recover without caching emptiness', async t => {
  const store = new RoomStore(':memory:'); store.initialize(initialRoom());
  const token = store.issueAccessKey('commons', 'owner');
  const server = createRoomServer({ store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const read = async version => {
    const response = await fetch(origin + '/api/rooms/commons/context' + (version ? '?since_version=' + version : ''),
      { headers: { authorization: `Bearer ${token}` } });
    return { status: response.status, retryAfter: response.headers.get('retry-after'), body: await response.json() };
  };
  const before = await read(); assert.equal(before.status, 200);
  const list = store.workClaims.list;
  store.workClaims.list = () => { throw storageFault(); };
  for (const version of [before.body.context_version, null]) {
    const refused = await read(version);
    assert.equal(refused.status, 503, JSON.stringify(refused));
    assert.equal(refused.retryAfter, '30');
    assert.equal(JSON.stringify(refused.body).includes('storage_unavailable'), true);
    assert.equal(JSON.stringify(refused.body).includes('synthetic private driver detail'), false);
    assert.notEqual(refused.body.not_modified, true);
    assert.equal(Object.hasOwn(refused.body, 'context_version'), false);
  }
  store.workClaims.list = list;
  const recovered = await read(before.body.context_version);
  assert.equal(recovered.status, 200); assert.equal(recovered.body.not_modified, true);
  store.workClaims.set('commons', { id: 'after-fault', title: 'New task after recovery', state: 'unclaimed', owner: null, history: [] });
  const changed = await read(before.body.context_version);
  assert.equal(changed.status, 200); assert.notEqual(changed.body.not_modified, true);
  assert.equal(changed.body.orient.availableClaims.some(item => item.id === 'after-fault'), true);
});

test('hosted MCP refuses uncertain board state and retries the original version after recovery', async t => {
  const store = new RoomStore(':memory:'); t.after(() => store.close());
  const identity = store.identities.create('Board-read-fault fixture');
  const rooms = new AgentRooms(store), roomId = 'context-read-fault';
  rooms.create(identity.secret, { roomId, title: 'Read failure fixture', purpose: 'Synthetic board read uncertainty', kind: 'personal' });
  const mcp = createHostedRoomMcp(store, { agentRooms: rooms });
  const read = version => mcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_room_context',
    arguments: { roomId, ...(version ? { since_version: version } : {}) } } }, { authorization: `Bearer ${identity.secret}` });
  const before = (await read()).result.structuredContent;
  const list = store.workClaims.list;
  store.workClaims.list = () => { throw storageFault(); };
  const refused = await read(before.context_version);
  assert.equal(refused.result.isError, true, JSON.stringify(refused));
  assert.equal(JSON.stringify(refused).includes('storage_unavailable'), true);
  assert.equal(JSON.stringify(refused).includes('synthetic private driver detail'), false);
  store.workClaims.list = list;
  const recovered = await read(before.context_version);
  assert.notEqual(recovered.result.isError, true);
  assert.equal(recovered.result.structuredContent.not_modified, true);
});
