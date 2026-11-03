import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "room-release-service-"));
  let now = Date.now();
  const store = new RoomStore(join(directory, "room.sqlite"), { now: () => now });
  store.initialize(initialRoom());
  const owner = store.issueAccessKey("commons", "owner");
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { store, owner, advance: ms => { now += ms; } };
}

test("account login is bounded by the existing browser slot and still rejects its expiry", t => {
  const { store, owner, advance } = fixture(t);
  const key = store.issueAccountAccessKey(store.authenticate(owner).account.id);
  for (const lifetime of [60000, 30 * 86400000]) {
    const slot = store.createAccountSessionSlot(lifetime);
    const start = store.now();
    const auth = store.loginAccountSession(slot.token, key, slot.session.sessionRevision);
    assert.equal(auth.expiresAt, Math.min(slot.session.expiresAt, store.authenticateAccountAccessKey(key).expiresAt, start + 30 * 86400000));
    assert.equal(auth.authenticatedUntil, auth.expiresAt);
    if (lifetime === 60000) {
      advance(lifetime);
      assert.throws(() => store.authenticateAccountSession(slot.token), /expired/);
      assert.throws(() => store.loginAccountSession(slot.token, key, auth.sessionRevision), /expired/);
    }
  }
});

test("snapshot and return brief request read-only transactions and never acknowledge", t => {
  const { store, owner } = fixture(t);
  const platform = store.storagePlatform, modes = [];
  store.storagePlatform = { ...platform, transaction(db, fn, readOnly) {
    modes.push(readOnly);
    return platform.transaction(db, fn, readOnly);
  } };
  const snapshot = store.snapshot(owner, "commons");
  const brief = store.returnBrief(owner, "commons");
  assert.deepEqual(modes, [true, true]);
  assert.equal(brief.current.evaluatedThrough, snapshot.sequence);
  assert.equal(store.snapshot(owner, "commons").cursor, 0);
  store.revoke(owner);
  for (const read of [() => store.snapshot(owner, "commons"), () => store.returnBrief(owner, "commons")])
    assert.throws(read, /revoked/);
});

test("verified account sessions last beyond eight hours and still honor sign out and slot expiry", t => {
  const { store, owner, advance } = fixture(t);
  const accountId = store.authenticate(owner).account.id;
  const methodSlot = store.createAccountSessionSlot();
  const method = store.loginAccountSessionWithMethod(methodSlot.token, accountId, 0, { method: { kind: "password" } });
  const googleSlot = store.createAccountSessionSlot();
  const google = store.loginAccountSessionWithGoogle(googleSlot.token, "123456789", 0);
  assert.equal(method.expiresAt, methodSlot.session.expiresAt);
  assert.equal(google.expiresAt, googleSlot.session.expiresAt);
  advance(9 * 3600000);
  assert.equal(store.authenticateAccountSession(methodSlot.token).account.id, accountId);
  assert.equal(store.authenticateAccountSession(googleSlot.token).account.id, google.account.id);
  store.logoutAccountSession(methodSlot.token, method.sessionRevision);
  assert.throws(() => store.authenticateAccountSession(methodSlot.token), /expired|revoked|ended/);
  advance(30 * 86400000);
  assert.throws(() => store.authenticateAccountSession(googleSlot.token), /expired|revoked|ended/);
});

test("account-key sessions never outlive their parent credential, including guest keys", t => {
  const { store, owner, advance } = fixture(t);
  const accountId = store.authenticate(owner).account.id;
  const key = store.insertAccountCredential(accountId, store.now() + 8 * 3600000);
  const slot = store.createAccountSessionSlot();
  const session = store.loginAccountSession(slot.token, key, 0);
  assert.equal(session.expiresAt, store.now() + 8 * 3600000);
  advance(8 * 3600000);
  assert.throws(() => store.authenticateAccountSession(slot.token), /expired|revoked|ended/);
});
