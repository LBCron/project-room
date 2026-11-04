// Flag-on coverage for ROOM_BOARD_CLAIM_TOOLS. Run with
//   ROOM_BOARD_CLAIM_TOOLS=1 node --test tests/mcp-board-claim-tools.test.js
// Without the flag the suite checks the tools stay hidden.
import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createAcceptanceFixture } from "../scripts/acceptance-fixture.mjs";
import { createRoomServer } from "../server/http.mjs";
import { linkWithProof } from "./helpers/link-with-proof.mjs";

const ON = /^(1|true|on)$/i.test(String(process.env.ROOM_BOARD_CLAIM_TOOLS ?? "").trim());

async function world() {
  const f = createAcceptanceFixture();
  const server = createRoomServer({ store: f.store });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let n = 0;
  const parse = t => { try { return JSON.parse(t); } catch { return JSON.parse(t.match(/data: (.*)/)[1]); } };
  const rpc = async (secret, method, params) => parse(await (await fetch(`${origin}/mcp`, { method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, params }) })).text());
  const rest = async (secret, path, body) => { const r = await fetch(origin + path, { method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, body: await r.json().catch(() => null) }; };
  const agent = name => { const id = f.store.identities.create(name);
    linkWithProof(f.store, f.keys.owner, "commons", id, { memberId: name.toLowerCase(), displayName: name, permissions: ["accept_work", "complete_work"] });
    return id.secret; };
  const close = async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); f.store.close(); rmSync(f.directory, { recursive: true, force: true }); };
  return { f, rpc, rest, agent, close };
}
const body = r => r.result?.structuredContent ?? JSON.parse(r.result?.content?.[0]?.text ?? "null");

test("board claim tools follow the flag in tools/list", async () => {
  const w = await world();
  try {
    const names = (await w.rpc(w.agent("Lister"), "tools/list", {})).result.tools.map(t => t.name);
    for (const name of ["room_take_work_claim", "room_finish_work_claim"]) assert.equal(names.includes(name), ON, name);
  } finally { await w.close(); }
});

test("take then finish moves a Board task to delivered; a second taker is refused", { skip: !ON }, async () => {
  const w = await world();
  try {
    assert.equal((await w.rest(w.f.keys.owner, "/api/rooms/commons/work-claims", { id: "fix-login", title: "Fix login", note: "n" })).status, 201);
    const a = w.agent("Alpha"), b = w.agent("Beta");
    const took = await w.rpc(a, "tools/call", { name: "room_take_work_claim", arguments: { roomId: "commons", claimId: "fix-login" } });
    assert.notEqual(took.result.isError, true);
    assert.equal(body(took).state, "claimed");
    const lost = await w.rpc(b, "tools/call", { name: "room_take_work_claim", arguments: { roomId: "commons", claimId: "fix-login" } });
    assert.ok(lost.error || lost.result?.isError);
    const done = await w.rpc(a, "tools/call", { name: "room_finish_work_claim", arguments: { roomId: "commons", claimId: "fix-login", note: "Fixed; tests pass." } });
    assert.notEqual(done.result.isError, true, JSON.stringify(done));
    assert.equal(body(done).state, "delivered");
    const stranger = await w.rpc(b, "tools/call", { name: "room_finish_work_claim", arguments: { roomId: "commons", claimId: "fix-login", note: "x" } });
    assert.ok(stranger.error || stranger.result?.isError);
  } finally { await w.close(); }
});

test("finish refuses unknown fields and a missing note", { skip: !ON }, async () => {
  const w = await world();
  try {
    const a = w.agent("Gamma");
    const r = await w.rpc(a, "tools/call", { name: "room_finish_work_claim", arguments: { roomId: "commons", claimId: "x" } });
    assert.ok(r.error || r.result?.isError);
    const r2 = await w.rpc(a, "tools/call", { name: "room_take_work_claim", arguments: { roomId: "commons", claimId: "x", bogus: 1 } });
    assert.ok(r2.error || r2.result?.isError);
  } finally { await w.close(); }
});
