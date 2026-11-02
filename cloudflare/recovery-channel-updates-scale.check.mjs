import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {Miniflare} from 'miniflare';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
const token=['synthetic','channel','native','scale','restore'].join('-');
test('actual Native retained legal1k/5k journals compare complete final audit consumption cost',{timeout:120000},async t=>{
 const directory=await mkdtemp(join(tmpdir(),'channel-native-scale-')),script=(await build({entryPoints:[new URL('./recovery-channel-updates-native.test-fixture.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']})).outputFiles[0].text;
 const mf=new Miniflare({script,modules:true,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:directory,durableObjects:{ROOM:{className:'DurableCoverageRoom',useSQLite:true}},bindings:{ROOM_ORIGIN:'https://room.example.test',ROOM_RESTORE_TOKEN:token},serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});
 const call=(surface,path,options={})=>mf.dispatchFetch('https://room.example.test'+path+(path.includes('?')?'&':'?')+'surface='+surface,{...options,headers:{Host:'room.example.test',...Object.fromEntries(new Headers(options.headers))}});
 try {for(const rows of [1000,5000]){
  const source='source-'+rows,target='target-'+rows;assert.equal((await call(source,'/__channel-seed?rows='+rows)).status,200);const exported=await call(source,'/__channel-export');assert.equal(exported.status,200);
  let response=await call(target,'/api/operator/restore',{method:'POST',headers:{authorization:'Bearer '+token},body:await exported.text()}),r=await response.json(),n=0;
  while(r.auditProgress?.stage!=='full_audit_pending'){assert.equal(response.status,202,JSON.stringify(r));assert.ok(n<3000);response=await call(target,'/api/operator/restore',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({restoreId:r.restoreId,sourceSeal:r.sourceSeal,expectedRevision:r.revision,requestId:'scale-'+n++})});r=await response.json();}
  const result=await call(target,'/__channel-compare'),value=await result.json();assert.equal(result.status,200,JSON.stringify(value));assert.equal(value.sameReport,true);assert.equal(value.original.journalRows,2*rows);assert.equal(value.consumed.journalRows,rows);assert.equal(value.original.unknown,0);assert.equal(value.consumed.unknown,0);
  t.diagnostic(JSON.stringify({rows,sourcePendingCap:500,operatorCallsToFinalStage:n+1,comparison:value,wholeRecoveryBounded:false,clockTimingNotCPU:true}));
 }}finally{await mf.dispose();await rm(directory,{recursive:true,force:true});}
});
