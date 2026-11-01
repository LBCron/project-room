import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event} from '../src/events.js';
import {buildRoomBootstrap} from '../server/room-bootstrap.mjs';

// Same existing endpoint, explicitly code-owned synthetic normalized room.
// Runtime implementation is owned by root; this test intentionally fails before
// the normalized snapshot/bootstrap port exists.
test('normalized room bootstrap is readable through the existing builder',t=>{
 const store=new RoomStore(':memory:');t.after(()=>store.close());
 store.initialize([...initialRoom(),event({id:'saved-bootstrap',roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'saved-bootstrap',body:'Useful saved context'}})],{representation:'normalized-current-v1'});
 const key=store.issueAccessKey('commons','owner');
 const bootstrap=buildRoomBootstrap(store,key,'commons',null);
 assert.equal(bootstrap.roomId,'commons');
 assert.equal(bootstrap.snapshot.viewerId,'owner');
 assert.ok(Array.isArray(bootstrap.snapshot.state.messages));
 assert.equal(bootstrap.snapshot.state.messages.find(message=>message.id==='saved-bootstrap')?.body,'Useful saved context');
});
