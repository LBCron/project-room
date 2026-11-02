import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
test('Native pending pages bound first and late equal-time reads, expiry and cold continuation',{timeout:120000},async()=>{
 const script=(await build({entryPoints:[fileURLToPath(new URL('./access-request-pages.test-fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']})).outputFiles[0].text;
 const samples=[];
 for(const count of [25,1000]){
  const dir=await mkdtemp(join(tmpdir(),'access-request-pages-'));
  const create=()=>new Miniflare({modules:true,script,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:dir,durableObjects:{ROOM:{className:'AccessRequestPageRoom',useSQLite:true}},bindings:{ROOM_ORIGIN:'https://room.example'},serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});let mf=create();
  const call=async path=>{const r=await mf.dispatchFetch('https://room.example'+path);assert.equal(r.status,200,await r.clone().text());return r.json();};
  try{
   await call('/seed?count='+count);let first;
   for(const role of ['owner','admin']){await call('/page?role='+role);const p=await call('/page?role='+role);assert.equal(p.status,200);assert.equal(p.ids.length,25);assert.equal(p.cost.rowsWritten,0);assert.equal(p.cost.unknown,0);assert.ok(p.bytes<32768);if(role==='owner')first=p;samples.push({count,role,cost:p.cost,bytes:p.bytes});}
   if(count===1000){const p=await call('/page?unselected=1');assert.equal(p.status,422);assert.ok(p.cost.rowsRead<=first.cost.rowsRead+32);}
   const ids=[],costs=[];let cursor=null,pages=0;
   do{const p=await call('/page'+(cursor?'?cursor='+encodeURIComponent(cursor):''));assert.equal(p.status,200);assert.ok(p.ids.length<=25);assert.equal(p.cost.rowsWritten,0);assert.equal(p.cost.unknown,0);ids.push(...p.ids);costs.push(p.cost.rowsRead);cursor=p.cursor;assert.ok(++pages<=40);}while(cursor);
   assert.equal(ids.length,count);assert.equal(new Set(ids).size,count);assert.ok(costs.at(-1)<=costs[0]+32,'late equal-time pages must seek beyond the visited prefix');samples.push({count,pages,unique:ids.length,firstRows:costs[0],lastRows:costs.at(-1),maxRows:Math.max(...costs)});
   if(count===1000){
    const original=await call('/page');await mf.dispose();mf=create();const stale=await call('/page?cursor='+encodeURIComponent(original.cursor));assert.equal(stale.status,409);assert.equal(stale.error,'stale_access_request_cursor');assert.equal((await call('/page')).status,200);
    await call('/expire');const fresh=await call('/page');assert.equal(fresh.status,200);assert.equal(fresh.ids.length,25);assert.ok(fresh.ids.every(id=>id>='pending-1000'));assert.equal(fresh.cost.rowsWritten,0);assert.ok(fresh.cost.rowsRead<=first.cost.rowsRead+64,'expired backlog must be skipped by the indexed keyset');samples.push({expired:1000,live:27,firstPage:25,cost:fresh.cost});
   }
  }finally{await mf.dispose();await rm(dir,{recursive:true,force:true});}
 }
 assert.ok(Math.abs(samples.find(s=>s.count===1000&&s.role==='owner').cost.rowsRead-samples.find(s=>s.count===25&&s.role==='owner').cost.rowsRead)<=32);
 console.log('ACCESS_REQUEST_PAGE_COST '+JSON.stringify(samples));
});
