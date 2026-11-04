import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {RoomStore} from '../../../server/store.mjs';
import {createWork} from '../../../server/work-claims.mjs';
import {initialRoom} from '../../../server/bootstrap.mjs';
import {event,EVENT_TYPES as T} from '../../../src/events.js';
import {runAssignmentDeadlines,runAssignmentDeadlinesAll} from '../../../server/assignment-deadlines.mjs';
const t0=Date.parse('2026-11-03T00:00:00Z'),now=t0+11*60000;
const directory=mkdtempSync(join(process.env.TMPDIR,'deadline-restart-'));
const filename=join(directory,'room.sqlite');
let store;
const open=()=>{store=new RoomStore(filename,{now:()=>now});store.featureEnv={ROOM_ASSIGNMENT_DEADLINES:'on'};return store;};
const make=(type,data)=>event({type,roomId:'commons',actorId:'owner',at:new Date(t0).toISOString(),data});
const counts=()=>({events:store.db.prepare("SELECT count(*) AS n FROM events WHERE id LIKE 'ad%'").get().n,wakes:store.db.prepare("SELECT count(*) AS n FROM agent_wake_signals WHERE message_id LIKE 'ad%'").get().n});
try{
open();store.initialize([...initialRoom('commons').map(e=>({...e,at:new Date(t0).toISOString()})),make(T.MEMBER_ADDED,{memberId:'delegate',displayName:'Synthetic delegate',kind:'agent',permissions:['accept_work']}),make(T.WORK_PROPOSED,{workItemId:'deadline-work',title:'Synthetic deadline',definitionOfDone:'Bounded test',mode:'read',accountableMemberId:'delegate'})]);
store.db.prepare('INSERT INTO agent_identities(identity_id,secret_hash,display_name,created_at) VALUES(?,?,?,?)').run('synthetic-delegate','non-authenticating-fixture-hash','Synthetic delegate',t0);
store.db.prepare('INSERT INTO identity_links(room_id,identity_id,member_id,linked_at) VALUES(?,?,?,?)').run('commons','synthetic-delegate','delegate',t0);
if(process.argv.includes('--with-unrelated-board-row'))store.workClaims.set('commons',createWork({id:'unrelated-board-row',title:'Unrelated'},{now:t0,agentId:'owner'}));
const before=counts();console.log(JSON.stringify({phase:'before',counts:before,boardRows:store.db.prepare('SELECT count(*) AS n FROM work_claims').get().n}));
const all=runAssignmentDeadlinesAll(store,now);console.log(JSON.stringify({phase:'all-runner',returned:all,counts:counts()}));
const ids=runAssignmentDeadlines(store,'commons',now);const first=counts();console.log(JSON.stringify({phase:'direct-first',ids,counts:first}));assert.equal(first.events,1,'direct runner persists one deadline message');assert.equal(first.wakes,1,'direct runner persists one recipient wake');
runAssignmentDeadlines(store,'commons',now);assert.deepEqual(counts(),first);console.log(JSON.stringify({phase:'same-process-repeat',counts:counts()}));
store.close();open();console.log(JSON.stringify({phase:'cold-before-repeat',counts:counts()}));assert.deepEqual(counts(),first);runAssignmentDeadlines(store,'commons',now);assert.deepEqual(counts(),first);console.log(JSON.stringify({phase:'cold-after-repeat',counts:counts(),result:'PASS'}));
assert.equal(all,1,'scheduled all-room runner must discover a room containing a due proposed assignment without Board claims');
}finally{store?.close();console.log(JSON.stringify({database:filename}));}
