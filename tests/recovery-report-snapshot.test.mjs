import test from 'node:test';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{RoomStore}from'../server/store.mjs';import{beginRestore,restoreProgress,withRestoreTransaction,withRestoreAuditRows,withExactRestoreGuards,RESTORE_CONTROL_GUARDS,checkpointRestore}from'../server/restore-admission.mjs';
import{captureRecoveryReportSnapshot,readRecoveryReportSnapshot,verifyRecoveryReportSnapshotParts}from'../server/recovery-report-snapshot.mjs';import{initialRecoveryReportRow,advanceRecoveryReportRow}from'../server/recovery-report-source.mjs';
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
function fixture(t,{maximum=false,oversized=false}={}){
 const store=new RoomStore(':memory:');t.after(()=>store.close());const pad=(s,n)=>s+' '.repeat(n-s.length);
 let seal='{ "id" : "'+ 'a'.repeat(64)+'", "schemaHash" : "'+'b'.repeat(64)+'" }',coverage='{ "audit" : {"stage":"full_audit_pending"}, "duplicate":1,"duplicate":2 }',latest=null;
 if(maximum){seal=pad(seal,1048576);coverage=pad(coverage,1048576);latest=pad('{}',1048576);}if(oversized)coverage=pad(coverage,1048577);
 withRestoreTransaction(store,()=>{beginRestore(store);withExactRestoreGuards(store.db,RESTORE_CONTROL_GUARDS.filter(([name])=>name==='current_restore_admission_update'),()=>store.db.prepare("UPDATE current_restore_admission SET phase='audit_pending',source_seal=?,coverage=?,latest_receipt=? WHERE singleton=1").run(seal,coverage,latest));});
 return{store,seal,coverage,latest};
}
test('internal T0 raw codec preserves whitespace, duplicate JSON keys and SQL NULL across checkpoint normalization',t=>{
 // This privileged codec harness deliberately does not pretend its synthetic
 // seal/progress is a valid full restore. Actual operator authority is tested
 // separately through operatorRestoreResponse and its existing validator.
 const f=fixture(t),before=f.store.db.prepare('SELECT * FROM current_restore_admission').get();let bound;
 withRestoreTransaction(f.store,()=>{const state=restoreProgress(f.store.db);bound=withRestoreAuditRows(f.store.db,state.restore_id,s=>captureRecoveryReportSnapshot(f.store.db,s,state));checkpointRestore(f.store.db,{restoreId:state.restore_id,expectedRevision:state.revision,phase:'audit_pending',seal:state.seal,progress:state.progress,latest:null});});
 const result=withRestoreTransaction(f.store,()=>{const state=restoreProgress(f.store.db);return withRestoreAuditRows(f.store.db,state.restore_id,s=>{const snapshot=readRecoveryReportSnapshot(f.store.db,s,bound.digest,state);verifyRecoveryReportSnapshotParts(s,snapshot);let row=initialRecoveryReportRow(f.store.db,'current_restore_admission',1,3*1024*1024),text='';for(let n=0;n<100;n++){const r=advanceRecoveryReportRow(f.store.db,row,{snapshot,scratch:s});row=r.state;if(r.chunk!==null)text+=r.chunk;if(r.last)return text;}throw Error('no progress');});});
 assert.equal(result,canonical(before));assert.notEqual(result,canonical(f.store.db.prepare('SELECT * FROM current_restore_admission').get()));assert.ok(result.includes('duplicate\\\":1,\\\"duplicate'));assert.equal(before.latest_receipt,null);
});
test('internal capture admits exactly3MiB in48immutable parts without expanding progress, and verifies every part',t=>{
 const f=fixture(t,{maximum:true});withRestoreTransaction(f.store,()=>{const state=restoreProgress(f.store.db);withRestoreAuditRows(f.store.db,state.restore_id,s=>{const bound=captureRecoveryReportSnapshot(f.store.db,s,state);assert.equal(bound.rows,49);const h=readRecoveryReportSnapshot(f.store.db,s,bound.digest,state);verifyRecoveryReportSnapshotParts(s,h);for(const field of['source_seal','coverage','latest_receipt']){assert.equal(h.fields[field].parts.length,16);assert.equal(h.fields[field].sha256,createHash('sha256').update(f[field==='source_seal'?'seal':field==='latest_receipt'?'latest':field]).digest('hex'));}});});
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM current_restore_audit_scratch').get().n,49);assert.ok(f.store.db.prepare('SELECT max(payload_bytes) n FROM current_restore_audit_scratch').get().n<133120);
});
test('existing1MiB raw-control field limit refusesoversize before any snapshot write',t=>{
 const f=fixture(t,{oversized:true});assert.throws(()=>withRestoreTransaction(f.store,()=>{const state=restoreProgress(f.store.db);return withRestoreAuditRows(f.store.db,state.restore_id,s=>captureRecoveryReportSnapshot(f.store.db,s,state));}),/scalar bytes/);assert.equal(f.store.db.prepare('SELECT count(*) n FROM current_restore_audit_scratch').get().n,0);
});
