import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { auditRecovery } from '../server/recovery.mjs';
import * as replay from '../server/replay-cutover.mjs';

function fixture(t) {
  const store = new RoomStore(':memory:');
  t.after(() => store.close());
  store.initialize(initialRoom());
  store.db.exec(replay.replayCutoverSchema());
  const capture = requestId => replay.captureReplayWitness(store, {
    roomId: 'commons', requestId, expectedHead: store.headSequence('commons'),
    reason: 'Synthetic explicit replay lifecycle'
  });
  const captured = capture('capture');
  const input = { roomId: 'commons', generation: captured.generation,
    requestId: 'abandon', reason: 'Explicit synthetic abandonment' };
  return { store, captured, capture, input };
}
function serving(store) {
  return Object.fromEntries(['rooms', 'events', 'messages', 'projection_bodies', 'work_entities',
    'integrity_room_state', 'messages_backfill_cursor', 'messages_backfill_state',
    'message_replay_snapshots'].map(table => [table, store.db.prepare(`SELECT * FROM ${table}`).all()]));
}

test('explicit abandonment changes only derived lifecycle and keeps original receipt historical', t => {
  const f = fixture(t), before = serving(f.store);
  const abandoned = replay.abandonReplayCapture(f.store, f.input);
  assert.equal(abandoned.lifecycle, 'abandoned');
  assert.equal(abandoned.certified, false);
  assert.deepEqual(serving(f.store), before);
  assert.throws(() => replay.advanceReplayWitness(f.store, {
    roomId: 'commons', generation: f.captured.generation, expectedBytes: 0, requestId: 'late-step'
  }), /abandoned|control/);
  const next = f.capture('new-generation');
  assert.notEqual(next.generation, f.captured.generation);
  const duplicate = replay.abandonReplayCapture(f.store, f.input);
  assert.deepEqual({ ...duplicate, duplicate: false }, abandoned);
});

test('cleanup deletes at most 200 derived rows per atomic historical phase receipt', t => {
  const f = fixture(t), db = f.store.db, before = serving(f.store);
  const insert = db.prepare('INSERT INTO message_replay_units VALUES(?,?,?, ?,1,2,?,?)');
  for (let i = 0; i < 450; i++) {
    insert.run('commons', f.captured.generation, 'metadata-entry', 'synthetic-' + i, '', Buffer.from('{}'));
  }
  replay.abandonReplayCapture(f.store, f.input);
  let progress = { deleted: 0 }, first;
  for (let i = 0; !progress.done; i++) {
    const input = { roomId: 'commons', generation: f.captured.generation,
      expectedDeleted: progress.deleted, requestId: 'cleanup-' + i };
    progress = replay.cleanupReplayCapture(f.store, input);
    assert.ok(progress.rowsDeleted <= 200);
    if (!i) first = { input, result: progress };
  }
  assert.equal(db.prepare('SELECT 1 FROM message_replay_units WHERE generation=?')
    .get(f.captured.generation), undefined);
  assert.deepEqual(serving(f.store), before);
  const old = replay.cleanupReplayCapture(f.store, first.input);
  assert.deepEqual({ ...old, duplicate: false }, first.result);
});

test('abandonment audit storage fault rolls back pointer and all derived bytes', t => {
  const f = fixture(t), db = f.store.db;
  const before = db.prepare('SELECT * FROM message_replay_units').all();
  db.exec(`CREATE TRIGGER synthetic_abandon_audit_failure BEFORE INSERT ON operator_actions
    WHEN NEW.action='replay_cutover_abandon'
    BEGIN SELECT RAISE(ABORT,'synthetic abandon audit storage failure'); END`);
  assert.throws(() => replay.abandonReplayCapture(f.store, f.input), /synthetic abandon audit storage failure/);
  assert.deepEqual(db.prepare('SELECT * FROM message_replay_units').all(), before);
});

test('whole-store audit recognizes retained abandoned derivation without serving certification', t => {
  const f = fixture(t);
  replay.abandonReplayCapture(f.store, f.input);
  assert.equal(auditRecovery(f.store).checks.writerFence, true);
  assert.equal(replay.auditReplayCutoverRecovery(f.store.db).abandoned, 1);
});
