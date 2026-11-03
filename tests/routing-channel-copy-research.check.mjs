import test from 'node:test';import assert from 'node:assert/strict';import {RoomStore} from '../server/store.mjs';import {initialRoom} from '../server/bootstrap.mjs';import {auditRecovery} from '../server/recovery.mjs';import {readConversation} from '../server/conversation-sync.mjs';
test('new v2 large root preserves atomic reply and channel copy',t=>{
 const s=new RoomStore(':memory:');t.after(()=>s.close());s.initialize(initialRoom(),{representation:'normalized-current-v1'});const key=s.issueAccessKey('commons','owner');
 s.command(key,'commons',{id:'root-large',type:'message.posted',data:{messageId:'root-large',body:'界'.repeat(65536)}});
 const cmd={id:'reply-copy',type:'message.posted',data:{messageId:'reply-copy',replyToId:'root-large',body:'Visible answer',alsoSendToChannel:true}};
 const first=s.command(key,'commons',cmd),retry=s.command(key,'commons',cmd);assert.equal(first.duplicate,false);assert.equal(retry.duplicate,true);
 const reply=readConversation(s,key,'commons',{messageId:'reply-copy'}).messages[0],copy=readConversation(s,key,'commons',{messageId:'reply-copy:channel'}).messages[0];assert.equal(reply.body,'Visible answer');assert.equal(reply.replyToId,'root-large');assert.equal(copy.body,'Visible answer');assert.equal(copy.replyToId,null);assert.equal(copy.channelId,reply.channelId);assert.doesNotThrow(()=>auditRecovery(s));
});
