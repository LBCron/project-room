import test from 'node:test';import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {operatorRestoreResponse} from '../server/restore-ndjson.mjs';
import {restoreProgress,withRestoreTransaction,withRestoreAuditRows} from '../server/restore-admission.mjs';
import {initialRecoveryWorkHelp,advanceRecoveryWorkHelp} from '../server/recovery-work-help.mjs';
import {seedRecoveryWorkHelpSource} from './helpers/recovery-work-help-source.mjs';
const token=['synthetic','work','help','restore','1101'].join('-');
async function post(store,body){const r=await operatorRestoreResponse(new Request('https://room.example/api/operator/restore',{method:'POST',headers:{authorization:'Bearer '+token,...(typeof body==='string'?{}:{'content-type':'application/json'})},body:typeof body==='string'?body:JSON.stringify(body)}),token,store);return{status:r.status,body:await r.json()};}
async function fixture(t,{checkpoint=true}={}){
 const source=new RoomStore(':memory:');t.after(()=>source.close());seedRecoveryWorkHelpSource(source,{checkpoint});const store=new RoomStore(':memory:');t.after(()=>store.close());let response=await post(store,exportNdjsonText(source.db)),calls=0;
 while(restoreProgress(store.db).progress?.audit?.stage!=='replay_events'){assert.equal(response.status,202,JSON.stringify(response.body.error));response=await post(store,{restoreId:response.body.restoreId,sourceSeal:response.body.sourceSeal,expectedRevision:response.body.revision,requestId:'help-prepare-'+calls++});assert.ok(calls<100);}
 const state=restoreProgress(store.db),step=(p,options)=>withRestoreTransaction(store,()=>withRestoreAuditRows(store.db,state.restore_id,scratch=>advanceRecoveryWorkHelp(store,scratch,state.restore_id,'legacy-room',p,state.seal,options)));
 return{source,store,state,step};
}
for(const checkpoint of [false,true])test('exact historical help/offer/member/ownership facts compare current and checkpoint; checkpoint='+checkpoint,async t=>{
 const f=await fixture(t,{checkpoint});let p=initialRecoveryWorkHelp(),calls=0,offerAtoms=0;
 while(p.stage!=='complete'){const result=f.step(p);if(p.stage==='offers')offerAtoms+=result.units;p=result.cursor;assert.notEqual(p.stage,'deferred',p.reason);assert.ok(result.units<=32);assert.ok(++calls<100);}
 assert.equal(p.offers,2);assert.equal(p.relevant,1);assert.equal(p.helps,1);assert.equal(p.room.ownerId,'heir');assert.equal(p.checkpointChecked,true);assert.ok(p.offerChecks>0);t.diagnostic(JSON.stringify({calls,offerAtoms,checkpoint,sequence:p.sequence}));
});
function drive(f,until,p=initialRecoveryWorkHelp()){
 for(let i=0;i<1000;i++){if(until(p))return p;if(['complete','deferred'].includes(p.stage))throw Error('Target phase not reached: '+JSON.stringify(p));p=f.step(p,{maxUnits:1}).cursor;}throw Error('Too many help atoms');
}
function mutate(f,operation){withRestoreTransaction(f.store,()=>withRestoreAuditRows(f.store.db,f.state.restore_id,operation));}
function sequence(f,type,offerId){return f.source.db.prepare("SELECT sequence FROM events WHERE room_id='legacy-room' AND json_extract(body,'$.type')=? AND json_extract(body,'$.data.offerId')=?").get(type,offerId).sequence;}
for(const defect of ['missing-identity','wrong-identity','duplicate-identity','missing-selected','duplicate-selected','task-revision','accountable-permission','checkpoint-scope','current-member-revision'])test('independent global work-help phase refuses '+defect,async t=>{
 const f=await fixture(t);let p;
 if(defect==='checkpoint-scope')p=drive(f,p=>p.stage==='discover');
 else if(defect==='accountable-permission'){
  const seq=f.source.db.prepare("SELECT sequence FROM events WHERE room_id='legacy-room' AND json_extract(body,'$.type')='work.help_updated' ORDER BY sequence LIMIT 1").get().sequence;p=drive(f,p=>p.sequence===seq&&p.stage==='events');
 }else{const seq=sequence(f,defect==='missing-selected'?'work.help_offer_updated':'work.help_offer_opened',defect==='missing-selected'?'first-offer':'second-offer');p=drive(f,p=>p.sequence===seq&&p.stage==='events');}
 mutate(f,scratch=>{
  const get=(domain,key,lane='history')=>scratch.get(lane,'legacy-room',domain,key),set=(domain,key,value,lane='history')=>scratch.set(lane,'legacy-room',domain,key,value);
  const first=get('helpOffer','first-offer'),second=get('helpOffer','second-offer');
  if(defect==='missing-identity'||defect==='wrong-identity')set('helpIdentity',JSON.stringify([first.workItemId,first.invitation.eventId,first.offererId]),defect==='missing-identity'?null:'wrong-offer');
  if(defect==='duplicate-identity'){second.offererId=first.offererId;second.updatedById=first.offererId;set('helpOffer',second.id,second);}
  if(defect==='missing-selected')set('helpSelected','help-task',null);
  if(defect==='duplicate-selected'){
   for(const offer of [first,second]){offer.status='selected';offer.revision=1;offer.updatedById=offer.accountableMemberId;offer.reason='Conflicting selection';offer.externalActivityUnverified=false;offer.eventId='corrupt-selection-'+offer.id;set('helpOffer',offer.id,offer);}set('helpSelected','help-task',first.id);
  }
  if(defect==='task-revision'){const work=get('helpWork','help-task');work.revision++;set('helpWork',work.id,work);}
  if(defect==='accountable-permission'){const person=get('helpMember','owner');person.permissions=[];set('helpMember',person.id,person);}
  if(defect==='checkpoint-scope'){const work=get('helpCpWork','help-task');work.helpWanted.scope='Changed retained checkpoint scope';set('helpCpWork',work.id,work);}
  if(defect==='current-member-revision'){const person=get('members','worker','actual');person.revision++;set('members',person.id,person,'actual');}
 });
 assert.throws(()=>drive(f,p=>p.stage==='complete',p),/reconciliation|Unavailable|unavailable|Stale|Invalid|accountable|Offer|Target phase not reached/);
});

test('offer and derived indices save atomically; interrupted save leaves prior cursor and all scratch exact',async t=>{
 const f=await fixture(t),seq=sequence(f,'work.help_offer_opened','first-offer'),p=drive(f,p=>p.stage==='events'&&p.sequence===seq-1),before=f.store.db.prepare('SELECT * FROM current_restore_audit_scratch ORDER BY rowid').all(),prepare=f.store.db.prepare.bind(f.store.db);let fired=false;
 f.store.db.prepare=sql=>{const statement=prepare(sql),run=statement.run.bind(statement);if(sql.startsWith('INSERT INTO current_restore_audit_scratch'))statement.run=(...args)=>{const result=run(...args);if(args[3]==='helpOffer'){fired=true;throw Error('help offer save interrupted');}return result;};return statement;};
 try{assert.throws(()=>f.step(p,{maxUnits:1}),/help offer save interrupted/);}finally{f.store.db.prepare=prepare;}
 assert.equal(fired,true);assert.deepEqual(f.store.db.prepare('SELECT * FROM current_restore_audit_scratch ORDER BY rowid').all(),before);assert.equal(p.sequence,seq-1);assert.equal(drive(f,p=>p.stage==='complete',p).offers,2);
});
