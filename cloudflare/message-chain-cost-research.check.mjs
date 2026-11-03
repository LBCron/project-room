// Research-only regression for issue #5759; run against clean and candidate code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('a bounded chain of ordinary messages remains replyable', {timeout:60000}, async t => {
  const script = (await build({entryPoints:[new URL('./large-message-contract-research.test-fixture.mjs', import.meta.url).pathname], bundle:true, write:false, format:'esm', platform:'neutral', external:['node:*','cloudflare:*']})).outputFiles[0].text;
  const dir = await mkdtemp(join(tmpdir(),'large-reply-contract-'));
  const create = () => new Miniflare({script, modules:true, compatibilityDate:'2026-07-30', compatibilityFlags:['nodejs_compat'], durableObjectsPersist:dir, durableObjects:{ROOM:{className:'PrivateLargeRoom',useSQLite:true}}});
  let mf = create();
  t.after(async () => { await mf.dispose(); await rm(dir,{recursive:true,force:true}); });
  const seed = await mf.dispatchFetch('http://localhost/seed-private');
  assert.equal(seed.status, 200);
  const keys = await seed.json();
  const headers = {host:'localhost',authorization:'Bearer '+keys.owner,'content-type':'application/json'};
  const commands = 'http://localhost/api/rooms/commons/commands';
  let parent;
  for (let i=0;i<12;i++) {
    const id = 'chain-'+i;
    const data = {messageId:id,body:i===6 ? 'short reply' : 'x'.repeat(16000),...(parent ? {replyToId:parent} : {})};
    const response = await mf.dispatchFetch(commands,{method:'POST',headers,body:JSON.stringify({id:'post-'+id,type:'message.posted',data})});
    const cost = response.headers.get('X-Fixture-Cost'); const text = await response.text(); console.log(JSON.stringify({depth:i,status:response.status,cost:JSON.parse(cost)}));
    assert.equal(response.status,201,'message '+(i+1)+' with '+i+' ancestors should post: '+text);
    parent=id;
  }
  await mf.dispose(); mf=create();
  const read=await mf.dispatchFetch('http://localhost/api/rooms/commons/conversation?messageId='+parent,{headers});
  assert.equal(read.status,200);

});
