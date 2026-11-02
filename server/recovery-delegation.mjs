import {validateDelegationJournalStep} from './journal.mjs';
import {inRestoreContext,restoreProgress,RESTORE_AUDIT_VERSION} from './restore-admission.mjs';
import {verifyRestoreFreeze} from './writer-fence.mjs';

const JOURNAL='membership_delegation_journal', GRANTS='membership_delegation_grants';
const LIMIT=4*1024*1024, scopes=new WeakMap();
const fail=()=>{throw Error('Recovery membership delegation requires operator reconciliation');};
export const initialRecoveryDelegation=()=>({version:1,stage:'journal',sequence:0,entries:0,groups:0,grants:0,after:null});
function rowid(value) {
  if(typeof value!=='string'||! /^(?:0|-[1-9][0-9]*|[1-9][0-9]*)$/.test(value)||value.length>20)return false;
  const n=BigInt(value);return n>=-9223372036854775808n&&n<=9223372036854775807n;
}
export function validateRecoveryDelegation(c) {
  if(!c||Object.keys(c).sort().join(',')!==Object.keys(initialRecoveryDelegation()).sort().join(',')||c.version!==1
    ||!['journal','grants','complete'].includes(c.stage)||c.after!==null&&!rowid(c.after)
    ||!['sequence','entries','groups','grants'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=0)
    ||c.sequence!==c.entries||c.groups>c.entries||c.grants>c.groups)fail();
}
function authority(store,id,sealId) {
  const db=store.db;if(!db.isTransaction||!inRestoreContext(db))fail();
  const s=restoreProgress(db),a=s.progress?.audit;
  if(s.state!=='pending'||s.phase!=='audit_pending'||s.restore_id!==id||s.seal?.id!==sealId
    ||s.seal.auditVersion!==RESTORE_AUDIT_VERSION||a?.version!==RESTORE_AUDIT_VERSION)fail();
  return s;
}
function entry(seal,table) {
  const e=seal.tables.find(e=>e.name===table);
  if(!e||!Number.isSafeInteger(e.expected?.rows)||e.expected.rows<0||!Number.isSafeInteger(e.maxRowBytes)||e.maxRowBytes<0)fail();
  return e;
}
function complete(c,seal) {
  validateRecoveryDelegation(c);
  if(c.stage!=='complete'||c.entries!==entry(seal,JOURNAL).expected.rows
    ||c.grants!==entry(seal,GRANTS).expected.rows||c.groups!==c.grants
    ||entry(seal,'membership_delegation_pending').expected.rows!==0)fail();
}
function assertNoPending(db,seal) {
  if(entry(seal,'membership_delegation_pending').expected.rows!==0
    ||db.prepare('SELECT 1 FROM membership_delegation_pending LIMIT 1').get())fail();
}
// Reconstruct the original per-room chains and per-identity transitions once.
// Scratch and the continuation checkpoint are committed in the same restore transaction.
export function advanceRecoveryDelegation(store,scratch,id,previous,seal,{maxUnits=32}={}) {
  validateRecoveryDelegation(previous);
  if(!Number.isInteger(maxUnits)||maxUnits<1||maxUnits>32)fail();
  const s=authority(store,id,seal?.id),a=s.progress.audit,db=store.db;
  if(a.stage!=='delegation'||JSON.stringify(a.delegation)!==JSON.stringify(previous))fail();
  seal=s.seal;store.delegationJournal.verifySchema();assertNoPending(db,seal);
  const c={...previous};let units=0,bytes=0;
  while(c.stage!=='complete'&&units<maxUnits&&scratch.remaining>=2) {
    if(c.stage==='journal') {
      const scalar=db.prepare(`SELECT sequence,coalesce(length(CAST(room_id AS BLOB)),0)
        +coalesce(length(CAST(identity_id AS BLOB)),0)+coalesce(length(CAST(action AS BLOB)),0)
        +coalesce(length(CAST(actor_id AS BLOB)),0)+coalesce(length(CAST(prior_hash AS BLOB)),0)
        +coalesce(length(CAST(hash AS BLOB)),0)+4096 bytes FROM membership_delegation_journal
        WHERE sequence>? ORDER BY sequence LIMIT 1`).get(c.sequence);
      if(!scalar) {
        const seq=db.prepare("SELECT seq FROM sqlite_sequence WHERE name='membership_delegation_journal'").get()?.seq??0;
        if(seq!==c.sequence||c.entries!==entry(seal,JOURNAL).expected.rows)fail();
        c.stage='grants';continue;
      }
      if(!Number.isSafeInteger(scalar.bytes)||scalar.bytes<4096||scalar.bytes>entry(seal,JOURNAL).maxRowBytes+4096)fail();
      if(units&&bytes+scalar.bytes>LIMIT)break;
      const row=db.prepare('SELECT * FROM membership_delegation_journal WHERE sequence=?').get(scalar.sequence);
      const prior=scratch.get('history',row.room_id,'delegationState',row.identity_id);
      const priorHash=scratch.get('history',row.room_id,'delegationChain','head');
      const next=validateDelegationJournalStep(row,{prior:prior??false,seen:prior!==undefined,priorHash,previousSequence:c.sequence});
      scratch.set('history',row.room_id,'delegationState',row.identity_id,next);
      scratch.set('history',row.room_id,'delegationChain','head',row.hash);
      if(prior===undefined)c.groups++;
      c.sequence=row.sequence;c.entries++;units++;bytes+=scalar.bytes;
    } else {
      const scalar=db.prepare(`SELECT CAST(rowid AS TEXT) cursor,coalesce(length(CAST(room_id AS BLOB)),0)
        +coalesce(length(CAST(identity_id AS BLOB)),0)+4096 bytes FROM membership_delegation_grants
        ${c.after===null?'':'WHERE rowid>CAST(? AS INTEGER)'} ORDER BY rowid LIMIT 1`).get(...(c.after===null?[]:[c.after]));
      if(!scalar){c.stage='complete';complete(c,seal);break;}
      if(!rowid(scalar.cursor)||!Number.isSafeInteger(scalar.bytes)||scalar.bytes<4096||scalar.bytes>entry(seal,GRANTS).maxRowBytes+4096)fail();
      if(units&&bytes+scalar.bytes>LIMIT)break;
      const row=db.prepare('SELECT room_id,identity_id,revoked_at FROM membership_delegation_grants WHERE rowid=CAST(? AS INTEGER)').get(scalar.cursor);
      const active=scratch.get('history',row.room_id,'delegationState',row.identity_id);
      if(active===undefined||active!==(row.revoked_at===null))fail();
      c.grants++;c.after=scalar.cursor;units++;bytes+=scalar.bytes;
    }
  }
  if(c.stage==='complete')complete(c,seal);
  return{cursor:c,units,bytes,done:c.stage==='complete'};
}
export function withCompletedRecoveryDelegation(store,id,sealId,operation) {
  const s=authority(store,id,sealId),c=s.progress.audit.delegation;
  if(s.progress.audit.stage!=='full_audit_pending')fail();
  complete(c,s.seal);verifyRestoreFreeze(store.db,s.seal.inventory);
  const previous=scopes.get(store.db);scopes.set(store.db,{id,sealId,revision:s.revision,cursor:JSON.stringify(c)});
  try {const result=operation();if(result?.then)fail();verifyDelegationForRecovery(store);return result;}
  finally {if(previous)scopes.set(store.db,previous);else scopes.delete(store.db);}
}
export function verifyDelegationForRecovery(store) {
  const permit=scopes.get(store.db);if(!permit)return store.delegationJournal.verify();
  const s=authority(store,permit.id,permit.sealId),c=s.progress.audit.delegation;
  if(s.progress.audit.stage!=='full_audit_pending'||s.revision!==permit.revision||JSON.stringify(c)!==permit.cursor)fail();
  complete(c,s.seal);return{entries:c.entries,absent:false};
}
