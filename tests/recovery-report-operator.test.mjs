import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync}from'node:fs';import {tmpdir}from'node:os';import {join}from'node:path';
import {RoomStore}from'../server/store.mjs';import {initialRoom}from'../server/bootstrap.mjs';import {event}from'../src/events.js';import {exportNdjsonText}from'../server/room-export.mjs';import {operatorRestoreResponse}from'../server/restore-ndjson.mjs';import {restoreProgress,withRestoreTransaction}from'../server/restore-admission.mjs';import{auditRecovery}from'../server/recovery.mjs';
const token=['synthetic','report','operator'].join('-'),url='https://room.example/api/operator/restore';
async function post(store,body){const response=await operatorRestoreResponse(new Request(url,{method:'POST',headers:{Authorization:'Bearer '+token,...(typeof body==='string'?{}:{'Content-Type':'application/json'})},body:typeof body==='string'?body:JSON.stringify(body)}),token,store);return{status:response.status,body:await response.json()};}
const input=(body,n)=>({restoreId:body.restoreId,sourceSeal:body.sourceSeal,expectedRevision:body.revision,requestId:'report_step_'+n});
test('actual operator report19 consumes exact T0 fingerprint, cold lost ACK retry and failed snapshot checkpoint rollback',{timeout:120000},async t=>{
 const dir=mkdtempSync(join(tmpdir(),'report-operator-')),filename=join(dir,'target.sqlite'),source=new RoomStore(':memory:');let target=new RoomStore(filename);t.after(()=>{source.close();target.close();rmSync(dir,{recursive:true,force:true});});
 source.initialize([...initialRoom(),event({id:'saved-source',roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'saved-message',body:'Saved 🦉 useful reply\u0000 with a quoted " result'}})],{representation:'normalized-current-v1'});
 let response=await post(target,exportNdjsonText(source.db));assert.equal(response.status,202);let steps=0;
 while(restoreProgress(target.db).progress.audit?.stage!=='full_audit_pending'){response=await post(target,input(response.body,steps++));assert.equal(response.status,202,JSON.stringify(response));assert.ok(steps<500);}
 const t0=withRestoreTransaction(target,()=>auditRecovery(target)),t0state=restoreProgress(target.db);assert.equal(target.db.prepare('SELECT count(*) n FROM current_restore_audit_scratch').get().n,0);
 // Fail AFTER the capture writes and checkpoint mutation; whole TX must roll
 // back both immutable parts and control, never recapture a later instant.
 const request=input(response.body,steps++),prepare=target.db.prepare.bind(target.db);let fault=false;
 target.db.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('UPDATE current_restore_admission SET phase='))return statement;return new Proxy(statement,{get(o,k){const value=Reflect.get(o,k,o);return k==='run'?(...args)=>{value.apply(o,args);fault=true;throw Error('synthetic report checkpoint save fault');}:typeof value==='function'?value.bind(o):value;}});};
 const denied=await post(target,request);target.db.prepare=prepare;assert.equal(denied.status,422);assert.equal(fault,true);assert.deepEqual(restoreProgress(target.db),t0state);assert.equal(target.db.prepare('SELECT count(*) n FROM current_restore_audit_scratch').get().n,0);
 response=await post(target,request);assert.equal(response.status,202,JSON.stringify(response));const capture=restoreProgress(target.db).progress.audit.report.snapshotHash;
 target.close();target=new RoomStore(filename);assert.deepEqual(await post(target,request),response,'cold lost ACK returns exact saved response, no recapture');assert.equal(restoreProgress(target.db).progress.audit.report.snapshotHash,capture);
 let reportCalls=1;while(restoreProgress(target.db).progress.audit.report.stage!=='complete'){
  const current=input(response.body,steps++);response=await post(target,current);assert.equal(response.status,202,JSON.stringify(response));assert.ok(++reportCalls<10000);
  if(reportCalls===3){target.close();target=new RoomStore(filename);assert.deepEqual(await post(target,current),response);}
 }
 const completed=restoreProgress(target.db).progress.audit.report;assert.deepEqual(completed.results,t0.tables);assert.equal(completed.dataSha256,t0.dataSha256);
 // Literal default is still literal and intentionally differs once report
 // workspace/progress exist; no public or arbitrary option enables the scope.
 const literal=withRestoreTransaction(target,()=>auditRecovery(target));assert.notEqual(literal.dataSha256,t0.dataSha256);
 const finalInput=input(response.body,steps++);response=await post(target,finalInput);assert.equal(response.status,200,JSON.stringify(response));assert.equal(response.body.verified,true);assert.deepEqual(response.body.recovery.tables,t0.tables);assert.equal(response.body.recovery.dataSha256,t0.dataSha256);assert.equal(response.body.recovery.fingerprintScope.basis,'restore-audit-instant');assert.equal(response.body.recovery.fingerprintScope.snapshotSha256,capture);
 target.close();target=new RoomStore(filename);assert.deepEqual(await post(target,finalInput),response);t.diagnostic(JSON.stringify({reportCalls,steps,snapshot:capture,exactT0:true,defaultLiteralUnchanged:true,coldAck:true}));
});
