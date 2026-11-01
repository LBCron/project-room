import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event} from '../src/events.js';
import {createRoomServer} from '../server/http.mjs';
import {RoomClient} from '../src/client.js';
import {readRoomSnapshot} from '../server/snapshot-window.mjs';
import {readConversation} from '../server/conversation-sync.mjs';
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

test('actual browser client holds explicit partial current window and pages through existing conversation contract',async t=>{
 const store=new RoomStore(':memory:');t.after(()=>store.close());
 const posts=Array.from({length:20},(_,i)=>event({id:`native-open-${i}`,roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:`native-open-${i}`,body:`Saved result ${i}`}}));
 store.initialize([...initialRoom(),...posts],{representation:'normalized-current-v1'});
 const issued=store.createSession(store.issueAccessKey('commons','owner')),key=issued.token,reads=[],seen=[];
 const client=new RoomClient({events:null,lazyHistory:true,onSnapshot:s=>seen.push(s)});t.after(()=>client.disconnect());
 client.session={authMode:'room',roomId:'commons',member:{id:'owner'},sessionBinding:issued.session.sessionBinding,sessionRevision:issued.session.sessionRevision};
 client.request=async path=>{
  reads.push(path);const url=new URL(path,'http://local');
  if(url.pathname.endsWith('/conversation'))return readConversation(store,key,'commons',{limit:Number(url.searchParams.get('limit')),cursor:url.searchParams.get('cursor')});
  return readRoomSnapshot(store,key,'commons',null,{windowed:true,offerContext:true});
 };
 await client.refresh();
 assert.equal(reads.length,1,'no fallback full-document loop for unknown omitted count');
 assert.equal(seen.at(-1).snapshotVersion,2);
 assert.equal(client.heldMessages().partial,true);
 assert.equal(client.heldMessages().owesFull,false);
 assert.equal(seen.at(-1).state.messages.at(-1).body,'Saved result 19');
 for(let i=0;i<5&&client.heldMessages().partial;i++)assert.equal(await client.pageOlder(),true);
 assert.equal(client.heldMessages().partial,false);
 assert.equal(new Set(seen.at(-1).state.messages.map(m=>m.id)).size,seen.at(-1).state.messages.length);
 for(const post of posts)assert.ok(seen.at(-1).state.messages.some(m=>m.id===post.data.messageId));
 assert.ok(reads.slice(1).every(path=>path.includes('/conversation?')));
});

test('ordinary HTTP room read opens normalized storage without legacy room hydration',async t=>{
 const store=new RoomStore(':memory:');
 store.initialize([...initialRoom(),event({id:'http-saved',roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'http-saved',body:'HTTP saved result'}})],{representation:'normalized-current-v1'});
 const key=store.issueAccessKey('commons','owner'),server=createRoomServer({store});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeStreams?.();server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));store.close();});
 const origin=`http://127.0.0.1:${server.address().port}`;
 store.room=()=>{throw new Error('legacy whole-room hydration is forbidden');};
 const response=await fetch(`${origin}/api/rooms/commons?messages=recent`,{headers:{authorization:`Bearer ${key}`,'X-Project-Room-Offer-Context':'1'}});
 assert.equal(response.status,200);const snapshot=await response.json();
 assert.equal(snapshot.snapshotVersion,2);
 assert.equal(snapshot.state.messages.find(m=>m.id==='http-saved')?.body,'HTTP saved result');
 assert.equal(snapshot.messagesWindow.omitted,null);
 assert.equal(snapshot.sections.replyRequests.available,true);
 assert.equal(snapshot.sections.replyRequests.complete,false);
 assert.equal(snapshot.sections.replyRequests.coverage,'visible-conversation-records');
 assert.deepEqual(snapshot.state.replyRequests,{},'empty selected page is explicitly not a complete request census');
});


import {withCurrentReadContext} from '../server/current-room-repository.mjs';
test('composed browser metadata reservation supports100small members without widening nested inbox bounds',t=>{
 const store=new RoomStore(':memory:');t.after(()=>store.close());const events=initialRoom();
 for(let i=1;i<100;i++)events.push(event({roomId:'commons',actorId:'owner',type:'member.added',data:{memberId:'roster-'+i,displayName:'Member '+i,kind:'agent',permissions:[]}}));
 for(let i=0;i<9;i++)events.push(event({roomId:'commons',actorId:'owner',type:'work.proposed',data:{workItemId:'roster-task-'+i,title:'Useful task',definitionOfDone:'Saved result',accountableMemberId:'owner'}}));
 store.initialize(events,{representation:'normalized-current-v1'});const key=store.issueAccessKey('commons','owner');
 const snapshot=readRoomSnapshot(store,key,'commons',null,{windowed:true});
 assert.equal(Object.keys(snapshot.state.members).length,100);assert.equal(snapshot.workWindow.shown,8);assert.equal(snapshot.workWindow.complete,false);
 assert.ok(snapshot.workWindow.nextAfter);const next=store.roomContext(key,'commons',{workAfter:snapshot.workWindow.nextAfter});
 assert.equal(next.workWindow.shown,1);assert.equal(next.workWindow.nextAfter,null);
 assert.throws(()=>store.readTransaction(()=>withCurrentReadContext(store.db,'commons',()=>readRoomSnapshot(store,key,'commons',null,{windowed:true}),{maxRecords:200})),e=>e.code==='current_room_context_unavailable','Nested reads cannot replace the enclosing smaller reservation');
});
