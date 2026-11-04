import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {writeFileSync} from 'node:fs';
const fixture=`
import entry,{ProjectRoom} from './room.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {projectPublicWorkReceipt} from '../server/receipts-live.mjs';
export class ReceiptProbe extends ProjectRoom {
 async fetch(request){
  if(new URL(request.url).pathname==='/__fixture/setup'){
   this.store.initialize(initialRoom('commons'));const store=this.store,key=store.issueAccessKey('commons','owner');
   const {state,off}=await request.json(),namespace='public_'+'ef'.repeat(16),sha='cd'.repeat(32),id='pwr_'+'a'.repeat(64),marker='SYNTHETIC-WORKER-5862';
   store.command(key,'commons',{id:'on',type:'room.public_receipts_set',data:{enabled:true}});
   store.db.prepare('INSERT INTO public_work_tasks(offer_id,namespace_key,room_id,terms_version,repository_url,repository_ref,files_json,generation,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run('offer',namespace,'commons',1,'https://example.test/repository','main','[]',1,Date.now());
   const receipt={schema:'public-work-receipt/1',receiptId:id,namespaceId:namespace,identityId:'synthetic-agent',title:marker,createdAt:'2026-10-01T00:00:00.000Z',artifact:{sha256:sha}};
   store.db.prepare('INSERT INTO public_work_receipts VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'offer',namespace,1,'synthetic-agent',marker,sha,4,JSON.stringify(receipt),Date.now());projectPublicWorkReceipt(store,receipt,sha);
   if(state==='mirror-only')store.db.prepare('DELETE FROM public_work_receipts WHERE receipt_id=?').run(id);
   if(state==='source-only')store.db.prepare('DELETE FROM public_receipts WHERE id=?').run(id);
   if(off)store.command(key,'commons',{id:'off',type:'room.public_receipts_set',data:{enabled:false}});
   return Response.json({id,marker,source:store.db.prepare('SELECT count(*) n FROM public_work_receipts').get().n,mirror:store.db.prepare('SELECT count(*) n FROM public_receipts WHERE id=?').get(id).n,setting:store.db.prepare('SELECT enabled FROM room_public_receipts_setting WHERE room_id=?').get('commons')});
  }
  return super.fetch(request);
 }
}
export default entry;`;
const results=[];
for(const [label,resolveDir] of [['baseline','/tmp/pr-5862-baseline-native/cloudflare'],['composed',new URL('.',import.meta.url).pathname]]){
 const script=(await build({stdin:{contents:fixture,resolveDir,sourcefile:'receipt-local-fixture.mjs'},bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']})).outputFiles[0].text;
 for(const [state,off] of [['both',false],['mirror-only',true],['source-only',false]]){
  const mf=new Miniflare({script,modules:true,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{ROOM:{className:'ReceiptProbe',useSQLite:true}},bindings:{ROOM_ORIGIN:'https://room.example.test'}});
  try{
   const response=await mf.dispatchFetch('https://room.example.test/__fixture/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,off})});assert.equal(response.status,200,await response.clone().text());const seed=await response.json(),faces=[];
   for(const path of ['/receipts/'+seed.id,'/receipts/'+seed.id+'.json','/receipts/'+seed.id+'/og.png','/receipts/'+seed.id+'/badge.svg','/api/public-work/receipts/'+seed.id,'/api/public-work/receipts/'+seed.id+'/artifact']){
    const r=await mf.dispatchFetch('https://room.example.test'+path),body=await r.text();faces.push({path:path.replace(seed.id,'ID'),status:r.status,marker:body.includes(seed.marker),preview:r.status>=500?body.slice(0,250):undefined});
   }
   const row={label,state,off,seed,faces};results.push(row);console.log(JSON.stringify(row));
  }finally{await mf.dispose();}
 }
}
writeFileSync('audit/evidence/workerd-5862/results.json',JSON.stringify(results,null,2));
