// PACK5502 one-bad-row probe: does ONE archived room's settled claim deny
// deploy linking for EVERY room once PR #5502's registry guard is live?
// Seam: linkDeployToSettledClaims (server/claim-autolink.mjs) — loops all
// rooms inside ONE store.workClaims.transaction and calls registry.set per
// matching item, with no room_archived catch (Q03-F1 shape).
// Arrangement: both rooms are real initialized rooms in one store; both
// claims settle (state done, revision stamped); the archived room's claim is
// inserted FIRST so the batch reaches the bad row before the live room's
// row; then the archived room's rooms.archived_at mirror is stamped (the
// SQL mirror the guard reads — set by command() in production in the same
// transaction that records room.archived).
// Control expectation (no guard): linked=2, no throw.
// Guard expectation: throw room_archived, live room's item left unlinked
// (whole transaction rolled back).
import { RoomStore } from "./server/store.mjs";
import { initialRoom } from "./server/bootstrap.mjs";
import { linkDeployToSettledClaims } from "./server/claim-autolink.mjs";

const rev = "d".repeat(40);
const nowMs = 1_700_000_000_000;
const store = new RoomStore(":memory:");
store.initialize(initialRoom("live-room"));
store.initialize(initialRoom("archived-room"));

const item = id => ({ id, kind: "land", state: "done", revision: rev, owner: "owner", history: [] });
store.workClaims.set("archived-room", item("lane-archived")); // bad row first
store.workClaims.set("live-room", item("lane-live"));

// The room archives AFTER both claims settle (the production sequence).
store.db.prepare("UPDATE rooms SET archived_at=? WHERE id=?")
  .run("2026-11-01T00:00:00.000Z", "archived-room");

let outcome;
try {
  const out = linkDeployToSettledClaims(store, { revision: rev, nowMs });
  outcome = { threw: false, linked: out.linked };
} catch (error) {
  outcome = { threw: true, code: error?.code ?? null, status: error?.status ?? null, message: String(error?.message ?? error).slice(0, 120) };
}
const live = store.workClaims.get("live-room", "lane-live");
const archived = store.workClaims.get("archived-room", "lane-archived");
console.log(JSON.stringify({
  outcome,
  liveRoomDeployLinked: Boolean(live?.deploy?.revision),
  archivedRoomDeployLinked: Boolean(archived?.deploy?.revision),
}, null, 2));
store.close();
