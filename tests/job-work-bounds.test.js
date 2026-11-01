// Deployed Workers freeze Date.now() during synchronous execution: it only
// advances after I/O. A job loop bounded only by `Date.now() > deadline`
// therefore never stops early in production, and one long synchronous
// pass holds the single Room DO past the 2.5s readiness probe. These tests
// freeze the clock the same way and prove each job loop still stops at a
// deterministic work bound.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { runPatrolTick, PATROL_TICK_ROOMS } from "../server/patrol.mjs";
import { backfillPublicReadModel } from "../server/public-read-model.mjs";

function freezeClock(t) {
  const frozen = Date.now(), real = Date.now;
  Date.now = () => frozen;
  t.after(() => { Date.now = real; });
  return frozen;
}
function storeWithRooms(count) {
  const path = join(mkdtempSync(join(tmpdir(), "project-room-bounds-")), "room.sqlite");
  const store = new RoomStore(path);
  store.path = path;
  for (let i = 0; i < count; i++) {
    const roomId = `room-${String(i).padStart(3, "0")}`;
    store.initialize(initialRoom(roomId));
    const key = store.issueAccessKey(roomId, "owner");
    store.command(key, roomId, { id: `cmd-${roomId}`, type: "message.posted", data: { body: "hello", messageId: `m-${roomId}` } });
  }
  return store;
}

test("patrol stops at a per-tick room bound under a frozen clock, and later ticks rotate to the rest", t => {
  const rooms = PATROL_TICK_ROOMS * 2 + 3;
  const store = storeWithRooms(rooms);
  const now = freezeClock(t);
  const seen = new Set();
  const first = runPatrolTick(store, { deadline: now + 5000 });
  assert.equal(first.rooms, PATROL_TICK_ROOMS, "the frozen deadline never trips; the work bound must");
  assert.equal(first.budgetExceeded, 1);
  for (let tick = 0; tick < 5; tick++) runPatrolTick(store, { deadline: now + 5000 });
  for (const row of store.db.prepare("SELECT room_id, sequence FROM patrol_cursor").all()) if (row.sequence > 0) seen.add(row.room_id);
  assert.equal(seen.size >= rooms, true, `every room is patrolled across ticks (no starvation): ${seen.size}/${rooms}`);
  const caughtUp = runPatrolTick(store, { deadline: now + 5000 });
  assert.equal(caughtUp.rooms, 0);
  assert.equal(caughtUp.budgetExceeded, undefined);
});

test("the patrol's fair continuation survives a store reopen (DO restart)", t => {
  const store = storeWithRooms(PATROL_TICK_ROOMS + 4);
  const now = freezeClock(t);
  runPatrolTick(store, { deadline: now + 5000 });
  const path = store.path;
  store.close();
  const reopened = new RoomStore(path);
  const second = runPatrolTick(reopened, { deadline: now + 5000 });
  assert.equal(second.rooms, 4, "resumes after the last tailed room instead of restarting at the first");
  assert.equal(reopened.db.prepare("SELECT COUNT(*) AS n FROM patrol_cursor WHERE sequence > 0").get().n, PATROL_TICK_ROOMS + 4);
});

test("an explicit single-room patrol is not limited by the tick room bound", t => {
  const store = storeWithRooms(2);
  const now = freezeClock(t);
  assert.equal(runPatrolTick(store, { deadline: now + 5000, roomId: "room-001" }).rooms, 1);
});

test("public read-model backfill stops at its batch bound under a frozen clock", t => {
  const store = storeWithRooms(45);
  const now = freezeClock(t);
  const batch = backfillPublicReadModel(store, { deadline: now + 5000 });
  assert.ok(batch.rooms <= 20, `one batch is bounded by rows, not time: ${batch.rooms}`);
  assert.equal(batch.done, false);
});
