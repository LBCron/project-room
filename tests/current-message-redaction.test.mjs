import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event} from '../src/events.js';
import {auditRecovery} from '../server/recovery.mjs';
import {createHash} from 'node:crypto';
import {textVersion} from '../server/text-results.mjs';
import {withCurrentRoomWriter} from '../server/current-room-repository.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {replayNdjsonInto} from '../server/restore-ndjson.mjs';

const snapshot=store=>Object.fromEntries(['rooms','events','commands','messages','work_entities','current_room_records','current_room_record_proofs','current_room_head','operator_actions','room_attachments'].map(table=>[table,store.db.prepare('SELECT * FROM '+table).all()]));
function noText(store,needles){for(const {name} of store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all())for(const row of store.db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all())for(const value of Object.values(row)){const text=value instanceof Uint8Array?Buffer.from(value).toString():String(value);for(const needle of needles)assert.equal(text.includes(needle),false,'residual text in '+name);}}
function seeded(t){const store=new RoomStore(':memory:');t.after(()=>store.close());const es=initialRoom();for(const id of ['worker','other'])es.push(event({roomId:'commons',actorId:'owner',type:'member.added',data:{memberId:id,displayName:id,kind:'agent',permissions:['accept_work','complete_work']}}));const add=(type,data,actorId='owner')=>es.push(event({roomId:'commons',actorId,type,data}));add('message.posted',{messageId:'root',body:'public root'});add('message.posted',{messageId:'copy',body:'copied-redaction-secret',replyToId:'root',alsoSendToChannel:true});add('message.posted',{messageId:'private',body:'private-old-redaction-secret',toMemberId:'worker'});add('message.edited',{messageId:'private',body:'private-edited-redaction-secret',expectedMessageRevision:0});store.initialize(es,{representation:'normalized-current-v1'});const keys=Object.fromEntries(['owner','worker','other'].map(id=>[id,store.issueAccessKey('commons',id)]));store.room=()=>{throw Error('legacy blob hydration');};const cmd=(who,id,type,data)=>store.command(keys[who],'commons',{id,type,data});return{store,keys,cmd};}

test('authorized normalized message deletion physically erases text and preserves exact retry',t=>{
 const store=new RoomStore(':memory:');t.after(()=>store.close());
 const es=initialRoom();es.push(event({roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'erase-me',body:'private-redaction-needle-1101'}}));
 store.initialize(es,{representation:'normalized-current-v1'});
 const key=store.issueAccessKey('commons','owner');store.room=()=>{throw Error('legacy blob hydration');};
 const command={id:'delete-once',type:'message.deleted',data:{messageId:'erase-me',expectedMessageRevision:0,reason:'remove'}};
 const saved=store.command(key,'commons',command);
 assert.equal(saved.duplicate,false);
 assert.equal(store.db.prepare("SELECT body FROM messages WHERE message_id='erase-me'").get().body,null);
 assert.equal(store.db.prepare("SELECT count(*) n FROM events WHERE instr(body,'private-redaction-needle-1101')>0").get().n,0);
 assert.equal(store.command(key,'commons',command).duplicate,true);
 assert.doesNotThrow(()=>auditRecovery(store));
});

test('normalized erasure preserves DM permission, source/channel copy, fault rollback and complete restored oracle',t=>{
 const {store,keys,cmd}=seeded(t);
 store.transaction(()=>withCurrentRoomWriter(store.db,'commons',()=>store.db.prepare("INSERT INTO room_attachments(room_id,id,uploader_id,filename,media_type,byte_length,sha256,bytes,state,created_at,expires_at,message_id) VALUES('commons','file','owner','secret.txt','text/plain',?,?,?,'committed',1,9999999999999,'private')").run(Buffer.byteLength('private-file-redaction-secret'),createHash('sha256').update('private-file-redaction-secret').digest('hex'),Buffer.from('private-file-redaction-secret'))));
 const before=snapshot(store);
 assert.throws(()=>cmd('other','denied','message.deleted',{messageId:'private',expectedMessageRevision:1}),/author or the Room owner/);
 assert.throws(()=>cmd('owner','stale','message.deleted',{messageId:'private',expectedMessageRevision:0}),/changed/);
 assert.deepEqual(snapshot(store),before);
 const prepare=store.db.prepare.bind(store.db);let fired=false;
 store.db.prepare=sql=>{const statement=prepare(sql);if(sql==='UPDATE events SET body=? WHERE room_id=? AND sequence=?'){const run=statement.run.bind(statement);statement.run=(...args)=>{run(...args);fired=true;throw Error('erasure interrupted');};}return statement;};
 try{assert.throws(()=>cmd('owner','erase-private','message.deleted',{messageId:'private',expectedMessageRevision:1,reason:'remove'}),/erasure interrupted/);}finally{store.db.prepare=prepare;}
 assert.equal(fired,true);assert.deepEqual(snapshot(store),before);
 cmd('owner','erase-private','message.deleted',{messageId:'private',expectedMessageRevision:1,reason:'remove'});
 cmd('owner','erase-copy','message.deleted',{messageId:'copy',expectedMessageRevision:0});
 for(const id of ['private','copy','copy:channel']){const row=store.db.prepare('SELECT body,record_json,reducer_extras_json FROM messages WHERE message_id=?').get(id);assert.equal(row.body,null);assert.equal(JSON.parse(row.record_json).redacted,true);}
 noText(store,['private-old-redaction-secret','private-edited-redaction-secret','private-file-redaction-secret','copied-redaction-secret']);
 assert.doesNotThrow(()=>auditRecovery(store));
 const saved=snapshot(store),target=new RoomStore(':memory:');t.after(()=>target.close());
 replayNdjsonInto(exportNdjsonText(store.db),target);target.room=()=>{throw Error('legacy blob hydration');};
 assert.doesNotThrow(()=>auditRecovery(target));
 assert.equal(target.command(keys.owner,'commons',{id:'erase-private',type:'message.deleted',data:{messageId:'private',expectedMessageRevision:1,reason:'remove'}}).duplicate,true);
 assert.deepEqual(snapshot(target),saved);
});

test('deleting cited normalized text withdraws current and historical receipt evidence without changing saved provenance',t=>{
 const {store,cmd}=seeded(t);
 cmd('owner','propose','work.proposed',{workItemId:'task',title:'Useful work',definitionOfDone:'Saved',accountableMemberId:'worker',mode:'read'});
 cmd('worker','accept','work.accepted',{workItemId:'task',expectedRevision:0});
 const body='saved-cited-redaction-secret',post=cmd('worker','result','message.posted',{messageId:'result',workItemId:'task',body});
 cmd('worker','complete','work.completed',{workItemId:'task',expectedRevision:1,evidenceKind:'room_text',evidenceMessageId:'result',evidenceMessageEventId:post.event.id,evidenceVersion:textVersion(body),producerId:'worker',previousCompletionEventId:null,summary:'Saved artifact',nextAction:'Review'});
 const original=JSON.parse(store.db.prepare("SELECT body FROM work_entities WHERE work_id='task'").get().body),receipt=original.receipt;
 cmd('owner','erase-result','message.deleted',{messageId:'result',expectedMessageRevision:0});
 const item=JSON.parse(store.db.prepare("SELECT body FROM work_entities WHERE work_id='task'").get().body);
 assert.equal(item.receipt.eventId,receipt.eventId);assert.equal(item.receipt.evidenceVersion,receipt.evidenceVersion);assert.equal(item.receipt.nativeText.evidence,'removed');assert.equal(item.evidenceWithdrawals.length,1);assert.equal(item.revision,original.revision);
 noText(store,[body]);assert.doesNotThrow(()=>auditRecovery(store));
});
