import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {operatorRestoreResponse} from '../server/restore-ndjson.mjs';
import {restoreProgress,withRestoreTransaction,withRestoreAuditRows} from '../server/restore-admission.mjs';
import {initialRecoveryReplies,advanceRecoveryReplies} from '../server/recovery-reply-continuation.mjs';
import {seedHistoricalRedactionSource} from './helpers/historical-redaction-source.mjs';
import {auditRecovery} from '../server/recovery.mjs';
const authorization=['synthetic','text','restore','1101'].join('-');
async function post(store,body){const response=await operatorRestoreResponse(new Request('https://room.example/api/operator/restore',{method:'POST',headers:{Authorization:'Bearer '+authorization,...(typeof body==='string'?{}:{'content-type':'application/json'})},body:typeof body==='string'?body:JSON.stringify(body)}),authorization,store);return{status:response.status,body:await response.json()};}
async function setup(t){
 const source=new RoomStore(':memory:');t.after(()=>source.close());const _f=seedHistoricalRedactionSource(source,{beforeCapture:(store,{key})=>store.command(key,'legacy-room',{id:'request-before-H',type:'message.posted',data:{messageId:'source-question',body:'Please review the saved result',toMemberId:'worker',workItemId:'task',requestKind:'reply'}})});
 assert.doesNotThrow(()=>auditRecovery(source));
 const store=new RoomStore(':memory:');t.after(()=>store.close());let response=await post(store,exportNdjsonText(source.db)),calls=0;
 while(restoreProgress(store.db).progress?.audit?.stage!=='replay_events'){
  assert.equal(response.status,202,JSON.stringify(response));response=await post(store,{restoreId:response.body.restoreId,sourceSeal:response.body.sourceSeal,expectedRevision:response.body.revision,requestId:'prepare-text-'+calls++});assert.ok(calls<100);
 }
 const state=restoreProgress(store.db),step=p=>withRestoreTransaction(store,()=>withRestoreAuditRows(store.db,state.restore_id,scratch=>advanceRecoveryReplies(store,scratch,state.restore_id,'legacy-room',p,state.seal)));
 return{source,store,state,step};
}
test('independent request history preserves authority and exact retained message fields',async t=>{
 const f=await setup(t);let p=initialRecoveryReplies(),calls=0;
 while(p.stage!=='complete'){const result=f.step(p);p=result.cursor;assert.notEqual(p.stage,'deferred');assert.ok(result.units<=32);assert.ok(++calls<100);}
 assert.equal(p.hasRequests,true);assert.equal(p.requests,1);assert.equal(p.sequence,f.source.headSequence('legacy-room'));assert.ok(p.compared>0);
});
test('independent request phase rejects substituted request before full oracle',async t=>{
 const f=await setup(t);withRestoreTransaction(f.store,()=>withRestoreAuditRows(f.store.db,f.state.restore_id,scratch=>{const request=scratch.get('actual','legacy-room','replyRequests','source-question');request.requesterId='worker';scratch.set('actual','legacy-room','replyRequests','source-question',request);}));
 let p=initialRecoveryReplies();assert.throws(()=>{for(let i=0;i<100&&p.stage!=='complete';i++)p=f.step(p).cursor;},/reconciliation/);
});
