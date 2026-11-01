import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { event } from '../src/events.js';
import { MESSAGE_PROOF_SELECT, messageProofMatches } from '../server/write-integrity.mjs';
import { replayCutoverSchema, captureReplayWitness } from '../server/replay-cutover.mjs';

function fixture(t) {
  const store = new RoomStore(':memory:', { maintainMessageCertification: true });
  t.after(() => store.close());
  store.initialize([...initialRoom(), event({
    id: 'before-capture', roomId: 'commons', actorId: 'owner', type: 'message.posted',
    data: { messageId: 'existing', body: 'Independently proved original' }
  })]);
  while (!store.backfillMessages({ limit: 200 }).done) {}
  store.checkMessagesParity({ roomId: 'commons' });
  const key = store.issueAccessKey('commons', 'owner');
  const current = () => store.db.prepare(
    `SELECT ${MESSAGE_PROOF_SELECT},entity_hash FROM messages WHERE room_id=? AND message_id=?`
  ).get('commons', 'existing');
  const original = current();
  assert.equal(messageProofMatches(original), true, 'fixture starts with independent valid proof');
  store.db.exec(replayCutoverSchema());
  const captured = captureReplayWitness(store, {
    roomId: 'commons', requestId: 'capture', expectedHead: store.headSequence('commons'),
    reason: 'Synthetic current-state H-row consistency'
  });
  const unit = (domain, id = 'existing') => store.db.prepare(
    'SELECT payload FROM message_replay_units WHERE room_id=? AND generation=? AND domain=? AND unit_key=?'
  ).get('commons', captured.generation, domain, id);
  const edit = (revision, body) => store.command(key, 'commons', {
    id: 'edit-' + revision, type: 'message.edited',
    data: { messageId: 'existing', body, expectedMessageRevision: revision }
  });
  return { store, key, original, captured, current, unit, edit };
}

test('a post-H edit preserves the exact independently proved H row before overwrite', t => {
  const f = fixture(t);
  f.edit(0, 'Current T differs from H');
  assert.equal(f.current().body, 'Current T differs from H');
  assert.equal(messageProofMatches(f.current()), true);
  const shadow = f.unit('h-message');
  assert.ok(shadow, 'RED: mutable current T must not substitute for the missing H row');
  assert.deepEqual(JSON.parse(Buffer.from(shadow.payload).toString('utf8')), f.original);
});

test('successive post-H edits retain the first H fields and proof, never an intermediate T', t => {
  const f = fixture(t);
  f.edit(0, 'Intermediate T');
  f.edit(1, 'Later T');
  const shadow = f.unit('h-message');
  assert.ok(shadow, 'RED: H row needs one durable first-change capture');
  assert.deepEqual(JSON.parse(Buffer.from(shadow.payload).toString('utf8')), f.original);
  assert.equal(f.current().body, 'Later T');
  assert.equal(messageProofMatches(f.current()), true);
});

test('a post-H insertion records independently distinguishable absence at H', t => {
  const f = fixture(t);
  f.store.command(f.key, 'commons', {
    id: 'after-capture', type: 'message.posted',
    data: { messageId: 'new-after-h', body: 'This ID was absent at H' }
  });
  assert.ok(f.unit('h-message-absent', 'new-after-h'),
    'RED: current membership alone cannot distinguish an ID introduced after H');
  assert.equal(f.unit('h-message', 'new-after-h'), undefined);
});

test('an actual shadow-write storage failure rolls back the enclosing serving edit', t => {
  const f = fixture(t);
  f.store.db.exec(`CREATE TRIGGER synthetic_h_capture_storage_failure
    BEFORE INSERT ON message_replay_units WHEN NEW.domain='h-message'
    BEGIN SELECT RAISE(ABORT,'synthetic dependency storage failure'); END`);
  const head = f.store.headSequence('commons');
  assert.throws(() => f.edit(0, 'Must roll back'), /synthetic dependency storage failure/);
  assert.equal(f.store.headSequence('commons'), head);
  assert.deepEqual(f.current(), f.original);
});
