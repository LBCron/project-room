// Research-only regression for issue #5759; run against clean and candidate code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('a short reply to an accepted large message survives a cold reopen', {timeout:60000}, async t => {
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
  const post = await mf.dispatchFetch(commands,{method:'POST',headers,body:JSON.stringify({id:'post-root',type:'message.posted',data:{messageId:'large-root',body:'界'.repeat(65536)}})});
  assert.equal(post.status,201,'large root is accepted');
  await mf.dispose(); mf = create();
  const reply = await mf.dispatchFetch(commands,{method:'POST',headers,body:JSON.stringify({id:'post-reply',type:'message.posted',data:{messageId:'small-reply',body:'A short reply',replyToId:'large-root'}})});
  const result = await reply.text();
  assert.equal(reply.status,201,`reply should be accepted: ${result}`);
  await mf.dispose(); mf = create();
  const read = await mf.dispatchFetch('http://localhost/api/rooms/commons/conversation?messageId=small-reply',{headers});
  assert.equal(read.status,200,'reply readable after a second restart');
  const value = await read.json();
  assert.equal(value.messages[0].body,'A short reply');
  assert.equal(value.messages[0].replyToId,'large-root');
});
