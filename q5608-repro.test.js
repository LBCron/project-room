// Q5608 qualification repro — Root seq 24801 acceptance case, per
// W2-5517-SPEC.md. Fixture credentials only; no values printed.
// Cases: (1) headline close/reopen between approve and poll;
// (2) close/reopen between start and approve; (3) close/reopen
// between first poll and replay poll; (4) pollHeld headline variant.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { PAIR_POLL_INTERVAL_MS } from "../server/pairing.mjs";

function harness(t) {
  const directory = mkdtempSync(join(tmpdir(), "room-q5608-"));
  const file = join(directory, "room.sqlite");
  let now = 1_800_000_000_000;
  let store = new RoomStore(file, { now: () => now });
  store.initialize(initialRoom("commons"));
  const ownerKey = store.issueAccessKey("commons", "owner");
  t.after(() => { try { store.close(); } catch {} rmSync(directory, { recursive: true, force: true }); });
  return {
    get store() { return store; },
    ownerKey,
    advance: ms => { now += ms; },
    reopen() { store.close(); store = new RoomStore(file, { now: () => now }); }
  };
}

test("headline: approve -> close/reopen -> poll delivers, token authenticates", async t => {
  const h = harness(t);
  const started = h.store.pairing.start({ roomId: "commons", displayName: "Repro Agent", address: "q5608-1" });
  const decided = h.store.pairing.decide(h.ownerKey, "commons", { pairId: started.pairId, decision: "approve", profile: "contribute" });
  h.reopen();
  h.advance(PAIR_POLL_INTERVAL_MS);
  const polled = h.store.pairing.poll(started.pairId, started.deviceSecret);
  assert.equal(polled.token, decided.connection.token);
  assert.equal(polled.identitySecret, decided.connection.identitySecret);
  assert.equal(h.store.authenticate(polled.token, "commons").member.id, decided.memberId);
  assert.equal(h.store.authenticate(polled.identitySecret, "commons").member.id, decided.memberId);
});

test("close/reopen between start and approve still delivers", async t => {
  const h = harness(t);
  const started = h.store.pairing.start({ roomId: "commons", displayName: "Repro Two", address: "q5608-2" });
  h.reopen();
  const decided = h.store.pairing.decide(h.ownerKey, "commons", { pairId: started.pairId, decision: "approve", profile: "contribute" });
  h.advance(PAIR_POLL_INTERVAL_MS);
  const polled = h.store.pairing.poll(started.pairId, started.deviceSecret);
  assert.equal(polled.token, decided.connection.token);
});

test("close/reopen between first poll and replay poll: replay still duplicate:true", async t => {
  const h = harness(t);
  const started = h.store.pairing.start({ roomId: "commons", displayName: "Repro Three", address: "q5608-3" });
  const decided = h.store.pairing.decide(h.ownerKey, "commons", { pairId: started.pairId, decision: "approve", profile: "contribute" });
  h.advance(PAIR_POLL_INTERVAL_MS);
  const first = h.store.pairing.poll(started.pairId, started.deviceSecret);
  assert.equal(first.token, decided.connection.token);
  h.reopen();
  h.advance(PAIR_POLL_INTERVAL_MS);
  const again = h.store.pairing.poll(started.pairId, started.deviceSecret);
  assert.equal(again.token, decided.connection.token);
  assert.equal(again.duplicate, true);
});

test("pollHeld headline: held approve -> close/reopen -> pollHeld delivers", async t => {
  const h = harness(t);
  const starter = h.store.identities.create("Starter Person");
  const started = h.store.pairing.start({ roomId: "commons", displayName: "Held Repro", holdFor: starter.identityId, address: "q5608-4" });
  const decided = h.store.pairing.decide(h.ownerKey, "commons", { pairId: started.pairId, decision: "approve", profile: "chat" });
  h.reopen();
  h.advance(PAIR_POLL_INTERVAL_MS);
  const joined = h.store.pairing.pollHeld(started.pairId, starter.identityId);
  assert.equal(joined.token, decided.connection.token);
  assert.equal(h.store.authenticate(joined.token, "commons").member.id, decided.memberId);
});
