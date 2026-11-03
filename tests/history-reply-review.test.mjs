import test from 'node:test';import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';import {initialRoom} from '../server/bootstrap.mjs';import {event} from '../src/events.js';import {readConversation} from '../server/conversation-sync.mjs';
test('since-join member cannot reference prejoin message',t=>{
 const s=new RoomStore(':memory:');t.after(()=>s.close());const es=initialRoom();
 for(const [type,data] of [['message.posted',{messageId:'old-public',body:'private older context'}],['room.history_visibility_set',{historyVisibility:'since_join'}],['member.added',{memberId:'late',displayName:'Late',kind:'agent',permissions:[]}]])es.push(event({roomId:'commons',actorId:'owner',type,data}));
 s.initialize(es,{representation:'normalized-current-v1'});const late=s.issueAccessKey('commons','late'),owner=s.issueAccessKey('commons','owner');
 assert.throws(()=>readConversation(s,late,'commons',{messageId:'old-public'}),e=>e.status===404);
 const failure=target=>{try{s.command(late,'commons',{id:'reply-'+target,type:'message.posted',data:{messageId:'reply-'+target,body:'hello',replyToId:target}});assert.fail('expected refusal')}catch(e){return {status:e.status,code:e.code,message:e.message}}};
 assert.deepEqual(failure('old-public'),failure('missing'));
 s.now=()=>Date.now()+5000;
 assert.ok(s.command(owner,'commons',{id:'recent',type:'message.posted',data:{messageId:'recent',body:'visible'}}).event);
 assert.ok(s.command(late,'commons',{id:'recent-reply',type:'message.posted',data:{messageId:'recent-reply',body:'visible reply',replyToId:'recent'}}).event);
 assert.ok(s.command(owner,'commons',{id:'owner-old-reply',type:'message.posted',data:{messageId:'owner-old-reply',body:'owner reply',replyToId:'old-public'}}).event);
});
