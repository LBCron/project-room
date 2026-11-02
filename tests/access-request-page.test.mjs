import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {AccessRequests,REQUEST_TTL_MS} from '../server/access-requests.mjs';
import {createRoomServer} from '../server/http.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {linkWithProof} from './helpers/link-with-proof.mjs';
function setup(t,count=70){
 const store=new RoomStore(':memory:');t.after(()=>store.close());store.initialize(initialRoom('queue'),{representation:'normalized-current-v1'});
 const key=store.issueAccessKey('queue','owner'),service=new AccessRequests(store);let now=store.now();store.now=()=>now;
 const add=(i)=>{const identity=store.identities.create('Person '+i);return service.request('queue',{identityId:identity.identityId,displayName:'Person '+i,requestId:'req-'+String(i).padStart(5,'0'),requestedPermissions:['accept_work']},identity.secret);};
 for(let i=0;i<count;i++)add(i);
 return{store,key,service,add,advance:ms=>{now+=ms;}};
}
test('stable equal-time keyset reaches every pending request without whole-room hydration or writes',t=>{
 const f=setup(t);f.store.room=()=>{throw Error('no history/blob hydration');};
 const before=f.store.db.prepare('SELECT total_changes() n').get().n;
 const ids=[];let cursor=null,pages=0;
 do{const p=f.service.pendingPage(f.key,'queue',{limit:25,cursor});assert.ok(p.requests.length<=25);assert.equal(p.sourceWindow.consistency,'current-per-page');ids.push(...p.requests.map(r=>r.requestId));cursor=p.page.nextCursor;assert.equal(p.sourceWindow.complete,!p.page.hasMore);assert.ok(++pages<10);}while(cursor);
 assert.equal(ids.length,70);assert.equal(new Set(ids).size,70);assert.deepEqual(ids,[...ids].sort());
 assert.equal(f.store.db.prepare('SELECT total_changes() n').get().n,before);
});
test('expired backlog is filtered without a room-wide expiration write',t=>{
 const f=setup(t,1000);f.advance(REQUEST_TTL_MS+1);for(let i=1000;i<1027;i++)f.add(i);
 const fresh=f.store.issueAccessKey('queue','owner');
 const before=f.store.db.prepare('SELECT total_changes() n').get().n,p=f.service.pendingPage(fresh,'queue',{limit:25});
 assert.equal(p.requests.length,25);assert.ok(p.requests.every(r=>r.requestId>='req-01000'));assert.equal(p.page.hasMore,true);
 assert.equal(f.store.db.prepare('SELECT total_changes() n').get().n,before);
 assert.equal(f.store.db.prepare("SELECT count(*) n FROM access_requests WHERE status='pending'").get().n,1027,'paged reads do not rewrite historical request status');
 const plan=f.store.db.prepare("EXPLAIN QUERY PLAN SELECT * FROM access_requests INDEXED BY access_requests_pending_page WHERE room_id=? AND status IN ('pending','pending_upgrade','pending_account') AND (created_at,request_id)>(?,?) ORDER BY created_at,request_id LIMIT ?").all('queue',0,'',26);
 assert.ok(plan.some(row=>/access_requests_pending_page/.test(row.detail)));assert.ok(!plan.some(row=>/TEMP B-TREE/.test(row.detail)));
});
test('source changes, decided anchors, tampering and changed selection explicitly invalidate continuation',t=>{
 const f=setup(t),first=f.service.pendingPage(f.key,'queue',{limit:5}),cursor=first.page.nextCursor;
 assert.throws(()=>f.service.pendingPage(f.key,'queue',{limit:6,cursor}),e=>e.code==='stale_access_request_cursor');
 assert.throws(()=>f.service.pendingPage(f.key,'queue',{limit:5,cursor:cursor+'x'}),e=>e.code==='stale_access_request_cursor');
 f.service.decide(f.key,'queue',first.requests.at(-1).requestId,{decision:'deny'});
 assert.throws(()=>f.service.pendingPage(f.key,'queue',{limit:5,cursor}),e=>e.code==='stale_access_request_cursor');
 const next=f.service.pendingPage(f.key,'queue',{limit:5});f.add(100);
 assert.throws(()=>f.service.pendingPage(f.key,'queue',{limit:5,cursor:next.page.nextCursor}),e=>e.code==='stale_access_request_cursor');
});
test('membership authority is rechecked before revealing any queue page',t=>{
 const f=setup(t);f.store.command(f.key,'queue',{id:'viewer',type:'member.added',data:{memberId:'viewer',displayName:'Viewer',kind:'human',permissions:[]}});
 const viewer=f.store.issueAccessKey('queue','viewer');assert.throws(()=>f.service.pendingPage(viewer,'queue'),e=>e.status===403);
 assert.throws(()=>f.service.pendingPage(f.key,'queue',{limit:51}),e=>e.status===422);
});
test('a cursor cannot cross current authorized credentials or survive credential revocation',t=>{
 const f=setup(t),page=f.service.pendingPage(f.key,'queue',{limit:5});
 const other=f.store.issueAccessKey('queue','owner');
 assert.throws(()=>f.service.pendingPage(other,'queue',{limit:5,cursor:page.page.nextCursor}),e=>e.status===409);
 f.store.revoke(f.key);
 assert.throws(()=>f.service.pendingPage(f.key,'queue',{limit:5,cursor:page.page.nextCursor}),e=>e.status===401);
});
test('cold service explicitly refuses old continuation while a fresh traversal remains available',t=>{
 const dir=mkdtempSync(join(tmpdir(),'access-pages-'));let store=new RoomStore(join(dir,'room.sqlite'));
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 store.initialize(initialRoom('cold'),{representation:'normalized-current-v1'});const key=store.issueAccessKey('cold','owner');let service=new AccessRequests(store);
 for(let i=0;i<6;i++){const identity=store.identities.create('Cold Person '+i);service.request('cold',{identityId:identity.identityId,displayName:'Cold Person '+i,requestId:'cold-'+i,requestedPermissions:[]},identity.secret);}
 const cursor=service.pendingPage(key,'cold',{limit:2}).page.nextCursor;
 store.close();store=new RoomStore(join(dir,'room.sqlite'));service=new AccessRequests(store);store.room=()=>{throw Error('No whole-room hydration');};
 assert.throws(()=>service.pendingPage(key,'cold',{limit:2,cursor}),e=>e.status===409);
 assert.equal(service.pendingPage(key,'cold',{limit:2}).requests.length,2);
});
test('HTTP refuses an unselected partial queue and exposes complete bounded traversal explicitly',async t=>{
 const f=setup(t,27),server=createRoomServer({store:f.store});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const origin='http://127.0.0.1:'+server.address().port;
 const read=path=>fetch(origin+path,{headers:{Authorization:'Bearer '+f.key}});
 assert.equal((await read('/api/rooms/queue/access-requests?status=pending')).status,422);
 const first=await read('/api/rooms/queue/access-requests?status=pending&limit=25');assert.equal(first.status,200);const p=await first.json();assert.equal(p.requests.length,25);assert.equal(p.sourceWindow.complete,false);
 const second=await read(p.page.nextRead.path);assert.equal(second.status,200);const q=await second.json();assert.equal(q.requests.length,2);assert.equal(q.sourceWindow.complete,true);assert.equal(q.page.nextCursor,null);
});
test('hosted MCP retains bounded continuation, content trust and exact authorization',async t=>{
 const f=setup(t,27),reviewer=f.store.identities.create('Reviewer');linkWithProof(f.store,f.key,'queue',reviewer,{permissions:['manage_members']});
 const server=createRoomServer({store:f.store});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const call=async args=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/room/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+reviewer.secret},body:JSON.stringify({jsonrpc:'2.0',id:'page',method:'tools/call',params:{name:'room_list_access_requests',arguments:{roomId:'queue',...args}}})});return r.json();};
 const oversized=await call({});assert.equal(oversized.error?.data?.reason??oversized.result?.structuredContent?.code,'invalid_request');
 const first=await call({limit:25});assert.equal(first.error,undefined);const p=first.result.structuredContent;assert.equal(p.requests.length,25);assert.equal(p.sourceWindow.complete,false);assert.ok(p.contentTrust && p.requests.every(row=>row.untrusted===true),'requester text keeps its trust annotation');
 const second=await call({limit:25,cursor:p.page.nextCursor});assert.equal(second.error,undefined);assert.equal(second.result.structuredContent.requests.length,2);assert.equal(second.result.structuredContent.sourceWindow.complete,true);
 const invalid=await call({status:'approved',limit:25});assert.equal(invalid.error.data.reason,'invalid_arguments');
 f.store.room=()=>{throw Error('No whole room hydration');};const bounded=await call({limit:25});assert.equal(bounded.error,undefined);assert.equal(bounded.result.isError,undefined);assert.equal(bounded.result.structuredContent.requests.length,25);
});
