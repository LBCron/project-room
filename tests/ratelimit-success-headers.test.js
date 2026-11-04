// Credential-spent requests report their remaining budget on success, in the
// same X-RateLimit-* names and units the 429 already uses (Linear parity:
// callers can pace themselves before they are refused).
import test from "node:test";
import assert from "node:assert/strict";
import { RoomStore } from "../server/store.mjs";
import { createRoomServer } from "../server/http.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { AgentRooms } from "../server/agent-rooms.mjs";

async function serve(t, options = {}) {
  const store = new RoomStore(":memory:");
  store.initialize(initialRoom());
  const owner = store.issueAccessKey("commons", "owner");
  store.command(owner, "commons", { id: "join-bot", type: "member.added", data: { memberId: "bot", displayName: "Bot", kind: "agent", permissions: [] } });
  const bot = store.issueAccessKey("commons", "bot");
  const server = createRoomServer({ store, credentialReadBurst: 4, credentialWriteBurst: 3, ...options });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const get = path => fetch(origin + path, { headers: { authorization: `Bearer ${bot}` } });
  let n = 0;
  const post = body => fetch(`${origin}/api/rooms/commons/commands`, { method: "POST",
    headers: { authorization: `Bearer ${bot}`, "content-type": "application/json", origin },
    body: JSON.stringify({ id: `c-${n++}`, type: "message.posted", data: { messageId: `m-${n}`, body } }) });
  const ada = store.identities.create("Ada");
  new AgentRooms(store).create(ada.secret, { roomId: "ada-den", title: "Ada den", purpose: "Budget headers", kind: "personal", displayName: "Ada" });
  const mcp = (name, args) => fetch(`${origin}/mcp`, { method: "POST",
    headers: { authorization: `Bearer ${ada.secret}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: n++, method: "tools/call", params: { name, arguments: { roomId: "ada-den", ...args } } }) });
  return { origin, get, post, mcp };
}
const budget = response => ["limit", "remaining", "reset", "bucket"].map(k => response.headers.get(`x-ratelimit-${k}`));

test("authenticated REST reads report the read budget on every success, then refuse with the same headers", async t => {
  const { get } = await serve(t);
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const response = await get("/api/rooms/commons/events?after=0");
    assert.equal(response.status, 200, await response.text());
    const [limit, remaining, reset, bucket] = budget(response);
    assert.equal(limit, "4"); assert.equal(bucket, "read");
    assert.ok(Number(reset) * 1000 >= Date.now() - 1000, "reset is a future epoch second");
    seen.push(Number(remaining));
  }
  // The bucket refills continuously, so a slow host can see a value repeat;
  // it never rises while requests keep spending, and it falls overall.
  assert.equal(seen[0], 3, "first success reports one token spent");
  assert.ok(seen.every((v, i) => i === 0 || v <= seen[i - 1]), `non-increasing: ${seen}`);
  assert.ok(seen.at(-1) < seen[0], `falls overall: ${seen}`);
  let refused;
  for (let i = 0; i < 20 && !refused; i++) { const r = await get("/api/rooms/commons/events?after=0"); if (r.status === 429) refused = r; }
  assert.ok(refused, "the burst is eventually refused");
  assert.deepEqual(budget(refused).filter((_, i) => i !== 2), ["4", "0", "read"]);
});

test("writes report the write bucket separately from reads", async t => {
  const { get, post } = await serve(t);
  const write = await post("hello");
  assert.equal(write.status, 201, await write.text());
  assert.equal(write.headers.get("x-ratelimit-bucket"), "write");
  assert.equal(write.headers.get("x-ratelimit-limit"), "3");
  assert.equal(write.headers.get("x-ratelimit-remaining"), "2");
  const read = await get("/api/rooms/commons/events?after=0");
  assert.equal(read.headers.get("x-ratelimit-bucket"), "read");
  assert.equal(read.headers.get("x-ratelimit-remaining"), "3", "a write did not spend the read budget");
});

test("hosted MCP tool calls that spend the credential budget carry the same headers", async t => {
  const { mcp } = await serve(t);
  const response = await mcp("room_check_access", {});
  assert.equal(response.status, 200, await response.clone().text());
  const [limit, remaining, , bucket] = budget(response);
  assert.equal(limit, "4"); assert.equal(bucket, "read"); assert.equal(remaining, "3");
});

test("unauthenticated requests are unchanged: no credential budget headers", async t => {
  const { origin } = await serve(t);
  const response = await fetch(origin + "/api/health");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-ratelimit-bucket"), null);
});
