// Byte-budget acceptance tests for the P1 integrity cure, lane B8
// (design of record:
// ~/workspace/wave-2026-11-01-monday-ready/w5-p1design/P1-DESIGN.md §5,
// tests 4-7 plus the parity half of test 8).
//
// The #5625 chunked parity engine bounds rows and time per visit; the
// P1 design (limits L2/L3) found it does not bound bytes: fetches
// materialize whole bodies before the byte counter runs, the visit
// preamble parses the whole room projection, and checkpoint payloads
// are capped only on one field, against an estimate. These tests assert
// the design's §3.3 budgets at the Node store seam, measured by a
// byte-counting db wrapper (tests/integrity-parity-byte-harness.mjs) —
// never by the engine's own counters:
//
//   VISIT_BYTES      = 256 KiB per visit segment (commit segment,
//                      preamble included), + one largest-row allowance
//   CHECKPOINT_BYTES = 256 KiB per checkpoint row, serialized, all
//                      JSON fields together
//   write bound      = cumulative checkpoint bytes per scan
//                      <= (rows scanned / 1,600) x CHECKPOINT_BYTES
//
// FAILING-FIRST (design §5: "Each fails on today's code for the designed
// reason; a test that cannot be made to fail today does not count").
// At the base head ff843d27202854565fefac6f80a9e848c3c2b9d1 the designed
// failures are: the counts/bodies preamble fetches the whole projection
// (23.7 MB on the 20k fixture; parityNumbers parses it for a count, the
// bodies phase parses it again); one events commit segment fetches
// 2,089,600 B (8 sub-chunks x 200 rows, counter reset per sub-chunk);
// oversize bodies arrive 200 rows per .all() with no fetchOversize
// report; staged_seq_json commits grow past 256 KiB toward the 1 MiB
// estimate-enforced cap; a full 100k scan rewrites the staged map on
// every commit of every phase, unbounded. T-NR is the non-regression
// pin half and must PASS at the base head and keep passing.
//
// Run: node --test tests/integrity-parity-bytes.test.js
// (Bun also runs it: bun test --timeout 900000 tests/integrity-parity-bytes.test.js)
import test from "node:test";
import assert from "node:assert/strict";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { runMessagesParityCheck } from "../server/messages-store.mjs";
import {
  BIG_COUNT, BODY_BYTES, fixtureBody, generateFixtureRoom
} from "./integrity-parity-fixture.mjs";
import {
  VISIT_BYTES, CHECKPOINT_BYTES, installByteCounter
} from "./integrity-parity-byte-harness.mjs";

const BYTE_COUNT = 20000;   // the design §2.2 byte fixture: 20k x 1,024-B bodies
const BIG_TIMEOUT = 900000;

function fixtureStore(t, roomId, count, bodyBytes = BODY_BYTES) {
  const store = new RoomStore(":memory:", { integrity: "deferred" });
  t.after(() => store.close());
  store.initialize(initialRoom(roomId));
  generateFixtureRoom(store, { roomId, count, bodyBytes });
  return store;
}

// T-L2a (design §5 test 4): per-visit materialization. Total text bytes
// fetched per visit segment <= VISIT_BYTES + one largest-row allowance,
// preamble included.
test("T-L2a: per-visit materialization is byte-bounded, preamble included", { timeout: BIG_TIMEOUT }, async t => {
  const store = fixtureStore(t, "fx20k", BYTE_COUNT);
  const projectionBytes = store.db.prepare("SELECT LENGTH(projection) AS b FROM rooms WHERE id=?")
    .get("fx20k").b;
  assert.ok(projectionBytes > VISIT_BYTES,
    `fixture projection (${projectionBytes} B) must exceed VISIT_BYTES for the preamble assertion to bite`);
  const counter = installByteCounter(store);
  const result = await runMessagesParityCheck(store, {});
  counter.finish();
  assert.equal(result.checked, 1, "the 20k fixture room certifies in one visit");
  t.diagnostic(`segments: ${counter.segments.map(s => s.bytes).join(", ")}`);
  const violations = counter.segments
    .map((segment, index) => ({ index, ...segment }))
    .filter(segment => segment.bytes > VISIT_BYTES + segment.largestRow);
  assert.deepEqual(violations.map(v => `segment ${v.index}: ${v.bytes} B fetched (largest row ${v.largestRow} B)`), [],
    `every visit segment must materialize <= VISIT_BYTES (${VISIT_BYTES}) + one largest row; the preamble and the per-sub-chunk counter resets break this at the base head`);
});

// T-L2b (design §5 test 5): fetch paging. A room whose bodies each
// exceed VISIT_BYTES / 2: no single query result exceeds the budget +
// one row; oversize rows are processed singly and reported.
test("T-L2b: oversize rows are fetched singly and reported (fetchOversize)", { timeout: BIG_TIMEOUT }, async t => {
  const bodyBytes = 200 * 1024; // > VISIT_BYTES / 2, < VISIT_BYTES
  const store = fixtureStore(t, "fxhuge", 12, bodyBytes);
  const counter = installByteCounter(store);
  const result = await runMessagesParityCheck(store, {});
  counter.finish();
  assert.equal(result.checked, 1, "oversize rows are still processed: the room certifies");
  const fat = counter.queries.filter(q => q.bytes > VISIT_BYTES + q.largestRow);
  assert.deepEqual(fat.map(q => `${q.sql} -> ${q.bytes} B in ${q.rows} rows`), [],
    `no single query result may exceed VISIT_BYTES (${VISIT_BYTES}) + one row; fetch-then-count .all() breaks this at the base head`);
  assert.ok((result.fetchOversize ?? 0) >= 1,
    `the visit result must report oversize rows as fetchOversize (mirroring checkpointOversize); got ${result.fetchOversize}`);
});

// T-L3a (design §5 test 6): checkpoint payload. At every commit of a
// big-room parity scan, the serialized checkpoint row <=
// CHECKPOINT_BYTES across all JSON fields together.
test("T-L3a: every checkpoint payload is byte-bounded on serialized size", { timeout: BIG_TIMEOUT }, async t => {
  const store = fixtureStore(t, "fx20k", BYTE_COUNT);
  const counter = installByteCounter(store);
  const result = await runMessagesParityCheck(store, {});
  counter.finish();
  assert.equal(result.checked, 1, "the 20k fixture room certifies");
  assert.ok(counter.checkpointWrites.length >= 10,
    `a 20k scan must commit its checkpoint many times (got ${counter.checkpointWrites.length})`);
  const over = counter.checkpointWrites.filter(w => w.jsonBytes > CHECKPOINT_BYTES);
  t.diagnostic(`checkpoint writes: ${counter.checkpointWrites.length}, max payload ${Math.max(...counter.checkpointWrites.map(w => w.jsonBytes))} B`);
  assert.deepEqual(over.map(w => `${w.jsonBytes} B (largest field ${w.largestJsonField} B)`), [],
    `every checkpoint row's JSON fields together must serialize to <= CHECKPOINT_BYTES (${CHECKPOINT_BYTES}); at the base head staged_seq_json alone grows past it toward the 1 MiB estimate cap`);
});

// T-L3b (design §5 test 7): checkpoint write bound. A full 100k scan's
// cumulative checkpoint bytes written <= (rows / 1,600) x
// CHECKPOINT_BYTES. Rows scanned = the two row domains the engine
// examines, events + messages = 2 x BIG_COUNT on this fixture.
test("T-L3b: cumulative checkpoint bytes written per scan are bounded", { timeout: BIG_TIMEOUT }, async t => {
  const store = fixtureStore(t, "fx100k", BIG_COUNT);
  const counter = installByteCounter(store);
  const result = await runMessagesParityCheck(store, {});
  counter.finish();
  assert.equal(result.checked, 1, "the 100k fixture room certifies");
  const rowsScanned = 2 * BIG_COUNT;
  const bound = (rowsScanned / 1600) * CHECKPOINT_BYTES;
  t.diagnostic(`checkpoint writes: ${counter.checkpointWrites.length}, cumulative ${counter.totalCheckpointJsonBytes} B, bound ${bound} B`);
  assert.ok(counter.totalCheckpointJsonBytes <= bound,
    `cumulative checkpoint bytes written (${counter.totalCheckpointJsonBytes}) must be <= (rows/1600) x CHECKPOINT_BYTES = ${bound}; at the base head the whole staged map is rewritten on every commit of every phase, unbounded`);
});

// T-NR parity half (design §5 test 8): non-regression pins. These must
// PASS at the base head and keep passing after the cure: the small-room
// result shapes (matched, verified, checked, failures) on the same
// fixtures, and the direct-caller contracts of checkMessagesParity.
test("T-NR: small-room result shapes and direct-caller contracts are unchanged", { timeout: 120000 }, async t => {
  const store = new RoomStore(":memory:");
  t.after(() => store.close());
  store.initialize(initialRoom("commons"));
  const owner = store.issueAccessKey("commons", "owner");
  let now = Date.now() + 10000;
  store.now = () => now;
  for (const id of ["a", "b", "c"]) {
    now += 2001;
    store.command(owner, "commons", { id, type: "message.posted", data: { messageId: id, body: "shape pin " + id } });
  }
  while (!store.backfillMessages({ limit: 1000 }).done) { /* fixture */ }
  // Matched shape, byte-identical in content (canonical key order).
  const canonical = value => JSON.stringify(Object.keys(value).sort().reduce((acc, k) => ({ ...acc, [k]: value[k] }), {}));
  const parity = store.checkMessagesParity({ roomId: "commons" });
  assert.deepEqual(parity,
    { ok: true, checked: 1, roomId: "commons", projectionCount: 3, tableCount: 3, projectionLastSeq: 5, tableLastSeq: 5 });
  assert.equal(canonical(parity),
    canonical({ ok: true, checked: 1, roomId: "commons", projectionCount: 3, tableCount: 3, projectionLastSeq: 5, tableLastSeq: 5 }));
  // The parity step's result shape on the same room.
  const step = store.runIntegrityParityStep();
  assert.equal(step.ok, true);
  assert.equal(step.checked, 1);
  assert.deepEqual(step.failures, []);
  // A full tick reports no failures for the settled small room.
  const tickResult = await store.verifyRoomIntegrity({ yieldBetween: async () => {} });
  assert.deepEqual(tickResult.failures, []);

  // Failure shape: a poisoned room's verdict is identical through the
  // direct caller (throws) and the step (records), message and code.
  const poison = new RoomStore(":memory:", { integrity: "deferred" });
  t.after(() => poison.close());
  poison.initialize(initialRoom("fxroom"));
  generateFixtureRoom(poison, { roomId: "fxroom", count: 100 });
  poison.db.prepare("UPDATE messages SET body='tampered fixture body' WHERE room_id=? AND message_id='fx-000042'").run("fxroom");
  assert.throws(() => poison.checkMessagesParity({ roomId: "fxroom" }),
    error => error.message === "messages parity failed for fxroom: current record fx-000042 differs (body)");
  // Restoring the body makes the same direct call certify: the contract
  // is verdict-only, no state leaks from the failed attempt.
  poison.db.prepare("UPDATE messages SET body=? WHERE room_id=? AND message_id='fx-000042'")
    .run(fixtureBody(42, BODY_BYTES), "fxroom");
  assert.equal(poison.checkMessagesParity({ roomId: "fxroom" }).ok, true);
});
