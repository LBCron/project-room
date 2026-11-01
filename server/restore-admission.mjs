import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { ServiceError } from './service-error.mjs';
import { CURRENT_WRITER_FORMAT } from './current-room-format.mjs';

// Target-owned operational fence. Exported source rows can never grant admission
// to a target, and no ordinary SQL writer may clear an interrupted restore.
export const RESTORE_CONTROL_TABLE = 'current_restore_admission';
export const RESTORE_CONTROL_DEFINITIONS = [[RESTORE_CONTROL_TABLE, `CREATE TABLE IF NOT EXISTS current_restore_admission (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1), state TEXT NOT NULL CHECK(state IN ('clear','pending')),
  restore_id TEXT, phase TEXT NOT NULL DEFAULT 'clear' CHECK(phase IN ('clear','loading','coverage','audit_pending')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0), source_seal TEXT, coverage TEXT, latest_receipt TEXT,
  CHECK((state='clear' AND restore_id IS NULL AND phase='clear' AND revision=0 AND source_seal IS NULL AND coverage IS NULL)
    OR (state='pending' AND length(restore_id)>0 AND phase='loading' AND source_seal IS NULL AND coverage IS NULL AND latest_receipt IS NULL)
    OR (state='pending' AND length(restore_id)>0 AND phase IN ('coverage','audit_pending') AND source_seal IS NOT NULL AND coverage IS NOT NULL)))`]];
export const RESTORE_CONTROL_GUARDS = ['INSERT','UPDATE','DELETE'].map(operation => {
  const name='current_restore_admission_'+operation.toLowerCase();
  return [name,`CREATE TRIGGER IF NOT EXISTS ${name} BEFORE ${operation} ON current_restore_admission BEGIN
    SELECT RAISE(ABORT,'unsupported restore admission mutation: durable-coverage-v1:${CURRENT_WRITER_FORMAT}'); END`];
});
export const RESTORE_CONTROL_SCHEMA=RESTORE_CONTROL_DEFINITIONS[0][1]+`;
INSERT INTO current_restore_admission(singleton,state,restore_id) SELECT 1,'clear',NULL WHERE NOT EXISTS(SELECT 1 FROM current_restore_admission);`;
const scopes=new WeakSet();
const normalize=sql=>sql?.trim().replace(/;$/,'').replace(/IF NOT EXISTS /g,'').replace(/\s+/g,' ');
export function restorePending(db) {
  const row=db.prepare('SELECT state,restore_id FROM current_restore_admission WHERE singleton=1').get();
  if(!row || (row.state!=='clear' && row.state!=='pending') || (row.state==='clear' && row.restore_id!==null)
    || (row.state==='pending' && !row.restore_id)) throw Error('Restore admission requires reconciliation');
  return row.state==='pending';
}
const admittedSchemas=new WeakMap();
export function verifyRestoreControl(db) {
  const expected=[...RESTORE_CONTROL_DEFINITIONS,...RESTORE_CONTROL_GUARDS];
  let rows=admittedSchemas.get(db);
  if(rows) {
    const actual=db.prepare('SELECT rowid,name,sql FROM sqlite_master WHERE rowid IN ('+rows.map(()=>'?').join(',')+') ORDER BY rowid').all(...rows.map(row=>row.rowid));
    if(actual.length===rows.length && actual.every((row,i)=>row.rowid===rows[i].rowid&&row.name===rows[i].name&&row.sql===rows[i].sql))return;
    admittedSchemas.delete(db);throw Error('Restore admission schema requires reconciliation');
  }
  rows=db.prepare('SELECT rowid,name,sql FROM sqlite_master WHERE name IN ('+expected.map(()=>'?').join(',')+') ORDER BY rowid').all(...expected.map(([name])=>name));
  if(rows.length!==expected.length || expected.some(([name,sql])=>normalize(rows.find(row=>row.name===name)?.sql)!==normalize(sql)))
    throw Error('Restore admission schema requires reconciliation');
  admittedSchemas.set(db,rows);
}
export function assertRestoreAdmitted(db) {
  if(scopes.has(db))return;
  verifyRestoreControl(db);
  if(!scopes.has(db) && restorePending(db)) throw new ServiceError(503,'restore_incomplete','Backup restore has not completed its independent recovery census');
}
export const inRestoreContext=db=>scopes.has(db);
export function withRestoreTransaction(store,operation) {
  const nested=scopes.has(store.db); scopes.add(store.db);
  try { return store.transaction(()=>{const value=operation();if(value?.then)throw Error('Restore must remain synchronous');return value;}); }
  finally { if(!nested)scopes.delete(store.db); }
}
export function withExactRestoreGuards(db,definitions,operation) {
  if(!db.isTransaction || !scopes.has(db))throw Error('Exact restore guards require a synchronous privileged restore transaction');
  for(const [name,sql] of definitions) if(normalize(db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name)?.sql)!==normalize(sql))
    throw Error('Restore guard requires reconciliation: '+name);
  admittedSchemas.delete(db);
  for(const [name] of definitions)db.exec('DROP TRIGGER '+name);
  try { return operation(); }
  finally {
    for(const [,sql] of definitions)db.exec(sql);
    for(const [name,sql] of definitions)if(normalize(db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name)?.sql)!==normalize(sql))
      throw Error('Restore guard reinstall failed: '+name);
  }
}
function setRestoreState(db,state,id,receipt=null) {
  withExactRestoreGuards(db,RESTORE_CONTROL_GUARDS,()=>db.prepare('UPDATE current_restore_admission SET state=?,restore_id=?,phase=?,revision=0,source_seal=NULL,coverage=NULL,latest_receipt=? WHERE singleton=1').run(state,id,state==='clear'?'clear':'loading',receipt===null?null:JSON.stringify(receipt)));
}
export function beginRestore(store) {
  return withRestoreTransaction(store,()=>{
    if(restorePending(store.db))throw Error('An incomplete backup restore already requires operator recovery');
    if(store.db.prepare('SELECT 1 FROM rooms LIMIT 1').get())throw Error('Refusing to replay into a non-empty store');
    const id='restore_'+randomUUID();setRestoreState(store.db,'pending',id);return id;
  });
}
export function completeRestore(db,receipt=null) {
  if(!restorePending(db))throw Error('Restore has no pending census');
  if(db.prepare('SELECT phase FROM current_restore_admission WHERE singleton=1').get().phase==='coverage')throw Error('Restore coverage has not completed');
  setRestoreState(db,'clear',null,receipt);
}

// Bounded operational metadata, never a source row or an imported grant.
export const RESTORE_PROGRESS_MAX_BYTES=1024*1024;
export function restoreProgress(db) {
  verifyRestoreControl(db);
  const scalar=db.prepare('SELECT length(CAST(source_seal AS BLOB)) AS seal_bytes,length(CAST(coverage AS BLOB)) AS coverage_bytes,length(CAST(latest_receipt AS BLOB)) AS receipt_bytes FROM current_restore_admission WHERE singleton=1').get();
  if(!scalar||Object.values(scalar).some(value=>value!==null&&(!Number.isSafeInteger(value)||value<0||value>RESTORE_PROGRESS_MAX_BYTES)))throw Error('Restore progress scalar bytes require reconciliation');
  const row=db.prepare('SELECT state,restore_id,phase,revision,source_seal,coverage,latest_receipt FROM current_restore_admission WHERE singleton=1').get();
  if(!Number.isSafeInteger(row.revision)||row.revision<0)throw Error('Restore progress revision requires reconciliation');
  return {...row,seal:row.source_seal===null?null:JSON.parse(row.source_seal),progress:row.coverage===null?null:JSON.parse(row.coverage),latest:row.latest_receipt===null?null:JSON.parse(row.latest_receipt)};
}
export function checkpointRestore(db,{restoreId,expectedRevision,phase,seal,progress,latest}) {
  if(!db.isTransaction||!scopes.has(db))throw Error('Restore checkpoint requires its privileged transaction');
  const before=restoreProgress(db);
  if(before.state!=='pending'||before.restore_id!==restoreId||before.revision!==expectedRevision)throw Error('Restore checkpoint is stale');
  if(!['coverage','audit_pending'].includes(phase)||(before.phase==='audit_pending'&&phase!=='audit_pending'))throw Error('Invalid restore checkpoint phase');
  if(before.phase!=='loading'&&JSON.stringify(before.seal)!==JSON.stringify(seal))throw Error('Restore source seal cannot change');
  const encoded=[seal,progress,latest].map(value=>value===null?null:JSON.stringify(value));
  if(encoded.some(value=>value!==null&&Buffer.byteLength(value)>RESTORE_PROGRESS_MAX_BYTES))throw Error('Restore progress exceeds its code-owned metadata bound');
  withExactRestoreGuards(db,RESTORE_CONTROL_GUARDS,()=>db.prepare("UPDATE current_restore_admission SET phase=?,revision=revision+1,source_seal=?,coverage=?,latest_receipt=? WHERE singleton=1 AND state='pending' AND restore_id=? AND revision=?").run(phase,...encoded,restoreId,expectedRevision));
  const after=restoreProgress(db);if(after.revision!==expectedRevision+1)throw Error('Restore checkpoint did not advance atomically');
  return after;
}
