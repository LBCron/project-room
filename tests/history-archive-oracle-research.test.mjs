import test from 'node:test';import assert from 'node:assert/strict';import {RoomStore} from '../server/store.mjs';import {initialRoom} from '../server/bootstrap.mjs';
for(const sameInstant of [false,true]) test(`archived prejoin references are hidden (${sameInstant?'same instant':'distinct instants'})`,t=>{
 let now=Date.now();const s=new RoomStore(':memory:',{now:()=>now});t.after(()=>s.close());s.initialize(initialRoom());const owner=s.issueAccessKey('commons','owner');
 const send=(key,id,type,data)=>{if(!sameInstant)now+=1000;return s.command(key,'commons',{id,type,data})};
 send(owner,'old','message.posted',{messageId:'old',body:'old',kind:'poll',poll:{question:'Pick',options:['a','b']}});send(owner,'policy','room.history_visibility_set',{historyVisibility:'since_join'});send(owner,'add','member.added',{memberId:'late',displayName:'late',kind:'agent',permissions:[]});send(owner,'visible','message.posted',{messageId:'visible',body:'visible'});send(owner,'recent','message.posted',{messageId:'recent',body:'recent'});
 for(let i=0;i<40;i++)if(s.backfillMessages({limit:1000}).done)break;
 assert.equal(s.checkMessagesParity().ok,true);
 const archived=s.archiveMessages('commons',{keepNewest:1,dryRun:false});console.log('archive',JSON.stringify(archived));
 assert.equal(archived.ok,true);
 const late=s.issueAccessKey('commons','late');const attempt=id=>{try{send(late,'reply-'+id,'message.posted',{messageId:'reply-'+id,body:'hello',replyToId:id});return 'accepted'}catch(e){return [e.status,e.code,e.message]}};
 const hidden=attempt('old'),missing=attempt('missing');console.log(JSON.stringify({hidden,missing}));assert.deepEqual(hidden,missing);
 assert.equal(attempt('visible')[1],'message_archived');
 for(const [type,extra] of [['message.pinned',{}],['message.unpinned',{}],['message.edited',{body:'edit',expectedMessageRevision:0}],['message.deleted',{expectedMessageRevision:0}],['poll.voted',{option:0,active:true}]]){
  const action=id=>{try{send(late,type+'-'+id,type,{messageId:id,...extra});return 'accepted'}catch(e){return [e.status,e.code,e.message]}};
  assert.deepEqual(action('old'),action('missing'),type);
 }
});
