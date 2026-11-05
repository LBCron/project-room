// First-connect task: a new agent's room_join result names one finishable
// first task when ROOM_FIRST_CONNECT_TASK=1; off by default (no change).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore} from '../server/store.mjs';
import {AgentRooms} from '../server/agent-rooms.mjs';
import {createRoomServer} from '../server/http.mjs';
import {firstConnectTask,firstConnectTaskEnabled} from '../server/first-connect-task.mjs';

async function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'first-connect-'));const store=new RoomStore(join(dir,'db'));
  const owner=store.identities.create('Founder'),roomId='qa-first-connect';
  new AgentRooms(store).create(owner.secret,{roomId,title:'QA',purpose:'Useful work',starter:false,visibility:'private'});
  const command=(type,data)=>store.command(owner.secret,roomId,{id:type,type,data});
  command('room.public_page_set',{enabled:true});command('room.join_link_set',{enabled:true});
  const server=createRoomServer({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{server.closeStreams();server.closeAllConnections();await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});delete process.env.ROOM_FIRST_CONNECT_TASK;});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(secret,args)=>{const r=await fetch(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify({jsonrpc:'2.0',id:'t',method:'tools/call',params:{name:'room_join',arguments:args}})});return (await r.json()).result?.structuredContent;};
  return {store,roomId,call};
}

test('flag off by default: room_join result is unchanged (no firstTask)',async t=>{
  delete process.env.ROOM_FIRST_CONNECT_TASK;const f=await fixture(t);
  const joined=await f.call(f.store.identities.create('Newcomer').secret,{roomId:f.roomId});
  assert.equal(joined.status,'approved');assert.equal(joined.firstTask,undefined);
  assert.equal(firstConnectTaskEnabled({}),false);
});

test('flag on: a new agent gets one finishable first task, and a rejoin does not',async t=>{
  process.env.ROOM_FIRST_CONNECT_TASK='1';const f=await fixture(t);
  const peer=f.store.identities.create('Newcomer');
  const joined=await f.call(peer.secret,{roomId:f.roomId});
  assert.equal(joined.status,'approved');
  assert.equal(joined.firstTask.source,'intro');
  assert.equal(joined.firstTask.action.tool,'room_post_message');
  assert.equal(joined.firstTask.action.arguments.roomId,f.roomId);
  assert.ok(joined.firstTask.done);
  const before=f.store.headSequence(f.roomId);
  const again=await f.call(peer.secret,{roomId:f.roomId});
  assert.equal(again.alreadyMember,true);assert.equal(again.firstTask,undefined);
  assert.equal(f.store.headSequence(f.roomId),before,'the hint never posts for the agent');
});

test('prefers a claimable public-work starter when one exists',()=>{
  const store={publicWorkClaims:{list:()=>({tasks:[{taskId:'t_1',title:'Fix a typo'}]})}};
  const task=firstConnectTask(store,'r',{env:{ROOM_FIRST_CONNECT_TASK:'1'}});
  assert.equal(task.source,'public_work');assert.deepEqual(task.nextRead,{tool:'public_work_read_task',arguments:{taskId:'t_1'}});
  const broken={publicWorkClaims:{list:()=>{throw Error('x');}}};
  assert.equal(firstConnectTask(broken,'r',{env:{ROOM_FIRST_CONNECT_TASK:'1'}}).source,'intro');
  assert.equal(firstConnectTask(store,'r',{env:{}}),null);
});
