import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const token=['synthetic','channel','native','restore','token'].join('-');
test('actual Native journal continuation cold-resumes and consumes exact semantic proof',{timeout:120000},async t=>{
 const directory=await mkdtemp(join(tmpdir(),'native-channel-recovery-'));
 const script=(await build({entryPoints:[new URL('./recovery-channel-updates-native.test-fixture.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']})).outputFiles[0].text;
 const create=()=>new Miniflare({script,modules:true,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:directory,durableObjects:{ROOM:{className:'DurableCoverageRoom',useSQLite:true}},bindings:{ROOM_ORIGIN:'https://room.example.test',ROOM_RESTORE_TOKEN:token},serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});let mf=create();
 const call=(surface,path,options={})=>mf.dispatchFetch('https://room.example.test'+path+(path.includes('?')?'&':'?')+'surface='+surface,{...options,headers:{Host:'room.example.test',...Object.fromEntries(new Headers(options.headers))}});
 const json=async(surface,path,options={})=>{const r=await call(surface,path,options),text=await r.text();return{status:r.status,body:(()=>{try{return JSON.parse(text);}catch{throw Error(text);}})()};};
 const post=body=>json('target','/api/operator/restore',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await json('source','/__channel-seed')).status,200);const exported=await call('source','/__channel-export');assert.equal(exported.status,200);
  let r=await json('target','/api/operator/restore',{method:'POST',headers:{authorization:'Bearer '+token},body:await exported.text()}),n=0,cold=0,compare=null,finalInput=null;
  while(r.status===202&&r.body.pending){assert.ok(n<2500,JSON.stringify(r.body));
   if(r.body.auditProgress?.stage==='channel_updates') {await mf.dispose();mf=create();cold++;}
   if(r.body.auditProgress?.stage==='full_audit_pending'&&r.body.auditProgress.report===null){compare=await json('target','/__channel-compare');assert.equal(compare.status,200,JSON.stringify(compare.body));assert.equal(compare.body.sameReport,true);assert.equal(compare.body.original.journalRows,140);assert.equal(compare.body.consumed.journalRows,70);}
   const input={restoreId:r.body.restoreId,sourceSeal:r.body.sourceSeal,expectedRevision:r.body.revision,requestId:'native-channel-'+n++};
   const before=r;r=await post(input);
   if(before.body.auditProgress?.stage==='channel_updates'){assert.equal(r.status,202,JSON.stringify(r.body));assert.deepEqual(await post(input),r);}
   if(r.body.verified)finalInput=input;
  }
  assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.subsystemContinuation.channelUpdates.consumed,true);assert.ok(compare);assert.ok(cold>=3);assert.deepEqual(await post(finalInput),r);
  let cleanup=r.body.nextCleanup;while(cleanup){const result=await post(cleanup.body);assert.ok([200,202].includes(result.status),JSON.stringify(result.body));cleanup=result.body.nextCleanup;}
  await mf.dispose();mf=create();assert.equal((await json('target','/api/ready')).status,200);
  t.diagnostic(JSON.stringify({actualNative:true,calls:n,coldJournalPages:cold,comparison:compare.body,wholeRecoveryBounded:false,fullOracleStillRequired:true}));
 }finally{await mf.dispose();await rm(directory,{recursive:true,force:true});}
});
