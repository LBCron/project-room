import {createHash} from 'node:crypto';
// Research-only regression for issue #5759; run against clean and candidate code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('streamed proof preserves UTF-8 across SQLite chunk edges', {timeout:60000}, async t => {
  const script = (await build({entryPoints:[new URL('./full-proof-utf8-research.test-fixture.mjs', import.meta.url).pathname], bundle:true, write:false, format:'esm', platform:'neutral', external:['node:*','cloudflare:*']})).outputFiles[0].text;
  const dir = await mkdtemp(join(tmpdir(),'large-reply-contract-'));
  const create = () => new Miniflare({script, modules:true, compatibilityDate:'2026-07-30', compatibilityFlags:['nodejs_compat'], durableObjectsPersist:dir, durableObjects:{ROOM:{className:'PrivateLargeRoom',useSQLite:true}}});
  let mf = create();
  t.after(async () => { await mf.dispose(); await rm(dir,{recursive:true,force:true}); });
  const seed = await mf.dispatchFetch('http://localhost/seed-private');
  assert.equal(seed.status, 200);
  const keys = await seed.json();
  const headers = {host:'localhost',authorization:'Bearer '+keys.owner,'content-type':'application/json'};
  const commands = 'http://localhost/api/rooms/commons/commands';
  for(let i=0;i<8;i++){
    const body='a'.repeat(16380+i)+'😀界\u0001"\\'+('z'.repeat(100));const id='edge'+i;
    const post=await mf.dispatchFetch(commands,{method:'POST',headers,body:JSON.stringify({id:'post-'+id,type:'message.posted',data:{messageId:id,body}})});assert.equal(post.status,201,await post.text());
    const response=await mf.dispatchFetch('http://localhost/measure-edge?id='+id),data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.equal(data.length,body.length);assert.equal(data.digest,createHash('sha256').update(body).digest('hex'));assert.ok(data.stats.blobReads>2);
  }

});
