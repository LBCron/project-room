import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
test('actual workerd historical derived repair rolls back audit faults and retains exact receipt across restart and later writes',async()=>{
  const bundle=await build({entryPoints:[fileURLToPath(new URL('./legacy-session-repair.test-fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']});
  const persistence=await mkdtemp(join(tmpdir(),'room-legacy-session-'));
  const worker=()=>new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{ROOM:{className:'LegacySessionRepairRoom',useSQLite:true}},durableObjectsPersist:persistence});
  let mf=worker();
  const call=async(path,input,status=200)=>{const response=await mf.dispatchFetch('http://localhost'+path,input?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}:{});const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;};
  try {
    const {request}=await call('/seed'),before=await call('/state');assert.equal(before.blocks,1);
    const plan=await call('/plan',request),input={...request,planHash:plan.planHash,requestId:'synthetic-restart'};
    await call('/audit-fault');await call('/execute',input,500);
    assert.deepEqual(await call('/state'),before);
    await mf.dispose();mf=worker();
    assert.deepEqual(await call('/state'),before);
    await call('/clear-fault');const completed=await call('/execute',input),after=await call('/state');
    assert.equal(after.blocks,0);assert.equal(after.receipts,1);assert.equal(after.cursor.applied_seq,before.head);assert.equal(after.cursor.parity_at_seq,before.head);
    assert.deepEqual(after.authority,before.authority);
    await mf.dispose();mf=worker();
    assert.deepEqual(await call('/execute',input),{...completed,duplicate:true});
    await call('/append');const appended=await call('/state');assert.equal(appended.head,before.head+1);assert.equal(appended.blocks,0);
    await mf.dispose();mf=worker();
    assert.deepEqual(await call('/execute',input),{...completed,duplicate:true});assert.deepEqual(await call('/state'),appended);
  } finally {await mf.dispose();await rm(persistence,{recursive:true,force:true});}
});
