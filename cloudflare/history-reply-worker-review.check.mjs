import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {Miniflare} from 'miniflare';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
test('since-join reply admission respects equal-instant ordering after restart',{timeout:60000},async t=>{
 const script=(await build({entryPoints:[new URL('./thread-history-http.test-fixture.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']})).outputFiles[0].text;
 const dir=await mkdtemp(join(tmpdir(),'history-reply-worker-'));const create=()=>new Miniflare({script,modules:true,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:dir,durableObjects:{ROOM:{className:'ThreadHistoryRoom',useSQLite:true}}});let mf=create();t.after(async()=>{await mf.dispose();await rm(dir,{recursive:true,force:true})});
 const keys=await(await mf.dispatchFetch('http://localhost/seed')).json();await mf.dispose();mf=create();
 const headers={host:'localhost',authorization:'Bearer '+keys.late,'content-type':'application/json'};
 const post=async(target,id)=>{const r=await mf.dispatchFetch('http://localhost/api/rooms/commons/commands',{method:'POST',headers,body:JSON.stringify({id,type:'message.posted',data:{messageId:id,body:'reply',replyToId:target}})});return {status:r.status,body:await r.json()}};
 const hidden=await post('tie-before','hidden-reply'),missing=await post('not-present','missing-reply');assert.equal(hidden.status,422);assert.equal(missing.status,422);assert.equal(hidden.body.error.code,missing.body.error.code);assert.equal(hidden.body.error.message,missing.body.error.message);
 assert.equal((await post('tie-after','visible-reply')).status,201);
 assert.equal((await post('offset-after','offset-reply')).status,201);
});
