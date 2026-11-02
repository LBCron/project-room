// CI admission case for the package's default Native runtime. The separate
// normalization-scale.check.mjs retains its original optional 7 MB stress case.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('default Native compact 50k-event normalization preserves flat warm post work', {timeout:240000},async()=>{
 const built=await build({entryPoints:[fileURLToPath(new URL('./normalization-scale.test-fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']});
 const dir=await mkdtemp(join(tmpdir(),'normalization-compact-scale-'));
 const create=()=>new Miniflare({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:dir,durableObjects:{ROOM:{className:'NormalizationScaleRoom',useSQLite:true}}});
 let mf=create();
 const call=async(path,body)=>{
  console.log('HOST_PHASE '+path);
  const started=performance.now();
  const response=await mf.dispatchFetch('http://localhost'+path,body?{method:'POST',body:JSON.stringify(body)}:{}),result=await response.json();
  console.log('NORMALIZATION_SAMPLE '+JSON.stringify({path,status:response.status,observedHostWallMs:performance.now()-started,...result}));
  assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.cost.unknown,0);
  return result;
 };
 try{
  const small=await call('/seed?surface=small&fixture=compact');
  assert.equal(small.result.events,1000);assert.equal(small.result.posts,100);
  const smallPlan=await call('/plan?surface=small');
  await call('/execute?surface=small',{roomId:'commons',discardLegacyAssignments:true,planHash:smallPlan.result.planHash,requestId:'native-small-adopt',reason:'Synthetic matched small serving control'});
  await call('/post?surface=small&id=one');
  const smallPost=await call('/post?surface=small&id=two');
  const seed=await call('/seed?fixture=compact');
  assert.equal(seed.result.fixture,'compact');assert.equal(seed.result.members,1);
  assert.equal(seed.result.events,50000);assert.equal(seed.result.eventCount,50000);assert.equal(seed.result.posts,5000);
  assert.ok(seed.result.projectionBytes>500000&&seed.result.projectionBytes<2000000,JSON.stringify(seed.result));
  const plan=await call('/plan');
  const input={roomId:'commons',discardLegacyAssignments:true,planHash:plan.result.planHash,requestId:'native-scale-adopt',reason:'Synthetic compact 50k-event activation qualification'};
  const adopted=await call('/execute',input);assert.ok(adopted.result.projectionBytes<512);
  await mf.dispose();mf=create();
  const duplicate=await call('/execute',input);assert.equal(duplicate.result.duplicate,true);assert.equal(duplicate.result.sequence,adopted.result.sequence);
  await mf.dispose();mf=create();
  const first=await call('/post?id=one'),second=await call('/post?id=two');
  assert.equal(first.cost.rowsWritten,second.cost.rowsWritten);
  assert.equal(second.cost.rowsWritten,smallPost.cost.rowsWritten);
  assert.equal(second.cost.statements,smallPost.cost.statements);
  assert.ok(second.cost.rowsRead<=smallPost.cost.rowsRead+32);
  assert.ok(second.cost.materializedBytes<=smallPost.cost.materializedBytes+2048);
  await mf.dispose();mf=create();
  const retry=await call('/post?id=one');assert.equal(retry.result.duplicate,true);assert.equal(retry.result.sequence,first.result.sequence);
  assert.equal(retry.cost.rowsWritten,2,'cold exact post retry only flips the existing native runtime permit');
  const read=await call('/read');assert.equal(read.result.messages[0].body,'Useful normalized result');
  const state=await call('/state');assert.ok(state.result.projectionBytes<512);
  assert.equal(state.result.events,50002);assert.equal(state.result.messages,5002);
 }finally{await mf.dispose();await rm(dir,{recursive:true,force:true});}
});
