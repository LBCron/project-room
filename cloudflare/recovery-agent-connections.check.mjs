import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
test('actual Native populated managed-connection historical verifier baseline',{timeout:120000},async t=>{
 const script=(await build({entryPoints:[fileURLToPath(new URL('./recovery-agent-connections.test-fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']})).outputFiles[0].text,operator='synthetic-managed-recovery-only-0123456789',receipts=[];
 for(const [events,rotations] of [[128,1],[128,16],[512,1],[512,16]]){
  const directory=await mkdtemp(join(tmpdir(),'managed-recovery-baseline-'));
  const create=()=>new Miniflare({modules:true,script,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:directory,durableObjects:{ROOM:{className:'RecoveryAgentConnectionsRoom',useSQLite:true}},bindings:{ROOM_ORIGIN:'https://room.example',ROOM_OPERATOR_TOKEN_SHA256:createHash('sha256').update(operator).digest('hex')},serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});let mf=create();
  const call=path=>mf.dispatchFetch('https://room.example'+path),post=(path,data)=>mf.dispatchFetch('https://room.example'+path,{method:'POST',headers:{Authorization:'Operator '+operator,Origin:'https://room.example','Content-Type':'application/json'},body:JSON.stringify(data)});
  try{
   const seeded=await post('/__managed-seed',{events,rotations});assert.equal(seeded.status,200,await seeded.clone().text());const facts=await seeded.json(),selection={roomId:'commons',discardLegacyAssignments:true},plan=await(await post('/api/operator/normalization/plan',selection)).json(),adopted=await post('/api/operator/normalization/execute',{...selection,planHash:plan.planHash,requestId:'baseline-adopt',reason:'Synthetic managed history measurement'});assert.equal(adopted.status,200,await adopted.clone().text());
   const response=await call('/__managed-verify');assert.equal(response.status,200,await response.clone().text());const warm=await response.json();assert.equal(warm.verified,true);assert.equal(warm.cost.unknown,0);assert.ok(warm.cost.prefixQueries>=rotations);assert.ok(warm.cost.prefixRows>=events*rotations);
   await mf.dispose();mf=create();const coldResponse=await call('/__managed-verify');assert.equal(coldResponse.status,200,await coldResponse.clone().text());const cold=await coldResponse.json();assert.equal(cold.verified,true);assert.equal(cold.cost.unknown,0);receipts.push({input:{events,rotations},facts,warm,cold});
  }finally{await mf.dispose();await rm(directory,{recursive:true,force:true});}
 }
 t.diagnostic('MANAGED_CONNECTION_RECOVERY_BASELINE '+JSON.stringify({source:'bb429d29c2839c5df788d15473eb19a5241ed6a8',actualNative:true,seedAndAdoptionExcluded:true,adapterObserved:true,rawNativeUnobserved:true,wholeRecoveryBounded:false,receipts}));
});
