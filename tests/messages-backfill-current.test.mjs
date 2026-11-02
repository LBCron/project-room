import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {auditRecovery} from '../server/recovery.mjs';

function mixed(t){
 const s=new RoomStore(':memory:');t.after(()=>s.close());
 s.initialize(initialRoom('legacy'),{representation:null});
 s.initialize(initialRoom('native'),{representation:'normalized-current-v1'});
 for(const id of ['legacy','native']){
  const key=s.issueAccessKey(id,'owner');
  s.command(key,id,{id:'post-'+id,type:'message.posted',data:{messageId:'saved-'+id,body:'Saved '+id}});
 }
 return s;
}
function nativeRows(s){
 const result={};
 for(const table of ['messages','current_room_head','current_room_records','current_room_record_proofs','events','commands','messages_backfill_cursor'])
  result[table]=s.db.prepare(`SELECT * FROM ${table} WHERE room_id=? ORDER BY rowid`).all('native');
 return result;
}
test('legacy replay and parity finish in a mixed store without rewriting native message authority',t=>{
 const s=mixed(t),before=nativeRows(s);
 let result;
 for(let n=0;n<10;n++){result=s.backfillMessages({limit:100});if(result.done)break;}
 assert.equal(result.done,true);assert.equal(result.failed.length,0);
 const parity=s.checkMessagesParity();assert.equal(parity.ok,true);assert.equal(parity.roomId,'legacy');
 assert.equal(s.db.prepare('SELECT parity_at_seq FROM messages_backfill_cursor WHERE room_id=?').get('legacy').parity_at_seq,s.headSequence('legacy'));
 assert.deepEqual(nativeRows(s),before);
 assert.throws(()=>s.checkMessagesParity({roomId:'native'}),e=>e.status===409&&/independent current-record integrity audit/.test(e.message));
 assert.deepEqual(nativeRows(s),before);
 assert.throws(()=>s.db.prepare("UPDATE messages SET body='old writer' WHERE room_id='native'").run(),/unsupported current room writer/);
 assert.doesNotThrow(()=>auditRecovery(s));
});
test('legacy replay refuses a closed current marker without its independent head',t=>{
 const s=new RoomStore(':memory:');t.after(()=>s.close());s.initialize(initialRoom('broken'),{representation:null});
 // Explicit synthetic corruption: a legacy room cannot legitimately publish a
 // current carrier without its protected head. It must not be replayed away.
 s.transaction(()=>s.db.prepare('UPDATE rooms SET projection=? WHERE id=?').run('{"normalizedCurrent":{"version":1,"headRevision":0,"headHash":"missing"}}','broken'));
 const before=s.db.prepare('SELECT projection FROM rooms WHERE id=?').get('broken').projection;
 assert.throws(()=>s.backfillMessages({limit:100}),/closed current marker lacks its independent head/);
 assert.equal(s.db.prepare('SELECT projection FROM rooms WHERE id=?').get('broken').projection,before);
});
test('legacy replay refuses a selected corrupt native head rather than skipping its failure',t=>{
 const s=mixed(t);
 // Named fault injection removes only the protection needed to forge the head;
 // the reader must also detect the exact schema drift before skipping it.
 s.db.exec('DROP TRIGGER current_room_guard_current_room_head_update');
 s.transaction(()=>s.db.prepare("UPDATE current_room_head SET head_sha256='forged' WHERE room_id='native'").run());
 assert.throws(()=>s.backfillMessages({limit:100}),/owned serving schema changed|head commitment changed/);
});
