// Deadline / resumability acceptance tests for the P1 integrity cure,
// lane B7 (design of record:
// ~/workspace/wave-2026-11-01-monday-ready/w5-p1design/P1-DESIGN.md
// §5 tests 1, 2 and the integrity half of test 8; §2.1, §3.1, §3.2).
//
// Limit L1: verifyRoomIntegrity checks its deadline only BETWEEN
// stretches, and the stretches ahead of the deferred batch are
// synchronous and unbounded. On snapshot invalidation the tick pays a
// full scanServingContent proof of every sequence-changed room (inside
// incrementalIntegrityCheck) and then, with NO deadline gate in
// between, integrityChecksum's full scan of every room's projection.
// The deferred batch (and with it the parity step) runs only at the
// end, so a tick whose budget dies in those stretches returns
// budgetExceeded having run the batch zero times. The content proof
// itself is one synchronous leg: there is no content-scan checkpoint,
// so a proof that exceeds the budget banks no progress.
//
// The cure these tests specify (design §3.1/§3.2): a deadline gate
// before every named stretch, a stretch that cannot start inside the
// budget deferred WHOLE and named on the result (deferredStretch),
// the deferred-skip counted under the existing #3896 machinery so the
// batch-first rule guarantees the batch its visit, and the content
// proof as a chunked, resumable scan whose durable progress lives in
// integrity_content_scan_checkpoint (scan bound = room sequence +
// projection metadata digest captured at scan start; range cursor =
// last message id banked). The snapshot advances only at a completed
// scan's bound; no verdict is ever issued from a partial scan.
//
// FAILING-FIRST (design §5: "Each fails on today's code for the
// designed reason; a test that cannot be made to fail today does not
// count"). At the base head 4916afa843db76fa79474a194eda70b470c1efe2:
//   - T-L1a: the invalidated 100k tick measured 5,569 ms in this
//     file's :memory: run and 10,321-14,119 ms in its file-backed runs
//     against the 5,000 ms production budget (design §2.1, at load
//     11.83/6.38/3.72: 5,602 ms), runDeferredIntegrityBatch called 0
//     times in the tick (and 0 in the next; it first runs on tick 3,
//     batch-first under the #3896 starvation rule), and no result ever
//     names a deferredStretch. Absolute times are load-inflated; the
//     structural facts (0 batch calls in the tick, no
//     deferredStretch, no checkpoint) are not.
//   - T-L1b: no integrity_content_scan_checkpoint table exists; the
//     proof is one synchronous leg per tick and the snapshot stays
//     frozen at the settled bound while every tick overruns.
//   - T-NR is the non-regression pin half and must PASS at the base
//     head and keep passing.
//
// T-L1c is NOT in this file: carved out of lane B7 by Jill's ruling
// (its failing-first version is completed after lane B3 lands its
// seam). Nothing here stubs or approximates it.
//
// Fixture: the part-2 acceptance fixture, exactly as design §2.1's
// reproduction constructs it — 100,000 posted messages x 1,024-byte
// bodies (tests/integrity-parity-fixture.mjs, the harness file the
// #5625 suites use; it is added by this tests-only branch because the
// fixture does not exist at the L1 pin), settled by the standard tick
// pair, then invalidated by direct-SQL growth of +500 messages via the
// fixture's own appendFixtureMessages, bypassing the write path.
// The store is file-backed in a scratch directory beside this file:
// this fixture's database is ~850 MB on disk, which does not fit this
// VM's 512 MB tmpfs /tmp (a store there dies with SQLITE_FULL during
// the build — measured), and the :memory: form of this exact tick
// was OOM-killed repeatedly on this VM (exit 137; design §2.1 records
// the same event at the default Node heap), while the file-backed
// form completed every attempt. The scratch directory is removed
// when the file finishes.
//
// Budget: the production job budget, deadline = now + 5000
// (JOB_BUDGET_MS = 5000, server/jobs.mjs). Slack: deadline + 1,500 ms
// — one chunk of slack, the assertion bound the part-2 fixture was
// calibrated against (its header: "~2x margin over the design's
// deadline + 1500 ms assertion bound").
//
// Run: node --test tests/integrity-l1-driver.test.js
// (on this VM the 100k tick's repeated whole-projection parses need
// heap headroom: NODE_OPTIONS=--max-old-space-size=6144)
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { servingContentProof, projectionContentHash } from "../server/write-integrity.mjs";
import { JOB_BUDGET_MS } from "../server/jobs.mjs";
import {
  BIG_COUNT, BODY_BYTES, appendFixtureMessages, generateFixtureRoom
} from "./integrity-parity-fixture.mjs";

const ROOM = "fxroom";
const SLACK_MS = 1500;
const BIG_TIMEOUT = 900000;
const GROWTH = 500;
const LAST_GROWN_ID = `fx-${String(BIG_COUNT + GROWTH - 1).padStart(6, "0")}`;

const tick = (store, opts = {}) => store.verifyRoomIntegrity({ yieldBetween: async () => {}, ...opts });
const headSeq = store => store.db.prepare("SELECT sequence FROM rooms WHERE id=?").get(ROOM).sequence;
const snapshotSeqSum = store => {
  const text = store.readIntegritySnapshot();
  return text ? Number(text.split(":")[2]) : null;
};
const checkpointTableExists = store => Boolean(store.db.prepare(
  "SELECT 1 FROM sqlite_master WHERE type='table' AND name='integrity_content_scan_checkpoint'").get());
const checkpointRow = store => checkpointTableExists(store)
  ? store.db.prepare("SELECT * FROM integrity_content_scan_checkpoint WHERE room_id=?").get(ROOM) ?? null : null;
// The design §3.2 checkpoint concepts, by the names the design gives
// them: scan bound, range cursor (last message id banked). B4 owns the
// table; if its column names differ from the design's vocabulary,
// these accessors are the contract point to reconcile — the concepts
// (a durable bound and a banked cursor) are not negotiable.
const checkpointBound = row => row?.scan_bound ?? row?.bound_seq ?? row?.bound ?? row?.sequence ?? null;
const checkpointCursor = row => row?.range_cursor ?? row?.last_message_id ?? row?.cursor ?? null;

// One shared large store for T-L1a/T-L1b (node:test runs a file's tests
// sequentially): build, settle pair, direct-SQL growth. The batch
// wrapper is measurement only, exactly as design §2.1's repro wrapped
// the store's own methods; no product code is modified.
let shared = null;
after(() => { shared?.cleanup(); });
async function bigStore() {
  if (shared) return shared;
  const directory = mkdtempSync(join(dirname(fileURLToPath(import.meta.url)), ".l1-scratch-"));
  const store = new RoomStore(join(directory, "room.sqlite"), { integrity: "deferred" });
  // Shared by T-L1a and T-L1b across the file (as in the #5625
  // acceptance suite's shared store): closed once by the top-level
  // after hook above, at file end.
  store.initialize(initialRoom(ROOM));
  generateFixtureRoom(store, { roomId: ROOM, count: BIG_COUNT, bodyBytes: BODY_BYTES });
  const settle1 = await tick(store);
  const settle2 = await tick(store);
  assert.equal(settle1.verified, 1, "settle tick 1 certifies the fixture room");
  assert.equal(settle2.matched, 1, "settle tick 2 takes the incremental path");
  assert.deepEqual(store.integrityFailures(), [], "settled fixture store carries no failure records");
  const settledSnapshot = store.readIntegritySnapshot();
  const settledSeq = headSeq(store);
  let batchCalls = 0;
  const origBatch = store.runDeferredIntegrityBatch.bind(store);
  store.runDeferredIntegrityBatch = (...args) => { batchCalls++; return origBatch(...args); };
  const newHead = appendFixtureMessages(store, { roomId: ROOM, startIndex: BIG_COUNT, count: GROWTH });
  assert.equal(newHead, settledSeq + GROWTH, "direct-SQL growth moves the head by exactly +500");
  shared = {
    store, settledSnapshot, settledSeq, newHead, batchCalls: () => batchCalls,
    cleanup: () => { store.close(); rmSync(directory, { recursive: true, force: true }); }
  };
  return shared;
}

// T-NR integrity half (design §5 test 8): non-regression pins. These
// must PASS at the base head and keep passing after the cure: the
// existing small-room result shapes (matched, verified, checked,
// failures), and the direct-caller contracts of servingContentProof /
// checkMessagesParity.
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

  // checkMessagesParity, direct caller: verdict shape, byte-identical
  // in content (canonical key order).
  const canonical = value => JSON.stringify(Object.keys(value).sort().reduce((acc, k) => ({ ...acc, [k]: value[k] }), {}));
  const parity = store.checkMessagesParity({ roomId: "commons" });
  assert.deepEqual(parity,
    { ok: true, checked: 1, roomId: "commons", projectionCount: 3, tableCount: 3, projectionLastSeq: 5, tableLastSeq: 5 });
  assert.equal(canonical(parity),
    canonical({ ok: true, checked: 1, roomId: "commons", projectionCount: 3, tableCount: 3, projectionLastSeq: 5, tableLastSeq: 5 }));

  // servingContentProof, direct caller: returns the {drift, hash}
  // pair, and its hash is projectionContentHash over the same inputs
  // (the synchronous exports keep their contracts for non-tick
  // callers — design §3.2).
  const row = store.db.prepare("SELECT sequence, projection FROM rooms WHERE id=?").get("commons");
  const proof = servingContentProof(store.db, "commons", row.sequence, row.projection);
  assert.equal(typeof proof.drift, "boolean");
  assert.equal(proof.drift, false, "a store-written room's proof reports no drift");
  assert.equal(proof.hash, projectionContentHash(store.db, "commons", row.sequence, row.projection));
  assert.match(proof.hash, /^[0-9a-f]{64}$/);

  // Full tick shapes on the settled small room: first tick certifies,
  // second tick matches on the incremental path; failures empty on
  // both; the settled tick's checked/swept counts are the base shape.
  const first = await tick(store);
  assert.equal(first.verified, 1);
  assert.equal(first.matched, 0);
  assert.deepEqual(first.failures, []);
  const second = await tick(store);
  assert.equal(second.matched, 1);
  assert.equal(second.skipped, 1);
  assert.equal(second.verified, 0);
  assert.equal(second.checked, 0);
  assert.equal(second.swept, 1);
  assert.deepEqual(second.failures, []);
});

// T-L1a (design §5 test 1): deadline before checksum. Invalidated 100k
// room at the production job budget: every tick returns within
// deadline + one chunk of slack; the budget-exceeded tick reports
// budgetExceeded: 1 and names the stretch it deferred whole
// (deferredStretch, §3.1); the deferred batch runs in the same tick
// or under the existing #3896 starvation rule by the third tick.
test("T-L1a: the invalidated tick defers whole stretches and cannot starve the batch", { timeout: BIG_TIMEOUT }, async t => {
  const { store, batchCalls } = await bigStore();
  assert.equal(JOB_BUDGET_MS, 5000, "the production job budget this test drives at");
  const ticks = [];
  for (let i = 0; i < 3; i++) {
    const callsBefore = batchCalls();
    const started = Date.now();
    const result = await tick(store, { deadline: started + JOB_BUDGET_MS });
    ticks.push({ result, elapsedMs: Date.now() - started, batchCalls: batchCalls() - callsBefore });
    t.diagnostic(`tick ${i + 1}: ${ticks[i].elapsedMs} ms, budgetExceeded=${result.budgetExceeded ?? 0}, ` +
      `deferredStretch=${result.deferredStretch ?? "(none)"}, batchCalls=${ticks[i].batchCalls}, deferredSkips=${result.deferredSkips}`);
  }
  assert.equal(ticks[0].result.budgetExceeded, 1,
    "the invalidated tick cannot finish the proof inside the budget: it must report budgetExceeded");
  for (const [i, entry] of ticks.entries()) {
    assert.ok(entry.elapsedMs <= JOB_BUDGET_MS + SLACK_MS,
      `tick ${i + 1} returned in ${entry.elapsedMs} ms, over deadline + one chunk of slack (${JOB_BUDGET_MS + SLACK_MS} ms): ` +
      "at the base head the synchronous proof + checksum stretches run past the deadline with no gate in between " +
      "(design §2.1 measured 5,602 ms at load 11.83/6.38/3.72; this file's runs measured 5.6-14.1 s for tick 1 across load conditions)");
  }
  assert.ok(ticks.some(entry => typeof entry.result.deferredStretch === "string" && entry.result.deferredStretch.length > 0),
    "a budget-exceeded tick must name the stretch it deferred whole (deferredStretch, design §3.1); " +
    "at the base head no result carries the field — stretches are started past the deadline instead of deferred");
  assert.ok(ticks.reduce((sum, entry) => sum + entry.batchCalls, 0) >= 1,
    "the deferred batch must run in the same tick or under the #3896 starvation rule by the third tick");
});

// T-L1b (design §5 test 2): proof resumability. The same changed room
// (its proof exceeds the budget, per T-L1a): successive ticks bank
// content-scan checkpoint progress and complete the proof; the
// snapshot advances only at the completed scan's bound; no tick
// exceeds budget + slack.
test("T-L1b: successive ticks bank content-scan checkpoint progress and complete the proof", { timeout: BIG_TIMEOUT }, async t => {
  const { store, settledSnapshot, newHead } = await bigStore();
  const observations = [];
  let completed = false;
  for (let i = 0; i < 6 && !completed; i++) {
    const started = Date.now();
    const result = await tick(store, { deadline: started + JOB_BUDGET_MS });
    const row = checkpointRow(store);
    const snapshot = store.readIntegritySnapshot();
    const failureRecorded = store.integrityFailures()
      .some(failure => failure.step === "projection_content" && failure.recordId === ROOM);
    observations.push({ result, elapsedMs: Date.now() - started, row, snapshot, failureRecorded });
    t.diagnostic(`tick ${i + 1}: ${observations[i].elapsedMs} ms, checkpoint=${row ? JSON.stringify(row) : "(none)"}, ` +
      `snapshotSeqSum=${snapshotSeqSum(store)}, failureRecorded=${failureRecorded}`);
    // Completion of the scan at its bound: the checkpoint cursor has
    // banked the last grown message, or the checkpoint is retired
    // because the scan completed and its verdict stands (the room's
    // content failure recorded, or the snapshot advanced to the new
    // head). A verdict is never issued from a partial scan.
    completed = checkpointCursor(row) === LAST_GROWN_ID
      || (row === null && checkpointTableExists(store) && (failureRecorded || snapshotSeqSum(store) === newHead));
    // While the scan is incomplete the snapshot must not move: it
    // advances only at the completed scan's bound, in one step.
    if (!completed) {
      assert.equal(snapshot, settledSnapshot,
        "the snapshot must not advance while the content scan is incomplete");
    }
  }
  for (const [i, entry] of observations.entries()) {
    assert.ok(entry.elapsedMs <= JOB_BUDGET_MS + SLACK_MS,
      `tick ${i + 1} returned in ${entry.elapsedMs} ms, over deadline + one chunk of slack (${JOB_BUDGET_MS + SLACK_MS} ms): ` +
      "at the base head the proof is one synchronous leg per tick with no deadline gate inside it");
  }
  assert.ok(checkpointTableExists(store),
    "the cure banks durable scan progress in integrity_content_scan_checkpoint (design §3.2); " +
    "at the base head the table does not exist — the proof is one synchronous leg and banks nothing");
  const banked = observations.find(entry => entry.row);
  assert.ok(banked,
    "a budget-exceeded tick must leave a banked content-scan checkpoint row for the changed room");
  if (banked) {
    assert.equal(Number(checkpointBound(banked.row)), newHead,
      "the banked scan's bound is the room sequence captured at scan start (the grown head)");
    assert.ok(typeof checkpointCursor(banked.row) === "string" && checkpointCursor(banked.row).length > 0,
      "the banked checkpoint carries a range cursor (last message id banked, design §3.2)");
  }
  assert.ok(completed,
    "successive ticks must complete the proof at the scan's bound within 6 ticks; " +
    "at the base head no scan ever completes — every tick re-pays the whole synchronous proof and the snapshot stays frozen");
});
