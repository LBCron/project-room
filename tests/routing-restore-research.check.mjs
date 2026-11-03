// Research only: exact v2 witness export/restore with a large accepted message.
import test from 'node:test';import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';import {initialRoom} from '../server/bootstrap.mjs';
import {auditRecovery} from '../server/recovery.mjs';import {exportNdjsonText} from '../server/room-export.mjs';import {replayNdjsonInto} from '../server/restore-ndjson.mjs';
test('large v2 routing witness survives export, restore, audit and reply',t=>{
 const source=new RoomStore(':memory:'),target=new RoomStore(':memory:');t.after(()=>{source.close();target.close()});
 source.initialize(initialRoom(),{representation:'normalized-current-v1'});const key=source.issueAccessKey('commons','owner');
 source.command(key,'commons',{id:'post-large-root',type:'message.posted',data:{messageId:'large-root',body:'界'.repeat(65536)}});
 const witness=s=>JSON.parse(s.db.prepare("SELECT payload FROM current_room_records WHERE room_id='commons' AND domain='messageWitness' AND record_key='large-root'").get().payload);
 assert.equal(witness(source).version,2);assert.doesNotThrow(()=>auditRecovery(source));
 const exported=exportNdjsonText(source.db);replayNdjsonInto(exported,target);assert.deepEqual(witness(target),witness(source));assert.doesNotThrow(()=>auditRecovery(target));
 const reply=target.command(key,'commons',{id:'reply-large-root',type:'message.posted',data:{messageId:'reply-large-root',replyToId:'large-root',body:'Restored reply'}});assert.equal(reply.duplicate,false);assert.doesNotThrow(()=>auditRecovery(target));
});
