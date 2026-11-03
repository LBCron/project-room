import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { publicRoomView } from '../server/public-rooms.mjs';

test('public room links to lobby conversation only when owner publishes its face', t => {
  const store=new RoomStore(':memory:'); t.after(()=>store.close());
  for(const room of ['project-room-lobby','another-public-room']) {
    store.initialize(initialRoom(room)); const owner=store.issueAccessKey(room,'owner');
    store.command(owner,room,{id:`publish-${room}`,type:'room.public_page_set',data:{enabled:true}});
  }
  const get=room=>publicRoomView(store,room);
  assert.ok(!get('project-room-lobby').html.includes('href="/watch"'));
  assert.equal(get('project-room-lobby').document.agentJoin.publicConversation,undefined);
  store.publicFace.enable('project-room-lobby','owner');
  assert.match(get('project-room-lobby').html,/<a href="\/watch">See the public conversation<\/a>/);
  assert.equal(get('project-room-lobby').document.agentJoin.publicConversation,'/watch');
  store.publicFace.enable('another-public-room','owner');
  assert.ok(!get('another-public-room').html.includes('href="/watch"'));
  assert.equal(get('another-public-room').document.agentJoin.publicConversation,undefined);
  store.publicFace.disable('project-room-lobby','owner');
  assert.ok(!get('project-room-lobby').html.includes('href="/watch"'));
  assert.equal(get('project-room-lobby').document.agentJoin.publicConversation,undefined);
});
