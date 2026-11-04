// Wake-loop guard (server/agent-wake-bucket.mjs).
//
// Contract: an agent can be instantly woken at most `capacity` times in one
// room before the bucket refills; over budget the signal is still queued
// (never dropped) and only the immediate poll release is skipped.
// Regression: two agents mentioning each other wake-loop without bound, or
// a guard that drops signals instead of deferring them.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { AgentHeartbeats, agentHeartbeatSchema, HEARTBEAT_STALE_AFTER_MS } from "../server/agent-heartbeats.mjs";
import { WakeBucket, wakeBucketLimits } from "../server/agent-wake-bucket.mjs";

test("bucket spends, refuses when empty, refills, and is keyed per agent and room", () => {
  let at = 0; const bucket = new WakeBucket(() => at, { capacity: 2, refillPerMinute: 6, maxKeys: 100 });
  assert.equal(bucket.take("a", "r"), true);
  assert.equal(bucket.take("a", "r"), true);
  assert.equal(bucket.take("a", "r"), false);
  assert.equal(bucket.take("a", "other"), true, "another room has its own bucket");
  assert.equal(bucket.take("b", "r"), true, "another agent has its own bucket");
  at += 10000;
  assert.equal(bucket.take("a", "r"), true, "one token refills every 10s at 6/min");
  assert.equal(bucket.take("a", "r"), false);
});

test("over-budget wakes stay queued but do not release the poll", t => {
  const db = new DatabaseSync(":memory:");
  db.exec(agentHeartbeatSchema);
  let at = 1_750_000_000_000;
  const hb = new AgentHeartbeats({ db, now: () => at, transaction: fn => { db.exec("BEGIN IMMEDIATE"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } } }, { staleAfterMs: HEARTBEAT_STALE_AFTER_MS });
  t.after(() => db.close());
  hb.heartbeat({ agentId: "ai_loop", hostId: "h" });
  let wakes = 0;
  const wait = () => t.after(hb.addWakeWaiter("ai_loop", "h", { roomId: null, onWake: () => { wakes++; } }));
  for (let i = 0; i < wakeBucketLimits.capacity; i += 1) {
    wait();
    const r = hb.enqueueWake({ agentId: "ai_loop", kind: "mention", roomId: "commons", messageId: `m-${i}` });
    assert.equal(r.throttled, undefined);
  }
  assert.equal(wakes, wakeBucketLimits.capacity);
  wait();
  const over = hb.enqueueWake({ agentId: "ai_loop", kind: "mention", roomId: "commons", messageId: "m-over" });
  assert.equal(over.enqueued, true, "the signal is still queued");
  assert.equal(over.throttled, true);
  assert.equal(wakes, wakeBucketLimits.capacity, "the waiting poll is not released");
  assert.ok(hb.pendingWakes("ai_loop").some(s => s.messageId === "m-over"), "delivered on the next heartbeat or poll");
  at += 60000 / wakeBucketLimits.refillPerMinute;
  hb.enqueueWake({ agentId: "ai_loop", kind: "mention", roomId: "commons", messageId: "m-after" });
  assert.equal(wakes, wakeBucketLimits.capacity + 1, "a refilled token wakes instantly again");
});
