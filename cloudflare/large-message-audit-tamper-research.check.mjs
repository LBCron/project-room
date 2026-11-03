// Research-only regression for issue #5759; run against clean and candidate code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('large audit survives restart and rejects corrupted body', {timeout:60000}, async t => {
  const script = (await build({entryPoints:[new URL('./large-message-audit-tamper-research.test-fixture.mjs', import.meta.url).pathname], bundle:true, write:false, format:'esm', platform:'neutral', external:['node:*','cloudflare:*']})).outputFiles[0].text;
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
  let audit=await mf.dispatchFetch('http://localhost/audit-after');assert.equal(audit.status,200,await audit.text());
  await mf.dispose();mf=create();audit=await mf.dispatchFetch('http://localhost/audit-after');assert.equal(audit.status,200,await audit.text());
  const tamper=await mf.dispatchFetch('http://localhost/tamper-large');assert.equal(tamper.status,200,await tamper.text());
  audit=await mf.dispatchFetch('http://localhost/audit-after');assert.equal(audit.status,500,'corrupted audit must fail');

});
