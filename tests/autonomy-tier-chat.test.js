import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { EVENT_TYPES as T } from "../src/events.js";
import { setTier, getTier, T1_CHAT_ALLOWED_COMMANDS } from "../server/autonomy-tiers.mjs";

function serve(t) {
  const directory = mkdtempSync(join(tmpdir(), "tier-chat-"));
  const store = new RoomStore(join(directory, "room.sqlite"), { now: () => Date.parse("2026-11-02T12:00:00Z") });
  store.initialize(initialRoom("commons"));
  const keys = { owner: store.issueAccessKey("commons", "owner") };
  const send = (actor, type, data, id = randomUUID()) => store.command(keys[actor], "commons", { id, type, data });
  send("owner", T.MEMBER_ADDED, { memberId: "agent", displayName: "Chat agent", kind: "agent", permissions: ["accept_work"], accountableHumanId: "owner" });
  keys.agent = store.issueAccessKey("commons", "agent");
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { store, send };
}

test("t1_chat: allowed set is the read-only set plus chat", () => {
  for (const type of [T.MESSAGE_POSTED, T.MESSAGE_EDITED, T.MESSAGE_DELETED, T.DM_POSTED, T.SESSION_STOPPED])
    assert.ok(T1_CHAT_ALLOWED_COMMANDS.has(type), type);
  assert.ok(!T1_CHAT_ALLOWED_COMMANDS.has(T.WORK_PROPOSED));
  assert.ok(!T1_CHAT_ALLOWED_COMMANDS.has(T.MEMBER_ADDED));
});

test("t1_chat: agent can post but work writes are 403 agent_chat_only with a promote hint; promotion lifts the tier gate", t => {
  const f = serve(t);
  setTier(f.store.db, "commons", "agent", "t1_chat", { updatedBy: "owner", nowMs: Date.now() });
  assert.equal(getTier(f.store.db, "commons", "agent").autonomyTier, "t1_chat");
  f.send("agent", T.MESSAGE_POSTED, { messageId: randomUUID(), body: "chat lands" });
  const propose = () => f.send("agent", T.WORK_PROPOSED, { workItemId: `w-${randomUUID()}`, title: "x", definitionOfDone: "d", accountableMemberId: "agent", mode: "read" });
  let error; try { propose(); } catch (e) { error = e; }
  assert.equal(error?.status, 403);
  assert.equal(error?.code, "agent_chat_only");
  assert.match(error.message, /promote/);
  setTier(f.store.db, "commons", "agent", "t2_standard", { updatedBy: "owner", nowMs: Date.now() });
  // Past the tier gate, ordinary permission checks apply again.
  let after; try { propose(); } catch (e) { after = e; }
  assert.notEqual(after?.code, "agent_chat_only");
});
