// Wake-loop guard over the real HTTP poll (review ask on #5745).
//
// Contract: when the per-(agent, room) bucket is empty, a held
// GET /api/agent-wakes/poll is not released early, but the post-wait read
// still returns every queued signal, including the throttled one, and ack
// drains them all. The cost is bounded by the poll's own waitMs (room-acp
// holds 25000 ms on its first page), never a lost signal.
import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createAcceptanceFixture } from "../scripts/acceptance-fixture.mjs";
import { createRoomServer } from "../server/http.mjs";
import { linkWithProof } from "./helpers/link-with-proof.mjs";
import { wakeBucketLimits } from "../server/agent-wake-bucket.mjs";

async function serve(t) {
  const f = createAcceptanceFixture();
  const server = createRoomServer({ store: f.store });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeStreams(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    f.store.close(); rmSync(f.directory, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const identity = f.store.identities.create("wake-bucket-agent");
  linkWithProof(f.store, f.keys.owner, "commons", identity, { memberId: "loopagent", displayName: "Loop Agent", permissions: ["accept_work"] });
  const call = (path, init = {}) => fetch(`${origin}${path}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${identity.secret}` } }).then(r => r.json());
  await call("/api/agent-heartbeats", { method: "POST", body: JSON.stringify({ hostId: "loop-host", mode: "wakeable" }) });
  const hb = f.store.agentHeartbeats;
  const enqueue = messageId => hb.enqueueWake({ agentId: identity.identityId, kind: "mention", roomId: "commons", messageId });
  const poll = waitMs => call(`/api/agent-wakes/poll?hostId=loop-host&waitMs=${waitMs}`);
  const ack = signalIds => call("/api/agent-heartbeats/ack", { method: "POST", body: JSON.stringify({ signalIds }) });
  return { identity, hb, enqueue, poll, ack, fixture: f };
}

const timed = async promise => { const start = performance.now(); const value = await promise; return { value, ms: performance.now() - start }; };
const later = (ms, fn) => new Promise(resolve => setTimeout(() => resolve(fn()), ms));

test("in budget: a held poll is released as soon as a wake is queued", async t => {
  const f = await serve(t);
  const held = timed(f.poll(3000));
  await later(100, () => assert.equal(f.enqueue("m-in").throttled, undefined));
  const { value, ms } = await held;
  assert.ok(ms < 1500, `released early (${Math.round(ms)} ms)`);
  assert.deepEqual(value.pendingWakes.map(w => w.messageId), ["m-in"]);
});

test("over budget: the held poll rides out waitMs, then returns every queued signal and ack drains them", async t => {
  const f = await serve(t);
  // Spend the bucket with queued in-budget wakes the agent has not handled yet.
  const spent = [];
  for (let i = 0; i < wakeBucketLimits.capacity; i += 1) spent.push(f.enqueue(`m-${i}`));
  assert.ok(spent.every(r => r.throttled === undefined));
  const first = await f.poll(0);
  assert.equal(first.pendingWakes.length, wakeBucketLimits.capacity);
  const acked = await f.ack(first.pendingWakes.map(w => w.signalId));
  assert.equal(acked.acknowledged.length, wakeBucketLimits.capacity, "no ack lost");
  // The agent re-polls with nothing pending; the next wake is over budget.
  const WAIT = 1200;
  const held = timed(f.poll(WAIT));
  await later(100, () => { const r = f.enqueue("m-over"); assert.equal(r.enqueued, true); assert.equal(r.throttled, true); });
  const { value, ms } = await held;
  assert.ok(ms >= WAIT - 100, `not released early (${Math.round(ms)} ms of ${WAIT})`);
  assert.deepEqual(value.pendingWakes.map(w => w.messageId), ["m-over"], "the throttled signal is delivered by the same poll");
  const drained = await f.ack(value.pendingWakes.map(w => w.signalId));
  assert.equal(drained.acknowledged.length, 1);
  assert.deepEqual((await f.poll(0)).pendingWakes, [], "nothing left behind");
  t.diagnostic(`extra wait for an over-budget wake: ${Math.round(ms - 100)} ms at waitMs=${WAIT}; bounded by waitMs (room-acp first page holds 25000 ms)`);
});

// Behavior, not just the code path: a real mention posted in a reply wakes
// the agent's held poll within one poll cycle, and a ping-pong of replies
// that keep mentioning it gets throttled after the bucket is spent.
const mentionReply = (f, keys, store, n, replyToId) => store.command(keys.owner, "commons", {
  id: `pp-${n}`, type: "message.posted",
  data: { messageId: `pp-${n}`, body: `<@loopagent> ping ${n}`, ...(replyToId ? { replyToId } : {}) } });

test("a real mention in a reply releases the held poll within one poll cycle", async t => {
  const f = await serve(t);
  const held = timed(f.poll(3000));
  await later(100, () => mentionReply(f, f.fixture.keys, f.fixture.store, 0));
  const { value, ms } = await held;
  assert.ok(ms < 1500, `woken within one cycle (${Math.round(ms)} ms of 3000)`);
  assert.ok(value.pendingWakes.some(w => w.messageId === "pp-0"), "wake names the mentioning message");
});

test("ping-pong: replies that keep mentioning the agent are throttled once the bucket is spent", async t => {
  const f = await serve(t);
  let throttledAt = null;
  for (let i = 1; i <= wakeBucketLimits.capacity + 5; i += 1) {
    const held = timed(f.poll(400));
    await later(20, () => mentionReply(f, f.fixture.keys, f.fixture.store, i, i > 1 ? `pp-${i - 1}` : undefined));
    const { value, ms } = await held;
    assert.ok(value.pendingWakes.some(w => w.messageId === `pp-${i}`), `turn ${i} signal still delivered`);
    await f.ack(value.pendingWakes.map(w => w.signalId));
    if (ms >= 350) { throttledAt = i; break; }
  }
  assert.equal(throttledAt, wakeBucketLimits.capacity + 1, "first capacity turns wake instantly, the next is throttled");
  t.diagnostic(`ping-pong throttled at turn ${throttledAt}; signal still delivered on the same poll`);
});
