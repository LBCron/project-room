import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const repo='/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-mcp-qa2-adapter-1102',pin='a599faa29ff65567e5c080609cb2d000acd33666',git='/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git';
assert.equal(execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
const load=p=>import(pathToFileURL(repo+'/'+p));const [{RoomStore},{initialRoom},{createRoomServer},{event},{auditRecovery}]=await Promise.all(['server/store.mjs','server/bootstrap.mjs','server/http.mjs','src/events.js','server/recovery.mjs'].map(load));
const s=new RoomStore(':memory:'),server=createRoomServer({store:s});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,cases=[];let serial=0;
const tables=['rooms','events','commands','work_entities','work_claims','current_room_records','current_room_record_proofs','current_room_head','operator_actions','work_claim_config'];
const snapshot=()=>createHash('sha256').update(JSON.stringify(Object.fromEntries(tables.map(t=>[t,s.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()])))).digest('hex');
async function call(room,key,path,body){const r=await fetch(origin+'/api/rooms/'+room+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
const input=(type,data,id)=>({id:id??'http-'+(++serial),type,data});
const send=(room,key,type,data,id)=>call(room,key,'/commands',input(type,data,id));
async function refusal(label,fn,status,code){const before=snapshot(),r=await fn();assert.equal(r.status,status,label+': '+r.body.error?.code);assert.equal(r.body.error?.code,code,label);assert.equal(snapshot(),before,label+' changed authoritative state');cases.push({label,status,code,authoritativeTablesUnchanged:true});return r;}
function setup(room){const seed=initialRoom(room);for(const id of ['worker','other','chat'])seed.push(event({roomId:room,actorId:'owner',type:'member.added',data:{memberId:id,displayName:id,kind:'agent',permissions:id==='chat'?[]:['accept_work','complete_work','write_external']}}));s.initialize(seed,{representation:'normalized-current-v1'});return Object.fromEntries(['owner','worker','other','chat'].map(id=>[id,s.issueAccessKey(room,id)]));}
try{
 for(const [room,kind] of [['capacity-board','board'],['capacity-member','member']]){
  const keys=setup(room),defaults=await call(room,keys.owner,'/work-claims/config');assert.equal(defaults.status,200);assert.equal(defaults.body.maxOpenClaims,1000);assert.equal(defaults.body.maxMemberOpenClaims,20);
  await refusal(kind+' non-owner config',()=>call(room,keys.worker,'/work-claims/config',{maxOpenClaims:1}),403,'work_claims_not_permitted');
  const patch=kind==='board'?{maxOpenClaims:2}:{maxOpenClaims:10,maxMemberOpenClaims:2};const configured=await call(room,keys.owner,'/work-claims/config',patch);assert.equal(configured.status,200);for(const [k,v]of Object.entries(patch))assert.equal(configured.body[k],v);
  for(const id of ['a','b','c']){const proposed=await send(room,keys.owner,'work.proposed',{workItemId:id,title:'Synthetic '+id,definitionOfDone:'Saved result',mode:'write',accountableMemberId:'worker'});assert.ok(proposed.status<300,'propose '+proposed.body.error?.code);}
  for(const id of ['a','b']){const accepted=await send(room,keys.worker,'work.accepted',{workItemId:id,expectedRevision:0});assert.ok(accepted.status<300,'accept '+accepted.body.error?.code);}
  if(kind==='board'){
   const data={workItemId:'c',expectedRevision:0};await refusal('third acceptance at room cap2',()=>send(room,keys.worker,'work.accepted',data,'room-cap-retry'),409,'work_board_full');
   assert.equal((await call(room,keys.owner,'/work-claims/config',{maxOpenClaims:3})).status,200);
   const accepted=await send(room,keys.worker,'work.accepted',data,'room-cap-retry');assert.ok(accepted.status<300);const before=snapshot();const retry=await send(room,keys.worker,'work.accepted',data,'room-cap-retry');assert.ok(retry.status<300);assert.equal(retry.body.duplicate,true);assert.equal(snapshot(),before);cases.push({label:'owner raises cap; same refused ID succeeds then exact retry adds no write',passed:true});
  }else{
   assert.ok((await send(room,keys.worker,'work.accepted',{workItemId:'c',expectedRevision:0})).status<300);
   const scope=id=>({workItemId:id,expectedRevision:1,repository:'synthetic/project',ref:'main',paths:[id+'.txt'],expiresAt:new Date(Date.now()+3600000).toISOString()});
   for(const id of ['a','b'])assert.ok((await send(room,keys.worker,'claim.acquired',scope(id))).status<300);
   await refusal('third acquisition at member cap2',()=>send(room,keys.worker,'claim.acquired',scope('c')),409,'too_many_open_claims');
   await refusal('other member releases holder claim',()=>send(room,keys.other,'claim.released',{workItemId:'a',expectedRevision:2}),422,'command_rejected');
   await refusal('chat profile releases holder claim',()=>send(room,keys.chat,'claim.released',{workItemId:'a',expectedRevision:2}),403,'work_claims_not_permitted');
   for(const [label,expiresAt]of [['past',new Date(Date.now()-1000).toISOString()],['null',null],['malformed','invalid-expiry']])await refusal('holder renewal '+label+' expiry',()=>send(room,keys.worker,'claim.renewed',{workItemId:'a',expectedRevision:2,expiresAt}),422,'command_rejected');
   assert.ok((await send(room,keys.worker,'claim.released',{workItemId:'a',expectedRevision:2})).status<300);
   assert.ok((await send(room,keys.worker,'claim.acquired',scope('c'))).status<300);cases.push({label:'holder release frees one member slot; refused work can acquire',passed:true});
  }
 }
 assert.equal(s.db.prepare('SELECT count(*) n FROM work_claims').get().n,0);auditRecovery(s);
 const result={source:pin,node:process.version,cases,defaults:{maxOpenClaims:1000,maxMemberOpenClaims:20},boundaryCapsAreExplicitSyntheticOwnerConfiguration:true,noLegacyMirrorRows:true,finalRecoveryAudit:true,refusalSnapshotTables:tables,scope:'Disposable local Node HTTP canonical work acceptance/acquisition boundaries with small explicit caps; not full QA2 legacy guard suite, default-limit scale, Native, hosted or peer-device execution proof.'};writeFileSync(fileURLToPath(new URL('./canonical-work-capacity-http-receipt.json',import.meta.url)),JSON.stringify(result,null,2)+'\n');console.log('CANONICAL_WORK_CAPACITY_HTTP '+JSON.stringify(result));
}finally{server.closeStreams();server.closeAllConnections();await new Promise(r=>server.close(r));s.close();}
execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
