import test from 'node:test';import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';import {initialRoom} from '../server/bootstrap.mjs';import {event} from '../src/events.js';import {textVersion} from '../server/text-results.mjs';import {auditRecovery} from '../server/recovery.mjs';
function setup(t,target){
 const s=new RoomStore(':memory:');t.after(()=>s.close());const es=initialRoom();for(const [type,data] of [['member.added',{memberId:'peer',displayName:'Peer',kind:'agent',permissions:[]}],['member.added',{memberId:'worker',displayName:'Worker',kind:'agent',permissions:['accept_work','complete_work']}]])es.push(event({roomId:'commons',actorId:'owner',type,data}));s.initialize(es,{representation:'normalized-current-v1'});
 const owner=s.issueAccessKey('commons','owner'),worker=s.issueAccessKey('commons','worker'),send=(key,id,type,data)=>s.command(key,'commons',{id,type,data});
 send(owner,'propose','work.proposed',{workItemId:'task',title:'Task',definitionOfDone:'Done',accountableMemberId:'worker'});send(worker,'accept','work.accepted',{workItemId:'task',expectedRevision:0});
 const body='saved evidence',post=send(owner,'post','message.posted',{messageId:'evidence',body,workItemId:'task',...(target?{toMemberId:target}:{})});
 const data={workItemId:'task',expectedRevision:1,evidenceKind:'room_text',evidenceMessageId:'evidence',evidenceMessageEventId:post.event.id,evidenceVersion:textVersion(body),previousCompletionEventId:null,producerId:'worker',summary:'Done',nextAction:'Review'};
 return {s,worker,data};
}
test('work completion cannot attach another pair’s private text',t=>{
 const {s,worker,data}=setup(t,'peer');const before=s.headSequence('commons');
 const reject=(id,messageId)=>{try{s.command(worker,'commons',{id,type:'work.completed',data:{...data,evidenceMessageId:messageId}});assert.fail('expected rejection')}catch(e){return {status:e.status,code:e.code,message:e.message}}};
 assert.deepEqual(reject('private','evidence'),reject('missing','missing'));assert.equal(s.headSequence('commons'),before);assert.ok(Object.values(auditRecovery(s).checks).every(Boolean));
 const stale=(id,messageId)=>{try{s.command(worker,'commons',{id,type:'work.completed',data:{...data,expectedRevision:999,evidenceMessageId:messageId}});assert.fail('expected rejection')}catch(e){return {status:e.status,code:e.code,message:e.message}}};
 assert.deepEqual(stale('stale-private','evidence'),stale('stale-missing','missing'));
});
for(const target of [null,'worker'])test('visible evidence remains usable '+(target??'public'),t=>{
 const {s,worker,data}=setup(t,target);assert.ok(s.command(worker,'commons',{id:'complete',type:'work.completed',data}).event);assert.ok(Object.values(auditRecovery(s).checks).every(Boolean));
});
