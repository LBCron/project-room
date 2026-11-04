import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';

test('Native integration and delegation doors remain off without feature configuration',async()=>{
 const script=(await build({entryPoints:[fileURLToPath(new URL('./http-worker.test-fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']})).outputFiles[0].text;
 const mf=new Miniflare({modules:true,script,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{ROOM:{className:'HttpTestRoom',useSQLite:true}},bindings:{ROOM_ORIGIN:'https://room.example'},serviceBindings:{ASSETS:async()=>new Response(null,{status:404})}});
 try{
  const seeded=await mf.dispatchFetch('https://room.example/__test-provision');assert.equal(seeded.status,200);const {ownerKey}=await seeded.json();
  const get=()=>mf.dispatchFetch('https://room.example/api/rooms/commons?messages=recent',{headers:{Authorization:`Bearer ${ownerKey}`}});
  const before=await (await get()).json();
  for(const [path,data] of [['inbound-hooks',{target:'owner'}],['automations',{template:'post-deploy-check'}],['work-claims/absent/delegate',{delegate:null}],['work-claims/absent/approval',{action:'request',approver:'owner',step:'Synthetic'}]]){
   const response=await mf.dispatchFetch('https://room.example/api/rooms/commons/'+path,{method:'POST',headers:{Authorization:`Bearer ${ownerKey}`,'Content-Type':'application/json'},body:JSON.stringify(data)});
   assert.equal(response.status,404,`${path}: ${await response.text()}`);
  }
  const after=await (await get()).json();assert.equal(after.sequence,before.sequence);
 }finally{await mf.dispose();}
});
