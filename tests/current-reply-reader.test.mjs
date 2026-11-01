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
