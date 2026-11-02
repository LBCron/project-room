// Test-only independent post-publication mutations; never patches runtime.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {operatorRestoreResponse} from '../server/restore-ndjson.mjs';
import {readConversation} from '../server/conversation-sync.mjs';
import {messageProofMatches,projectionDigest} from '../server/write-integrity.mjs';
import {auditRecovery} from '../server/recovery.mjs';
import {event} from '../src/events.js';
const token='synthetic-matrix-restore-00000000000000000';
const source=new RoomStore(':memory:');
const cases=[
 ['public-post','message.posted',{messageId:'new',body:'Synthetic public result'}],
 ['thread-reply','message.posted',{messageId:'new',replyToId:'seed',body:'Synthetic reply'}],
 ['private-post','message.posted',{messageId:'new',toMemberId:'peer',body:'Synthetic private result'}],
 ['edit-existing','message.edited',{messageId:'seed',body:'Edited synthetic result',expectedMessageRevision:0}],
 ['delete-existing','message.deleted',{messageId:'seed',expectedMessageRevision:0,reason:'Synthetic deletion'}],
 ['propose-work','work.proposed',{workItemId:'new-work',title:'Synthetic task',definitionOfDone:'Saved result',accountableMemberId:'owner',mode:'read'}],
 ['accept-work','work.accepted',{workItemId:'proposed',expectedRevision:0}],
 ['start-work','work.started',{workItemId:'accepted',expectedRevision:1}],
];
async function post(store,body){
 const response=await operatorRestoreResponse(new Request('https://room.example/api/operator/restore',{method:'POST',headers:{Authorization:'Bearer '+token,...(typeof body==='string'?{}:{'Content-Type':'application/json'})},body:typeof body==='string'?body:JSON.stringify(body)}),token,store);
 return {status:response.status,body:await response.json()};
}
const next=(body,id)=>({restoreId:body.restoreId,sourceSeal:body.sourceSeal,expectedRevision:body.revision,requestId:id});
const errorOf=fn=>{try{fn();return null;}catch(error){return {name:error.name,message:error.message,code:error.code??null,status:error.status??null};}};
function proofs(store){
 const invalidMessageIds=store.db.prepare("SELECT * FROM messages WHERE room_id='commons'").all().filter(row=>!messageProofMatches(row)).map(row=>row.message_id);
 const row=store.db.prepare("SELECT projection FROM rooms WHERE id='commons'").get();
 const proof=store.db.prepare("SELECT metadata_hash FROM integrity_room_state WHERE room_id='commons'").get();
 return {invalidMessageIds,metadataProofMatches:proof?.metadata_hash===projectionDigest(row.projection)};
}
const results=[];
try{
 const seed=initialRoom();seed.push(event({roomId:'commons',actorId:'owner',type:'member.added',data:{memberId:'peer',displayName:'Synthetic peer',kind:'human',permissions:[]}}));
 source.initialize(seed,{representation:'normalized-current-v1'});
 const key=source.issueAccessKey('commons','owner');let n=0;
 const send=(type,data)=>source.command(key,'commons',{id:'seed-'+(++n),type,data});
 send('message.posted',{messageId:'seed',body:'Synthetic original'});
 for(const workItemId of ['proposed','accepted'])send('work.proposed',{workItemId,title:'Synthetic '+workItemId,definitionOfDone:'Saved result',accountableMemberId:'owner',mode:'read'});
 send('work.accepted',{workItemId:'accepted',expectedRevision:0});
 const text=exportNdjsonText(source.db);
 for(const control of [false,true])for(const [name,type,data] of cases){
  const dir=mkdtempSync(join(tmpdir(),'member2-write-matrix-')),filename=join(dir,'target.sqlite');let target=new RoomStore(filename);
  try{
   let result=await post(target,text),steps=0;
   while(result.body.auditProgress?.stage!=='full_audit_pending'){
    assert.equal(result.status,202,JSON.stringify(result));assert.ok(++steps<400);
    result=await post(target,next(result.body,'prepare-'+steps));
   }
   if(!control){target.close();target=new RoomStore(filename,{integrity:'deferred'});assert.equal(target.restoreStatus().pending,true);}
   // Current recovery protocol can continue the independent final audit in
   // several 202 responses. Preserve the pending reopen, never bypass its oracle.
   let published=await post(target,next(result.body,'publish')),publicationSteps=1;
   while(published.status===202){
    assert.ok(++publicationSteps<=2000,'Finite publication continuation budget exceeded');
    published=await post(target,next(published.body,'publish-'+publicationSteps));
   }
   assert.equal(published.status,200,JSON.stringify(published));assert.equal(published.body.verified,true);
   if(control){target.close();target=new RoomStore(filename,{integrity:'deferred'});assert.equal(target.restoreStatus().pending,false);}
   const command={id:'matrix-command',type,data};let mutation=null,retry=null;
   const before=JSON.stringify({proofs:proofs(target),events:target.db.prepare('SELECT count(*) n FROM events').get(),projection:target.db.prepare("SELECT projection FROM rooms WHERE id='commons'").get()});
   const commandError=errorOf(()=>{mutation=target.command(key,'commons',command);});
   const retryError=commandError?null:errorOf(()=>{retry=target.command(key,'commons',command);});
   const warmProofs=proofs(target);
   const refusedWithoutBusinessChange=before===JSON.stringify({proofs:warmProofs,events:target.db.prepare('SELECT count(*) n FROM events').get(),projection:target.db.prepare("SELECT projection FROM rooms WHERE id='commons'").get()});
   const query=name==='private-post'?{peerMemberId:'peer',limit:10}:{channelId:'general',limit:10};
   const warmReadError=errorOf(()=>readConversation(target,key,'commons',query));
   const warmAuditError=errorOf(()=>auditRecovery(target));
   target.close();target=new RoomStore(filename,{integrity:'deferred'});
   const coldReadError=errorOf(()=>readConversation(target,key,'commons',query));
   const coldAuditError=errorOf(()=>auditRecovery(target));
   const expectedUnsupported=['edit-existing'].includes(name);
   const erasedTextAbsent=name!=='delete-existing'||['events','messages','rooms','current_room_records','work_entities'].every(table=>target.db.prepare('SELECT * FROM '+table).all().every(row=>Object.values(row).every(value=>!String(value).includes('Synthetic original'))));
   const report={erasedTextAbsent,mode:control?'cold-after-publication-control':'cold-while-pending',case:name,expectedUnsupported,publicationVerified:true,commandRecorded:Boolean(mutation?.event),commandError,retryDuplicate:retry?.duplicate??false,retryError,refusedWithoutBusinessChange,warmProofs,coldProofs:proofs(target),warmReadError,warmAuditError,coldReadError,coldAuditError};
   report.passed=erasedTextAbsent&&report.commandRecorded&&report.retryDuplicate&&!commandError&&!retryError&&!warmReadError&&!warmAuditError&&!coldReadError&&!coldAuditError&&warmProofs.metadataProofMatches&&warmProofs.invalidMessageIds.length===0;
   report.expectedRefusal=expectedUnsupported&&commandError?.status===409&&commandError?.code==='current_room_context_unavailable'&&refusedWithoutBusinessChange&&!warmReadError&&!coldReadError&&!warmAuditError&&!coldAuditError;
   results.push(report);console.log(JSON.stringify({event:'case',...report}));
  }finally{target.close();rmSync(dir,{recursive:true,force:true});}
 }
 const supported=cases.filter(([name])=>!['edit-existing'].includes(name)).length;
 const summary={event:'summary',cases:results.length,controlPassed:results.filter(r=>r.mode==='cold-after-publication-control'&&r.passed).length,controlTotal:supported,pendingPassed:results.filter(r=>r.mode==='cold-while-pending'&&r.passed).length,pendingTotal:supported,expectedRefusals:results.filter(r=>r.expectedRefusal).length,refusalTotal:2};
 console.log(JSON.stringify(summary));
 assert.equal(summary.controlPassed,supported,'Every supported paired control must pass to validate the fixture');
 assert.equal(summary.expectedRefusals,2,'Unsupported current commands must fail closed without changing business state');
 if(summary.pendingPassed!==supported)process.exitCode=1;
}finally{source.close();}
