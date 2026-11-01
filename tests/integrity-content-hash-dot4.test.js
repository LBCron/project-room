import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { createOperatorPurge } from "../server/operator-purge.mjs";

// Dot's ROUND-4 recheck of PR #5506 (muse-room seq 24405, defect
// verdict accepted by Jill at seq 24472) broke the round-3 cure: its
// covered_event_rowid high-water mark decides newness by insertion
// order, but the operator purge physically deletes events and SQLite
// then hands a genuinely new room rowids BELOW the mark, so the new
// room is judged "covered" and takes a durable false
// projection_content failure. Dot's writer-map audit (seq 24454)
// prescribes the structural cure implemented here: the baseline is
// seeded atomically when a room is created (RoomStore.initialize,
// the same transaction that inserts the room and its events,
// following the importEvents precedent), snapshots written by
// seed-era code carry a seeded_baseline stamp, and on a stamped
// snapshot the scan performs NO newness inference at all — a missing
// remembered row fails closed, whatever the rowids say. Snapshots
// written before seeding existed keep the round-3 insertion test as
// their bounded, self-extinguishing bridge: the first baseline the
// seed-era code publishes stamps seeded_baseline and the bridge can
// never fire again. The operator purge no longer recomputes the
// snapshot over whatever bytes survive (which laundered a surviving
// room's drift); it recomposes the snapshot from the surviving
// rooms' remembered hashes, and writes nothing when a survivor has
// no remembered hash to compose from.

const tick = store => store.verifyRoomIntegrity({ yieldBetween: async () => {} });

function openStore(options = {}) {
  const directory = mkdtempSync(join(tmpdir(), "project-room-integrity-dot4-"));
  const filename = join(directory, "room.sqlite");
  const store = new RoomStore(filename, options);
  store.initialize(initialRoom("alpha"));
  return {
    store,
    filename,
    close() {
      try { store.close(); } catch {}
      rmSync(directory, { recursive: true, force: true });
    }
  };
}

function snapshotRow(store) {
  return store.db.prepare("SELECT checksum, covered_event_rowid AS mark FROM integrity_snapshot WHERE id=1").get() ?? null;
}

function seededOf(store) {
  try { return store.db.prepare("SELECT seeded_baseline AS seeded FROM integrity_snapshot WHERE id=1").get()?.seeded ?? null; }
  catch { return null; }
}

function roomState(store, roomId) {
  return store.db.prepare("SELECT sequence, projection_bytes AS bytes, projection_hash AS hash FROM integrity_room_state WHERE room_id=?").get(roomId) ?? null;
}

function contentFailures(store, roomId) {
  return store.integrityFailures().filter(row => row.step === "projection_content" && row.recordId === roomId);
}

function mutateSameLength(store, roomId) {
  const row = store.db.prepare("SELECT projection, LENGTH(projection) AS bytes FROM rooms WHERE id=?").get(roomId);
  const tampered = row.projection.replace("Project Room Commons", "Project Room Commonz");
  assert.notEqual(tampered, row.projection);
  store.db.prepare("UPDATE rooms SET projection=? WHERE id=?").run(tampered, roomId);
  assert.equal(store.db.prepare("SELECT LENGTH(projection) AS bytes FROM rooms WHERE id=?").get(roomId).bytes, row.bytes);
}

function purgeRoom(store, roomId) {
  const purge = createOperatorPurge(store);
  const plan = purge.plan({ targets: [{ kind: "room", id: roomId }], reason: "round-4 acceptance purge" }, randomUUID());
  return purge.execute({ planId: plan.planId, confirmToken: plan.confirmToken }, randomUUID());
}

test("Dot round-4 4a: a room carries its integrity baseline from birth, seeded by initialize before any scan runs", async () => {
  const fixture = openStore();
  try {
    const seeded = roomState(fixture.store, "alpha");
    assert.ok(seeded, "initialize seeds the room's integrity_room_state row in the creation transaction");
    assert.match(seeded.hash ?? "", /^[0-9a-f]{64}$/, "the seeded row carries the content hash of the stored projection");
    const room = fixture.store.db.prepare("SELECT sequence, LENGTH(projection) AS bytes FROM rooms WHERE id='alpha'").get();
    assert.equal(seeded.sequence, room.sequence);
    assert.equal(seeded.bytes, room.bytes);
    const scan = await tick(fixture.store);
    assert.equal(scan.verified, 1);
    const quiet = await tick(fixture.store);
    assert.equal(quiet.matched, 1);
  } finally { fixture.close(); }
});

test("Dot round-4 4b (owner case): purge the high-rowid room, then a genuinely new room reusing low rowids verifies clean", async () => {
  const fixture = openStore();
  try {
    fixture.store.initialize(initialRoom("beta"));
    await tick(fixture.store);
    await tick(fixture.store);
    const baseline = snapshotRow(fixture.store);
    assert.match(baseline.checksum, /^v2:/);
    const betaFirst = fixture.store.db.prepare("SELECT MIN(rowid) AS m FROM events WHERE room_id='beta'").get().m;
    assert.ok(betaFirst > 1, "beta holds the high-rowid region of the log");
    purgeRoom(fixture.store, "beta");
    assert.equal(fixture.store.db.prepare("SELECT COUNT(*) AS n FROM rooms WHERE id='beta'").get().n, 0);
    fixture.store.initialize(initialRoom("gamma"));
    const gammaFirst = fixture.store.db.prepare("SELECT MIN(rowid) AS m FROM events WHERE room_id='gamma'").get().m;
    assert.ok(gammaFirst <= baseline.mark,
      "reuse precondition: the new room's first event sits at or below the snapshot's covered mark — the round-3 exemption cannot fire");
    const scan = await tick(fixture.store);
    assert.equal(scan.verified, 1, "a genuinely new room born after a purge is baselined, not convicted by reused rowids");
    assert.equal(scan.baselineUnverifiable, undefined);
    assert.deepEqual(contentFailures(fixture.store, "gamma"), []);
    assert.ok(roomState(fixture.store, "gamma")?.hash);
    const quiet = await tick(fixture.store);
    assert.equal(quiet.matched, 1);
  } finally { fixture.close(); }
});

test("Dot round-4 4c: purging room A does not launder room B's drift — the purge must not re-bless surviving bytes", async () => {
  const fixture = openStore();
  try {
    fixture.store.initialize(initialRoom("beta"));
    await tick(fixture.store);
    await tick(fixture.store);
    mutateSameLength(fixture.store, "beta");
    purgeRoom(fixture.store, "alpha");
    const scan = await tick(fixture.store);
    assert.notEqual(scan.matched, 1, "the post-purge snapshot must not early-return matched over drifted survivor bytes");
    assert.equal(scan.contentDrift, 1, "the surviving room's drift is judged by the audit, not blessed by the purge");
    assert.equal(contentFailures(fixture.store, "beta").length, 1);
  } finally { fixture.close(); }
});

test("Dot round-4 4d: on a seed-era baseline there is no rowid exemption — a lost row fails closed even if the room's events are reinserted above the mark", async () => {
  const fixture = openStore();
  try {
    fixture.store.initialize(initialRoom("beta"));
    await tick(fixture.store);
    await tick(fixture.store);
    const baseline = snapshotRow(fixture.store);
    assert.equal(seededOf(fixture.store), 1, "baselines written by seed-era code carry the seeded_baseline stamp");
    // Rewrite beta's log segment wholesale (fresh rowids above the
    // mark — the round-3 test would exempt this room), lose its
    // remembered row, and mutate its bytes. A third room is created
    // first to push the log's waterline far above the mark:
    // deletion alone lowers the waterline, so reinsertion after a
    // bare deletion would reuse low rowids — that is 4b's shape,
    // not this one.
    fixture.store.initialize(initialRoom("gamma"));
    const events = fixture.store.db.prepare("SELECT sequence, id, body FROM events WHERE room_id='beta' ORDER BY sequence").all();
    fixture.store.db.prepare("DELETE FROM events WHERE room_id='beta'").run();
    const insert = fixture.store.db.prepare("INSERT INTO events VALUES(?,?,?,?)");
    for (const entry of events) insert.run("beta", entry.sequence, entry.id, entry.body);
    const firstReinserted = fixture.store.db.prepare("SELECT MIN(rowid) AS m FROM events WHERE room_id='beta'").get().m;
    assert.ok(firstReinserted > baseline.mark, "the reinserted log sits above the covered mark");
    fixture.store.db.prepare("DELETE FROM integrity_room_state WHERE room_id='beta'").run();
    mutateSameLength(fixture.store, "beta");
    const scan = await tick(fixture.store);
    assert.equal(scan.verified, 0, "seed-era coverage never consults rowids: a covered room with a lost row is unverifiable");
    assert.equal(scan.baselineUnverifiable, 1);
    assert.equal(scan.baselineUpgraded, undefined);
    assert.equal(snapshotRow(fixture.store).checksum, baseline.checksum, "the snapshot must not advance over unverifiable content");
    assert.equal(roomState(fixture.store, "beta"), null, "the scan must not recreate the row from the mutated bytes");
    assert.equal(contentFailures(fixture.store, "beta").length, 1);
  } finally { fixture.close(); }
});

test("Dot round-4 4e (negative control): purge does not exempt a covered room on a seed-era baseline either", async () => {
  const fixture = openStore();
  try {
    fixture.store.initialize(initialRoom("beta"));
    await tick(fixture.store);
    await tick(fixture.store);
    purgeRoom(fixture.store, "beta");
    // A covered room re-created out-of-band after the purge with
    // reused rowids and no baseline must NOT slip through: coverage
    // on a seeded snapshot is by construction, not by rowid.
    fixture.store.initialize(initialRoom("gamma"));
    fixture.store.db.prepare("DELETE FROM integrity_room_state WHERE room_id='gamma'").run();
    mutateSameLength(fixture.store, "gamma");
    const scan = await tick(fixture.store);
    assert.equal(scan.verified, 0);
    assert.equal(scan.baselineUnverifiable, 1);
    assert.equal(contentFailures(fixture.store, "gamma").length, 1);
  } finally { fixture.close(); }
});

test("Dot round-4 4f (pre-seed bridge): a snapshot written before seeding existed still bridges a genuinely new room once — and the next publication retires the bridge", async () => {
  const fixture = openStore();
  try {
    await tick(fixture.store);
    await tick(fixture.store);
    // Simulate the pre-seed world: the snapshot carries no seeded
    // stamp (every production snapshot predates this cure).
    fixture.store.db.prepare("UPDATE integrity_snapshot SET seeded_baseline=0 WHERE id=1").run();
    fixture.store.initialize(initialRoom("beta"));
    // The new room is seeded at birth even under a pre-seed snapshot,
    // so it verifies — and the scan must NOT report a transition.
    const scan = await tick(fixture.store);
    assert.equal(scan.verified, 1);
    assert.equal(scan.baselineUnverifiable, undefined);
    assert.deepEqual(fixture.store.integrityFailures(), []);
    assert.equal(seededOf(fixture.store), 1, "the first seed-era publication stamps seeded_baseline: the bridge has extinguished itself");
  } finally { fixture.close(); }
});

test("Dot round-4 4g: delete and recreate the same room id — the recreated room carries its own proof, not the purged room's", async () => {
  const fixture = openStore();
  try {
    fixture.store.initialize(initialRoom("beta"));
    await tick(fixture.store);
    await tick(fixture.store);
    purgeRoom(fixture.store, "beta");
    fixture.store.initialize(initialRoom("beta"));
    const scan = await tick(fixture.store);
    assert.equal(scan.verified, 1, "a recreated room id verifies on its own seeded baseline");
    assert.deepEqual(contentFailures(fixture.store, "beta"), []);
    const quiet = await tick(fixture.store);
    assert.equal(quiet.matched, 1);
  } finally { fixture.close(); }
});

test("Dot round-4 4h (matrix): creation rolls back atomically — a failed initialize leaves no room, no events, and no baseline row", async () => {
  const fixture = openStore();
  try {
    assert.throws(() => fixture.store.initialize(initialRoom("alpha")), "re-initializing an existing room id must fail");
    assert.equal(fixture.store.db.prepare("SELECT COUNT(*) AS n FROM rooms WHERE id='alpha'").get().n, 1, "the original room is untouched");
    assert.ok(roomState(fixture.store, "alpha")?.hash, "the original room's seeded baseline survives the failed creation");
    const scan = await tick(fixture.store);
    assert.equal(scan.verified, 1);
  } finally { fixture.close(); }
});

test("Dot round-4 4i (matrix): a carried snapshot whose mark exceeds every rowid in a reloaded log still verifies when the per-room proof travels with the rooms", async () => {
  const fixture = openStore();
  try {
    fixture.store.initialize(initialRoom("beta"));
    await tick(fixture.store);
    await tick(fixture.store);
    // Simulate an NDJSON restore into a fresh log: the snapshot's
    // covered mark describes the OLD log's rowids and may exceed
    // anything the reloaded log will ever hand out. Verification must
    // rest on the per-room proof, never on the carried mark.
    fixture.store.db.prepare("UPDATE integrity_snapshot SET covered_event_rowid=999999999 WHERE id=1").run();
    const scan = await tick(fixture.store);
    assert.equal(scan.matched, 1, "the digest over per-room proof matches; the carried mark is not consulted");
    assert.deepEqual(fixture.store.integrityFailures(), []);
  } finally { fixture.close(); }
});
