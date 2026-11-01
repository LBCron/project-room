import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event,PERMISSIONS} from '../src/events.js';
import {currentCommandContext,withCurrentReadContext} from '../server/current-room-repository.mjs';
function fixture(t,{count=100,large=false}={}){
 const events=initialRoom();
 for(let i=1;i<count;i++){
  const memberId=`member-${String(i).padStart(3,'0')}`;
  events.push(event({roomId:'commons',actorId:'owner',type:'member.added',data:{memberId,displayName:memberId,kind:'agent',permissions:[...PERMISSIONS]}}));
  if(large&&i>3)events.push(event({roomId:'commons',actorId:memberId,type:'capabilities.advertised',data:{capabilities:Array.from({length:30},(_,j)=>String(j).padStart(2,'0')+'x'.repeat(78))}}));
 }
 const store=new RoomStore(':memory:');t.after(()=>store.close());store.initialize(events,{representation:'normalized-current-v1'});
 return {store,owner:store.issueAccessKey('commons','owner'),agent:store.issueAccessKey('commons','member-001')};
}
const post=(id,body='Useful ordinary text')=>({id,type:'message.posted',data:{messageId:id,body}});
test('ordinary post at100 members does not hydrate the roster',t=>{
 const {store,owner}=fixture(t);const result=store.command(owner,'commons',post('plain'));
 assert.equal(result.event.actorId,'owner');assert.equal(result.event.data.body,'Useful ordinary text');
 assert.equal(store.command(owner,'commons',post('plain')).duplicate,true);
});
test('unrelated large legal profiles do not prevent an addressed work assignment',t=>{
 const {store,owner,agent}=fixture(t,{large:true});
 const result=store.command(owner,'commons',{id:'propose',type:'work.proposed',data:{workItemId:'task',title:'Useful task',definitionOfDone:'A saved result',accountableMemberId:'member-001',verifierMemberId:'member-002'}});
 assert.equal(result.event.actorId,'owner');
 assert.equal(store.command(agent,'commons',{id:'accept',type:'work.accepted',data:{workItemId:'task',expectedRevision:0}}).event.actorId,'member-001');
});
import {textVersion} from '../server/text-results.mjs';
import {auditRecovery} from '../server/recovery.mjs';
import {readCurrentRecord,withCurrentServingWriter} from '../server/current-room-repository.mjs';
test('100-member native work runs through result, independent review and owner decision without deleting unrelated authority',t=>{
 const {store,owner,agent}=fixture(t,{large:true}),verifier=store.issueAccessKey('commons','member-002');
 const cmd=(key,id,type,data)=>store.command(key,'commons',{id,type,data});
 const untouched=store.db.prepare("SELECT payload,payload_sha256 FROM current_room_records WHERE domain='members' AND record_key='member-099'").get();
 store.room=()=>{throw Error('whole-room hydration');};
 cmd(owner,'propose','work.proposed',{workItemId:'task',title:'Useful task',definitionOfDone:'Independent saved result',accountableMemberId:'member-001',verifierMemberId:'member-002',humanDecisionMakerId:'owner',independentVerificationRequired:true,ownerDecisionRequired:true});
 cmd(agent,'accept','work.accepted',{workItemId:'task',expectedRevision:0});
 cmd(agent,'start','work.started',{workItemId:'task',expectedRevision:1});
 const body='Exact saved result',posted=cmd(agent,'result','message.posted',{messageId:'result',body,workItemId:'task'}),version=textVersion(body);
 const done=cmd(agent,'complete','work.completed',{workItemId:'task',expectedRevision:2,evidenceKind:'room_text',evidenceMessageId:'result',evidenceMessageEventId:posted.event.id,evidenceVersion:version,producerId:'member-003',previousCompletionEventId:null,summary:'Saved result',nextAction:'Review'});
 const review={workItemId:'task',expectedRevision:3,result:'pass',completionEventId:done.event.id,evidenceVersion:version,summary:'Independently checked'};
 assert.throws(()=>cmd(agent,'wrong-review','verification.recorded',review),/designated verifier/);
 cmd(verifier,'verify','verification.recorded',review);
 cmd(owner,'rationale','message.posted',{messageId:'rationale',body:'I reviewed the exact saved result'});
 cmd(owner,'approve','owner.decision_recorded',{workItemId:'task',expectedRevision:4,decision:'approved',completionEventId:done.event.id,evidenceVersion:version,reason:'Useful and correct',sourceMessageId:'rationale'});
 assert.deepEqual(store.db.prepare("SELECT payload,payload_sha256 FROM current_room_records WHERE domain='members' AND record_key='member-099'").get(),untouched);
 assert.equal(JSON.parse(store.db.prepare("SELECT body FROM work_entities WHERE work_id='task'").get().body).decision.decision,'approved');
 assert.doesNotThrow(()=>auditRecovery(store));
});
test('mention path preserves full roster resolution at100 short profiles',t=>{
 const {store,owner}=fixture(t);
 const result=store.command(owner,'commons',post('mention','@member-099 please review'));
 assert.equal(result.event.data.body,'@member-099 please review');
 assert.equal(store.db.prepare("SELECT count(*) AS n FROM activity_events WHERE message_id='mention' AND user_id='member-099'").get().n,1);
});
test('trusted actor option ignores caller-invented command actor and uses protected member facts',t=>{
 const {store,agent}=fixture(t,{large:true});let measured;
 const command={...post('spoof'),actorId:'member-099'};
 const context=store.readTransaction(()=>withCurrentReadContext(store.db,'commons',b=>{
  const value=currentCommandContext(store,'commons',command,{actorId:'member-001'});measured={records:b.records,bytes:b.bytes};return value;
 }));
 assert.deepEqual(Object.keys(context.room.state.members).sort(),['member-001','owner']);
 assert.ok(measured.records<=200);assert.throws(()=>store.command(agent,'commons',command),e=>e.code==='invalid_command');assert.equal(store.command(agent,'commons',post('honest')).event.actorId,'member-001');
});
test('missing assignee and corrupt selected member remain refusals with sparse command authority',t=>{
 const {store,owner}=fixture(t,{large:true});
 // Existing code-owned format permit is used solely for controlled fault and
 // authority-gate fixture setup; no new production mutation path is introduced.
 const propose=id=>({id,type:'work.proposed',data:{workItemId:id,title:'Task',definitionOfDone:'Saved',accountableMemberId:'missing'}});
 assert.throws(()=>store.command(owner,'commons',propose('unknown')),/member/i);
 store.transaction(()=>withCurrentServingWriter(store.db,'commons',()=>{
  // Corrupting a selected proof-bound payload must fail closed, never borrow
  // the authenticated in-memory member or a caller's actor object.
  store.db.prepare("UPDATE current_room_records SET payload='{}' WHERE domain='members' AND record_key='member-001'").run();
 }));
 assert.throws(()=>store.command(owner,'commons',{...propose('corrupt'),data:{...propose('corrupt').data,accountableMemberId:'member-001'}}),/current_room_corrupt/);
});
