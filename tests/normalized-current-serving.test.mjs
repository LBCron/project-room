// Actual Store.command/read integration contract. This is deliberately not a
// replay-sidecar adapter: synthetic creation must select the migration endpoint.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';

const raw = store => JSON.parse(store.db.prepare("SELECT projection FROM rooms WHERE id='commons'").get().projection);

test('explicit synthetic initialization selects actual normalized serving, not replay staging', t => {
  const store = new RoomStore(':memory:');
  t.after(() => store.close());
  store.initialize(initialRoom(), { representation: 'normalized-current-v1' });
  const marker = raw(store);
  assert.equal(marker.normalizedCurrent?.version, 1,
    'RED: actual initialization still persists the whole legacy room projection');
  assert.deepEqual(Object.keys(marker), ['normalizedCurrent']);
  assert.equal(store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='message_replay_units'").get(), undefined,
    'ordinary normalized initialization must not require a replay staging authority');
  const token = store.issueAccessKey('commons', 'owner');
  const legacyRead = store.room;
  store.room = () => { throw Error('unbounded full-room hydration'); };
  try {
    const command = { id: 'first-normalized-post', type: 'message.posted',
      data: { messageId: 'first', body: 'A saved ordinary task context' } };
    const first = store.command(token, 'commons', command);
    assert.equal(first.duplicate, false);
    const reply = store.command(token, 'commons', { id: 'first-normalized-reply', type: 'message.posted',
      data: { messageId: 'reply', body: 'Useful follow-through', replyToId: 'first' } });
    assert.equal(reply.sequence, first.sequence + 1);
    const retry = store.command(token, 'commons', command);
    assert.equal(retry.duplicate, true);
    assert.equal(retry.sequence, first.sequence);
    assert.deepEqual(raw(store).normalizedCurrent.version, 1);
  } finally { store.room = legacyRead; }
});
