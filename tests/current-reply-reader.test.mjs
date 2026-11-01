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
