import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RoomStore } from "../server/store.mjs";
import { AgentRooms } from "../server/agent-rooms.mjs";
import { attachmentLimits } from "../server/attachment-schema.mjs";

// Test-audit authoring gate:
// 1. Protects: a room whose byte quota is full of committed files can free
//    space. Committed rows keep counting after their staging deadline (they
//    never expire by policy), and room_discard_file refused them, so the
//    uploader or owner had no way to reclaim bytes (Fo, muse-room seq 24906).
// 2. Regression: reverting discard() to staged-only makes the committed
//    delete throw 410 attachment_unavailable and the follow-up stage 409.
// 3. Existing coverage: quota-ratchet covers discarded/expired staged rows
//    only; nothing covers committed rows.
// 4. No new production seam: live RoomAttachmentBytes API.

function serve(t) {
  const directory = mkdtempSync(join(tmpdir(), "room-attach-commit-del-"));
  const store = new RoomStore(join(directory, "room.sqlite"), { now: () => Date.now() });
  const rooms = new AgentRooms(store);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { store, rooms };
}

const b64 = n => Buffer.alloc(n, 120).toString("base64");

function fillWithCommitted(store, roomId, memberId) {
  const now = Date.now();
  const insert = store.db.prepare(`INSERT INTO room_attachments(
    room_id,id,uploader_id,filename,media_type,byte_length,sha256,bytes,state,created_at,expires_at,message_id
  ) VALUES(?,?,?,'f.txt','text/plain',?,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',?,'committed',?,?,'m-1')`);
  const size = attachmentLimits.fileBytes;
  const count = Math.ceil(attachmentLimits.roomBytes / size);
  const blob = Buffer.alloc(size, 120);
  store.transaction(() => {
    for (let i = 0; i < count; i += 1) {
      insert.run(roomId, i === 0 ? "full" : `full-${i}`, i === 0 ? memberId : "earlier-member", size, blob, now - 2 * 86400000, now - 86400000);
    }
  });
}

test("uploader can delete a committed file whose staging deadline passed, and the quota frees", t => {
  const { store, rooms } = serve(t);
  const owner = store.identities.create("Quota owner");
  const created = rooms.create(owner.secret, { roomId: "qa-commit-del", title: "q", purpose: "q", kind: "personal", displayName: "Quota owner" });
  const roomId = created.roomId;
  fillWithCommitted(store, roomId, created.ownerMemberId);

  assert.throws(() => store.roomAttachments.stage(owner.secret, roomId, { id: "new", filename: "n.txt", mediaType: "text/plain", data: b64(10) }),
    error => error.code === "attachment_quota");

  const deleted = store.roomAttachments.discard(owner.secret, roomId, "full");
  assert.equal(deleted.status, "deleted");
  const row = store.db.prepare("SELECT state, bytes FROM room_attachments WHERE room_id=? AND id='full'").get(roomId);
  assert.equal(row.state, "deleted");
  assert.equal(row.bytes, null);

  const staged = store.roomAttachments.stage(owner.secret, roomId, { id: "new", filename: "n.txt", mediaType: "text/plain", data: b64(10) });
  assert.equal(staged.status, "staged");
  assert.equal(store.roomAttachments.discard(owner.secret, roomId, "full").duplicate, true);
});

test("a committed file whose bound message is gone stays hidden from non-uploaders, so they cannot delete it", t => {
  const { store, rooms } = serve(t);
  const owner = store.identities.create("Quota owner");
  const created = rooms.create(owner.secret, { roomId: "qa-commit-del2", title: "q", purpose: "q", kind: "personal", displayName: "Quota owner" });
  const roomId = created.roomId;
  store.db.prepare(`INSERT INTO room_attachments(room_id,id,uploader_id,filename,media_type,byte_length,sha256,bytes,state,created_at,expires_at,message_id)
    VALUES(?,?,?,'f.txt','text/plain',1,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',?,'committed',0,0,'m-gone')`).run(roomId, "theirs", "someone-else", Buffer.from("x"));
  assert.throws(() => store.roomAttachments.discard(owner.secret, roomId, "theirs"), error => error.code === "attachment_not_found");
  assert.equal(store.db.prepare("SELECT state FROM room_attachments WHERE room_id=? AND id='theirs'").get(roomId).state, "committed");
});
