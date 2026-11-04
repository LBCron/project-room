import assert from 'node:assert/strict';
import {RoomStore} from '../../../server/store.mjs';
import {initialRoom} from '../../../server/bootstrap.mjs';
import {event,EVENT_TYPES as T} from '../../../src/events.js';
import {runAssignmentDeadlines} from '../../../server/assignment-deadlines.mjs';
const t0=Date.parse('2026-11-03T00:00:00Z'),now=t0+11*60000;
const store=new RoomStore(':memory:',{now:()=>now});store.featureEnv={ROOM_ASSIGNMENT_DEADLINES:'on'};
try{for(const roomId of ['room-a','room-b']){store.initialize([...initialRoom(roomId).map(e=>({...e,at:new Date(t0).toISOString()})),event({type:T.WORK_PROPOSED,roomId,actorId:'owner',at:new Date(t0).toISOString(),data:{workItemId:process.argv.includes('--distinct-ids')?roomId+'-id':'same-id',title:'Synthetic assignment',definitionOfDone:'Test',mode:'read',accountableMemberId:'owner'}})]);const ids=runAssignmentDeadlines(store,roomId,now);console.log(JSON.stringify({roomId,ids,persisted:store.db.prepare("SELECT count(*) AS n FROM events WHERE room_id=? AND id LIKE 'ad%'").get(roomId).n}));}assert.equal(store.db.prepare("SELECT count(*) AS n FROM events WHERE id LIKE 'ad%'").get().n,2,'independent rooms with equal local work IDs each need their deadline event');}finally{store.close();}
