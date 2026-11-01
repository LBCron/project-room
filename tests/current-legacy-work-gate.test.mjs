import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {createWork} from '../server/work-claims.mjs';
import {assertLegacyWorkReconciled} from '../server/current-legacy-work-gate.mjs';
import {replayCutoverSchema,captureReplayWitness,advanceReplayWitness,partitionReplayWitness,qualifyReplayHWork,qualifyReplayHMessages,advanceCurrentRoomConversion} from '../server/replay-cutover.mjs';
const by={kind:'human',id:'owner'};
function fixture(t){const store=new RoomStore(':memory:');t.after(()=>store.close());store.initialize(initialRoom());store.db.exec(replayCutoverSchema());return store;}
const capture=store=>captureReplayWitness(store,{roomId:'commons',requestId:'capture',expectedHead:store.headSequence('commons'),reason:'Legacy assignment reconciliation control'});
test('capture refuses active collaboration authority and preserves released journal evidence',t=>{
 const s=fixture(t),assigned=s.collab.assignThread('commons','thread',{kind:'agent',id:'worker'},{by});
 const before=s.db.prepare('SELECT * FROM collab_assignments').all();
 assert.throws(()=>capture(s),e=>e.code==='current_room_legacy_work_unreconciled'&&e.message.includes('/collab/assignments'));
 assert.deepEqual(s.db.prepare('SELECT * FROM collab_assignments').all(),before);
 s.collab.releaseAssignment('commons',assigned.assignmentId,{by,reason:'Recorded reconciliation'});
 assert.doesNotThrow(()=>capture(s));assert.equal(s.collab.listAssignments('commons')[0].status,'released');
});
test('legacy board open work gates conversion but terminal history and other rooms do not',t=>{
 const s=fixture(t),work=createWork({id:'legacy-open',title:'Existing obligation'},{agentId:'owner',now:new Date(s.now())});
 s.workClaims.set('commons',work);assert.throws(()=>capture(s),e=>e.code==='current_room_legacy_work_unreconciled'&&e.message.includes('/work-claims-read'));
 // Storage fixture for an already recorded closed authority. This does not
 // manufacture a claim completion or rewrite immutable claim history.
 s.transaction(()=>s.db.prepare("UPDATE work_claims SET item_json=json_set(item_json,'$.data.state','closed') WHERE room_id=? AND claim_id=?").run('commons',work.id));
 s.workClaims.set('other-room',createWork({id:'other',title:'Another room obligation'},{agentId:'owner',now:new Date(s.now())}));
 assert.doesNotThrow(()=>assertLegacyWorkReconciled(s.db,'commons'));assert.doesNotThrow(()=>capture(s));
});
test('publication rechecks newly admitted legacy assignments and leaves room legacy',t=>{
 const s=fixture(t),h=capture(s),input={roomId:'commons',generation:h.generation};let p={bytes:0},i=0;
 while(p.phase!=='witness_verified')p=advanceReplayWitness(s,{...input,requestId:'hash'+i++,expectedBytes:p.bytes});
 p={bytes:0};i=0;while(p.phase!=='codec_partitioned')p=partitionReplayWitness(s,{...input,requestId:'codec'+i++,expectedBytes:p.bytes});
 qualifyReplayHWork(s,{...input,requestId:'work',expectedWorkCount:0});p={hMessageSteps:0};i=0;while(!p.hMessagesQualified)p=qualifyReplayHMessages(s,{...input,requestId:'messages'+i++,expectedSteps:p.hMessageSteps});
 s.collab.assignThread('commons','late-thread',{kind:'agent',id:'worker'},{by});
 p={currentSteps:0};i=0;assert.throws(()=>{while(p.phase!=='current_serving'&&i<100)p=advanceCurrentRoomConversion(s,{...input,requestId:'current'+i++,expectedSteps:p.currentSteps});},e=>e.code==='current_room_legacy_work_unreconciled');
 assert.equal(s.db.prepare('SELECT count(*) n FROM current_room_head').get().n,0);assert.ok(s.room('commons').state.room);
});
