import assert from 'node:assert/strict';
import {fork,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const lab=fileURLToPath(new URL('.',import.meta.url)),repo='/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-mcp-qa2-adapter-1102',pin='a599faa29ff65567e5c080609cb2d000acd33666',runtime='/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies',git=runtime+'/bin/fallback/git';
assert.equal(execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
const dir=await mkdtemp(join(tmpdir(),'canonical-process-crash-')),db=join(dir,'room.sqlite');let worker,endpoint,keys,dropNext=false,observed;
async function boot(seed=false){
 const child=fork(lab+'canonical_crash_worker.mjs',[repo,db,...(seed?['seed']:[])],{cwd:repo,env:{PATH:[runtime+'/node/bin','/usr/bin','/bin'].join(':'),TMPDIR:dir,LANG:'en_US.UTF-8'},stdio:['ignore','ignore','ignore','ipc']});
 const exited=once(child,'exit');worker={child,exited};
 const ready=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker ready timeout')),15000);child.once('message',m=>{clearTimeout(timer);resolve(m);});child.once('exit',()=>{clearTimeout(timer);reject(Error('Worker exited before ready'));});});assert.equal(ready.ready,true);endpoint=ready;if(ready.keys)keys=ready.keys;
}
const facts=async()=>{const r=await fetch(endpoint.controlOrigin+'/facts',{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();};
const proxy=createServer(async(req,res)=>{try{let body='';for await(const chunk of req)body+=chunk;const upstream=await fetch(endpoint.origin+req.url,{method:req.method,headers:{Authorization:req.headers.authorization,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(15000)});const text=await upstream.text();if(dropNext){dropNext=false;observed={status:upstream.status,body:JSON.parse(text),facts:await facts()};worker.child.kill('SIGKILL');const [code,signal]=await worker.exited;assert.equal(signal,'SIGKILL');observed.killedBy=signal;res.destroy();}else{res.writeHead(upstream.status,{'Content-Type':'application/json'});res.end(text);}}catch{res.destroy();}});await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+proxy.address().port;
const request=async command=>{const r=await fetch(origin+'/api/rooms/crash-room/commands',{method:'POST',headers:{Authorization:'Bearer '+keys.worker,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(20000)});return {status:r.status,body:await r.json()};};
const cells=[];
try{
 await boot(true);
 const commands=[{id:'lost-accept',type:'work.accepted',data:{workItemId:'task',expectedRevision:0}},{id:'lost-scope',type:'claim.acquired',data:{workItemId:'task',expectedRevision:1,repository:'synthetic/project',ref:'main',paths:['result.txt'],expiresAt:new Date(Date.now()+3600000).toISOString()}},{id:'lost-message',type:'message.posted',data:{messageId:'saved-result',body:'Synthetic durable result',workItemId:'task'}}];
 for(const command of commands){
  const before=await facts();dropNext=true;let callerLostReply=false;try{await request(command);}catch{callerLostReply=true;}assert.equal(callerLostReply,true,'Caller must lose actual network response');assert.equal(observed.killedBy,'SIGKILL');assert.equal(observed.status,201);assert.equal(observed.body.event.actorId,'worker');assert.equal(observed.facts.head,before.head+1);
  const committed=observed;await boot();const cold=await facts();assert.deepEqual(cold,committed.facts,'Committed canonical rows/proofs must survive actual process kill');const retry=await request(command);assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);assert.equal(retry.body.event.id,committed.body.event.id);assert.deepEqual(await facts(),cold,'Exact retry must add no event/receipt/row/proof');
  cells.push({operation:command.type,callerLostNetworkReply:true,workerExitSignal:committed.killedBy,committedEventSurvivesColdProcess:true,exactRetryReturnsSameEvent:true,exactRetryAddsNoWrite:true});
 }
 const beforeConflict=await facts(),conflict=await request({...commands[2],data:{...commands[2].data,body:'Changed intent'}});assert.equal(conflict.status,409);assert.equal(conflict.body.error.code,'idempotency_conflict');assert.deepEqual(await facts(),beforeConflict);
 const revoke=await fetch(endpoint.controlOrigin+'/revoke',{method:'POST',body:JSON.stringify({token:keys.worker}),signal:AbortSignal.timeout(15000)});assert.equal(revoke.status,200);const beforeAuth=await facts(),revoked=await request(commands[2]);assert.equal(revoked.status,401);assert.equal(revoked.body.error.code,'unauthenticated');assert.deepEqual(await facts(),beforeAuth);
 const result={source:pin,node:process.version,cells,actualSigkillCount:3,serverProcessStarts:4,changedIntentRefused:true,revokedCredentialCannotReplayReceipt:true,refusalsAddNoWrite:true,finalRecoveryAudit:true,tables:Object.keys(beforeAuth.fingerprints),scope:'Actual local Node HTTP+file SQLite with a test proxy withholding entire committed responses before SIGKILL. Not a power/storage failure, Native runtime, hosted deployment or peer-device execution qualification.'};await writeFile(lab+'canonical-process-crash-retry-receipt.json',JSON.stringify(result,null,2)+'\n');console.log('CANONICAL_PROCESS_CRASH_RETRY '+JSON.stringify(result));
}finally{
 if(worker&&worker.child.exitCode===null&&worker.child.signalCode===null){worker.child.kill('SIGTERM');await worker.exited;}
 proxy.closeAllConnections();await new Promise(r=>proxy.close(r));await rm(dir,{recursive:true,force:true});
}
execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
