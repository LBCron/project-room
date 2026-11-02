import test from 'node:test';import assert from 'node:assert/strict';
import {restoreProgress,withRestoreTransaction,withRestoreAuditRows,withExactRestoreGuards,RESTORE_CONTROL_GUARDS,checkpointRestore} from '../server/restore-admission.mjs';
import {readRecoveryReplayValue,planRecoveryReplayValue,writeRecoveryReplayValue} from '../server/recovery-replay-value.mjs';
import {advanceRecoveryReplayEquality,validateRecoveryReplayEquality} from '../server/recovery-replay-equality.mjs';
import {withCompletedRecoveryProjectionParity,completedRecoveryProjectionParity} from '../server/recovery-projection-consumption.mjs';
import {verifyRecoveryWorkDefaults,verifyRecoveryGeneralChannel,stripRecoveryProjection} from '../server/recovery-projection-rules.mjs';
import {fixture,post,input} from './helpers/recovery-replay-equality-target.mjs';
const maximum=seal=>4096+9*seal.tables.filter(e=>['events','projection_checkpoints'].includes(e.name)).reduce((n,e)=>n+e.maxRowBytes*e.expected.rows,0);
function edit(f,operation){const state=restoreProgress(f.store.db);return withRestoreTransaction(f.store,()=>withRestoreAuditRows(f.store.db,state.restore_id,scratch=>operation(scratch,{get:(domain,key)=>readRecoveryReplayValue(scratch,'commons',domain,key,maximum(state.seal)),put:(domain,key,value)=>assert.equal(writeRecoveryReplayValue(scratch,'commons',domain,key,planRecoveryReplayValue(value,maximum(state.seal))),true)},state)));}
async function close(f){while(f.current.body.auditProgress?.stage==='replay_equality'){const r=await f.step();assert.equal(r.status,202,JSON.stringify(r.body));}return restoreProgress(f.store.db).progress.audit;}
for(const defect of ['member','missing-member','same-count-member','work','counter','private-body','message-order','extra-metadata','map-shape'])test('complete equality detects '+defect+' despite unchanged folded counts',async t=>{
 const f=await fixture(t),before=restoreProgress(f.store.db);
 edit(f,(_scratch,{get,put},state)=>{
  if(defect==='member'){const v=get('members','worker');v.permissions=[];put('members','worker',v);}
  if(defect==='missing-member'||defect==='same-count-member'){
   const v=get('members','worker');withExactRestoreGuards(f.store.db,RESTORE_CONTROL_GUARDS.filter(([name])=>name.startsWith('current_restore_audit_scratch_')),()=>f.store.db.prepare("DELETE FROM current_restore_audit_scratch WHERE restore_id=? AND lane='replay' AND room_id='commons' AND domain='members' AND unit_key='worker'").run(state.restore_id));
   if(defect==='same-count-member')put('members','different-member',v);
  }
  if(defect==='work'||defect==='counter'){const v=get('workItems','task');if(defect==='work')v.title='wrong selected result';else v.round_count=7;put('workItems','task',v);}
  if(defect==='private-body'){const v=get('messages','private');v.body='forged private text';put('messages','private',v);}
  if(defect==='message-order'){const a=JSON.stringify(['messages',0]),b=JSON.stringify(['messages',1]),v=get('replayOrder',a);put('replayOrder',a,get('replayOrder',b));put('replayOrder',b,v);}
  if(defect==='extra-metadata')put('metadata','unknown-source-property',{value:'not the actual projection'});
  if(defect==='map-shape')put('shape','bonds','object');
 });f.reopen();
 let r;for(let n=0;n<8;n++){const prior=restoreProgress(f.store.db);r=await f.step();if(r.status!==202){assert.deepEqual(restoreProgress(f.store.db),prior);break;}}
 assert.equal(r.status,422,JSON.stringify(r.body));assert.match(r.body.error.message,/replay|projection|reconciliation/);assert.equal(restoreProgress(f.store.db).progress.audit.replay.counts.members,before.progress.audit.replay.counts.members);
});
test('shared backfill rules preserve original default, exact explicit counters and general triple semantics',()=>{
 assert.doesNotThrow(()=>verifyRecoveryWorkDefaults({receipt:{},receiptHistory:[]},{round_count:0,tool_calls:0,suspended_by:null,receipt:{segments:null},receiptHistory:[]}));
 assert.throws(()=>verifyRecoveryWorkDefaults({round_count:1},{round_count:0,tool_calls:0,suspended_by:null}),/reconciliation/);
 assert.doesNotThrow(()=>verifyRecoveryGeneralChannel({id:'general',name:'general',archivedAt:null,createdBy:'old'},{id:'general',name:'general',archivedAt:null,createdBy:'new'}));
 assert.throws(()=>verifyRecoveryGeneralChannel({id:'general',name:'wrong',archivedAt:null},{id:'general',name:'general',archivedAt:null}),/reconciliation/);
 const stripped=stripRecoveryProjection({state:{channels:{x:1},messages:[{id:'m',channelId:'general'}],workItems:{a:{round_count:0,receipt:{segments:null}}}}});assert.equal(stripped.state.channels,undefined);assert.equal(stripped.state.messages[0].channelId,undefined);assert.equal(stripped.state.workItems.a.receipt.segments,undefined);
});
test('checkpoint absent work defaults and historical channel fields compare under exact original accommodations',async t=>{
 const f=await fixture(t,{checkpoint:true,checkpointMutate:s=>{delete s.workItems.task.round_count;delete s.workItems.task.tool_calls;delete s.workItems.task.suspended_by;delete s.workItems.task.receipt.segments;s.channels.general.createdAt='different historical creator time';for(const m of s.messages)m.channelId='historical-channel';}});
 const a=await close(f);assert.equal(a.equalityDeferred,0);assert.equal(a.equalityRooms,1);
});
for(const checkpoint of [false,true])test('archived/pinned source compares exact retained order without requiring archived bodies in checkpoint; checkpoint='+checkpoint,async t=>{
 const f=await fixture(t,{archive:true,checkpoint,extra:8}),a=await close(f);assert.equal(a.equalityDeferred,0);assert.equal(a.equalityRooms,1);assert.ok(a.equalityMessages>0);if(!checkpoint)assert.ok(a.equalityArchived>0);
});
test('phase owns bounded pages and a checkpoint fault rolls back before cold exact retry',async t=>{
 const f=await fixture(t,{extra:180}),before=restoreProgress(f.store.db),body={...input(f.current.body,f.n),requestId:'equality-checkpoint-fault'},prepare=f.store.db.prepare.bind(f.store.db);let fired=false;
 f.store.db.prepare=sql=>{const s=prepare(sql);if(sql.startsWith('UPDATE current_restore_admission SET phase=')){const run=s.run.bind(s);s.run=(...args)=>{run(...args);fired=true;throw Error('equality save fault');};}return s;};
 try{assert.equal((await post(f.store,body)).status,422);assert.equal(fired,true);assert.deepEqual(restoreProgress(f.store.db),before);}finally{f.store.db.prepare=prepare;}
 f.reopen();const r=await post(f.store,body);assert.equal(r.status,202,JSON.stringify(r.body));assert.deepEqual(await post(f.store,body),r);
 // Use a fresh exact input after each cold restart; both source and revision
 // remain bound. No page claims all180 retained messages were compared at once.
 let current=r,pages=0;while(current.body.auditProgress?.stage==='replay_equality'){const state=restoreProgress(f.store.db);current=await post(f.store,{...input(current.body,1000+pages++),requestId:'cold-equality-'+pages});assert.equal(current.status,202,JSON.stringify(current.body));const next=restoreProgress(f.store.db);assert.ok(next.progress.audit.units-state.progress.audit.units<=64);assert.ok(next.progress.audit.bytes-state.progress.audit.bytes<=4*1024*1024);f.reopen();}
 assert.ok(pages>=2);assert.equal(restoreProgress(f.store.db).progress.audit.equalityDeferred,0);
});
test('unauthorized, stale and incomplete completion proof cannot be consumed or escape its synchronous scope',async t=>{
 const f=await fixture(t),s=restoreProgress(f.store.db),p=s.progress.audit;
 assert.throws(()=>advanceRecoveryReplayEquality(f.store,{},s.restore_id,'commons',p.equality,p.replay,s.seal),/projection|reconciliation/);
 assert.throws(()=>withRestoreTransaction(f.store,()=>withRestoreAuditRows(f.store.db,s.restore_id,scratch=>advanceRecoveryReplayEquality(f.store,scratch,s.restore_id,'commons',{...p.equality,fields:1},p.replay,s.seal))),/projection|reconciliation/);
 assert.throws(()=>withRestoreTransaction(f.store,()=>withCompletedRecoveryProjectionParity(f.store,s.restore_id,s.seal.id,()=>null)),/reconciliation/);
 assert.throws(()=>validateRecoveryReplayEquality({...p.equality,after:'x'.repeat(201)}),/projection/);
 while(f.current.body.auditProgress?.stage!=='full_audit_pending')assert.equal((await f.step()).status,202);
 const done=restoreProgress(f.store.db);assert.equal(completedRecoveryProjectionParity(f.store),false);
 assert.throws(()=>withRestoreTransaction(f.store,()=>withCompletedRecoveryProjectionParity(f.store,done.restore_id,'wrong',()=>null)),/reconciliation/);
 assert.throws(()=>withRestoreTransaction(f.store,()=>withCompletedRecoveryProjectionParity(f.store,done.restore_id,done.seal.id,()=>{checkpointRestore(f.store.db,{restoreId:done.restore_id,expectedRevision:done.revision,phase:done.phase,seal:done.seal,progress:done.progress,latest:null});completedRecoveryProjectionParity(f.store);})),/reconciliation/);
 assert.deepEqual(restoreProgress(f.store.db),done);assert.equal(completedRecoveryProjectionParity(f.store),false);
});
test('unqualified legal tail stays explicitly deferred and cannot suppress original parity',async t=>{
 const f=await fixture(t,{deferred:true,stop:'full_audit_pending'}),a=restoreProgress(f.store.db).progress.audit;assert.equal(a.equalityDeferred,1);assert.equal(a.replayDeferred,1);
 let called=0;const rebuild=f.store.rebuildProjection.bind(f.store);f.store.rebuildProjection=(...args)=>{called++;return rebuild(...args);};
 while(f.current.body.auditProgress?.report?.stage!=='complete')assert.equal((await f.step()).status,202);
 const r=await f.step();assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.subsystemContinuation.projectionEquality.consumed,false);assert.equal(called,1);
});
