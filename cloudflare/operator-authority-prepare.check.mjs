import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
test('actual workerd restart retains bounded targeted preparation, append progress, retry receipt and conversion',async()=>{
  const bundle=await build({entryPoints:[fileURLToPath(new URL('./operator-authority-prepare.test-fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']});
  const persistence=await mkdtemp(join(tmpdir(),'room-authority-prepare-'));
  const worker=()=>new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{ROOM:{className:'AuthorityPrepareRoom',useSQLite:true}},durableObjectsPersist:persistence});
  let mf=worker();
  const call=async(path,input)=>{const response=await mf.dispatchFetch('http://localhost'+path,input?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}:{});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;};
  const request={roomId:'commons',reason:'Persistent bounded prepare qualification'};
  try {
    await call('/seed');const initial=await call('/state');
    assert.equal(initial.cursor,null);
    const plan=await call('/plan',request),input={...request,requestId:'phase-separated-id',planHash:plan.planHash};
    const first=await call('/prepare',input);assert.equal(first.preparation.events,200);assert.equal(first.preparation.caughtUp,false);
    await mf.dispose();mf=worker();
    const reopened=await call('/state');assert.equal(reopened.cursor.state_seq,200);assert.equal(reopened.cursor.applied_seq,0);assert.equal(reopened.otherCursor,null);
    await call('/append');
    const next=await call('/plan',request),second=await call('/prepare',{...request,requestId:'second-step',planHash:next.planHash});
    assert.equal(second.preparation.caughtUp,true);assert.equal(second.preparation.events,103);
    await mf.dispose();mf=worker();
    const retry=await call('/prepare',input);assert.deepEqual(retry,{...first,duplicate:true});
    const prepared=await call('/state');assert.equal(prepared.cursor.applied_seq,303);assert.equal(prepared.messages,301);assert.equal(prepared.otherCursor,null);assert.equal(prepared.prepareReceipts,2);
    const conversion=await call('/plan',request);await call('/execute',{...request,requestId:'phase-separated-id',planHash:conversion.planHash});
    await mf.dispose();mf=worker();
    const final=await call('/state');assert.equal(final.canonical,true);assert.equal(final.messages,301);assert.equal(final.appended,'Appended after first prepare');assert.equal(final.executeReceipts,1);
    console.log('BOUNDED_AUTHORITY_PREPARE_RESTART '+JSON.stringify({first:first.preparation,second:second.preparation,final}));
  } finally {await mf.dispose();await rm(persistence,{recursive:true,force:true});}
});
