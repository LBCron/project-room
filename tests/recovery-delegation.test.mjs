import {auditRecovery} from '../server/recovery.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,post,input} from './helpers/recovery-channel-updates-target.mjs';
import {linkWithProof} from './helpers/link-with-proof.mjs';
import {restoreProgress,withRestoreTransaction} from '../server/restore-admission.mjs';
import {withCompletedRecoveryDelegation,verifyDelegationForRecovery,advanceRecoveryDelegation} from '../server/recovery-delegation.mjs';
import {operatorNormalization} from '../server/operator-normalization.mjs';

function seed(store,n=70) {
  const owner=store.issueAccessKey('commons','owner');
  const agent=store.identities.create('Synthetic recovery delegate');
  linkWithProof(store,owner,'commons',agent,{displayName:'Synthetic recovery delegate',permissions:['accept_work']});
  for(let i=0;i<n;i++)store.delegation[i%2?'revoke':'grant'](owner,'commons',{identityId:agent.identityId});
  const args={roomId:'commons',discardLegacyAssignments:false},plan=operatorNormalization(store,args);
  operatorNormalization(store,{...args,planHash:plan.planHash,requestId:'delegation-native-source',reason:'Synthetic recovery qualification'},true);
  assert.equal(store.delegationJournal.verify().entries,n);
}
const setup=(t,n=70)=>fixture(t,{rows:0,stop:'delegation',beforeExport:store=>seed(store,n)});
function corrupt(f,table,sql) {
  withRestoreTransaction(f.store,()=>{
    const db=f.store.db,defs=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name=?").all(table);
    for(const d of defs)db.exec('DROP TRIGGER '+d.name);
    db.exec(sql);
    for(const d of defs)db.exec(d.sql);
  });
}
test('real grants/revocations resume in bounded pages with exact retry and cold recovery',async t=>{
  const f=await setup(t),prepare=f.store.db.prepare.bind(f.store.db),queries=[];
  f.store.db.prepare=sql=>{queries.push(sql);assert.notEqual(sql,'SELECT * FROM membership_delegation_journal ORDER BY sequence');return prepare(sql);};
  const body={...input(f.response.body,f.n),requestId:"delegation-lost-ack"};
  try {const r=await f.step(body);assert.equal(r.status,202,JSON.stringify(r.body));assert.deepEqual(await post(f.store,body),r);assert.equal(restoreProgress(f.store.db).progress.audit.delegation.entries,32);}
  finally {f.store.db.prepare=prepare;}
  f.reopen();let pages=1;
  while(f.response.body.auditProgress?.stage==='delegation') {
    const before=restoreProgress(f.store.db);assert.equal((await f.step()).status,202);
    const after=restoreProgress(f.store.db);assert.ok(after.progress.audit.units-before.progress.audit.units<=32);pages++;f.reopen();
  }
  const c=restoreProgress(f.store.db).progress.audit.delegation;
  assert.equal(c.entries,70);assert.equal(c.groups,1);assert.equal(c.grants,1);assert.ok(pages>=3);
  assert.ok(queries.some(s=>s.includes('length(CAST(room_id AS BLOB))')));
  while(f.response.body.auditProgress?.stage!=='full_audit_pending')assert.equal((await f.step()).status,202);
  const oracle=withRestoreTransaction(f.store,()=>auditRecovery(f.store));
  const original=f.store.delegationJournal.verify;
  f.store.delegationJournal.verify=()=>{throw Error('whole delegation journal was rescanned');};
  try {
    for(let n=0;f.response.body.auditProgress?.report?.stage!=='complete';n++){assert.ok(n<10000);assert.equal((await f.step()).status,202);}
    const done=await f.step();assert.equal(done.status,200,JSON.stringify(done.body));assert.equal(done.body.subsystemContinuation.delegation.consumed,true);
    assert.deepEqual(done.body.recovery.tables,oracle.tables);assert.equal(done.body.recovery.dataSha256,oracle.dataSha256);
  }
  finally {f.store.delegationJournal.verify=original;}
  assert.equal(f.store.delegationJournal.verify().entries,70);
});
test('failed checkpoint rolls back scratch and retry advances once after reopening',async t=>{
  const f=await setup(t),before=restoreProgress(f.store.db),body=input(f.response.body,f.n),prepare=f.store.db.prepare.bind(f.store.db);let fired=false;
  f.store.db.prepare=sql=>{const q=prepare(sql);if(sql.startsWith('UPDATE current_restore_admission SET phase=')){const run=q.run.bind(q);q.run=(...args)=>{run(...args);fired=true;throw Error('synthetic delegation save failure');};}return q;};
  try {assert.equal((await post(f.store,body)).status,422);assert.equal(fired,true);assert.deepEqual(restoreProgress(f.store.db),before);}
  finally {f.store.db.prepare=prepare;}
  f.reopen();const r=await post(f.store,body);assert.equal(r.status,202);assert.deepEqual(await post(f.store,body),r);assert.equal(restoreProgress(f.store.db).progress.audit.delegation.entries,32);
});
for(const [name,table,sql] of [
  ['hash','membership_delegation_journal',"UPDATE membership_delegation_journal SET hash='broken' WHERE sequence=2"],
  ['prior state','membership_delegation_journal','UPDATE membership_delegation_journal SET prior_active=0 WHERE sequence=2'],
  ['sequence gap','membership_delegation_journal','DELETE FROM membership_delegation_journal WHERE sequence=2'],
  ['generation','sqlite_sequence',"UPDATE sqlite_sequence SET seq=999 WHERE name='membership_delegation_journal'"],
  ['current grant','membership_delegation_grants','UPDATE membership_delegation_grants SET revoked_at=NULL'],
  ['pending','membership_delegation_pending',"INSERT INTO membership_delegation_pending(room_id,identity_id,prior_active,next_active,recorded_at) VALUES('commons','synthetic',0,1,1)"]
])test('independent continuation refuses '+name,async t=>{
  const f=await setup(t,4),before=restoreProgress(f.store.db);corrupt(f,table,sql);f.reopen();
  assert.equal((await f.step()).status,422);assert.deepEqual(restoreProgress(f.store.db),before);
});
test('completion cannot be supplied by caller or used outside target restore scope',async t=>{
  const f=await setup(t,2),s=restoreProgress(f.store.db);
  assert.throws(()=>advanceRecoveryDelegation(f.store,{},s.restore_id,s.progress.audit.delegation,s.seal),/reconciliation/);
  assert.throws(()=>withRestoreTransaction(f.store,()=>withCompletedRecoveryDelegation(f.store,s.restore_id,s.seal.id,()=>null)),/reconciliation/);
  assert.deepEqual(verifyDelegationForRecovery(f.store),{entries:2,absent:false});
});
