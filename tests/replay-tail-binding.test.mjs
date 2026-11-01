import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import * as cutover from '../server/replay-cutover.mjs';
function fixture(t){
  const store=new RoomStore(':memory:');t.after(()=>store.close());store.initialize(initialRoom());
  store.db.exec(cutover.replayCutoverSchema());
  const capture=cutover.captureReplayWitness(store,{roomId:'commons',requestId:'capture',expectedHead:2,reason:'Synthetic prospective append authority'});
  const key=store.issueAccessKey('commons','owner');
  const post=()=>store.command(key,'commons',{id:'after-h',type:'message.posted',data:{messageId:'new',body:'Prospectively bound event'}});
  return {store,capture,post};
}
test('ordinary post-H append durably binds exact raw event bytes in its own transaction',t=>{
  const f=fixture(t);f.post();
  const raw=f.store.db.prepare("SELECT id,body FROM events WHERE room_id='commons' AND sequence=3").get();
  const saved=f.store.db.prepare("SELECT payload FROM message_replay_units WHERE generation=? AND domain='tail-event' AND unit_key='3'").get(f.capture.generation);
  assert.ok(saved,'RED: a later replay hash cannot replace missing prospective append authority');
  assert.equal(Buffer.from(saved.payload).toString('utf8'),raw.body);
});
test('actual prospective-binding write failure rolls back event and derived serving mutation',t=>{
  const f=fixture(t);const before=f.store.db.prepare("SELECT sequence,projection FROM rooms WHERE id='commons'").get();
  f.store.db.exec("CREATE TRIGGER synthetic_tail_failure BEFORE INSERT ON message_replay_units WHEN NEW.domain='tail-event' BEGIN SELECT RAISE(ABORT,'synthetic prospective binding failure'); END");
  assert.throws(()=>f.post(),/synthetic prospective binding failure/);
  assert.deepEqual(f.store.db.prepare("SELECT sequence,projection FROM rooms WHERE id='commons'").get(),before);
  assert.equal(f.store.db.prepare("SELECT 1 FROM events WHERE sequence=3").get(),undefined);
});
