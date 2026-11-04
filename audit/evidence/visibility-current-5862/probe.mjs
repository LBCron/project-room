import {unpublishPublic} from '../../../server/legal-store.mjs';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {RoomStore} from '../../../server/store.mjs';
import {initialRoom} from '../../../server/bootstrap.mjs';
import {createRoomServer} from '../../../server/http.mjs';
import {projectPublicWorkReceipt} from '../../../server/receipts-live.mjs';
const dir=mkdtempSync(join(process.env.TMPDIR,'visibility-'));
const store=new RoomStore(join(dir,'room.sqlite'));store.initialize(initialRoom('commons'));
const ownerKey=store.issueAccessKey('commons','owner');
const server=createRoomServer({store});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${server.address().port}`,namespace='public_'+'ef'.repeat(16),sha='cd'.repeat(32);let checks=0,failures=[];
try{let n=0;for(const enabled of [true,false])for(const unpublished of [false,true])for(const state of ['both','mirror-only','source-only','neither']){
 store.command(ownerKey,'commons',{id:'on-'+n,type:'room.public_receipts_set',data:{enabled:true}});
 const id='pwr_'+(++n).toString(16).padStart(64,'0'),offer='offer-'+n,marker='PRIVATE-MATRIX-'+n;
 store.db.prepare('INSERT INTO public_work_tasks(offer_id,namespace_key,room_id,terms_version,repository_url,repository_ref,files_json,generation,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(offer,namespace,'commons',1,'https://example.test/repository','main','[]',1,Date.now());
 const receipt={schema:'public-work-receipt/1',receiptId:id,namespaceId:namespace,identityId:'synthetic-agent',title:marker,createdAt:'2026-10-01T00:00:00.000Z',artifact:{sha256:sha}};
 store.db.prepare('INSERT INTO public_work_receipts VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,offer,namespace,1,'synthetic-agent',marker,sha,4,JSON.stringify(receipt),Date.now());projectPublicWorkReceipt(store,receipt,sha);
 if(['mirror-only','neither'].includes(state))store.db.prepare('DELETE FROM public_work_receipts WHERE receipt_id=?').run(id);
 if(['source-only','neither'].includes(state))store.db.prepare('DELETE FROM public_receipts WHERE id=?').run(id);
 store.command(ownerKey,'commons',{id:'setting-'+n,type:'room.public_receipts_set',data:{enabled}});
 if(unpublished)assert.equal(unpublishPublic(store.db,{kind:'receipt',id,byAccount:'synthetic-operator',now:Date.now()}).ok,true);
 const expectedPublic=enabled&&!unpublished&&state==='both',statuses={};
 for(const path of [`/receipts/${id}`,`/receipts/${id}.json`,`/receipts/${id}/og.png`,`/receipts/${id}/badge.svg`,`/api/public-work/receipts/${id}`,`/api/public-work/receipts/${id}/artifact`]){
 const response=await fetch(origin+path),body=await response.text();statuses[path.replaceAll(id,'ID')]=response.status;checks++;
 if(expectedPublic?response.status!==200:![403,404].includes(response.status)||body.includes(marker))failures.push({enabled,unpublished,state,path:path.replaceAll(id,'ID'),status:response.status,markerPresent:body.includes(marker)});
 }
 console.log(JSON.stringify({enabled,unpublished,state,statuses}));
 }console.log(JSON.stringify({checks,failures}));
}finally{server.closeStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();console.log(JSON.stringify({database:join(dir,'room.sqlite')}));}
