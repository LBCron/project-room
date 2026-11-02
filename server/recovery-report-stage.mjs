import {Buffer} from 'node:buffer';
import {applicationTables} from './writer-fence.mjs';
import {restoreProgress,inRestoreContext,withRestoreAuditRows} from './restore-admission.mjs';
import {captureRecoveryReportSnapshot,readRecoveryReportSnapshot} from './recovery-report-snapshot.mjs';
import {initialRecoveryReportRow,advanceRecoveryReportRow} from './recovery-report-source.mjs';
import {initialRecoveryReportTable,appendRecoveryReportChunk,sealRecoveryReportTable,advanceRecoveryReportTable,recoveryReportTableResult,initialRecoveryReportDigest,appendRecoveryReportDigest,finishRecoveryReportDigest} from './recovery-report-continuation.mjs';
const fail=()=>{throw Error('Recovery report stage requires reconciliation');};
export function validateRecoveryReportStage(p){
 if(!p||Object.keys(p).sort().join(',')!=='dataHash,dataSha256,results,rowAfter,scratchRows,snapshotHash,source,stage,table,tableIndex,version'||p.version!==1
  ||!['source','sort','complete'].includes(p.stage)||!/^[a-f0-9]{64}$/.test(p.snapshotHash??'')
  ||!Number.isSafeInteger(p.scratchRows)||p.scratchRows<1||!Number.isInteger(p.tableIndex)||p.tableIndex<0||p.tableIndex>applicationTables.length||p.rowAfter!==null&&!Number.isSafeInteger(p.rowAfter)
  ||!Array.isArray(p.results)||p.results.length!==p.tableIndex||p.results.some((v,i)=>v.table!==applicationTables[i]||!Number.isSafeInteger(v.rows)||v.rows<0||!/^[a-f0-9]{64}$/.test(v.sha256??''))
  ||Buffer.byteLength(JSON.stringify(p))>512*1024)fail();
 if(p.stage==='complete'){if(p.tableIndex!==applicationTables.length||p.table!==null||p.source!==null||p.dataSha256!==finishRecoveryReportDigest(p.dataHash))fail();}
 else if(p.tableIndex>=applicationTables.length||p.table?.table!==applicationTables[p.tableIndex]||p.dataSha256!==null
  ||(p.stage==='source'&&p.table.stage!=='ingest')||(p.stage==='sort'&&p.table.stage==='ingest')
  ||p.source!==null&&(p.stage!=='source'||p.source.table!==applicationTables[p.tableIndex]||(p.rowAfter!==null&&p.source.rowid<=p.rowAfter)))fail();
}
// The existing restore entrypoint supplies its existing exact sealed-schema
// admission callback; it must not create a second, weaker source/freeze check.
// Caller commits returned cursor + scratch + normal CAS/request receipt in ONE
// privileged synchronous restore transaction, and returns latest receipts on ACK loss.
export function advanceRecoveryReport(store,restoreId,previous,{assertSealedSource}={}){
 const db=store.db;if(!db.isTransaction||!inRestoreContext(db)||typeof assertSealedSource!=='function')fail();
 const state=restoreProgress(db);if(state.state!=='pending'||state.phase!=='audit_pending'||state.restore_id!==restoreId)fail();assertSealedSource(state);
 return withRestoreAuditRows(db,restoreId,scratch=>{
  let p;
  if(previous===null){
   const capture=captureRecoveryReportSnapshot(db,scratch,state);
   p={version:1,stage:'source',snapshotHash:capture.digest,scratchRows:capture.rows,tableIndex:0,rowAfter:null,source:null,table:initialRecoveryReportTable(applicationTables[0]),results:[],dataHash:initialRecoveryReportDigest(),dataSha256:null};
   validateRecoveryReportStage(p);return p;
  }
  validateRecoveryReportStage(previous);p=structuredClone(previous);const snapshot=readRecoveryReportSnapshot(db,scratch,p.snapshotHash,state);
  if(p.stage==='complete')return p;
  let sourceBudget=32,sortBudget=16;
  for(let transitions=0;transitions<16&&p.stage!=='complete';transitions++){
  const name=applicationTables[p.tableIndex];
  if(p.stage==='sort'){
   if(sortBudget===0)break;const sorted=advanceRecoveryReportTable(scratch,p.table,{maxUnits:sortBudget});p.table=sorted.state;sortBudget-=sorted.units;
   if(p.table.stage==='complete'){
    const result=recoveryReportTableResult(p.table),entry=state.seal.tables.find(t=>t.name===name),expected=name==='current_restore_audit_scratch'?0:name==='current_restore_admission'||name==='current_room_writer_permit'||name==='public_work_claim_writer_permit'?1:entry?.expected?.rows??0;if(result.rows!==expected)fail();if(result.rows>1)p.scratchRows+=result.rows;p.results.push(result);p.dataHash=appendRecoveryReportDigest(p.dataHash,result,p.tableIndex===0);p.tableIndex++;p.rowAfter=null;p.source=null;
    if(p.tableIndex===applicationTables.length){p.table=null;p.stage='complete';p.dataSha256=finishRecoveryReportDigest(p.dataHash);}
    else{p.table=initialRecoveryReportTable(applicationTables[p.tableIndex]);p.stage='source';}
   }
  }else{
   if(p.source===null){
    const next=name==='current_restore_audit_scratch'?undefined:name==='current_restore_admission'?(p.rowAfter===null?{__report_rid:1}:undefined):db.prepare(`SELECT rowid AS __report_rid FROM "${name}"${p.rowAfter===null?'':' WHERE rowid>?'} ORDER BY rowid LIMIT 1`).get(...(p.rowAfter===null?[]:[p.rowAfter]));
    if(!next){p.table=sealRecoveryReportTable(p.table);p.stage='sort';continue;}
    if(!Number.isSafeInteger(next.__report_rid))fail();
    // maxRowBytes is sealed from the actual original source. Only target-owned
    // control/permit rows may exist outside that list; others must be empty.
    const entry=state.seal.tables.find(t=>t.name===name),target=name==='current_restore_admission'||name==='current_room_writer_permit'||name==='public_work_claim_writer_permit';
    if(!entry&&!target)fail();const maximum=name==='current_restore_admission'?3*1024*1024:entry?.maxRowBytes??4096;
    p.source=initialRecoveryReportRow(db,name,next.__report_rid,maximum);
   }
   if(sourceBudget===0)break;const result=advanceRecoveryReportRow(db,p.source,{snapshot,scratch,maxUnits:sourceBudget});p.source=result.state;sourceBudget-=result.units;
   if(result.chunk!==null){p.table=appendRecoveryReportChunk(scratch,p.table,result.chunk,result.last);p.scratchRows+=1+(result.last?1:0);}
   if(result.last){p.rowAfter=p.source.rowid;p.source=null;}
  }
  }
  validateRecoveryReportStage(p);return p;
 });
}
