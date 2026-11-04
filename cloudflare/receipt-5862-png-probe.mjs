import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Response as MfResponse} from 'miniflare';
const fixture=`
import entry,{ProjectRoom} from './room.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {projectPublicWorkReceipt} from '../server/receipts-live.mjs';
export class ReceiptProbe extends ProjectRoom {
 constructor(ctx,env){console.log(JSON.stringify({fixtureAssetBinding:typeof env.ASSETS}));super(ctx,env);}
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
 for(const assets of [false,true]){const state='both',off=false,assetReads=[];
  const mf=new Miniflare({script,modules:true,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjects:{ROOM:{className:'ReceiptProbe',useSQLite:true}},bindings:{ROOM_ORIGIN:'https://room.example.test'},...(assets?{serviceBindings:{ASSETS:async request=>{const path=new URL(request.url).pathname;if(!/^\/og\/(atlas\.json|atlas-inter-(24|32|48)\.png|base-receipt\.png)$/.test(path))return new MfResponse(null,{status:404});const bytes=readFileSync(resolveDir+'/..'+path);assetReads.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});return new MfResponse(bytes);}}}:{})});
  try{
   const response=await mf.dispatchFetch('https://room.example.test/__fixture/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,off})});assert.equal(response.status,200,await response.clone().text());const seed=await response.json(),faces=[];
   const path='/receipts/'+seed.id+'/og.png';
   const responsePng=await mf.dispatchFetch('https://room.example.test'+path),bytes=Buffer.from(await responsePng.arrayBuffer());
   const signature=bytes.subarray(0,8).toString('hex');
   const face={status:responsePng.status,contentType:responsePng.headers.get('content-type'),bytes:bytes.length,signature,width:signature==='89504e470d0a1a0a'?bytes.readUInt32BE(16):null,height:signature==='89504e470d0a1a0a'?bytes.readUInt32BE(20):null,sha256:createHash('sha256').update(bytes).digest('hex')};faces.push(face);
   if(assets){assert.equal(face.status,200);assert.equal(signature,'89504e470d0a1a0a');assert.equal(face.width,1200);assert.equal(face.height,630);writeFileSync('audit/evidence/workerd-png-5862/'+label+'.png',bytes);}else assert.equal(face.status,500);
   const row={label,assets,state,off,seed,faces,assetReads};results.push(row);console.log(JSON.stringify(row));
  }finally{await mf.dispose();}
 }
}
writeFileSync('audit/evidence/workerd-png-5862/results.json',JSON.stringify(results,null,2));
