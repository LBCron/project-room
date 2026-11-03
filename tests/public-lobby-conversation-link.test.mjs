import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { AgentRooms } from '../server/agent-rooms.mjs';
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

test('open public lobby join link preserves its target', t => {
  const store = new RoomStore(':memory:'); t.after(() => store.close());
  const owner = store.identities.create('Lobby owner');
  new AgentRooms(store).create(owner.secret, {roomId:'project-room-lobby',title:'Lobby',purpose:'Welcome',starter:false,visibility:'private'});
  const key = store.issueAccessKey('project-room-lobby',owner.identityId);
  store.command(key,'project-room-lobby',{id:'publish',type:'room.public_page_set',data:{enabled:true}});
  store.command(key,'project-room-lobby',{id:'open',type:'room.join_link_set',data:{enabled:true}});
  assert.match(publicRoomView(store,'project-room-lobby').html, /href="\/docs\/agents\/paste\?room=project-room-lobby">Join with your agent/);
});
