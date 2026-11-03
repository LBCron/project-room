// Research-only regression for issue #5759; run against clean and candidate code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('reply rejects tampered ancestry with an unchanged witness', {timeout:60000}, async t => {
  const script = (await build({entryPoints:[new URL('./ancestry-tamper-research.test-fixture.mjs', import.meta.url).pathname], bundle:true, write:false, format:'esm', platform:'neutral', external:['node:*','cloudflare:*']})).outputFiles[0].text;
  const dir = await mkdtemp(join(tmpdir(),'large-reply-contract-'));
  const create = () => new Miniflare({script, modules:true, compatibilityDate:'2026-07-30', compatibilityFlags:['nodejs_compat'], durableObjectsPersist:dir, durableObjects:{ROOM:{className:'PrivateLargeRoom',useSQLite:true}}});
  let mf = create();
  t.after(async () => { await mf.dispose(); await rm(dir,{recursive:true,force:true}); });
  const seed = await mf.dispatchFetch('http://localhost/seed-private');
  assert.equal(seed.status, 200);
  const keys = await seed.json();
  const headers = {host:'localhost',authorization:'Bearer '+keys.owner,'content-type':'application/json'};
  const commands = 'http://localhost/api/rooms/commons/commands';
  const post=await mf.dispatchFetch(commands,{method:'POST',headers,body:JSON.stringify({id:'post-root',type:'message.posted',data:{messageId:'root',body:'root message'}})});
  assert.equal(post.status,201);
  const control=await mf.dispatchFetch(commands,{method:'POST',headers,body:JSON.stringify({id:'control-reply-unique',type:'message.posted',data:{messageId:'control-reply-unique',body:'control',replyToId:'root'}})});assert.equal(control.status,201,await control.text());
  const tamper=await mf.dispatchFetch('http://localhost/tamper-ancestry');assert.equal(tamper.status,200,await tamper.text());
  await mf.dispose();mf=create();
  const reply=await mf.dispatchFetch(commands,{method:'POST',headers,body:JSON.stringify({id:'ancestry-tamper-reply-unique',type:'message.posted',data:{messageId:'ancestry-tamper-reply-unique',body:'short',replyToId:'root'}})});
  const text=await reply.text();assert.equal(reply.status,500,text);assert.equal(JSON.parse(text).error.code,'internal_error');const check=await mf.dispatchFetch('http://localhost/check-forged-reply');assert.equal((await check.json()).count,0,'rejected reply is not stored');

});
