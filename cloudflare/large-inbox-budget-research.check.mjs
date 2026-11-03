import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const source = await readFile(new URL('../server/current-room-repository.mjs', import.meta.url), 'utf8');
const built = await build({entryPoints:[new URL('./large-inbox-budget-research.test-fixture.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*'],plugins:[{name:'research-only',setup(b){b.onLoad({filter:/current-room-repository\.mjs$/},()=>({contents:source,loader:'js'}));}}]});
const mf=new Miniflare({script:built.outputFiles[0].text,modules:true,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{ROOM:{className:'LargeAncestryRoom',useSQLite:true}}});
try {
 const seed=await mf.dispatchFetch('http://localhost/seed?n=12&cert=1');assert.equal(seed.status,200);const keys=await seed.json();
 for(const q of ['', '?limit=1']){
  const r=await mf.dispatchFetch('http://localhost/api/rooms/commons/agent-inbox'+q,{headers:{host:'localhost',authorization:'Bearer '+keys.worker}});const body=await r.json();
  assert.equal(r.status,q?200:409); if(!q)assert.equal(body.error?.code,'current_room_context_unavailable'); else assert.equal(body.older?.hasMore,true);
  console.log(JSON.stringify({selection:q||'default',status:r.status,error:body.error?.code,message:body.error?.message,olderHasMore:body.older?.hasMore}));
 }
} finally {await mf.dispose();}
