import entry,{DurableCoverageRoom as Base} from './durable-coverage-native.test-fixture.mjs';
import {seedRecoveryChannelUpdatesSource} from '../tests/helpers/recovery-channel-updates-source.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {auditRecovery} from '../server/recovery.mjs';
import {restoreProgress,withRestoreTransaction} from '../server/restore-admission.mjs';
import {withCompletedRecoveryChannelUpdates} from '../server/recovery-channel-updates.mjs';
export class DurableCoverageRoom extends Base {
 async fetch(request) {
  const path=new URL(request.url).pathname;
  if(path==='/__channel-seed'){try{const result=seedRecoveryChannelUpdatesSource(this.store,{rows:Number(new URL(request.url).searchParams.get('rows')??70)});auditRecovery(this.store);return Response.json(result);}catch(error){return Response.json({error:error.stack},{status:500});}}
  if(path==='/__channel-export')return new Response(exportNdjsonText(this.store.db));
  if(path==='/__channel-compare') {
   const measure=operation=>{const records=[],exec=this.ctx.storage.sql.exec.bind(this.ctx.storage.sql),cost={statements:0,rowsRead:0,rowsWritten:0,bytes:0,unknown:0,journalScans:0,journalRows:0,journalBytes:0};
    this.ctx.storage.sql.exec=(sql,...args)=>{const cursor=exec(sql,...args);records.push(cursor);const journal=sql==='SELECT * FROM pending_channel_updates';cost.statements++;if(journal)cost.journalScans++;const charge=row=>{const n=new TextEncoder().encode(JSON.stringify(row)).length;cost.bytes+=n;if(journal){cost.journalRows++;cost.journalBytes+=n;}return row;};
     return new Proxy(cursor,{get(o,k){if(k==='toArray')return()=>o.toArray().map(charge);if(k===Symbol.iterator)return function*(){for(const row of o)yield charge(row);};const v=Reflect.get(o,k,o);return typeof v==='function'?v.bind(o):v;}});
    };let result;try{result=operation();}finally{this.ctx.storage.sql.exec=exec;}for(const cursor of records){if(!Number.isSafeInteger(cursor.rowsRead)||!Number.isSafeInteger(cursor.rowsWritten))cost.unknown++;cost.rowsRead+=cursor.rowsRead??0;cost.rowsWritten+=cursor.rowsWritten??0;}return{result,cost};};
   // Journal transfer counters come from actual Native cursor iteration. Other
   // physical counters are collected separately by the normal store observer.
   const state=restoreProgress(this.store.db),original=measure(()=>withRestoreTransaction(this.store,()=>auditRecovery(this.store))),consumed=measure(()=>withRestoreTransaction(this.store,()=>withCompletedRecoveryChannelUpdates(this.store,state.restore_id,state.seal.id,()=>auditRecovery(this.store))));
   return Response.json({sameReport:JSON.stringify(original.result)===JSON.stringify(consumed.result),original:original.cost,consumed:consumed.cost,cursor:state.progress.audit.channelUpdates});
  }
  if(path==='/api/operator/restore') {
   const state=restoreProgress(this.store.db),audit=state.progress?.audit,verify=this.store.channelUpdates.verify;
   if(audit?.stage==='full_audit_pending'&&audit.report?.stage==='complete')this.store.channelUpdates.verify=()=>{throw Error('unbounded Native journal rescan');};
   try{return await super.fetch(request);}finally{this.store.channelUpdates.verify=verify;}
  }
  return super.fetch(request);
 }
}
export default entry;
