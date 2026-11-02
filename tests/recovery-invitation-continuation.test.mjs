import test from 'node:test';import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {operatorRestoreResponse} from '../server/restore-ndjson.mjs';
import {restoreProgress,withRestoreTransaction,withRestoreAuditRows} from '../server/restore-admission.mjs';
import {initialRecoveryInvitations,advanceRecoveryInvitations} from '../server/recovery-invitation-continuation.mjs';
import {seedRecoveryInvitationSource} from './helpers/recovery-invitation-source.mjs';
const credential='synthetic-independent-invitation-restore';
async function post(store,body){const r=await operatorRestoreResponse(new Request('https://room.example/api/operator/restore',{method:'POST',headers:{authorization:'Bearer '+credential,...(typeof body==='string'?{}:{'content-type':'application/json'})},body:typeof body==='string'?body:JSON.stringify(body)}),credential,store);return{status:r.status,body:await r.json()};}
async function fixture(t,options){const source=new RoomStore(':memory:');t.after(()=>source.close());const seeded=seedRecoveryInvitationSource(source,options),store=new RoomStore(':memory:');t.after(()=>store.close());let response=await post(store,exportNdjsonText(source.db)),n=0;
 while(restoreProgress(store.db).phase!=='audit_pending'){assert.equal(response.status,202,JSON.stringify(response.body));response=await post(store,{restoreId:response.body.restoreId,sourceSeal:response.body.sourceSeal,expectedRevision:response.body.revision,requestId:'invite-prepare-'+n++});assert.ok(n<150);}
 const state=restoreProgress(store.db),step=(p,options)=>withRestoreTransaction(store,()=>withRestoreAuditRows(store.db,state.restore_id,scratch=>advanceRecoveryInvitations(store,scratch,state.restore_id,p,state.seal,options)));return{source,store,seeded,state,step};}
function drive(f,p=initialRecoveryInvitations()){for(let n=0;n<1000;n++){if(p.stage==='complete')return p;const r=f.step(p);assert.ok(r.units<=32);p=r.cursor;}throw Error('Invitation progress stalled');}
test('independent invitation phase proves pending/revoked/accepted journal and protected membership without full lists',async t=>{
 const f=await fixture(t),prepare=f.store.db.prepare.bind(f.store.db);f.store.room=()=>{throw Error('whole room hydration');};
 f.store.db.prepare=sql=>{assert.notEqual(sql,'SELECT id FROM membership_invitations ORDER BY id');assert.ok(!/SELECT \* FROM membership_invitation(?:_journal|_events)s? WHERE invitation_id=/.test(sql));return prepare(sql);};
 try{const p=drive(f);assert.equal(p.invitations,3);assert.equal(p.journalEntries,5);assert.equal(p.auditEntries,5);assert.equal(p.orphanRows,5);assert.equal(p.legacyBaselines,0);}finally{f.store.db.prepare=prepare;}
 assert.equal(f.seeded.expected.consistent,true);
});
