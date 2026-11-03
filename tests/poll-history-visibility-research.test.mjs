import test from 'node:test';import assert from 'node:assert/strict';import {RoomStore} from '../server/store.mjs';import {initialRoom} from '../server/bootstrap.mjs';
for(const representation of [undefined])test(`poll votes respect visibility (${representation??'legacy'})`,t=>{
 let now=Date.now();const s=new RoomStore(':memory:',{now:()=>now});t.after(()=>s.close());s.initialize(initialRoom(),representation?{representation}:undefined);const owner=s.issueAccessKey('commons','owner');const send=(key,id,type,data)=>{now+=1000;return s.command(key,'commons',{id,type,data})};
 const poll={body:'Pick',kind:'poll',poll:{question:'Pick',options:['a','b']}};
 send(owner,'old','message.posted',{...poll,messageId:'old'});send(owner,'policy','room.history_visibility_set',{historyVisibility:'since_join'});send(owner,'peer','member.added',{memberId:'peer',displayName:'Peer',kind:'agent',permissions:[]});send(owner,'late','member.added',{memberId:'late',displayName:'Late',kind:'agent',permissions:[]});
 const late=s.issueAccessKey('commons','late'),peer=s.issueAccessKey('commons','peer');send(owner,'private','message.posted',{...poll,messageId:'private',toMemberId:'peer'});send(owner,'visible','message.posted',{...poll,messageId:'visible'});
 const vote=(key,id,target)=>{try{send(key,id,'poll.voted',{messageId:target,option:0,active:true});return 'accepted'}catch(e){return [e.status,e.code,e.message]}};
 assert.deepEqual(vote(late,'old-vote','old'),vote(late,'missing-vote','missing'));assert.deepEqual(vote(late,'private-vote','private'),vote(late,'missing-vote2','missing'));assert.equal(vote(late,'visible-vote','visible'),'accepted');assert.equal(vote(peer,'peer-vote','private'),'accepted');
});
