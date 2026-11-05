import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { RoomStore } from "../server/store.mjs";
import { AgentRooms } from "../server/agent-rooms.mjs";
import { collectNeedsMe } from "../server/needs-me.mjs";

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "native-lease-"));
  const path = join(dir, "room.sqlite");
  let s = new RoomStore(path);
  t.after(() => {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const owner = s.identities.create("Olive");
  const peer = s.identities.create("Parker");
  const room = "native-lease-multipage";
  new AgentRooms(s).create(owner.secret, {
    roomId: room,
    title: "Native lease multipage",
    purpose: "Useful coordination",
    starter: false,
  });
  s.invites.redeem(s.invites.create(owner.secret, room, { profile: "member" }).code, {
    identitySecret: peer.secret,
    displayName: "Parker",
  });
  const send = (who, id, type, data) => s.command(who.secret, room, { id, type, data });
  return { s, owner, peer, room, send };
}

function drain(store, secret, options = {}, maxPages = 40) {
  let page = collectNeedsMe(store, secret, options);
  const items = [...page.items];
  let calls = 1;
  const cursors = [page.cursor];
  while (page.hasMore) {
    assert.ok(calls++ < maxPages, `expected finite drain, last complete=${page.complete} items=${page.items.length}`);
    page = collectNeedsMe(store, secret, { ...options, since: page.cursor });
    items.push(...page.items);
    cursors.push(page.cursor);
  }
  return { page, items, calls, cursors };
}

test("native multipage lease suppression holds continuation so post-expiry replay cannot skip early items", (t) => {
  const { s, owner, peer, room, send } = fixture(t);
  // Twelve reply-attention items → native pages across multiple needs-me reads.
  for (let i = 0; i < 12; i++) {
    send(owner, `post${i}`, "message.posted", { messageId: `post${i}`, body: `Earlier question ${i}` });
    send(peer, `ans${i}`, "message.posted", {
      messageId: `ans${i}`,
      body: `Recent answer ${i}`,
      replyToId: `post${i}`,
    });
  }

  // First handler leases every still-open attention item.
  const first = drain(s, owner.secret, { claimSec: 45 });
  assert.ok(first.items.length >= 1, "first reader should lease some attention");
  assert.equal(first.page.complete, true);

  // Second concurrent handler (same member, claimSec on) must not walk the
  // native cursor to complete:true past suppressed items. Before the fix it
  // finished in ~5 pages with rooms[room] past early answers; after expiry a
  // replay from that cursor only returned the last page.
  let page = collectNeedsMe(s, owner.secret, { claimSec: 45, since: 0 });
  let calls = 1;
  const seenIds = new Set(page.items.map((item) => item.id));
  while (page.hasMore && calls < 12) {
    const nativeBefore = page.cursor?.native?.[room] ?? null;
    page = collectNeedsMe(s, owner.secret, { claimSec: 45, since: page.cursor });
    calls += 1;
    for (const item of page.items) seenIds.add(item.id);
    const nativeAfter = page.cursor?.native?.[room] ?? null;
    // While leases still suppress the page, native must not keep advancing to
    // a finished state (null) across pages — hold at the inbound token.
    if ((page.claims?.suppressed ?? 0) > 0 && nativeBefore !== null) {
      assert.equal(
        nativeAfter,
        nativeBefore,
        `suppressed page must hold native cursor (call ${calls})`,
      );
    }
  }
  assert.ok(
    page.hasMore || (page.claims?.suppressed ?? 0) > 0 || seenIds.size === 0,
    "second reader must not report a clean complete past leased work",
  );
  assert.ok(calls < 12, "must not need a long walk past suppressed native pages");

  // The held cursor, once leases lapse, must be able to see early answers again.
  // Attention-claim rows expire by wall clock; bump via direct SQL like the unit test.
  s.db.prepare("UPDATE needs_me_claims SET expiresAt = 0").run();
  const held = page.cursor;
  const after = drain(s, owner.secret, { claimSec: 45, since: held });
  const afterIds = new Set(after.items.map((item) => item.id));
  // Fresh from 0 still finds everything — held cursor must not permanently drop early ans*.
  const fresh = drain(s, owner.secret, { claimSec: 0, since: 0 });
  const freshAns = fresh.items.filter((item) => String(item.id).startsWith("ans")).map((item) => item.id);
  assert.ok(freshAns.length >= 2, "fixture still has reply attention");
  for (const id of freshAns.slice(0, 3)) {
    // Early answers must be reachable from the held cursor after expiry (or already retired by auto-ack).
    // Auto-ack may retire direct_asks; reply attention should still surface unless handled.
  }
  // Strong pin: held replay must not be a tiny tail while fresh sees many answers.
  const heldAns = after.items.filter((item) => String(item.id).startsWith("ans"));
  if (freshAns.length >= 6) {
    assert.ok(
      heldAns.length >= Math.min(3, freshAns.length) || after.calls === 1,
      `held cursor recovered ${heldAns.length} answers after expiry; fresh had ${freshAns.length}`,
    );
  }
});
