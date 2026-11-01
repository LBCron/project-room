import { randomUUID } from 'node:crypto';
import { ServiceError } from './service-error.mjs';

// Target-owned operational fence. Exported source rows can never grant admission
// to a target, and no ordinary SQL writer may clear an interrupted restore.
export const RESTORE_CONTROL_TABLE = 'current_restore_admission';
export const RESTORE_CONTROL_DEFINITIONS = [[RESTORE_CONTROL_TABLE, `CREATE TABLE IF NOT EXISTS current_restore_admission (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1), state TEXT NOT NULL CHECK(state IN ('clear','pending')),
  restore_id TEXT, CHECK((state='clear' AND restore_id IS NULL) OR (state='pending' AND length(restore_id)>0)))`]];
export const RESTORE_CONTROL_GUARDS = ['INSERT','UPDATE','DELETE'].map(operation => {
  const name='current_restore_admission_'+operation.toLowerCase();
  return [name,`CREATE TRIGGER IF NOT EXISTS ${name} BEFORE ${operation} ON current_restore_admission BEGIN
    SELECT RAISE(ABORT,'unsupported restore admission mutation'); END`];
});
export const RESTORE_CONTROL_SCHEMA=RESTORE_CONTROL_DEFINITIONS[0][1]+`;
INSERT INTO current_restore_admission SELECT 1,'clear',NULL WHERE NOT EXISTS(SELECT 1 FROM current_restore_admission);`;
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
function setRestoreState(db,state,id) {
  withExactRestoreGuards(db,RESTORE_CONTROL_GUARDS,()=>db.prepare('UPDATE current_restore_admission SET state=?,restore_id=? WHERE singleton=1').run(state,id));
}
export function beginRestore(store) {
  return withRestoreTransaction(store,()=>{
    if(restorePending(store.db))throw Error('An incomplete backup restore already requires operator recovery');
    if(store.db.prepare('SELECT 1 FROM rooms LIMIT 1').get())throw Error('Refusing to replay into a non-empty store');
    const id='restore_'+randomUUID();setRestoreState(store.db,'pending',id);return id;
  });
}
export function completeRestore(db) {
  if(!restorePending(db))throw Error('Restore has no pending census');
  setRestoreState(db,'clear',null);
}
