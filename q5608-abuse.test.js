// Q5608 qualification — sealed-delivery abuse cases for the durable
// pair-delivery prototype (W2-5517-SPEC.md semantics). Every abuse
// case must fail closed to PairPollError expired_token: never a
// plaintext fallback, never a raw crypto/sqlite error, never another
// pair's credential. Keys are random per-run test values held only in
// this process's environment; fixture credentials only, none printed.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { PAIR_POLL_INTERVAL_MS } from "../server/pairing.mjs";

const KEY_A = randomBytes(32).toString("base64");
const KEY_B = randomBytes(32).toString("base64");
const setKey = value => { if (value === null) delete process.env.PAIR_DELIVERY_KEY; else process.env.PAIR_DELIVERY_KEY = value; };

function harness(t) {
  const directory = mkdtempSync(join(tmpdir(), "room-q5608-abuse-"));
  const file = join(directory, "room.sqlite");
  let now = 1_800_000_000_000;
  let store = new RoomStore(file, { now: () => now });
  store.initialize(initialRoom("commons"));
  const ownerKey = store.issueAccessKey("commons", "owner");
  t.after(() => { setKey(null); try { store.close(); } catch {} rmSync(directory, { recursive: true, force: true }); });
  return {
    get store() { return store; },
    ownerKey,
    advance: ms => { now += ms; },
    reopen() { store.close(); store = new RoomStore(file, { now: () => now }); },
    approve(displayName, address) {
      const started = store.pairing.start({ roomId: "commons", displayName, address });
      const decided = store.pairing.decide(ownerKey, "commons", { pairId: started.pairId, decision: "approve", profile: "contribute" });
      return { started, decided };
    }
  };
}

const expired = err => err?.code === "expired_token";

test("wrong key at reopen fails closed, and the sealed record survives for the right key", async t => {
  const h = harness(t);
  setKey(KEY_A);
  const { started, decided } = h.approve("Wrong Key Agent", "q5608-a1");
  h.reopen();
  setKey(KEY_B);
  h.advance(PAIR_POLL_INTERVAL_MS);
  assert.throws(() => h.store.pairing.poll(started.pairId, started.deviceSecret), expired);
  h.reopen();
  setKey(KEY_A);
  h.advance(PAIR_POLL_INTERVAL_MS);
  const polled = h.store.pairing.poll(started.pairId, started.deviceSecret);
  assert.equal(polled.token, decided.connection.token);
});

test("truncated sealed payload fails closed with expired_token only", async t => {
  const h = harness(t);
  setKey(KEY_A);
  const { started } = h.approve("Truncated Agent", "q5608-a2");
  const row = h.store.db.prepare("SELECT sealed FROM pair_delivery_sealed WHERE pair_id=?").get(started.pairId);
  assert.ok(row?.sealed, "sealed record must exist when a key is configured");
  h.store.db.prepare("UPDATE pair_delivery_sealed SET sealed=? WHERE pair_id=?")
    .run(row.sealed.slice(0, Math.floor(row.sealed.length / 2)), started.pairId);
  h.reopen();
  h.advance(PAIR_POLL_INTERVAL_MS);
  assert.throws(() => h.store.pairing.poll(started.pairId, started.deviceSecret), expired);
});

test("tampered ciphertext fails closed", async t => {
  const h = harness(t);
  setKey(KEY_A);
  const { started } = h.approve("Tampered Agent", "q5608-a3");
  const row = h.store.db.prepare("SELECT sealed FROM pair_delivery_sealed WHERE pair_id=?").get(started.pairId);
  const parts = row.sealed.split(".");
  parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
  h.store.db.prepare("UPDATE pair_delivery_sealed SET sealed=? WHERE pair_id=?").run(parts.join("."), started.pairId);
  h.reopen();
  h.advance(PAIR_POLL_INTERVAL_MS);
  assert.throws(() => h.store.pairing.poll(started.pairId, started.deviceSecret), expired);
});

test("a sealed record replayed onto another pair delivers nothing (AAD binding)", async t => {
  const h = harness(t);
  setKey(KEY_A);
  const a = h.approve("Pair A", "q5608-a4a");
  const b = h.approve("Pair B", "q5608-a4b");
  const sealedA = h.store.db.prepare("SELECT sealed FROM pair_delivery_sealed WHERE pair_id=?").get(a.started.pairId).sealed;
  h.store.db.prepare("UPDATE pair_delivery_sealed SET sealed=? WHERE pair_id=?").run(sealedA, b.started.pairId);
  h.reopen();
  h.advance(PAIR_POLL_INTERVAL_MS);
  assert.throws(() => h.store.pairing.poll(b.started.pairId, b.started.deviceSecret), expired);
  h.advance(PAIR_POLL_INTERVAL_MS);
  const polledA = h.store.pairing.poll(a.started.pairId, a.started.deviceSecret);
  assert.equal(polledA.token, a.decided.connection.token);
});

test("no key at reopen: recovery is impossible and the failure is the pre-existing expired_token", async t => {
  const h = harness(t);
  setKey(KEY_A);
  const { started } = h.approve("No Key Later", "q5608-a5");
  h.reopen();
  setKey(null);
  h.advance(PAIR_POLL_INTERVAL_MS);
  assert.throws(() => h.store.pairing.poll(started.pairId, started.deviceSecret), expired);
});

test("no key at approval: nothing sealed, in-process delivery unchanged, reopen cannot recover", async t => {
  const h = harness(t);
  setKey(null);
  const { started, decided } = h.approve("No Key At All", "q5608-a6");
  const sealed = h.store.db.prepare("SELECT sealed FROM pair_delivery_sealed WHERE pair_id=?").get(started.pairId);
  assert.equal(sealed, undefined);
  h.advance(PAIR_POLL_INTERVAL_MS);
  const first = h.store.pairing.poll(started.pairId, started.deviceSecret);
  assert.equal(first.token, decided.connection.token);
  h.reopen();
  setKey(KEY_A);
  h.advance(PAIR_POLL_INTERVAL_MS);
  assert.throws(() => h.store.pairing.poll(started.pairId, started.deviceSecret), expired);
});

test("a database dump yields no working credential (spec falsifier 3, sealed era)", async t => {
  const h = harness(t);
  setKey(KEY_A);
  const { started, decided } = h.approve("Dump Agent", "q5608-a7");
  const pairRow = h.store.db.prepare("SELECT * FROM pairs WHERE pair_id=?").get(started.pairId);
  const sealedRow = h.store.db.prepare("SELECT * FROM pair_delivery_sealed WHERE pair_id=?").get(started.pairId);
  const dump = JSON.stringify([pairRow, sealedRow]);
  assert.equal(dump.includes(decided.connection.token), false, "token must not appear in any stored row");
  assert.equal(dump.includes(decided.connection.identitySecret), false, "identity secret must not appear in any stored row");
  assert.throws(() => h.store.authenticate(sealedRow.sealed, "commons"));
  assert.equal(h.store.authenticate(decided.connection.token, "commons").member.id, decided.memberId);
});

test("a sealed record whose replay bound no longer matches the pair row is refused", async t => {
  const h = harness(t);
  setKey(KEY_A);
  const { started } = h.approve("Stale Bound Agent", "q5608-a8");
  h.store.db.prepare("UPDATE pairs SET replay_until = replay_until + 60000 WHERE pair_id=?").run(started.pairId);
  h.reopen();
  h.advance(PAIR_POLL_INTERVAL_MS);
  assert.throws(() => h.store.pairing.poll(started.pairId, started.deviceSecret), expired);
});
