import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {createRoomServer} from '../server/http.mjs';
import {seedPublicLobby} from './helpers/public-lobby-source.mjs';
import {unpublishPublic} from '../server/legal-store.mjs';
import {readCurrentPublicFace} from '../server/current-public-face.mjs';
import {PUBLIC_LOBBY_ROOM_ID} from '../server/routes/public-lobby.mjs';

async function fixture(t){
 const store=new RoomStore(':memory:'),saved=seedPublicLobby(store,{roomId:PUBLIC_LOBBY_ROOM_ID});
 store.room=()=>{throw Error('Whole room hydration forbidden');};
 const server=createRoomServer({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeStreams();server.closeAllConnections();await new Promise(r=>server.close(r));store.close();});
 const origin='http://127.0.0.1:'+server.address().port;
 const call=async(path,{token,body}={})=>{const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();return{status:r.status,text,body:r.headers.get('Content-Type')?.includes('application/json')?JSON.parse(text):null};};
 return{store,saved,call};
}
test('actual normalized public endpoints require owner publication and expose only bounded live General messages',async t=>{
 const {store,saved,call}=await fixture(t),route='/api/rooms/'+saved.roomId+'/public-face';
 assert.match((await call('/watch')).text,/No public lobby is published yet/);
 assert.equal((await call(route,{body:{enabled:true}})).status,401);
 assert.equal((await call(route,{token:saved.alice,body:{enabled:true}})).status,403);
 const enabled=await call(route,{token:saved.owner,body:{enabled:true}});assert.equal(enabled.status,200,enabled.text);
 const code=enabled.body.publicCode,page=await call('/api/public/rooms/'+code);
 assert.equal(page.status,200,page.text);assert.equal(page.body.messages.length,8);assert.match(page.body.messages.at(-1).body,/Useful <public> result/);
 assert.deepEqual(page.body.coverage,{channel:'general',bounded:true,limit:8});
 assert.equal(readCurrentPublicFace(store,saved.roomId,{latest:true}).messages.at(-1).id,'public-17');
 assert.doesNotMatch(page.text,/PRIVATE HISTORY|OTHER CHANNEL|DELETED MUST|identityId|permissions/);
 const html=await call('/p/'+code);assert.equal(html.status,200);assert.match(html.text,/Useful &lt;public&gt; result/);assert.match(html.text,/Only the General channel/);
 assert.match((await call('/watch')).text,/No public lobby is published yet/,'an unlisted capability code is not enumerated as the official lobby');
 store.command(saved.owner,saved.roomId,{id:'publish-lobby',type:'room.public_page_set',data:{enabled:true}});
 const watch=await call('/watch');assert.equal(watch.status,200,watch.text);assert.match(watch.text,/Connect an agent/);assert.match(watch.text,/\/docs\/agents\/paste\?room=project-room-lobby/);
 const ids=[];let after=null;
 for(let i=0;i<4;i++){const feed=await call('/api/public/rooms/'+code+'/feed'+(after?'?after='+after:''));assert.equal(feed.status,200,feed.text);ids.push(...feed.body.messages.map(m=>m.id));after=feed.body.next;if(!feed.body.hasMore)break;}
 assert.deepEqual(ids,Array.from({length:18},(_,i)=>'public-'+i));
 for(const id of ['private-0','other-channel','deleted','missing'])assert.equal((await call('/api/public/rooms/'+code+'/feed?after='+id)).status,422);
 const rotated=await call(route+'/rotate',{token:saved.owner,body:{}});assert.equal(rotated.status,200);assert.equal((await call('/p/'+code)).status,404);
 const off=await call(route,{token:saved.owner,body:{enabled:false}});assert.equal(off.status,200);assert.equal((await call('/p/'+rotated.body.publicCode)).status,404);assert.match((await call('/watch')).text,/No public lobby is published yet/);
});
test('normalized publication respects operator unpublish immediately',async t=>{
 const {store,saved,call}=await fixture(t),code=store.publicFace.enable(saved.roomId,'owner').publicCode;
 unpublishPublic(store.db,{kind:'room',id:saved.roomId,byAccount:'operator',now:Date.now()});
 assert.equal((await call('/p/'+code)).status,404);assert.equal((await call('/api/public/rooms/'+code+'/feed')).status,404);
});

test('archiving a published normalized room hides its public messages',async t=>{
 const {store,saved,call}=await fixture(t),code=store.publicFace.enable(saved.roomId,'owner').publicCode;
 store.command(saved.owner,saved.roomId,{id:'archive',type:'room.archived',data:{}});
 assert.equal((await call('/p/'+code)).status,404);
});
