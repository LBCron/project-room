import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event} from '../src/events.js';

function fixture(t,extend=()=>{}){
 const store=new RoomStore(':memory:');t.after(()=>store.close());const events=initialRoom();
 const add=(type,data,actorId='owner')=>events.push(event({roomId:'commons',actorId,type,data}));
 for(const memberId of ['reader','other'])add('member.added',{memberId,displayName:memberId,kind:'agent',permissions:[]});
 add('message.posted',{messageId:'question',toMemberId:'reader',requestKind:'reply',requestPolicyVersion:1,body:'Please save useful work'});
 extend(events,add,store);store.initialize(events,{representation:'normalized-current-v1'});
 const keys=Object.fromEntries(['owner','reader','other'].map(id=>[id,store.issueAccessKey('commons',id)]));
 return {store,keys,events};
}
test('normalized current requests list does not report an existing incoming obligation as empty',t=>{
 const {store,keys}=fixture(t),listed=store.replyRequests.list(keys.reader,'commons');
 assert.deepEqual(listed.requests.map(request=>request.id),['question']);
});
test('normalized selected request is readable through the existing reader and supplies exact answer basis',t=>{
 const {store,keys}=fixture(t),read=store.replyRequests.selected(keys.reader,'commons','question');
 assert.equal(read.request.id,'question');assert.equal(read.page.items[0].message.body,'Please save useful work');
 assert.equal(read.current.answerBasis.contextEventId,read.request.contextEventId);
});
test('normalized current request remains absent to nonparticipants',t=>{
 const {store,keys}=fixture(t);
 assert.throws(()=>store.replyRequests.selected(keys.other,'commons','question'),error=>error.status===404&&error.code==='reply_request_not_found');
});

import {validateReplyRead,validReplyArguments} from '../client/reply-actions.mjs';
test('v2 selected and list pass the actual shared SDK/MCP validator without v1 cursor synthesis',t=>{
 const {store,keys}=fixture(t);
 for(const [name,args,read]of [
  ['room_list_requests',{},store.replyRequests.list(keys.reader,'commons')],
  ['room_read_request',{requestMessageId:'question'},store.replyRequests.selected(keys.reader,'commons','question')]
 ])assert.equal(validateReplyRead(read,{name,args,roomId:'commons'}).contractVersion,2);
 assert.equal(validReplyArguments('room_list_requests',{limit:1,cursor:'opaque'}),true);
});
test('bounded list empty-more pages retain late obligation and hide excluded IDs in opaque cursor',t=>{
 const {store,keys}=fixture(t,(_events,add)=>{
  for(let i=0;i<18;i++)add('message.posted',{messageId:`a-private-${i.toString().padStart(2,'0')}`,toMemberId:'other',requestKind:'reply',requestPolicyVersion:1,body:'Private'});
 });
 let args={limit:2},found=[],pages=0,emptyMore=false;
 do{
  const read=store.replyRequests.list(keys.reader,'commons',args);validateReplyRead(read,{name:'room_list_requests',args,roomId:'commons'});
  found.push(...read.requests.map(r=>r.id));emptyMore ||=read.requests.length===0&&read.page.hasMore;
  assert.equal(JSON.stringify(read).includes('a-private-'),false);
  if(!read.nextRead)break;args=read.nextRead.arguments;assert.ok(++pages<20);
 }while(true);
 assert.deepEqual(found,['question']);assert.equal(emptyMore,true);
});
test('selected continuation binds viewer and request, rejects tampering and carries source progress',t=>{
 const {store,keys}=fixture(t,(_events,add)=>{
  for(let i=0;i<12;i++)add('message.posted',{messageId:`context-${i}`,replyToId:'question',toMemberId:'reader',body:`Context ${i}`});
 });
 let args={requestMessageId:'question',limit:2},ids=[],pages=0;
 do{
  const read=store.replyRequests.selected(keys.reader,'commons','question',args);validateReplyRead(read,{name:'room_read_request',args,roomId:'commons'});
  ids.push(...read.page.items.map(r=>r.message.id));
  if(!read.nextRead)break;
  assert.equal(read.current.answerBasis,null);
  assert.throws(()=>store.replyRequests.selected(keys.owner,'commons','question',read.nextRead.arguments),e=>e.code==='reply_cursor_identity_changed');
  assert.throws(()=>store.replyRequests.selected(keys.reader,'commons','question',{...read.nextRead.arguments,cursor:read.page.nextCursor.slice(0,-2)+'xx'}),e=>e.code==='invalid_reply_cursor');
  args=read.nextRead.arguments;assert.ok(++pages<20);
 }while(true);
 assert.equal(ids.length,13);assert.equal(new Set(ids).size,13);
});
test('requester cancellation is exposed only after supported command and remains readable to its parties',t=>{
 const {store,keys}=fixture(t);
 const before=store.replyRequests.selected(keys.owner,'commons','question');assert.equal(before.current.actions.cancel,true);
 const cancelled=store.command(keys.owner,'commons',{id:'cancel-question',type:'reply_request.cancelled',data:{requestMessageId:'question',expectedRequestRevision:0,reason:'No longer needed'}});
 const read=store.replyRequests.selected(keys.reader,'commons','question');
 assert.equal(read.request.status,'cancelled');assert.equal(read.current.answerBasis,null);
 assert.equal(read.page.items.at(-1).eventId,cancelled.event.id);assert.equal(read.page.items.at(-1).reason,'No longer needed');
 validateReplyRead(read,{name:'room_read_request',args:{requestMessageId:'question'},roomId:'commons'});
});

import {createRoomServer} from '../server/http.mjs';
import {RoomAgentClient} from '../client/room-agent.mjs';
test('actual HTTP and SDK consume normalized list continuation and selected answer without legacy hydration',async t=>{
 const {store,keys}=fixture(t,(_events,add)=>{for(let i=0;i<9;i++)add('message.posted',{messageId:`a-excluded-${i}`,toMemberId:'other',requestKind:'reply',requestPolicyVersion:1,body:'Private'});});
 const server=createRoomServer({store});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const origin=`http://127.0.0.1:${server.address().port}`,client=new RoomAgentClient({version:1,origin,roomId:'commons',memberId:'reader',token:keys.reader});
 store.room=()=>{throw Error('unexpected legacy room hydration');};
 let args={limit:2},ids=[];
 for(let page=0;page<10;page++){
  const read=await client.replyRead('room_list_requests',args);ids.push(...read.requests.map(r=>r.id));if(!read.nextRead)break;args=read.nextRead.arguments;
 }
 assert.deepEqual(ids,['question']);
 const selected=await client.replyContext('question');assert.ok(selected.current.answerBasis);assert.equal(selected.page.items[0].message.body,'Please save useful work');
});
test('normalized same-pair follow-up prepares the earlier useful answer without hydrating the room',t=>{
 const {store,keys}=fixture(t,(_events,add)=>{
  // Legacy policy1 marked response records carry the exact inspected context.
  const opening=_events.find(e=>e.data.messageId==='question');
  add('message.posted',{messageId:'answer',replyToId:'question',responseToRequestId:'question',expectedRequestRevision:0,responseOutcome:'answered',requestPolicyVersion:1,contextEventId:opening.id,contextSequence:_events.indexOf(opening)+1,toMemberId:'owner',workItemId:null,body:'A useful saved answer'},'reader');
  add('message.posted',{messageId:'follow-up',replyToId:'answer',toMemberId:'reader',requestKind:'reply',requestPolicyVersion:1,body:'Build on that answer'});
 });
 store.room=()=>{throw Error('legacy hydration');};
 const read=store.replyRequests.selected(keys.reader,'commons','follow-up');
 assert.equal(read.preparation.previousExchanges[0].messages.at(-1).body,'A useful saved answer');
 assert.ok(read.current.answerBasis);validateReplyRead(read,{name:'room_read_request',args:{requestMessageId:'follow-up'},roomId:'commons'});
});
test('normalized history drains excluded source windows and resumes checkpoint for a late obligation',t=>{
 const {store,keys}=fixture(t,(_events,add)=>{for(let i=0;i<18;i++)add('message.posted',{messageId:`private-background-${i}`,toMemberId:'other',body:'Do not disclose'});});
 let args={limit:2},ids=[],checkpoint=null,emptyMore=false;
 for(let page=0;page<30;page++){
  const read=store.replyRequests.history(keys.reader,'commons',args);validateReplyRead(read,{name:'room_request_history',args,roomId:'commons'});
  ids.push(...read.page.items.map(r=>r.message.id));emptyMore ||=read.page.items.length===0&&read.page.hasMore;
  assert.equal(JSON.stringify(read).includes('private-background'),false);
  if(!read.nextRead){checkpoint=read.page.completedCheckpoint;break;}args=read.nextRead.arguments;
 }
 assert.deepEqual(ids,['question']);assert.ok(checkpoint);assert.equal(emptyMore,true);
 store.command(keys.owner,'commons',{id:'late-request',type:'message.posted',data:{messageId:'late-question',toMemberId:'reader',requestKind:'reply',body:'New useful work'}});
 args={limit:2,checkpoint};const late=store.replyRequests.history(keys.reader,'commons',args);
 validateReplyRead(late,{name:'room_request_history',args,roomId:'commons'});assert.deepEqual(late.page.items.map(r=>r.message.id),['late-question']);
 assert.throws(()=>store.replyRequests.history(keys.owner,'commons',args),e=>e.code==='reply_cursor_identity_changed');
});
