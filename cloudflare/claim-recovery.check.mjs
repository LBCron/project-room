import {RESTORE_AUDIT_VERSION} from '../server/restore-admission.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const credential='synthetic-durable-restore-00000000000000';
test('actual Native checkpoint claim global scan resumes cold with exact numeric-first warnings',{timeout:120000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'native-claim-recovery-')),script=(await build({entryPoints:[fileURLToPath(new URL('./claim-recovery.test-fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']})).outputFiles[0].text;
 const create=()=>new Miniflare({modules:true,script,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:directory,durableObjects:{ROOM:{className:'ClaimTarget',useSQLite:true},SOURCE:{className:'ClaimSource',useSQLite:true}},bindings:{ROOM_ORIGIN:'https://room.example.test',ROOM_RESTORE_TOKEN:credential},serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});
 // Source and target use different native classes without swapping source bytes.
 let mf=create();
 const call=(surface,path,options={})=>surface==='source'?mf.getDurableObjectNamespace('SOURCE').then(ns=>ns.get(ns.idFromName('source')).fetch('https://room.example.test'+path,options)):mf.dispatchFetch('https://room.example.test'+path,options);
 const json=async(surface,path,status=200,options)=>{const response=await call(surface,path,options),text=await response.text();assert.equal(response.status,status,surface+path+' '+text);return JSON.parse(text);};
 try{
  const seeded=await json('source','/__seed'),backup=await call('source','/__export');assert.equal(backup.status,200);const text=await backup.text();await json('target','/__partial',200,{method:'POST',body:text});await mf.dispose();mf=create();await json('target','/api/ready',503);
  let result=await json('target','/api/operator/restore?resume=1',202,{method:'POST',headers:{Authorization:'Bearer '+credential},body:text}),steps=0,scans=0,compared=false,sawCheckpoint=false;
  while(result.pending){const input={restoreId:result.restoreId,sourceSeal:result.sourceSeal,expectedRevision:result.revision,requestId:'claim_native_'+steps},status=result.auditProgress?.stage==='full_audit_pending'?200:202;
   const next=await json('target','/api/operator/restore',status,{method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:JSON.stringify(input)});assert.deepEqual(await json('target','/api/operator/restore',status,{method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:JSON.stringify(input)}),next);result=next;steps++;assert.ok(steps<350);
   const replay=result.auditProgress?.replay?.cursor;if(replay?.checkpoint)sawCheckpoint=true;if(replay?.expansion)scans++;
   if(!compared&&replay?.stage==='complete'){const folded=await json('target','/__folded');assert.deepEqual(folded.claim.overlaps.map(item=>item.workItemId),seeded.expected);compared=true;}
   if(result.pending)await json('target','/api/ready',503);if(steps%5===0){await mf.dispose();mf=create();}
  }
  assert.equal(sawCheckpoint,true);assert.ok(scans>1);assert.equal(compared,true);assert.equal(result.verified,true);assert.equal(result.replayContinuation.deferred,0);assert.equal(result.replayContinuation.originalFullOracleRequired,true);await mf.dispose();mf=create();await json('target','/api/ready');
  console.log('CLAIM_RECOVERY_NATIVE '+JSON.stringify({protocol:RESTORE_AUDIT_VERSION,sourcePrefix:seeded.prefix,tailEvents:1,workItems:seeded.workItems,steps,scans,checkpointSeed:true,coldResume:true,independentFoldExact:true,originalFullOracleRequired:true,wholeRecoveryBounded:false}));
 }finally{await mf.dispose();await rm(directory,{recursive:true,force:true});}
});
