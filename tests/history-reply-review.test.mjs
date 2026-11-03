import test from 'node:test';import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';import {initialRoom} from '../server/bootstrap.mjs';import {event} from '../src/events.js';import {readConversation} from '../server/conversation-sync.mjs';
test('since-join member cannot reference prejoin message',t=>{
 const s=new RoomStore(':memory:');t.after(()=>s.close());const es=initialRoom();
 for(const [type,data] of [['message.posted',{messageId:'old-public',body:'private older context'}],['room.history_visibility_set',{historyVisibility:'since_join'}],['member.added',{memberId:'late',displayName:'Late',kind:'agent',permissions:[]}]])es.push(event({roomId:'commons',actorId:'owner',type,data}));
 s.initialize(es,{representation:'normalized-current-v1'});const late=s.issueAccessKey('commons','late'),owner=s.issueAccessKey('commons','owner');
 assert.throws(()=>readConversation(s,late,'commons',{messageId:'old-public'}),e=>e.status===404);
 const failure=target=>{try{s.command(late,'commons',{id:'reply-'+target,type:'message.posted',data:{messageId:'reply-'+target,body:'hello',replyToId:target}});assert.fail('expected refusal')}catch(e){return {status:e.status,code:e.code,message:e.message}}};
 assert.deepEqual(failure('old-public'),failure('missing'));
 for(const [type,data] of [['message.pinned',id=>({messageId:id})],['message.edited',id=>({messageId:id,body:'edited',expectedMessageRevision:0})],['message.deleted',id=>({messageId:id,expectedMessageRevision:0})]]){
  const attempt=target=>{try{s.command(late,'commons',{id:type+'-'+target,type,data:data(target)});assert.fail('expected refusal')}catch(e){return {status:e.status,code:e.code,message:e.message}}};
  assert.deepEqual(attempt('old-public'),attempt('missing'),type);
 }
 s.now=()=>Date.now()+5000;
 assert.ok(s.command(owner,'commons',{id:'recent',type:'message.posted',data:{messageId:'recent',body:'visible'}}).event);
 assert.ok(s.command(late,'commons',{id:'recent-reply',type:'message.posted',data:{messageId:'recent-reply',body:'visible reply',replyToId:'recent'}}).event);
 assert.ok(s.command(owner,'commons',{id:'owner-old-reply',type:'message.posted',data:{messageId:'owner-old-reply',body:'owner reply',replyToId:'old-public'}}).event);
 assert.ok(s.command(late,'commons',{id:'reply-visible-child',type:'message.posted',data:{messageId:'reply-visible-child',body:'continue',replyToId:'owner-old-reply'}}).event);
});

test('work proposals cannot use unseen prejoin messages as sources',t=>{
 const s=new RoomStore(':memory:');t.after(()=>s.close());const es=initialRoom();
 for(const [type,data] of [['message.posted',{messageId:'old-public',body:'old'}],['room.history_visibility_set',{historyVisibility:'since_join'}],['member.added',{memberId:'late',displayName:'Late',kind:'agent',permissions:['steer']}]])es.push(event({roomId:'commons',actorId:'owner',type,data}));
 s.initialize(es,{representation:'normalized-current-v1'});const late=s.issueAccessKey('commons','late'),owner=s.issueAccessKey('commons','owner');
 const proposal=(target,id)=>({id,type:'work.proposed',data:{workItemId:id,title:'Task',definitionOfDone:'Done',accountableMemberId:'late',sourceMessageId:target}});
 const reject=target=>{try{s.command(late,'commons',proposal(target,'task-'+target));assert.fail('expected refusal')}catch(e){return {status:e.status,code:e.code,message:e.message}}};
 assert.deepEqual(reject('old-public'),reject('missing'));
 s.now=()=>Date.now()+5000;s.command(owner,'commons',{id:'visible',type:'message.posted',data:{messageId:'visible',body:'visible'}});
 assert.ok(s.command(late,'commons',proposal('visible','visible-task')).event);
});

test('work proposals cannot use another pair’s direct message as a source',t=>{
 const s=new RoomStore(':memory:');t.after(()=>s.close());const es=initialRoom();
 for(const [type,data] of [['member.added',{memberId:'peer',displayName:'Peer',kind:'agent',permissions:['steer']}],['member.added',{memberId:'other',displayName:'Other',kind:'agent',permissions:['steer']}],['member.added',{memberId:'unprivileged',displayName:'Unprivileged',kind:'agent',permissions:[]}],['message.posted',{messageId:'private-dm',body:'private',toMemberId:'peer'}]])es.push(event({roomId:'commons',actorId:'owner',type,data}));
 s.initialize(es,{representation:'normalized-current-v1'});const other=s.issueAccessKey('commons','other'),peer=s.issueAccessKey('commons','peer'),unprivileged=s.issueAccessKey('commons','unprivileged');
 const proposal=(target,id,actor)=>({id,type:'work.proposed',data:{workItemId:id,title:'Task',definitionOfDone:'Done',accountableMemberId:actor,sourceMessageId:target}});
 const reject=(token,target,actor)=>{try{s.command(token,'commons',proposal(target,'task-'+target,actor));assert.fail('expected refusal')}catch(e){return {status:e.status,code:e.code,message:e.message}}};
 assert.deepEqual(reject(other,'private-dm','other'),reject(other,'missing','other'));
 assert.deepEqual(reject(unprivileged,'private-dm','unprivileged'),reject(unprivileged,'missing','unprivileged'));
 assert.ok(s.command(peer,'commons',proposal('private-dm','peer-task','peer')).event);
 // A nonparticipant must not gain an oracle merely by reusing an existing task ID.
 const otherDuplicate=target=>{try{s.command(other,'commons',proposal(target,'peer-task','other'));assert.fail('expected refusal')}catch(e){return {status:e.status,code:e.code,message:e.message}}};
 assert.deepEqual(otherDuplicate('private-dm'),otherDuplicate('missing'));
});

test('legacy decisions do not confirm another pair’s private message ID',t=>{
 const s=new RoomStore(':memory:');t.after(()=>s.close());const es=initialRoom();
 for(const [type,data] of [['member.added',{memberId:'peer',displayName:'Peer',kind:'agent',permissions:[]}],['member.added',{memberId:'observer',displayName:'Observer',kind:'human',permissions:['decide']}],['member.added',{memberId:'unprivileged',displayName:'Unprivileged',kind:'human',permissions:[]}],['message.posted',{messageId:'private-dm',body:'private',toMemberId:'peer'}],['message.posted',{messageId:'public',body:'public rationale'}]])es.push(event({roomId:'commons',actorId:'owner',type,data}));
 s.initialize(es);const observer=s.issueAccessKey('commons','observer'),unprivileged=s.issueAccessKey('commons','unprivileged');
 const reject=(key,target,id)=>{try{s.command(key,'commons',{id,type:'decision.recorded',data:{sourceMessageId:target,statement:'Adopt this'}});assert.fail('expected refusal')}catch(e){return {status:e.status,code:e.code,message:e.message}}};
 assert.deepEqual(reject(observer,'private-dm','private'),reject(observer,'missing','missing'));
 assert.deepEqual(reject(unprivileged,'private-dm','no-private'),reject(unprivileged,'missing','no-missing'));
 assert.ok(s.command(observer,'commons',{id:'public-decision',type:'decision.recorded',data:{sourceMessageId:'public',statement:'Adopt this'}}).event);
});
