import {exportNdjsonText} from '../server/room-export.mjs';import {replayNdjsonInto} from '../server/restore-ndjson.mjs';
// Research only: single legacy witness certification, not production migration.
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {RoomStore} from '../server/store.mjs';import {initialRoom} from '../server/bootstrap.mjs';import {event} from '../src/events.js';import {auditRecovery} from '../server/recovery.mjs';import {certifyOneMessageRoutingResearch,withCurrentRoomWriter} from '../server/current-room-repository.mjs';
test('certifies a v1 witness without adding an event and survives restart',t=>{
 const dir=mkdtempSync(join(tmpdir(),'routing-cert-')),db=join(dir,'room.db');let s=new RoomStore(db);t.after(()=>{s.close();rmSync(dir,{recursive:true,force:true})});
 const events=initialRoom();events.push(event({roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'legacy-large',body:'界'.repeat(65536)}}));s.initialize(events,{representation:'normalized-current-v1'});const key=s.issueAccessKey('commons','owner');
 const witness=()=>JSON.parse(s.db.prepare("SELECT payload FROM current_room_records WHERE room_id='commons' AND domain='messageWitness' AND record_key='legacy-large'").get().payload),seq=s.headSequence('commons');assert.equal(witness().version,undefined);
 assert.deepEqual(certifyOneMessageRoutingResearch(s,'commons','legacy-large'),{changed:true,sequence:seq});assert.equal(witness().version,2);assert.equal(s.headSequence('commons'),seq);
 assert.deepEqual(certifyOneMessageRoutingResearch(s,'commons','legacy-large'),{changed:false,sequence:seq});assert.doesNotThrow(()=>auditRecovery(s));s.close();s=new RoomStore(db);assert.equal(witness().version,2);
 const reply=s.command(key,'commons',{id:'legacy-reply',type:'message.posted',data:{messageId:'legacy-reply',replyToId:'legacy-large',body:'hello'}});assert.equal(reply.duplicate,false);assert.doesNotThrow(()=>auditRecovery(s));
});
test('certification rolls back if carrier write fails',t=>{
 const s=new RoomStore(':memory:');t.after(()=>s.close());const events=initialRoom();events.push(event({roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'legacy-large',body:'界'.repeat(65536)}}));s.initialize(events,{representation:'normalized-current-v1'});
 const snapshot=()=>Object.fromEntries(['rooms','current_room_head','current_room_records','current_room_record_proofs','operator_actions','integrity_room_state'].map(table=>[table,s.db.prepare('SELECT * FROM '+table).all()]));const before=snapshot(),prepare=s.db.prepare.bind(s.db);let injected=false;
 s.db.prepare=sql=>{const q=prepare(sql);if(sql==='UPDATE rooms SET projection=? WHERE id=?'){const run=q.run.bind(q);q.run=(...args)=>{run(...args);injected=true;throw Error('injected carrier failure')};}return q};
 try{assert.throws(()=>certifyOneMessageRoutingResearch(s,'commons','legacy-large'),/injected carrier failure/)}finally{s.db.prepare=prepare}
 assert.equal(injected,true);assert.deepEqual(snapshot(),before);assert.equal(certifyOneMessageRoutingResearch(s,'commons','legacy-large').changed,true);
});
test('certification refuses a corrupted message without changing its witness',t=>{
 const s=new RoomStore(':memory:');t.after(()=>s.close());const events=initialRoom();events.push(event({roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'legacy-large',body:'界'.repeat(65536)}}));s.initialize(events,{representation:'normalized-current-v1'});
 s.transaction(()=>withCurrentRoomWriter(s.db,'commons',()=>s.db.prepare("UPDATE messages SET body=substr(body,1,50000)||'X'||substr(body,50002) WHERE room_id='commons' AND message_id='legacy-large'").run()));
 const before=s.db.prepare("SELECT payload FROM current_room_records WHERE room_id='commons' AND domain='messageWitness' AND record_key='legacy-large'").get().payload,head=s.db.prepare("SELECT * FROM current_room_head WHERE room_id='commons'").get();
 assert.throws(()=>certifyOneMessageRoutingResearch(s,'commons','legacy-large'),/row mismatch/);
 assert.equal(s.db.prepare("SELECT payload FROM current_room_records WHERE room_id='commons' AND domain='messageWitness' AND record_key='legacy-large'").get().payload,before);assert.deepEqual(s.db.prepare("SELECT * FROM current_room_head WHERE room_id='commons'").get(),head);
});
test('same-sequence certification and receipts survive export and restore',t=>{
 const s=new RoomStore(':memory:'),target=new RoomStore(':memory:');t.after(()=>{s.close();target.close()});const events=initialRoom();events.push(event({roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'legacy-large',body:'界'.repeat(65536)}}));s.initialize(events,{representation:'normalized-current-v1'});const key=s.issueAccessKey('commons','owner'),seq=s.headSequence('commons');certifyOneMessageRoutingResearch(s,'commons','legacy-large');
 const snapshot=store=>Object.fromEntries(['rooms','events','current_room_head','current_room_records','current_room_record_proofs','operator_actions','integrity_room_state'].map(table=>[table,store.db.prepare('SELECT * FROM '+table).all()]));const before=snapshot(s);replayNdjsonInto(exportNdjsonText(s.db),target);assert.deepEqual(snapshot(target),before);assert.equal(target.headSequence('commons'),seq);assert.doesNotThrow(()=>auditRecovery(target));
 const receipt=target.command(key,'commons',{id:'restored-reply',type:'message.posted',data:{messageId:'restored-reply',replyToId:'legacy-large',body:'hello'}});assert.equal(receipt.duplicate,false);assert.doesNotThrow(()=>auditRecovery(target));
});
test('certification composes with subsequent edits and lost-ack retries',t=>{
 const s=new RoomStore(':memory:');t.after(()=>s.close());const events=initialRoom();events.push(event({roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'legacy-large',body:'界'.repeat(65536)}}));s.initialize(events,{representation:'normalized-current-v1'});const key=s.issueAccessKey('commons','owner');
 const before=s.command(key,'commons',{id:'unrelated',type:'message.posted',data:{messageId:'unrelated',body:'other work'}});assert.equal(before.duplicate,false);const seq=s.headSequence('commons');
 assert.equal(certifyOneMessageRoutingResearch(s,'commons','legacy-large').sequence,seq);assert.equal(s.headSequence('commons'),seq);
 const edit={id:'edit-legacy',type:'message.edited',data:{messageId:'legacy-large',body:'revised',expectedMessageRevision:0}};const first=s.command(key,'commons',edit),again=s.command(key,'commons',edit);assert.equal(first.duplicate,false);assert.equal(again.duplicate,true);assert.equal(again.sequence,first.sequence);
 const value=JSON.parse(s.db.prepare("SELECT payload FROM current_room_records WHERE room_id='commons' AND domain='messageWitness' AND record_key='legacy-large'").get().payload);assert.equal(value.version,2);assert.doesNotThrow(()=>auditRecovery(s));
 const reply=s.command(key,'commons',{id:'reply-edited',type:'message.posted',data:{messageId:'reply-edited',replyToId:'legacy-large',body:'reply'}});assert.equal(reply.duplicate,false);assert.doesNotThrow(()=>auditRecovery(s));
});
test('certification observes a second connection’s preceding write',t=>{
 const dir=mkdtempSync(join(tmpdir(),'routing-interleave-')),path=join(dir,'room.db'),a=new RoomStore(path);let b;t.after(()=>{a.close();b?.close();rmSync(dir,{recursive:true,force:true})});
 const events=initialRoom();events.push(event({roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'legacy-large',body:'界'.repeat(65536)}}));a.initialize(events,{representation:'normalized-current-v1'});const key=a.issueAccessKey('commons','owner');b=new RoomStore(path);
 a.command(key,'commons',{id:'other-before',type:'message.posted',data:{messageId:'other-before',body:'before'}});const seq=a.headSequence('commons');const result=certifyOneMessageRoutingResearch(b,'commons','legacy-large');assert.equal(result.sequence,seq);assert.equal(a.headSequence('commons'),seq);
 const post=a.command(key,'commons',{id:'other-after',type:'message.posted',data:{messageId:'other-after',body:'after',replyToId:'legacy-large'}});assert.equal(post.duplicate,false);assert.doesNotThrow(()=>auditRecovery(a));assert.doesNotThrow(()=>auditRecovery(b));
});
