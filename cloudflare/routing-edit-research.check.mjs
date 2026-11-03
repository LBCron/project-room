// Research-only regression for issue #5759; run against clean and candidate code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('edited messages retain a v2 routing witness', {timeout:60000}, async t => {
  const script = (await build({entryPoints:[new URL('./routing-edit-research.test-fixture.mjs', import.meta.url).pathname], bundle:true, write:false, format:'esm', platform:'neutral', external:['node:*','cloudflare:*']})).outputFiles[0].text;
  const dir = await mkdtemp(join(tmpdir(),'large-reply-contract-'));
  const create = () => new Miniflare({script, modules:true, compatibilityDate:'2026-07-30', compatibilityFlags:['nodejs_compat'], durableObjectsPersist:dir, durableObjects:{ROOM:{className:'PrivateLargeRoom',useSQLite:true}}});
  let mf = create();
  t.after(async () => { await mf.dispose(); await rm(dir,{recursive:true,force:true}); });
  const seed = await mf.dispatchFetch('http://localhost/seed-private');
  assert.equal(seed.status, 200);
  const keys = await seed.json();
  const headers = {host:'localhost',authorization:'Bearer '+keys.owner,'content-type':'application/json'};
  const commands = 'http://localhost/api/rooms/commons/commands';
  const command=async (id,type,data)=>{const r=await mf.dispatchFetch(commands,{method:'POST',headers,body:JSON.stringify({id,type,data})});const text=await r.text();assert.equal(r.status,201,text);};
  await command('post-version-root','message.posted',{messageId:'version-root',body:'x'.repeat(16000)});
  let witness=await (await mf.dispatchFetch('http://localhost/witness-version')).json();assert.equal(witness.version,2);
  await command('edit-version-root','message.edited',{messageId:'version-root',body:'updated',expectedMessageRevision:0});
  witness=await (await mf.dispatchFetch('http://localhost/witness-version')).json();assert.equal(witness.version,2,'edit must retain certified routing');

});
