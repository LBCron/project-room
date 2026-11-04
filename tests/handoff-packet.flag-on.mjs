// Run by tests/handoff-packet.test.js with ROOM_HANDOFF_PACKET=1 (tool lists are fixed at import).
import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createAcceptanceFixture } from "../scripts/acceptance-fixture.mjs";
import { createHostedRoomMcp } from "../server/mcp-room-profile.mjs";
import { linkWithProof } from "./helpers/link-with-proof.mjs";

test("room_handoff_packet over hosted MCP", async t => {
  const f = createAcceptanceFixture();
  t.after(() => { f.store.close(); rmSync(f.directory, { recursive: true, force: true }); });
  const send = (type, data) => f.store.command(f.keys.owner, "commons", { id: crypto.randomUUID(), type, data });
  send("message.posted", { messageId: "rule-src", body: "We merge only through Codex." });
  send("decision.recorded", { sourceMessageId: "rule-src", statement: "Codex is the only merger." });
  f.store.workClaims.set("commons", { id: "held-1", title: "Held work", state: "claimed", owner: "producer", history: [] });
  const identity = f.store.identities.create("Handoff reader");
  linkWithProof(f.store, f.keys.owner, "commons", identity, { memberId: "reader", displayName: "Reader agent", permissions: ["accept_work"] });
  const auth = { authorization: `Bearer ${identity.secret}` };
  const mcp = createHostedRoomMcp(f.store);
  const { HOSTED_ROOM_MCP_TOOLS } = await import("../src/room-mcp-join.js");
  assert.ok(HOSTED_ROOM_MCP_TOOLS.includes("room_handoff_packet"), "tool registered when flag on");
  const reply = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "room_handoff_packet", arguments: { roomId: "commons" } } }, auth);
  assert.ok(reply.result && !reply.result.isError, JSON.stringify(reply).slice(0, 2000));
  const packet = reply.result.structuredContent;
  assert.equal(packet.contract.name, "project-room/handoff-packet");
  assert.equal(packet.roomId, "commons");
  assert.ok(packet.decisions.some(d => d.statement === "Codex is the only merger."), JSON.stringify(packet.decisions));
  assert.ok("charter" in packet.rules);
  assert.ok(Array.isArray(packet.claims.open));
});
