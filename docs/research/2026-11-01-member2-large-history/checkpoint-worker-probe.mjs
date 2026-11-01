import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require=createRequire(new URL('../../../cloudflare/package.json',import.meta.url));
const {build}=require('esbuild'),{Miniflare}=require('miniflare');
const bundle=await build({entryPoints:[fileURLToPath(new URL('./checkpoint-worker.fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']});
const root=await mkdtemp(join(tmpdir(),'member2-worker-codec-')),results=[];
const worker=directory=>new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{PROBE:{className:'CheckpointProbe',useSQLite:true}},durableObjectsPersist:directory});
const call=async(mf,path)=>{const start=performance.now(),r=await mf.dispatchFetch('https://synthetic.invalid'+path),body=await r.json();return {status:r.status,wallMs:performance.now()-start,body};};
let mf;
try{
 for(const count of [1000,10000,30000]){
  const directory=join(root,String(count));mf=worker(directory);
  const seed=await call(mf,`/seed?count=${count}`);assert.equal(seed.status,200,JSON.stringify(seed));
  await mf.dispose();mf=worker(directory);
  const cold=await call(mf,'/read');assert.equal(cold.status,200,JSON.stringify(cold));assert.equal(cold.body.digest,seed.body.digest);assert.equal(cold.body.count,count);
  const append=await call(mf,'/append');assert.equal(append.status,200,JSON.stringify(append));assert.equal(append.body.count,count+1);
  let corruption=null;
  if(count>1000){await call(mf,'/tamper');await mf.dispose();mf=worker(directory);corruption=await call(mf,'/read');assert.equal(corruption.status,500);assert.match(corruption.body.error.message,/torn/);}
  results.push({count,seed,coldAfterWorkerdRestart:cold,append,corruptionAfterWorkerdRestart:corruption});
  await mf.dispose();mf=null;
 }
}finally{if(mf)await mf.dispose();await rm(root,{recursive:true,force:true});}
const result={sourceRevision:'513d3ee8471464803fd3c70dea2fe9ce30f27ad0',node:process.version,measuredAt:new Date().toISOString(),limitations:['Actual local workerd codec calls and process disposal/restart, not full Room backfill','Wall times include request overhead; not production CPU limits','SQL rowsRead is distinct from payload-byte transfer','Synthetic data only; no deployment or private corpus'],results};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));
