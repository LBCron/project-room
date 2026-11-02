import test from 'node:test';import assert from 'node:assert/strict';
import {withRestoreTransaction} from '../server/restore-admission.mjs';import {auditRecovery} from '../server/recovery.mjs';import {fixture} from './helpers/recovery-replay-equality-target.mjs';
for(const checkpoint of [false,true])test('complete replay equality removes only original rebuild while default oracle stays exact; checkpoint='+checkpoint,async t=>{
 const f=await fixture(t,{checkpoint,stop:'full_audit_pending'});
 const original=withRestoreTransaction(f.store,()=>auditRecovery(f.store)),rebuild=f.store.rebuildProjection;
 f.store.rebuildProjection=()=>{throw Error('original whole-room rebuild invoked');};
 try{assert.throws(()=>withRestoreTransaction(f.store,()=>auditRecovery(f.store)),/whole-room rebuild/);for(let n=0;f.current.body.auditProgress?.report?.stage!=='complete';n++){assert.ok(n<10000);assert.equal((await f.step()).status,202);}
  const r=await f.step();assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.subsystemContinuation.projectionEquality.consumed,true);assert.deepEqual(r.body.recovery.tables,original.tables);assert.equal(r.body.recovery.dataSha256,original.dataSha256);assert.throws(()=>auditRecovery(f.store),/whole-room rebuild/);
 }finally{f.store.rebuildProjection=rebuild;}
 assert.doesNotThrow(()=>auditRecovery(f.store));
});
