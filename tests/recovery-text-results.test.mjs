import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {operatorRestoreResponse} from '../server/restore-ndjson.mjs';
import {restoreProgress,withRestoreTransaction,withRestoreAuditRows} from '../server/restore-admission.mjs';
import {initialRecoveryTextResults,advanceRecoveryTextResults} from '../server/recovery-text-results.mjs';
import {seedHistoricalRedactionSource} from './helpers/historical-redaction-source.mjs';
import {auditRecovery} from '../server/recovery.mjs';
const authorization=['synthetic','text','restore','1101'].join('-');
async function post(store,body){const response=await operatorRestoreResponse(new Request('https://room.example/api/operator/restore',{method:'POST',headers:{Authorization:'Bearer '+authorization,...(typeof body==='string'?{}:{'content-type':'application/json'})},body:typeof body==='string'?body:JSON.stringify(body)}),authorization,store);return{status:response.status,body:await response.json()};}
async function setup(t,{withdraw=false}={}){
 const source=new RoomStore(':memory:');t.after(()=>source.close());const f=seedHistoricalRedactionSource(source);
 if(withdraw)source.command(f.key,'legacy-room',{id:'withdraw-native-text',type:'message.deleted',data:{messageId:'saved-modern-result',expectedMessageRevision:0}});
 assert.doesNotThrow(()=>auditRecovery(source));
 const store=new RoomStore(':memory:');t.after(()=>store.close());let response=await post(store,exportNdjsonText(source.db)),calls=0;
 while(restoreProgress(store.db).progress?.audit?.stage!=='replay_events'){
  assert.equal(response.status,202,JSON.stringify(response));response=await post(store,{restoreId:response.body.restoreId,sourceSeal:response.body.sourceSeal,expectedRevision:response.body.revision,requestId:'prepare-text-'+calls++});assert.ok(calls<100);
 }
 const state=restoreProgress(store.db),step=p=>withRestoreTransaction(store,()=>withRestoreAuditRows(store.db,state.restore_id,scratch=>advanceRecoveryTextResults(store,scratch,state.restore_id,'legacy-room',p,state.seal)));
 return{source,store,state,step};
}
for(const withdraw of [false,true])test('exact native-text subsystem completes against independent real restored work/message facts; withdrawn='+withdraw,async t=>{
 const f=await setup(t,{withdraw});let p=initialRecoveryTextResults(),calls=0,maximum=0;
 while(p.stage!=='complete'){const next=f.step(p);p=next.cursor;maximum=Math.max(maximum,next.bytes);assert.ok(next.units<=32);assert.ok(next.bytes<=4*1024*1024);assert.ok(++calls<100);}
 assert.equal(p.projected,1);assert.equal(p.audited,1);assert.equal(p.sequence,f.source.headSequence('legacy-room'));assert.ok(maximum>0);
});
for(const mutation of ['summary','missing-projected','duplicate-projected','wrong-text-version'])test('independent text phase refuses '+mutation,async t=>{
 const f=await setup(t),id=f.state.restore_id;
 withRestoreTransaction(f.store,()=>withRestoreAuditRows(f.store.db,id,scratch=>{const work=scratch.get('actual','legacy-room','workBody','task');
  if(mutation==='summary')work.receipt.summary='substituted result';
  if(mutation==='missing-projected')work.receipt=null;
  if(mutation==='duplicate-projected')work.receiptHistory.push(structuredClone(work.receipt));
  if(mutation==='wrong-text-version')work.receipt.evidenceVersion='sha256:'+'0'.repeat(64);
  scratch.set('actual','legacy-room','workBody','task',work);
 }));
 let p=initialRecoveryTextResults();assert.throws(()=>{for(let i=0;i<100;i++){p=f.step(p).cursor;if(p.stage==='complete')break;}},/reconciliation/);
});
test('text phase save failure rolls back scratch as well as external cursor',async t=>{
 const f=await setup(t),before=f.store.db.prepare('SELECT * FROM current_restore_audit_scratch ORDER BY rowid').all(),p=initialRecoveryTextResults();
 assert.throws(()=>withRestoreTransaction(f.store,()=>{withRestoreAuditRows(f.store.db,f.state.restore_id,scratch=>advanceRecoveryTextResults(f.store,scratch,f.state.restore_id,'legacy-room',p,f.state.seal));throw Error('text checkpoint interrupted');}),/text checkpoint interrupted/);
 assert.deepEqual(f.store.db.prepare('SELECT * FROM current_restore_audit_scratch ORDER BY rowid').all(),before);assert.deepEqual(p,initialRecoveryTextResults());assert.ok(f.step(p).units>0);
});
