// Research acceptance contract for owner-published native work; expected red.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore} from '../server/store.mjs';
import {AgentRooms} from '../server/agent-rooms.mjs';
import {createRoomServer} from '../server/http.mjs';
import {researchPublicTasks} from '../server/current-public-work-research.mjs';

test('owner-published work is visible, and withdrawal survives restart',{timeout:30000},async t=>{
 const dir=mkdtempSync(join(tmpdir(),'public-work-contract-')),path=join(dir,'db');let s=new RoomStore(path);let server;
 t.after(()=>{server?.closeAllConnections();server?.close();s.close();rmSync(dir,{recursive:true,force:true})});
 const owner=s.identities.create('Founder');new AgentRooms(s).create(owner.secret,{roomId:'public-work-contract',title:'Public project',purpose:'Make things',starter:false,visibility:'private'});
 const key=s.issueAccessKey('public-work-contract',owner.identityId), room='public-work-contract';
 const command=(id,type,data)=>s.command(key,room,{id,type,data});
 command('page-on','room.public_page_set',{enabled:true});
 for(const [id,title] of [['visible-task','A deliberately published task'],['private-task','Private title must stay private']])command('propose-'+id,'work.proposed',{workItemId:id,title,definitionOfDone:'A checked result',accountableMemberId:owner.identityId,mode:'read',independentVerificationRequired:false,ownerDecisionRequired:false});
 command('publish-visible','work.public_set',{workItemId:'visible-task',enabled:true});
 const start=async()=>{server=createRoomServer({store:s});await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`};
 const get=async origin=>{const r=await fetch(origin+'/r/public-work-contract.json');assert.equal(r.status,200);return r.json()};
 let origin=await start(),view=await get(origin);view.coverage.tasks={available:researchPublicTasks(s,room).available};view.tasks=researchPublicTasks(s,room).tasks;
 assert.equal(view.coverage.tasks.available,true,'published work should be available');
 assert.ok(view.tasks.some(x=>x.title==='A deliberately published task'));
 assert.doesNotMatch(JSON.stringify(view),/Private title must stay private/);
 command('withdraw-visible','work.public_set',{workItemId:'visible-task',enabled:false});
 view=await get(origin);view.tasks=researchPublicTasks(s,room).tasks;assert.doesNotMatch(JSON.stringify(view),/A deliberately published task|Private title must stay private/);
 server.closeAllConnections();await new Promise(r=>server.close(r));server=null;s.close();s=new RoomStore(path);origin=await start();view=await get(origin);view.tasks=researchPublicTasks(s,room).tasks;
 assert.doesNotMatch(JSON.stringify(view),/A deliberately published task|Private title must stay private/);
});
