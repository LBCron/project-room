// Research-only regression for issue #5759; run against clean and candidate code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('outsider cannot reply to a large private message', {timeout:60000}, async t => {
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
  const outsider={...headers,authorization:'Bearer '+keys.other};
  const response=await mf.dispatchFetch(commands,{method:'POST',headers:outsider,body:JSON.stringify({id:'outsider-reply-check',type:'message.posted',data:{messageId:'outsider-reply-check',body:'hello',replyToId:'large-private'}})});
  const result=await response.text();assert.equal(response.status,422,result);assert.doesNotMatch(result,/界/);
  const missing=await mf.dispatchFetch(commands,{method:'POST',headers:outsider,body:JSON.stringify({id:'missing-reply-check',type:'message.posted',data:{messageId:'missing-reply-check',body:'hello',replyToId:'nonexistent-target'}})});const missingText=await missing.text();assert.equal(missing.status,response.status);assert.equal(JSON.parse(missingText).error.message,JSON.parse(result).error.message);
  const allowed=await mf.dispatchFetch(commands,{method:'POST',headers,body:JSON.stringify({id:'owner-reply-check',type:'message.posted',data:{messageId:'owner-reply-check',body:'hello',replyToId:'large-private'}})});assert.equal(allowed.status,201,await allowed.text());
  const read=await mf.dispatchFetch('http://localhost/api/rooms/commons/conversation?messageId=large-private',{headers:outsider});assert.equal(read.status,404);const replyRead=await mf.dispatchFetch('http://localhost/api/rooms/commons/conversation?messageId=owner-reply-check',{headers:outsider});assert.equal(replyRead.status,404,'private reply must remain invisible');

});
