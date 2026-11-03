// Research-only regression for issue #5759; run against clean and candidate code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('measure full proof byte amplification on Worker', {timeout:60000}, async t => {
  const script = (await build({entryPoints:[new URL('./full-proof-accounting-research.test-fixture.mjs', import.meta.url).pathname], bundle:true, write:false, format:'esm', platform:'neutral', external:['node:*','cloudflare:*']})).outputFiles[0].text;
  const dir = await mkdtemp(join(tmpdir(),'large-reply-contract-'));
  const create = () => new Miniflare({script, modules:true, compatibilityDate:'2026-07-30', compatibilityFlags:['nodejs_compat'], durableObjectsPersist:dir, durableObjects:{ROOM:{className:'PrivateLargeRoom',useSQLite:true}}});
  let mf = create();
  t.after(async () => { await mf.dispose(); await rm(dir,{recursive:true,force:true}); });
  const seed = await mf.dispatchFetch('http://localhost/seed-private');
  assert.equal(seed.status, 200);
  const keys = await seed.json();
  const headers = {host:'localhost',authorization:'Bearer '+keys.owner,'content-type':'application/json'};
  const commands = 'http://localhost/api/rooms/commons/commands';
  const measure=await mf.dispatchFetch('http://localhost/measure-large');const data=await measure.json();assert.equal(measure.status,200,JSON.stringify(data));assert.equal(data.length,65536);assert.equal(data.stats.sourceBytes,data.stats.blobBytes);assert.ok(data.stats.blobReads>0);t.diagnostic('cjk '+JSON.stringify(data.stats));
  const post=await mf.dispatchFetch(commands,{method:'POST',headers,body:JSON.stringify({id:'post-control-large',type:'message.posted',data:{messageId:'control-large',body:'\u0001'.repeat(65536)}})});assert.equal(post.status,201,await post.text());
  const control=await mf.dispatchFetch('http://localhost/measure-control'),controlData=await control.json();assert.equal(control.status,200,JSON.stringify(controlData));assert.equal(controlData.length,65536);assert.equal(controlData.stats.sourceBytes,controlData.stats.blobBytes);t.diagnostic('control '+JSON.stringify(controlData.stats));

});
