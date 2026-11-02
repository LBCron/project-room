import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreProgress,withRestoreTransaction} from '../server/restore-admission.mjs';
import {auditRecovery} from '../server/recovery.mjs';
import {fixture} from './helpers/recovery-channel-updates-target.mjs';
test('operator final audit consumes complete channel proof while ordinary oracle stays exact',async t=>{
 const f=await fixture(t,{stop:'full_audit_pending'}),s=restoreProgress(f.store.db);
 const original=withRestoreTransaction(f.store,()=>auditRecovery(f.store)),verify=f.store.channelUpdates.verify;
 let calls=0;f.store.channelUpdates.verify=()=>{calls++;throw Error('unbounded channel scan invoked');};
 try {
  for(let n=0;f.response.body.auditProgress?.report?.stage!=='complete';n++){assert.ok(n<10000);assert.equal((await f.step()).status,202);}
  const r=await f.step();assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(calls,0);
  assert.deepEqual(r.body.subsystemContinuation.channelUpdates,{version:1,stage:'complete',after:'70',rows:70,pending:68,imported:1,failed:1,consumed:true});
  assert.deepEqual(r.body.recovery.tables,original.tables);assert.equal(r.body.recovery.dataSha256,original.dataSha256);
  assert.throws(()=>auditRecovery(f.store),/unbounded channel scan/);
  t.diagnostic(JSON.stringify({rows:s.progress.audit.channelUpdates.rows,avoidedFinalSemanticPayloadRows:70,fullOracleStillRequired:true,wholeRecoveryBounded:false}));
 }finally{f.store.channelUpdates.verify=verify;}
 assert.doesNotThrow(()=>auditRecovery(f.store));
});
