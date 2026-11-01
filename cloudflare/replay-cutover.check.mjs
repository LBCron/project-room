import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('actual Worker durable Muse-sized witness progresses across restart with constant source guard cost',async()=>{
  const built=await build({entryPoints:[fileURLToPath(new URL('./replay-cutover.test-fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']});
  const directory=await mkdtemp(join(tmpdir(),'durable-cutover-'));
  const create=()=>new Miniflare({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:directory,durableObjects:{ROOM:{className:'ReplayCutoverRoom',useSQLite:true}}});
  let mf=create();const call=async path=>{const r=await mf.dispatchFetch('http://localhost'+path),body=await r.json();assert.equal(r.status,200,JSON.stringify(body));return body;};
  try{
    const runtime=await call('/runtime');assert.equal(runtime.storage.valueLimitBytes,8388642,'use the qualified October runtime');
    await call('/seed?bytes=2376000');const captured=await call('/durable-capture');
    const baseline=await call('/append-cost?i=90&baseline=1');const before=await call('/append-cost?i=0');await call('/seed-derived?count=17405&generation='+captured.generation);
    const after=await call('/append-cost?i=1');assert.deepEqual(after.eventStatementCosts,before.eventStatementCosts,'derived history must not grow the ordinary append guard');
    let progress={bytes:0};const first=await call(`/durable-step?generation=${captured.generation}&bytes=0&step=0`);progress=first;
    await mf.dispose();mf=create();
    for(let step=1;progress.phase!=='witness_verified'&&step<200;step++){
      progress=await call(`/durable-step?generation=${captured.generation}&bytes=${progress.bytes}&step=${step}`);
      if(step===3)await call('/append-cost?i=2');
    }
    assert.equal(progress.phase,'witness_verified');assert.equal(progress.bytes,2376000);assert.equal(progress.certified,false);assert.equal(progress.head,2);
    const historical=await call(`/durable-step?generation=${captured.generation}&bytes=0&step=0`);
    assert.deepEqual({...historical,duplicate:false},first,'old phase receipt remains historical after later advances');
    const duplicateCapture=await call('/durable-capture');assert.deepEqual({...duplicateCapture,duplicate:false},captured);
    console.log('DURABLE_REPLAY_CAPTURE_WORKER '+JSON.stringify({runtime,head:progress.head,bytes:progress.bytes,phase:progress.phase,certified:false,derivedLeaves:17405,withoutGuard:baseline.eventStatementCosts,guardBefore:before.eventStatementCosts,guardAfter:after.eventStatementCosts,originalStepBytes:historical.bytes}));
  }finally{await mf.dispose();await rm(directory,{recursive:true,force:true});}
});
