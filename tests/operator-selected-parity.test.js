import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { event } from '../src/events.js';
import { operatorStatus } from '../server/operator-status.mjs';

function fixture(t) {
  const store = new RoomStore(':memory:'); t.after(() => store.close());
  store.initialize([...initialRoom('commons'), event({ type:'message.posted', actorId:'owner', roomId:'commons', id:'selected-event', at:'2026-11-01T00:00:00.000Z', data:{messageId:'selected-message', body:'PRIVATE_SELECTED_CONTENT'} })]);
  while (!store.backfillMessages({limit:1000}).done) { /* setup */ }
  store.checkMessagesParity({roomId:'commons'});
  return store;
}
function selected(store, expectedHead) {
  const before = store.db.prepare('SELECT total_changes() AS n').get().n;
  const head = store.db.prepare("SELECT sequence FROM rooms WHERE id='commons'").get().sequence;
  const value = operatorStatus(store, {parityRoom:'commons', expectedHead:expectedHead ?? head});
  assert.equal(store.db.prepare('SELECT total_changes() AS n').get().n, before);
  assert.ok(Buffer.byteLength(JSON.stringify(value)) <= 4096);
  assert.doesNotMatch(JSON.stringify(value), /PRIVATE_SELECTED_CONTENT/);
  return value.messageParityDiagnostics.rooms[0];
}
test('explicit healthy target outside failure inventory is freshly compared without writes', t => {
  const store=fixture(t); store.room=()=>{throw Error('room read prohibited');};
  const value=selected(store); assert.equal(value?.status,'clean'); assert.equal(value.complete,true); assert.equal(value.proofsVerified,true);
});
test('selected read refuses changed head', t => {
  const store=fixture(t); assert.equal(selected(store,1)?.reason,'head_changed');
});
for (const mode of ['metadata','message','missing-proof','large-control']) test(`selected read fails closed for ${mode}`,t=>{
  const store=fixture(t);
  if(mode==='metadata')store.db.exec("UPDATE rooms SET projection=json_set(projection,'$.messages[0].body','corruption')");
  if(mode==='message')store.db.exec("UPDATE messages SET body='corruption'");
  if(mode==='missing-proof')store.db.exec('UPDATE integrity_room_state SET metadata_hash=NULL');
  if(mode==='large-control')store.db.prepare('UPDATE messages_backfill_cursor SET applied_seq=?').run('x'.repeat(300000));
  const value=selected(store); assert.equal(value?.status,'unknown'); assert.equal(value.complete,false);
});
