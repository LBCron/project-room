import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChannelUpdateJournalRow} from '../server/channel-journal.mjs';
import {ChannelUpdateJournal as LiveChannelUpdateJournal} from '../server/journal.mjs';
import {initialRecoveryChannelUpdates,validateRecoveryChannelUpdates,advanceRecoveryChannelUpdates,withCompletedRecoveryChannelUpdates,verifyChannelUpdatesForRecovery} from '../server/recovery-channel-updates.mjs';
import {restoreProgress,withRestoreTransaction,checkpointRestore} from '../server/restore-admission.mjs';
import {fixture,post,input} from './helpers/recovery-channel-updates-target.mjs';
function corrupt(f,operation) {
 withRestoreTransaction(f.store,()=>{const db=f.store.db,defs=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name='pending_channel_updates'").all();for(const d of defs)db.exec('DROP TRIGGER '+d.name);operation(db);for(const d of defs)db.exec(d.sql);});
}
test('shared leaf preserves exact original acceptance including duplicate JSON key semantics',()=>{
 const row={payload:'{"update_id":4,"update_id":5}',update_id:5,status:'pending',attempts:0,last_error:null,updated_at:5,received_at:5};
 assert.equal(validateChannelUpdateJournalRow(row),'pending');
 for(const change of [{update_id:4},{payload:'[]'},{status:'unknown'},{attempts:6},{status:'failed',attempts:4},{attempts:1},{updated_at:4}])assert.throws(()=>validateChannelUpdateJournalRow({...row,...change}),/reconciliation/);
 assert.equal(validateChannelUpdateJournalRow({...row,status:'imported',attempts:2}),'imported');
});
test('bounded source pages survive cold resume and exact lost-ACK retries without whole journal reads',async t=>{
 const f=await fixture(t),seen=[],prepare=f.store.db.prepare.bind(f.store.db);
 f.store.db.prepare=sql=>{assert.notEqual(sql,'SELECT * FROM pending_channel_updates');seen.push(sql);return prepare(sql);};
 let pages=0;
 try {const body={...input(f.response.body,f.n),requestId:'channel-lost-ack'},r=await f.step(body);assert.equal(r.status,202);assert.deepEqual(await post(f.store,body),r);assert.equal(restoreProgress(f.store.db).progress.audit.channelUpdates.rows,32);}
 finally{f.store.db.prepare=prepare;}
 while(f.response.body.auditProgress?.stage==='channel_updates'){
  const before=restoreProgress(f.store.db),r=await f.step();assert.equal(r.status,202,JSON.stringify(r.body));const after=restoreProgress(f.store.db);
  assert.ok(after.progress.audit.units-before.progress.audit.units<=32);assert.ok(after.progress.audit.bytes-before.progress.audit.bytes<=4*1024*1024);pages++;f.reopen();
 }
 assert.ok(pages>=2);assert.equal(restoreProgress(f.store.db).progress.audit.channelUpdates.rows,70);assert.ok(seen.some(s=>s.includes('length(CAST(payload AS BLOB))')));
});
for(const defect of ['id','attempts','failed','error','time'])test('independent channel phase refuses '+defect+' without checkpoint advance',async t=>{
 const f=await fixture(t),before=restoreProgress(f.store.db);
 const edits={id:"payload=json_set(payload,'$.update_id',999)",attempts:'attempts=6',failed:"status='failed'",error:'attempts=1,last_error=NULL',time:'updated_at=received_at-1'};
 corrupt(f,db=>db.exec('UPDATE pending_channel_updates SET '+edits[defect]+' WHERE update_id=2'));
 f.reopen();const r=await f.step();assert.equal(r.status,422,JSON.stringify(r.body));assert.deepEqual(restoreProgress(f.store.db),before);
});
test('checkpoint save fault rolls back page and cold same input advances exactly once',async t=>{
 const f=await fixture(t),before=restoreProgress(f.store.db),body=input(f.response.body,f.n),prepare=f.store.db.prepare.bind(f.store.db);let fired=false;
 f.store.db.prepare=sql=>{const s=prepare(sql);if(sql.startsWith('UPDATE current_restore_admission SET phase=')){const run=s.run.bind(s);s.run=(...args)=>{run(...args);fired=true;throw Error('channel checkpoint fault');};}return s;};
 try {assert.equal((await post(f.store,body)).status,422);assert.equal(fired,true);assert.deepEqual(restoreProgress(f.store.db),before);}finally{f.store.db.prepare=prepare;}
 f.reopen();const r=await post(f.store,body);assert.equal(r.status,202);assert.deepEqual(await post(f.store,body),r);assert.equal(restoreProgress(f.store.db).progress.audit.channelUpdates.rows,32);
});
test('signed int64 source rowids retain original semantics and indexed bounded traversal',async t=>{
 const f=await fixture(t,{rows:3});corrupt(f,db=>{db.exec('UPDATE pending_channel_updates SET rowid=-9223372036854775808 WHERE update_id=0');db.exec('UPDATE pending_channel_updates SET rowid=0 WHERE update_id=1');db.exec('UPDATE pending_channel_updates SET rowid=9223372036854775807 WHERE update_id=2');});f.reopen();
 while(f.response.body.auditProgress?.stage==='channel_updates'){const r=await f.step();assert.equal(r.status,202,JSON.stringify(r.body));}
 const c=restoreProgress(f.store.db).progress.audit.channelUpdates;assert.equal(c.after,'9223372036854775807');assert.equal(c.rows,3);
 const plan=f.store.db.prepare('EXPLAIN QUERY PLAN SELECT rowid FROM pending_channel_updates WHERE rowid>CAST(? AS INTEGER) ORDER BY rowid LIMIT 1').all('0');assert.ok(plan.some(r=>/SEARCH.*INTEGER PRIMARY KEY/.test(r.detail)),JSON.stringify(plan));assert.ok(!plan.some(r=>/TEMP B-TREE/.test(r.detail)));
});
test('scope refuses wrong source, caller, incomplete cursor and mutable revision; never escapes',async t=>{
 const f=await fixture(t),s=restoreProgress(f.store.db),c=initialRecoveryChannelUpdates();assert.deepEqual(s.progress.audit.channelUpdates,c);
 assert.throws(()=>advanceRecoveryChannelUpdates(f.store,s.restore_id,c,s.seal),/reconciliation/);
 assert.throws(()=>withRestoreTransaction(f.store,()=>advanceRecoveryChannelUpdates(f.store,s.restore_id,c,{...s.seal,id:'wrong'})),/reconciliation/);
 assert.throws(()=>withRestoreTransaction(f.store,()=>advanceRecoveryChannelUpdates(f.store,s.restore_id,{...c,rows:1,pending:1},s.seal)),/reconciliation/);
 assert.throws(()=>withRestoreTransaction(f.store,()=>withCompletedRecoveryChannelUpdates(f.store,s.restore_id,s.seal.id,()=>null)),/reconciliation/);
 for(const after of ['01','-0','9223372036854775808','-9223372036854775809'])assert.throws(()=>validateRecoveryChannelUpdates({...c,after}),/reconciliation/);
 while(f.response.body.auditProgress?.stage!=='full_audit_pending')assert.equal((await f.step()).status,202);
 const done=restoreProgress(f.store.db);
 assert.throws(()=>withRestoreTransaction(f.store,()=>withCompletedRecoveryChannelUpdates(f.store,done.restore_id,done.seal.id,()=>Promise.resolve())),/reconciliation/);
 assert.throws(()=>withRestoreTransaction(f.store,()=>withCompletedRecoveryChannelUpdates(f.store,done.restore_id,done.seal.id,()=>{checkpointRestore(f.store.db,{restoreId:done.restore_id,expectedRevision:done.revision,phase:done.phase,seal:done.seal,progress:done.progress,latest:null});verifyChannelUpdatesForRecovery(f.store);})),/reconciliation/);
 assert.deepEqual(restoreProgress(f.store.db),done);
});
test('existing sealed historical payload larger than work quantum is validated alone, never newly capped',async t=>{
 const f=await fixture(t,{rows:2,beforeExport:source=>source.transaction(()=>source.db.prepare('UPDATE pending_channel_updates SET payload=? WHERE update_id=0').run(JSON.stringify({update_id:0,text:'x'.repeat(4*1024*1024+100)})))});
 const before=restoreProgress(f.store.db),r=await f.step();assert.equal(r.status,202,JSON.stringify(r.body));const after=restoreProgress(f.store.db);
 assert.equal(after.progress.audit.channelUpdates.rows,1);assert.ok(after.progress.audit.bytes-before.progress.audit.bytes>4*1024*1024);assert.equal(after.progress.audit.units-before.progress.audit.units,1);
 assert.equal((await f.step()).status,202);assert.equal(restoreProgress(f.store.db).progress.audit.channelUpdates.rows,2);
});

test('live Store channel journal uses the same row predicate as the bounded phase',()=>{
 const row={payload:'{"update_id":4,"update_id":5}',update_id:5,status:'pending',attempts:0,last_error:null,updated_at:5,received_at:5};
 const verify=value=>new LiveChannelUpdateJournal({db:{prepare(sql){assert.equal(sql,'SELECT * FROM pending_channel_updates');return{all:()=>[value]};}},readTransaction:operation=>operation()}).verify();
 assert.deepEqual(verify(row),{pending:1,imported:0,failed:0});
 for(const change of [{update_id:4},{payload:'[]'},{status:'unknown'},{attempts:6},{status:'failed',attempts:4},{attempts:1},{updated_at:4}]){
  const changed={...row,...change};assert.throws(()=>validateChannelUpdateJournalRow(changed),/reconciliation/);assert.throws(()=>verify(changed),/reconciliation/);
 }
 assert.deepEqual(verify({...row,status:'imported',attempts:2}),{pending:0,imported:1,failed:0});
});
