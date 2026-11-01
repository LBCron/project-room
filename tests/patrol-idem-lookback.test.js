// Patrol's idempotency look-back must not re-read a room's whole preceding
// history on every batch: with a fixed 200-event tail, the rows the look-back
// reads stay flat as history grows. Duplicates across batches are still
// found, including for rooms patrolled before the key index existed.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { runPatrolTick, ensurePatrolSchema, PATROL_BATCH } from "../server/patrol.mjs";

function roomWithEvents(count, { keyAt = () => null } = {}) {
  const path = join(mkdtempSync(join(tmpdir(), "project-room-idem-")), "room.sqlite");
  const store = new RoomStore(path);
  store.initialize(initialRoom("idem"));
  const base = store.db.prepare("SELECT sequence FROM rooms WHERE id='idem'").get().sequence;
  keyAt = keyAt.bind(null, base);
  const insert = store.db.prepare("INSERT INTO events VALUES(?,?,?,?)");
  store.db.exec("BEGIN");
  for (let i = 1; i <= count; i++) {
    const sequence = base + i, id = `ev-${sequence}`;
    insert.run("idem", sequence, id, JSON.stringify({ id, roomId: "idem", sequence, type: "test.noop", idempotencyKey: keyAt(sequence) ?? `k-${sequence}` }));
  }
  store.db.prepare("UPDATE rooms SET sequence=? WHERE id='idem'").run(base + count);
  store.db.exec("COMMIT");
  return { store, path, base };
}
// Record every statement the final batch runs that reads a room's events at
// or before the batch start: that is the scan whose cost grows with history.
// (Returned-row counts would not show it: the scan returns only matches.)
function historyScans(store, run) {
  const real = store.db.prepare.bind(store.db);
  const seen = [];
  store.db.prepare = sql => { if (/FROM events WHERE room_id=\? AND sequence<=\?/.test(sql)) seen.push(sql); return real(sql); };
  try { run(); } finally { store.db.prepare = real; }
  return seen.length;
}
const steady = store => { for (let i = 0; i < 400; i++) { const r = runPatrolTick(store, { roomId: "idem" }); if (!r.rooms && !r.checked) break; } };

test("with coverage, the final batch's look-back reads no preceding history, at any history size", () => {
  for (const history of [400, 1600]) {
    const { store } = roomWithEvents(history + PATROL_BATCH);
    for (let i = 0; i < history / PATROL_BATCH; i++) runPatrolTick(store, { roomId: "idem" });
    assert.equal(historyScans(store, () => runPatrolTick(store, { roomId: "idem" })), 0, `history ${history}`);
    store.close();
  }
});

test("a key reused across batches is still filed as idempotency_duplicate", () => {
  const { store, base } = roomWithEvents(3 * PATROL_BATCH, { keyAt: (b, s) => (s === b + 2 * PATROL_BATCH + 7 ? `k-${b + 5}` : null) });
  steady(store);
  const dup = store.db.prepare("SELECT sequence, detail FROM patrol_findings WHERE kind='idempotency_duplicate'").all();
  assert.deepEqual(dup.map(row => [row.sequence, JSON.parse(row.detail).firstSequence]), [[base + 2 * PATROL_BATCH + 7, base + 5]]);
});

test("a room patrolled before the key index existed still finds an old duplicate and gains coverage", () => {
  const { store, base } = roomWithEvents(4 * PATROL_BATCH, { keyAt: (b, s) => (s === b + 3 * PATROL_BATCH + 9 ? `k-${b + 3}` : null) });
  runPatrolTick(store, { roomId: "idem" });
  runPatrolTick(store, { roomId: "idem" });
  // Simulate the pre-index state: the cursor moved, but no keys were indexed.
  ensurePatrolSchema(store);
  store.db.exec("DELETE FROM patrol_idem_keys; DELETE FROM patrol_idem_coverage;");
  steady(store);
  const dup = store.db.prepare("SELECT sequence, detail FROM patrol_findings WHERE kind='idempotency_duplicate'").all();
  assert.deepEqual(dup.map(row => [row.sequence, JSON.parse(row.detail).firstSequence]), [[base + 3 * PATROL_BATCH + 9, base + 3]]);
  const through = store.db.prepare("SELECT through FROM patrol_idem_coverage WHERE room_id='idem'").get()?.through;
  assert.equal(through, base + 4 * PATROL_BATCH, "coverage catches up to the cursor");
});

test("a gap just before the batch start does not stall legacy coverage", () => {
  const { store } = roomWithEvents(3 * PATROL_BATCH);
  runPatrolTick(store, { roomId: "idem" });
  const cursor = store.db.prepare("SELECT sequence FROM patrol_cursor WHERE room_id='idem'").get().sequence;
  ensurePatrolSchema(store);
  store.db.exec("DELETE FROM patrol_idem_keys; DELETE FROM patrol_idem_coverage;");
  // The last few events before the cursor are missing from the log.
  store.db.prepare("DELETE FROM events WHERE room_id='idem' AND sequence>? AND sequence<?").run(cursor - 5, cursor);
  runPatrolTick(store, { roomId: "idem" });
  const through = store.db.prepare("SELECT through FROM patrol_idem_coverage WHERE room_id='idem'").get()?.through;
  assert.equal(through, cursor + PATROL_BATCH);
});

// Patrol's continuation and key-index tables are lazy application tables:
// an export taken after a tick must restore (every restore path builds
// lazy schemas from code-owned DDL, never from the export).
test("an export taken after patrol ticks restores, keeping rotation and key-index rows", async () => {
  const { exportNdjsonText } = await import("../server/room-export.mjs");
  const { replayNdjsonInto } = await import("../server/restore-ndjson.mjs");
  const store = new RoomStore(join(mkdtempSync(join(tmpdir(), "project-room-idem-export-")), "room.sqlite"));
  store.initialize(initialRoom("idem"));
  const key = store.issueAccessKey("idem", "owner");
  for (let i = 0; i < 3; i++) store.command(key, "idem", { id: `c-${i}`, type: "message.posted", data: { body: "b", messageId: `m-${i}` } });
  runPatrolTick(store, { limit: 2 });
  runPatrolTick(store, { limit: 2 });
  const rows = db => ["patrol_rotation", "patrol_idem_keys", "patrol_idem_coverage"].map(table => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
  const before = rows(store.db);
  assert.ok(before.every(n => n > 0), `fixture populates every table: ${before}`);
  const restored = new RoomStore(":memory:");
  try {
    const result = replayNdjsonInto(exportNdjsonText(store.db), restored);
    assert.equal(result.verified, true);
    assert.deepEqual(rows(restored.db), before);
  } finally { restored.close(); store.close(); }
});
