import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
const [repo,pin,mode]=process.argv.slice(2);assert.ok(repo&&/^[a-f0-9]{40}$/.test(pin)&&(!mode||mode==='--assert-fixed'));
const git='/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git';assert.equal(execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
const load=p=>import(pathToFileURL(repo+'/'+p));const [{RoomStore},{initialRoom},{createRoomServer}]=await Promise.all(['server/store.mjs','server/bootstrap.mjs','server/http.mjs'].map(load));
const store=new RoomStore(':memory:'),server=createRoomServer({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const observations=[];
try{
 for(const normalized of [false,true]){
  const roomId=normalized?'charter-normalized':'charter-legacy';store.initialize(initialRoom(roomId),normalized?{representation:'normalized-current-v1'}:{});const key=store.issueAccessKey(roomId,'owner');
  const get=async(path,authed=true)=>{const r=await fetch(origin+'/api/rooms/'+roomId+path,{headers:authed?{Authorization:'Bearer '+key}:{}});return {status:r.status,body:await r.json()};};
  const initial=await get('/charter');const update=store.command(key,roomId,{id:'set-instructions',type:'room.charter_updated',data:{expectedRevision:0,purpose:'Synthetic charter acceptance marker',outputs:'Save evidence',boundaries:null,escalation:'Ask owner'}});assert.equal(update.event.type,'room.charter_updated');
  const before=store.headSequence(roomId),current=await get('/charter'),historical=await get('/charter?revision=0'),pack=await get('/activation-pack'),unauthenticated=await get('/charter',false);assert.equal(unauthenticated.status,401);assert.equal(store.headSequence(roomId),before);
  const row={representation:normalized?'normalized-current-v1':'legacy',initialReadStatus:initial.status,initialReason:initial.body.error?.code??null,updateSucceeded:true,currentReadStatus:current.status,currentReadReason:current.body.error?.code??null,historicalReadStatus:historical.status,historicalReadReason:historical.body.error?.code??null,activationPackStatus:pack.status,activationPackHasInstructions:JSON.stringify(pack.body).includes('Synthetic charter acceptance marker'),unauthenticatedStatus:unauthenticated.status,readsAddNoEvents:true};
  if(!normalized){assert.equal(initial.status,200);assert.equal(current.status,200);assert.equal(current.body.revision,1);assert.equal(historical.status,200);}
  observations.push(row);
 }
 const result={source:pin,observations,scope:'Disposable real local Node HTTP; no runtime edits, Native, production, peer execution or release qualification.'};writeFileSync(fileURLToPath(new URL('./normalized-charter-read-'+pin.slice(0,8)+'.json',import.meta.url)),JSON.stringify(result,null,2)+'\n');console.log('NORMALIZED_CHARTER_READ '+JSON.stringify(result));
 if(mode==='--assert-fixed'){assert.equal(observations[1].initialReadStatus,200);assert.equal(observations[1].currentReadStatus,200);assert.equal(observations[1].historicalReadStatus,200);}else{assert.equal(observations[1].currentReadReason,'current_room_context_required');assert.equal(observations[1].currentReadStatus,409);}
}finally{server.closeStreams();server.closeAllConnections();await new Promise(r=>server.close(r));store.close();}
execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
