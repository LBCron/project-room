import entry,{DurableCoverageRoom as Base} from './durable-coverage-native.test-fixture.mjs';
import {createHash} from 'node:crypto';
import {seedRecoveryReplayEqualitySource} from '../tests/helpers/recovery-replay-equality-source.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {auditRecovery} from '../server/recovery.mjs';
import {restoreProgress,withRestoreTransaction} from '../server/restore-admission.mjs';
import {withCompletedRecoveryProjectionParity} from '../server/recovery-projection-consumption.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export class DurableCoverageRoom extends Base {
 measure(operation){
  const sql=this.ctx.storage.sql,exec=sql.exec.bind(sql),records=[];let rebuilds=0;const rebuild=this.store.rebuildProjection.bind(this.store);
  this.store.rebuildProjection=(...args)=>{rebuilds++;return rebuild(...args);};
  sql.exec=(text,...args)=>{const cursor=exec(text,...args),r={text,cursor,bytes:0,boundBytes:args.reduce((n,v)=>n+(typeof v==='string'?new TextEncoder().encode(v).length:v instanceof ArrayBuffer?v.byteLength:ArrayBuffer.isView(v)?v.byteLength:8),0),sqlBytes:new TextEncoder().encode(text).length};records.push(r);const charge=row=>{r.bytes+=new TextEncoder().encode(JSON.stringify(row)).length;return row;};return new Proxy(cursor,{get(o,k){if(k==='toArray')return()=>o.toArray().map(charge);if(k===Symbol.iterator)return function*(){for(const row of o)yield charge(row);};const v=Reflect.get(o,k,o);return typeof v==='function'?v.bind(o):v;}});};
  let result;try{result=operation();}finally{sql.exec=exec;this.store.rebuildProjection=rebuild;}
  const cost={statements:records.length,rowsRead:0,rowsWritten:0,bytes:0,unknown:0,rebuilds,boundBytes:0,sqlBytes:0};for(const r of records){if(!Number.isSafeInteger(r.cursor.rowsRead)||!Number.isSafeInteger(r.cursor.rowsWritten))cost.unknown++;cost.rowsRead+=r.cursor.rowsRead??0;cost.rowsWritten+=r.cursor.rowsWritten??0;cost.bytes+=r.bytes;cost.boundBytes+=r.boundBytes;cost.sqlBytes+=r.sqlBytes;}cost.totalTransferBytes=cost.bytes+cost.boundBytes+cost.sqlBytes;
  const groups=new Map();for(const r of records){const g=groups.get(r.text)??{sql:r.text,statements:0,rowsRead:0,bytes:0};g.statements++;g.rowsRead+=r.cursor.rowsRead??0;g.bytes+=r.bytes;groups.set(r.text,g);}cost.topRows=[...groups.values()].sort((a,b)=>b.rowsRead-a.rowsRead).slice(0,8);cost.topBytes=[...groups.values()].sort((a,b)=>b.bytes-a.bytes).slice(0,8);
  return{result,cost};
 }
 async fetch(request){
  const url=new URL(request.url),path=url.pathname,store=this.store,db=store.db;
  if(path==='/__equality-seed'){const seeded=seedRecoveryReplayEqualitySource(store,{extra:Number(url.searchParams.get('n')??128),archive:url.searchParams.has('archive'),checkpoint:url.searchParams.has('checkpoint')});auditRecovery(store);return Response.json(seeded);}
  if(path==='/__equality-export')return new Response(exportNdjsonText(db));
  if(path==='/__equality-state'){const state=restoreProgress(db);return Response.json({revision:state.revision,phase:state.phase,hash:hash(state.coverage??''),equality:state.progress?.audit?.equality??null,rooms:state.progress?.audit?.equalityRooms??null,deferred:state.progress?.audit?.equalityDeferred??null});}
  if(path==='/__equality-fault'){this.equalityFault=true;return Response.json({armed:true});}
  if(path==='/__equality-cost')return Response.json(this.lastEqualityCost);
  if(path==='/__equality-compare'){
   const state=restoreProgress(db);const audit=()=>withRestoreTransaction(store,()=>auditRecovery(store));audit();
   const original=this.measure(audit),consumed=this.measure(()=>withRestoreTransaction(store,()=>withCompletedRecoveryProjectionParity(store,state.restore_id,state.seal.id,()=>auditRecovery(store))));
   return Response.json({sameReport:JSON.stringify(original.result)===JSON.stringify(consumed.result),original:original.cost,consumed:consumed.cost,summary:{rooms:state.progress.audit.equalityRooms,deferred:state.progress.audit.equalityDeferred,fields:state.progress.audit.equalityFields,values:state.progress.audit.equalityValues,messages:state.progress.audit.equalityMessages,archived:state.progress.audit.equalityArchived}});
  }
  if(path==='/__equality-carrier')return Response.json(db.prepare("SELECT length(CAST(projection AS BLOB)) bytes,sequence FROM rooms WHERE id='commons'").get());
  if(path==='/api/operator/restore'){
   const state=restoreProgress(db),a=state.progress?.audit,prepare=db.prepare.bind(db),rebuild=store.rebuildProjection;
   if(a?.stage==='full_audit_pending'&&a.report?.stage==='complete'&&a.equalityDeferred===0)store.rebuildProjection=()=>{throw Error('Native final unbounded rebuild invoked');};
   if(this.equalityFault&&a?.stage==='replay_equality'){this.equalityFault=false;db.prepare=text=>{const s=prepare(text);if(text.startsWith('UPDATE current_restore_admission SET phase=')){const run=s.run.bind(s);s.run=(...args)=>{run(...args);throw Error('Native equality checkpoint fault');};}return s;};}
   // Async HTTP entry calls the existing synchronous restore operation. Record
   // actual Native cursor costs without changing its transaction or authority.
   const sql=this.ctx.storage.sql,exec=sql.exec.bind(sql),records=[];
   sql.exec=(text,...args)=>{const cursor=exec(text,...args),r={cursor,bytes:0,boundBytes:args.reduce((n,v)=>n+(typeof v==='string'?new TextEncoder().encode(v).length:v instanceof ArrayBuffer?v.byteLength:ArrayBuffer.isView(v)?v.byteLength:8),0),sqlBytes:new TextEncoder().encode(text).length};records.push(r);const charge=row=>{r.bytes+=new TextEncoder().encode(JSON.stringify(row)).length;return row;};return new Proxy(cursor,{get(o,k){if(k==='toArray')return()=>o.toArray().map(charge);if(k===Symbol.iterator)return function*(){for(const row of o)yield charge(row);};const v=Reflect.get(o,k,o);return typeof v==='function'?v.bind(o):v;}});};
   try{return await super.fetch(request);}finally{sql.exec=exec;db.prepare=prepare;store.rebuildProjection=rebuild;this.lastEqualityCost={statements:records.length,rowsRead:0,rowsWritten:0,bytes:0,boundBytes:0,sqlBytes:0,unknown:0};for(const r of records){if(!Number.isSafeInteger(r.cursor.rowsRead)||!Number.isSafeInteger(r.cursor.rowsWritten))this.lastEqualityCost.unknown++;this.lastEqualityCost.rowsRead+=r.cursor.rowsRead??0;this.lastEqualityCost.rowsWritten+=r.cursor.rowsWritten??0;this.lastEqualityCost.bytes+=r.bytes;this.lastEqualityCost.boundBytes+=r.boundBytes;this.lastEqualityCost.sqlBytes+=r.sqlBytes;}this.lastEqualityCost.totalTransferBytes=this.lastEqualityCost.bytes+this.lastEqualityCost.boundBytes+this.lastEqualityCost.sqlBytes;}
  }
  return super.fetch(request);
 }
}
export default entry;
