import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {RoomStore} from '../server/store.mjs';import {initialRoom} from '../server/bootstrap.mjs';import {event} from '../src/events.js';import {createRoomServer} from '../server/http.mjs';import {RoomClient} from '../src/client.js';

test('real room-cookie browser session reads normalized selected native work absent from its snapshot',async t=>{
 const store=new RoomStore(':memory:');t.after(()=>store.close());const events=initialRoom();for(let i=0;i<9;i++)events.push(event({roomId:'commons',actorId:'owner',type:'work.proposed',data:{workItemId:`task-${i}`,title:`Task ${i}`,definitionOfDone:`Exact definition ${i}`,accountableMemberId:'owner'}}));store.initialize(events,{representation:'normalized-current-v1'});
 const created=store.createSession(store.issueAccessKey('commons','owner')),server=createRoomServer({store});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const origin=`http://127.0.0.1:${server.address().port}`,seen=[];const client=new RoomClient({onSnapshot:s=>seen.push(s),fetcher:(path,options)=>fetch(origin+path,{...options,headers:{...options.headers,Cookie:'room_session='+created.token}})});
 client.session={...created.session,authMode:'room',csrf:null};await client.refresh();
 assert.equal(seen[0].snapshotVersion,2);assert.equal(Object.hasOwn(seen[0].state.workItems,'task-8'),false);
 const read=await client.workContext('task-8');assert.equal(read.work.definitionOfDone,'Exact definition 8');assert.equal(read.viewerId,'owner');assert.notEqual(client.session,null);client.disconnect();
});
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
function harness({held={}}={}){
 const calls=[],card={querySelector:()=>({open:false})},ctx={structuredClone,calls,card,partialWorkSnapshot:true,inspectedWorkRecord:null,state:{room:{id:'commons'},members:{owner:{id:'owner',active:true}},workItems:held},session:{roomId:'commons',member:{id:'owner'}},client:{generation:1,workContext:async id=>{calls.push(['read',id]);return {roomId:'commons',viewerId:'owner',work:{id,title:'Full title',definitionOfDone:'Complete selected definition',revision:1},viewerSessionBinding:'bound'};},ownsResponse:()=>true},busy:false,activeWorkNavigationId:null,activeWorkNavigation:null,workNavigationEpoch:1,location:{href:'http://localhost/#pr-record/work/late'},CSS:{escape:x=>x},SOURCE_UNAVAILABLE_NOTICE:'unavailable'};
 vm.createContext(ctx);const start=source.indexOf('// JDOT-COH-NAV begin\nfunction revealWork('),end=source.indexOf('function workNavigationContext()',start);assert.ok(start>=0&&end>start);
 vm.runInContext(`var revealClaimRecord=id=>calls.push(['legacy-board',id]);var workRecord=()=>card;var revealWorkTimeline=id=>{calls.push(['mount',id]);return card;};var focusRecord=()=>{};var syncWorkReturnControl=()=>{};var notice=text=>calls.push(['notice',text]);var workNavigationContext=()=>session&&state?client.generation+'|'+session.roomId+'|'+session.member.id:null;${source.slice(start,end)}this.reveal=revealWork;`,ctx);return ctx;
}
test('normalized missing native id reads and mounts the selected record instead of opening a legacy claim board',async()=>{
 const h=harness();await h.reveal('late',true);assert.deepEqual(h.calls.map(x=>Array.from(x)),[['read','late'],['mount','late']]);assert.equal(h.state.workItems.late.definitionOfDone,'Complete selected definition');
});
test('normalized held thin summary also needs full selected details before rendering',async()=>{
 const h=harness({held:{late:{id:'late',title:'Summary',revision:1}}});await h.reveal('late',true);assert.equal(h.calls[0][0],'read');assert.equal(h.state.workItems.late.definitionOfDone,'Complete selected definition');
});
