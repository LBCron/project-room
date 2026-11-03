// room_mark_caught_up: an MCP-only agent saves its own catch-up marker, so a
// later cold room_read_messages returns the #5819 catchUp hint.
import test from "node:test";
import assert from "node:assert/strict";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { callHostedStdioTool, validHostedStdioArgs } from "../server/mcp-full-profile.mjs";

function fixture(t) {
  const store = new RoomStore(":memory:");
  t.after(() => store.close());
  store.initialize(initialRoom());
  const keys = { owner: store.issueAccessKey("commons", "owner") };
  store.command(keys.owner, "commons", { id: "join-w", type: "member.added",
    data: { memberId: "worker1", displayName: "Worker 1", kind: "agent", permissions: [] } });
  keys.worker1 = store.issueAccessKey("commons", "worker1");
  const post = messageId => store.command(keys.owner, "commons",
    { id: `post-${messageId}`, type: "message.posted", data: { messageId, body: messageId } });
  const call = (name, args) => callHostedStdioTool(store, keys.worker1, name, { roomId: "commons", ...args });
  const marker = () => store.db.prepare("SELECT sequence FROM cursors WHERE room_id='commons' AND member_id='worker1'").get()?.sequence;
  return { store, post, call, marker };
}

test("mark then cold read: the hint points at the saved marker and the follow-up read is only new messages", async t => {
  const f = fixture(t);
  for (const id of ["old-1", "old-2"]) f.post(id);
  assert.equal((await f.call("room_read_messages", { limit: 2 })).value.catchUp, undefined, "no marker, no hint");
  const handled = (await f.call("room_read_messages", { after: 0 })).value.next;
  const saved = await f.call("room_mark_caught_up", { sequence: handled });
  assert.equal(saved.isError, false);
  assert.equal(saved.value.cursor, handled);
  f.post("new-1");
  const cold = (await f.call("room_read_messages", { limit: 2 })).value;
  assert.equal(cold.catchUp.after, handled);
  const next = (await f.call("room_read_messages", cold.catchUp.nextRead.arguments)).value;
  assert.deepEqual(next.messages.map(m => m.messageId), ["new-1"]);
});

test("the marker never rewinds, and an out-of-range or malformed sequence is refused", async t => {
  const f = fixture(t);
  for (const id of ["a", "b", "c"]) f.post(id);
  const head = f.store.room("commons").sequence;
  await f.call("room_mark_caught_up", { sequence: head });
  const lower = await f.call("room_mark_caught_up", { sequence: 1 });
  assert.equal(lower.value.cursor, head, "lower sequence leaves the marker");
  assert.equal(f.marker(), head);
  await assert.rejects(f.call("room_mark_caught_up", { sequence: head + 100 }), error => error.status === 422 && error.code === "invalid_cursor");
  assert.equal(f.marker(), head);
  assert.equal(validHostedStdioArgs("room_mark_caught_up", { roomId: "commons", sequence: -1 }), false);
  assert.equal(validHostedStdioArgs("room_mark_caught_up", { roomId: "commons", sequence: 1.5 }), false);
  assert.equal(validHostedStdioArgs("room_mark_caught_up", { roomId: "commons" }), false);
  assert.equal(validHostedStdioArgs("room_mark_caught_up", { roomId: "commons", sequence: 2 }), true);
});

test("marking posts nothing and changes no work", async t => {
  const f = fixture(t);
  f.post("a");
  const before = f.store.room("commons").sequence;
  await f.call("room_mark_caught_up", { sequence: before });
  assert.equal(f.store.room("commons").sequence, before, "no room event appended");
});
