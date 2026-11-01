// RES-0001 (wave-7 R08-F1): a stored public_receipts row — above all a
// public-work (pwr_) row, which no delete path can remove — must honour
// the room's AUTHORITATIVE recorded public-receipts setting
// (room.public_receipts_set) at read time. Before the fix, stored-row
// reads consulted only the operator unpublish and the directory
// toggle: an owner who recorded enabled:false kept serving on the
// mirror detail, feed, collect, sitemap, the live JS filter, and the
// dedicated public-work receipt/artifact door, indefinitely.
//
// Semantics pinned here (the lot rule's read-time shape, narrowed to
// the opt-out direction): a recorded enabled:false hides; a recorded
// enabled:true serves; never-recorded keeps the pre-existing default
// (the directory toggle decides — public-work receipts are public
// unless opted out). The check is level-triggered: it consults the
// authoritative record on every read, so a mirror row written before
// the opt-out (or restored from a drifted backup) hides with no sync
// edge, and a later opt-in serves it again with no rewrite.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { PUBLIC_READ_MODEL_SCHEMA, publicReceiptById, queryPublicReceipts, collectPublicReceipts, listPublicReceiptSitemap } from "../server/public-read-model.mjs";
import { publicUnpublishSchema } from "../server/legal-store.mjs";
import { roomDirectorySchema } from "../server/room-directory.mjs";
import { PublicWorkClaims, publicWorkClaimsSchema } from "../server/public-work-claims.mjs";
import { receiptVisible, recordedReceiptsOptOut } from "../server/public-visibility.mjs";

const ROOM = "room-a";
const PWR = `pwr_${"a".repeat(32)}`;
const WCR = `wcr_${"b".repeat(32)}`;

function makeDb(enabled) {
  const db = new DatabaseSync(":memory:");
  db.exec(PUBLIC_READ_MODEL_SCHEMA);
  db.exec(publicUnpublishSchema);
  db.exec(roomDirectorySchema);
  db.exec(publicWorkClaimsSchema);
  // No rooms table at all: public reads consult the recorded setting's
  // read-model copy (room_public_receipts_setting, part of the read
  // model schema), never rooms.projection.
  setRecorded(db, enabled);
  for (const [id, source] of [[PWR, "public-work"], [WCR, "work-claim"]]) {
    db.prepare(`INSERT INTO public_receipts
      (id, title, source, origin_room_id, room_id, room_title, agents_json, humans_json,
       pull_request, merged_at, verification_state, hashes_json, at, start_href)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, "Settled work", source, ROOM, ROOM, "Room A", "[]", "[]", null, null, null, "[]",
        "2026-10-01T00:00:00.000Z", "https://room.trydemigod.com/?start=room");
  }
  db.prepare(`INSERT INTO public_work_receipts
    (receipt_id, offer_id, namespace_key, generation, identity_id, artifact_text, artifact_sha256, artifact_bytes, receipt_json, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(PWR, "offer-1", "ns", 1, "ai_x", "note", "0".repeat(64), 4, "{}", 0);
  db.prepare(`INSERT INTO public_work_tasks
    (offer_id, namespace_key, room_id, terms_version, repository_url, repository_ref, files_json, generation, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run("offer-1", "ns", ROOM, 1, "https://example.invalid/repo", "main", "[]", 1, 0);
  // No room_directory_settings row: the directory toggle is at its
  // public default, so only the authoritative setting can hide these.
  return db;
}

// The recorded setting's read-model copy, in the exact shape
// syncRoomPublication writes it in the same transaction as a
// room.public_receipts_set act (enabled 1/0; no row = never recorded).
function setRecorded(db, enabled) {
  if (enabled === null) { db.prepare("DELETE FROM room_public_receipts_setting WHERE room_id=?").run(ROOM); return; }
  db.prepare("INSERT INTO room_public_receipts_setting (room_id, enabled) VALUES (?,?) ON CONFLICT(room_id) DO UPDATE SET enabled=excluded.enabled")
    .run(ROOM, enabled ? 1 : 0);
}

function surfaces(db, id) {
  const store = { db };
  return {
    byId: publicReceiptById(store, id) !== null,
    query: queryPublicReceipts(store, { limit: 10 }).receipts.some(r => r.id === id),
    collect: collectPublicReceipts(store).some(r => r.id === id),
    sitemap: listPublicReceiptSitemap(store).some(r => r.path === `/receipts/${id}`),
    jsVisible: receiptVisible(db, id),
  };
}
const ALL_HIDDEN = { byId: false, query: false, collect: false, sitemap: false, jsVisible: false };
const ALL_SERVED = { byId: true, query: true, collect: true, sitemap: true, jsVisible: true };

test("recorded opt-out hides a pwr_ row on every mirror surface", () => {
  assert.deepEqual(surfaces(makeDb(false), PWR), ALL_HIDDEN);
});

test("recorded opt-out hides a drifted wcr_ row too (missed delete edge)", () => {
  assert.deepEqual(surfaces(makeDb(false), WCR), ALL_HIDDEN);
});

test("recorded opt-in serves the pwr_ row on every mirror surface", () => {
  assert.deepEqual(surfaces(makeDb(true), PWR), ALL_SERVED);
});

test("never-recorded keeps the directory default (serves)", () => {
  assert.deepEqual(surfaces(makeDb(null), PWR), ALL_SERVED);
  assert.equal(recordedReceiptsOptOut(makeDb(null), ROOM), false);
});

test("level-triggered: opt-out recorded after the row exists hides it with no sync; opt-in restores it", () => {
  const db = makeDb(true);
  assert.deepEqual(surfaces(db, PWR), ALL_SERVED);
  setRecorded(db, false); // the recorded opt-out lands; no receipt-row sync runs
  assert.deepEqual(surfaces(db, PWR), ALL_HIDDEN);
  setRecorded(db, true);
  assert.deepEqual(surfaces(db, PWR), ALL_SERVED);
});

test("dedicated door: recorded opt-out refuses anonymous receipt and artifact reads, opt-in serves", () => {
  const db = makeDb(false);
  const claims = new PublicWorkClaims({ db, roomDirectory: { publicReceiptsVisible: () => true } });
  assert.throws(() => claims._requireReceiptVisible(ROOM, undefined), (error) => error?.code === "receipts_private");
  setRecorded(db, true);
  claims._requireReceiptVisible(ROOM, undefined); // must not throw
  setRecorded(db, null);
  claims._requireReceiptVisible(ROOM, undefined); // never recorded: directory default governs
});
