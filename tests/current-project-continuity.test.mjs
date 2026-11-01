import test from 'node:test';import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';import {initialRoom} from '../server/bootstrap.mjs';import {event} from '../src/events.js';import {AgentRooms} from '../server/agent-rooms.mjs';
import {classifyOwnedRooms,planAccountDeletion} from '../server/account-deletion.mjs';
function fixture(t,{normalized=true,count=4}={}){
 const s=new RoomStore(':memory:');t.after(()=>s.close());const es=initialRoom();es[0].data.kind='organization';
 for(let i=1;i<count;i++){const id=i===1?'successor':i===2?'worker':'agent-'+i;es.push(event({roomId:'commons',actorId:'owner',type:'member.added',data:{memberId:id,displayName:id,kind:i===1?'human':'agent',permissions:['accept_work','complete_work']}}));}
 es.push(event({roomId:'commons',actorId:'owner',type:'work.proposed',data:{workItemId:'task',title:'Project task',definitionOfDone:'Saved project result',accountableMemberId:'worker'}}));
 s.initialize(es,normalized?{representation:'normalized-current-v1'}:undefined);const owner=s.issueAccessKey('commons','owner'),successor=s.issueAccessKey('commons','successor');
 const accountId=s.db.prepare("SELECT account_id FROM member_accounts WHERE room_id='commons' AND member_id='owner'").get().account_id;
 return {s,owner,successor,accountId,rooms:new AgentRooms(s)};
}
test('normalized ownership transfer preserves the same explicit owner appointment and exact lost-response retry',t=>{
 const {s,owner,successor,rooms}=fixture(t),before=s.db.prepare('SELECT * FROM work_entities').all();s.room=()=>{throw Error('whole room hydration');};
 const result=rooms.transfer(owner,'commons',{toMemberId:'successor',reason:'Authorized successor'});assert.equal(result.ownerId,'successor');assert.equal(result.duplicate,false);
 assert.equal(rooms.transfer(owner,'commons',{toMemberId:'successor'}).duplicate,true);assert.equal(s.roomAuthority('commons',{memberId:'successor'}).ownerId,'successor');
 assert.equal(rooms.transfer(successor,'commons',{toMemberId:'owner'}).ownerId,'owner');assert.deepEqual(s.db.prepare('SELECT * FROM work_entities').all(),before);
});
test('normalized deletion preview includes protected room and succession dependency instead of omitting unavailable room',t=>{
 const {s,accountId}=fixture(t);s.room=()=>{throw Error('whole room hydration');};
 const disposition=classifyOwnedRooms(s,accountId);assert.equal(disposition.transfer.length,1);assert.equal(disposition.transfer[0].toMemberId,'successor');
 const {plan}=planAccountDeletion(s,accountId);assert.ok(plan.steps.some(step=>step.category==='owned_rooms'));assert.equal(plan.rooms.transfer[0].id,'commons');
});
