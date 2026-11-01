// Wake drain: the Room pages pending wakes (server cap MAX_PENDING_WAKES=50
// in server/agent-heartbeats.mjs) and returns more/nextCursor so the poller
// can reach later pages. Wakes queued while the bridge machine slept must
// all be offered to accept() in one poll cycle, not only the first page:
// a first-page signal that cannot ack yet (a long turn, or a parked
// interrupted receipt) must not hide every later wake behind it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Bridge, MAX_POLL_PAGES } from '../room-acp/src/bridge.mjs';
import { RoomClient } from '../room-acp/src/room.mjs';

function fixture(pollImpl) {
  const bridge = new Bridge({
    connection: { apiBase: 'http://localhost', roomId: 'r', memberId: 'agent', hostId: 'h' },
    persistSessions: false,
    host: { session: async () => ({ sessionId: 's', created: true }), prompt: async () => ({ recorder: { text: 'done', tools: new Map() }, stopReason: 'end_turn' }), stop() {} },
  });
  bridge.room.heartbeat = async () => ({ listener: { acquired: true, fencingToken: 'tok', leaseExpiresAt: Date.now() + 60000 } });
  bridge.room.poll = pollImpl;
  bridge.refreshRoom = async () => {};
  const accepted = [];
  bridge.accept = async signal => { accepted.push(signal.signalId); };
  return { bridge, accepted };
}

const sig = id => ({ signalId: id, messageId: `m-${id}`, kind: 'mention' });

test('pollOnce follows nextCursor until the wake queue is drained', async () => {
  const cursors = [];
  const { bridge, accepted } = fixture(async ({ cursor }) => {
    cursors.push(cursor ?? null);
    if (!cursor) return { pendingWakes: [sig('a'), sig('b')], more: true, nextCursor: 'page-2' };
    if (cursor === 'page-2') return { pendingWakes: [sig('c')], more: false, nextCursor: null };
    throw new Error(`unexpected cursor ${cursor}`);
  });
  await bridge.pollOnce();
  assert.deepEqual(cursors, [null, 'page-2']);
  assert.deepEqual(accepted, ['a', 'b', 'c']);
});

test('pollOnce stops paging at the page bound even if the server always says more', async () => {
  let calls = 0;
  const { bridge, accepted } = fixture(async () => {
    calls++;
    return { pendingWakes: [sig(`s${calls}`)], more: true, nextCursor: `cursor-${calls}` };
  });
  await bridge.pollOnce();
  assert.equal(calls, MAX_POLL_PAGES);
  assert.equal(accepted.length, MAX_POLL_PAGES);
});

test('RoomClient.poll sends the cursor when one is given, and omits it otherwise', async () => {
  const urls = [];
  const fetchImpl = async url => {
    urls.push(String(url));
    return { ok: true, headers: { get: () => null }, json: async () => ({ pendingWakes: [] }) };
  };
  const client = new RoomClient({ apiBase: 'http://localhost', roomId: 'r', memberId: 'agent', credential: 'x', fetchImpl });
  await client.poll({ hostId: 'h', waitMs: 0 });
  await client.poll({ hostId: 'h', waitMs: 0, cursor: 'cur sor/1' });
  assert.equal(urls.length, 2);
  assert.ok(!urls[0].includes('cursor='));
  assert.ok(urls[1].includes(`cursor=${encodeURIComponent('cur sor/1')}`));
});

test('filtered source windows carry traversal across bounded cycles, then reset for new work', async () => {
  const cursors = []; let finished = false;
  const { bridge, accepted } = fixture(async ({ cursor, waitMs }) => {
    cursors.push(cursor);
    if (finished) { assert.equal(cursor, null); return { pendingWakes: [sig('new-after-terminal')], more: false, nextCursor: null }; }
    const page = cursor === null ? 0 : Number(cursor.slice(1));
    if (page > 0) assert.equal(waitMs, 0, 'carried traversal never starts another long wait');
    if (page < 85) return { pendingWakes: [], more: true, nextCursor: 'c' + (page + 1) };
    finished = true; return { pendingWakes: [sig('late-useful')], more: false, nextCursor: null };
  });
  bridge.minPollIntervalMs = 0;
  for (let cycle = 0; cycle < 5; cycle++) { const before = cursors.length; await bridge.pollOnce(); assert.ok(cursors.length - before <= MAX_POLL_PAGES); }
  assert.deepEqual(accepted, ['late-useful']); assert.equal(cursors.length, 86);
  assert.deepEqual(cursors.slice(0, 3), [null, 'c1', 'c2']);
  await bridge.pollOnce(); assert.deepEqual(accepted, ['late-useful', 'new-after-terminal']);
});

test('traversal retry retains progress, while a fresh bridge restarts a cursorless observation', async () => {
  let calls = 0, failOnce = true;
  const { bridge } = fixture(async ({ cursor }) => {
    calls++;
    if (calls === MAX_POLL_PAGES + 1 && failOnce) { failOnce = false; throw Error('synthetic network failure'); }
    return { pendingWakes: [], more: true, nextCursor: 'c' + (Number(cursor?.slice(1) ?? 0) + 1) };
  });
  bridge.minPollIntervalMs = 0; await bridge.pollOnce();
  assert.equal(bridge.wakeCursor, 'c20'); await assert.rejects(bridge.pollOnce(), /synthetic network failure/); assert.equal(bridge.wakeCursor, 'c20');
  await bridge.pollOnce(); assert.equal(bridge.wakeCursor, 'c40');
  const { bridge: fresh } = fixture(async ({ cursor }) => { assert.equal(cursor, null); return { pendingWakes: [], more: false, nextCursor: null }; });
  await fresh.pollOnce(); assert.equal(fresh.wakeCursor, null);
});
