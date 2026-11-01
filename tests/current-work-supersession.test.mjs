import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {prepareSupersession} from './helpers/current-work-supersession.mjs';
import {auditRecovery} from '../server/recovery.mjs';
import {textVersion} from '../server/text-results.mjs';
const rows=s=>Object.fromEntries(['events','commands','work_entities','current_room_records','current_room_record_proofs','operator_actions'].map(t=>[t,s.db.prepare('SELECT * FROM '+t).all()]));
function setup(t,options){const s=new RoomStore(':memory:');t.after(()=>s.close());const f=prepareSupersession(s,options);s.room=()=>{throw Error('full room hydration');};s.workClaims.set=()=>{throw Error('legacy mirror');};return{s,...f};}
test('authorized supersession retains departed contract/claim ancestry and lets a different agent finish independently reviewed work',t=>{
 const{s,keys,item,cmd,command}=setup(t),old=item('original'),replacement=item('successor'),request=command();
 const result=s.command(keys.owner,'commons',request);
 const after=item('original');assert.equal(after.state,'superseded');assert.equal(after.supersededBy,'successor');assert.equal(after.accountableMemberId,'departed');assert.equal(after.claim.holderId,'departed');assert.equal(after.claim.status,'superseded');assert.equal(after.handoff.doneSummary,old.handoff.doneSummary);assert.equal(after.handoff.open,false);assert.deepEqual(item('successor'),replacement);
 const before=rows(s);assert.equal(s.command(keys.owner,'commons',request).duplicate,true);assert.deepEqual(rows(s),before);
 cmd('replacement','accept','work.accepted',{workItemId:'successor',expectedRevision:0});cmd('replacement','start','work.started',{workItemId:'successor',expectedRevision:1});
 const body='Replacement useful result',post=cmd('replacement','result','message.posted',{messageId:'result',body,workItemId:'successor'}),version=textVersion(body);
 const completion=cmd('replacement','complete','work.completed',{workItemId:'successor',expectedRevision:2,evidenceKind:'room_text',evidenceMessageId:'result',evidenceMessageEventId:post.event.id,evidenceVersion:version,previousCompletionEventId:null,producerId:'replacement',summary:'Useful result saved',nextAction:'Independent review'});
 assert.equal(item('successor').verification,null);assert.equal(item('successor').decision,null);
 assert.throws(()=>cmd('replacement','self-verify','verification.recorded',{workItemId:'successor',expectedRevision:3,result:'pass',completionEventId:completion.event.id,evidenceVersion:version,summary:'Self check'}),/verifier|independent|verify/i);
 cmd('verifier','verify','verification.recorded',{workItemId:'successor',expectedRevision:3,result:'pass',completionEventId:completion.event.id,evidenceVersion:version,summary:'Exact result checked'});
 cmd('owner','rationale','message.posted',{messageId:'rationale',body:'Independent result reviewed'});
 cmd('owner','approve','owner.decision_recorded',{workItemId:'successor',expectedRevision:4,decision:'approved',completionEventId:completion.event.id,evidenceVersion:version,reason:'Approved useful replacement result',sourceMessageId:'rationale'});
 assert.equal(item('successor').decision.decision,'approved');assert.equal(item('original').claim.holderId,'departed');assert.equal(result.event.actorId,'owner');assert.doesNotThrow(()=>auditRecovery(s));
});
test('supersession does not grant authority, accept stale source revision, or lose completed historical receipt',t=>{
 const{s,keys,item,command}=setup(t,{completed:true}),request=command(),before=rows(s),receipt=item('original').receipt;
 assert.throws(()=>s.command(keys.other,'commons',request),/steer/);assert.deepEqual(rows(s),before);
 assert.throws(()=>s.command(keys.owner,'commons',{...request,data:{...request.data,expectedRevision:0}}),/revision/i);assert.deepEqual(rows(s),before);
 s.command(keys.owner,'commons',request);assert.deepEqual(item('original').receipt,receipt);assert.equal(item('original').accountableMemberId,'departed');
});
