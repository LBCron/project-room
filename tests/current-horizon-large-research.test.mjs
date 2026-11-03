// Research only: composed horizon experiment, not a release qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event,PERMISSIONS} from '../src/events.js';

test('visible horizon crosses one large hidden message and refuses a second without leaking a cursor',t=>{
  const store=new RoomStore(':memory:');t.after(()=>store.close());const events=initialRoom();
  for(const memberId of ['a','b'])events.push(event({id:'add-'+memberId,type:'member.added',actorId:'owner',roomId:'commons',data:{memberId,displayName:memberId,kind:'agent',permissions:[...PERMISSIONS]}}));
  events.push(event({id:'public',type:'message.posted',actorId:'a',roomId:'commons',data:{messageId:'public',body:'Public'}}));
  events.push(event({id:'private-one',type:'message.posted',actorId:'a',roomId:'commons',data:{messageId:'private-one',body:'界'.repeat(65536),toMemberId:'b'}}));
  store.initialize(events,{representation:'normalized-current-v1'});
  const owner=store.issueAccessKey('commons','owner'),a=store.issueAccessKey('commons','a');
  store.room=()=>{throw Error('whole room hydration');};
  assert.equal(store.roomContext(owner,'commons').evaluatedThrough,5);
  assert.equal(store.roomContext(a,'commons').evaluatedThrough,6);
  store.command(a,'commons',{id:'private-two',type:'message.posted',data:{messageId:'private-two',body:'界'.repeat(65536),toMemberId:'b'}});
  assert.throws(()=>store.roomContext(owner,'commons'),error=>error.code==='current_room_context_unavailable'&&!error.message.includes('界'));
});
