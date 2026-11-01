// Existing recovery engine checks, resumable BETWEEN tables. SQLite's work
// inside a single table PRAGMA is atomic and is not a strict CPU bound.
import {Buffer} from 'node:buffer';
import {inRestoreContext,restoreProgress} from './restore-admission.mjs';
export const initialRecoveryEngine=()=>({version:1,stage:'quick_check',tableAfter:'',quickTables:0,foreignKeyTables:0});
const fail=message=>{throw Error('Recovery SQLite engine requires reconciliation: '+message);};
export function validateRecoveryEngine(value){
 if(!value||Object.keys(value).sort().join(',')!=='foreignKeyTables,quickTables,stage,tableAfter,version'||value.version!==1
  ||!['quick_check','foreign_key_check','complete'].includes(value.stage)||typeof value.tableAfter!=='string'||Buffer.byteLength(value.tableAfter)>512
  ||!['quickTables','foreignKeyTables'].every(key=>Number.isSafeInteger(value[key])&&value[key]>=0)
  ||value.stage==='quick_check'&&value.foreignKeyTables!==0||value.stage==='complete'&&value.tableAfter!=='')fail('invalid cursor');
}
export function advanceRecoveryEngine(store,restoreId,previous){
 validateRecoveryEngine(previous);const db=store.db;
 if(!db.isTransaction||!inRestoreContext(db))fail('requires privileged synchronous restore transaction');
 const admission=restoreProgress(db);
 if(admission.state!=='pending'||admission.restore_id!==restoreId||admission.phase!=='audit_pending')fail('restore authority differs');
 const p={...previous};if(p.stage==='complete')return p;
 // quick_check uses the precise legacy filter. Per-table foreign_key_check
 // visits ALL tables, preserving the former unscoped foreign_key_check.
 const filter=p.stage==='quick_check'?" AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*'":'';
 const scalar=db.prepare("SELECT rowid,length(CAST(name AS BLOB)) bytes FROM sqlite_master WHERE type='table'"+filter+' AND name>? ORDER BY name LIMIT 1').get(p.tableAfter);
 if(!scalar){p.stage=p.stage==='quick_check'?'foreign_key_check':'complete';p.tableAfter='';return p;}
 if(!Number.isSafeInteger(scalar.bytes)||scalar.bytes<1||scalar.bytes>512)fail('invalid table name');
 const row=db.prepare("SELECT name FROM sqlite_master WHERE rowid=? AND type='table'").get(scalar.rowid);
 if(typeof row?.name!=='string'||Buffer.byteLength(row.name)!==scalar.bytes)fail('table identity differs');
 const quoted='"'+row.name.replaceAll('"','""')+'"';
 if(p.stage==='quick_check'){
  // Match the existing oracle's exact success condition. On corruption fail
  // at the first result; do not allocate an unbounded array of diagnostics.
  if(db.prepare('PRAGMA quick_check('+quoted+')').get()?.quick_check!=='ok')fail('quick_check failed for '+row.name);
  p.quickTables++;
 }else{
  if(db.prepare('PRAGMA foreign_key_check('+quoted+')').get()!==undefined)fail('foreign key check failed for '+row.name);
  p.foreignKeyTables++;
 }
 p.tableAfter=row.name;return p;
}
