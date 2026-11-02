import assert from 'node:assert/strict';
import {createRequire}from'node:module';
import {execFileSync}from'node:child_process';
import {pathToFileURL,fileURLToPath}from'node:url';
import {mkdtemp,rm}from'node:fs/promises';
import {tmpdir}from'node:os';
import {join}from'node:path';
const[beforeRoot,afterRoot]=process.argv.slice(2);assert.equal(process.argv.length,4);
const git=process.env.LOCAL_LAB_GIT??'git';
const pins=['00888c52110d36250d3e07629036701b72926d09','aec29ee1275db508070f4bfbfd902f207469fcd8'];
for(const[root,pin]of[[beforeRoot,pins[0]],[afterRoot,pins[1]]]){assert.equal(execFileSync(git,['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);execFileSync(git,['-C',root,'diff','--exit-code','HEAD','--']);}
const require=createRequire(afterRoot+'/cloudflare/package.json');const{build}=await import(pathToFileURL(require.resolve('esbuild'))),{Miniflare}=await import(pathToFileURL(require.resolve('miniflare')));
const seed=fileURLToPath(new URL('./access_request_seed.mjs',import.meta.url));
async function bundle(root,isAfter){
 const fixture=`
import {ProjectRoom}from'./room.mjs';import{initialRoom}from'../server/bootstrap.mjs';import{AccessRequests}from'../server/access-requests.mjs';import{createHash}from'node:crypto';import{seedAccessStore}from${JSON.stringify(seed)};
export class AccessUpgradeRoom extends ProjectRoom{
 constructor(ctx,env){super(ctx,env);this.cost={statements:0,rowsRead:0,rowsWritten:0,unknown:0};const old=this.store.db.observeStatement;this.store.db.observeStatement=()=>{const done=old?.();return sample=>{done?.(sample);this.cost.statements++;for(const k of['rowsRead','rowsWritten'])if(Number.isSafeInteger(sample[k]))this.cost[k]+=sample[k];else this.cost.unknown++;};};}
 async fetch(request){const u=new URL(request.url),s=this.store;
 if(u.pathname==='/seed'){const f=seedAccessStore(s,1000,{initialRoom,AccessRequests});await this.ctx.storage.put('fixture',f);return Response.json({count:f.count});}
 const f=await this.ctx.storage.get('fixture');if(!f)throw Error('Missing persisted fixture');
 if(u.pathname==='/snapshot'){const rows=s.db.prepare('SELECT * FROM access_requests ORDER BY request_id').all(),fingerprint=createHash('sha256').update(JSON.stringify(rows)).digest('hex');return Response.json({count:rows.length,allPending:rows.every(r=>r.status==='pending'),fingerprint,credentials:createHash('sha256').update(f.owner+'|'+f.admin).digest('hex'),identities:s.db.prepare('SELECT count(*) n FROM agent_identities').get().n,index:s.db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='access_requests_pending_page'").get()?.name??null});}
 s.room=()=>{throw Error('Whole-room/history hydration forbidden');};const role=u.searchParams.get('role')??'owner';if(!['owner','admin'].includes(role))throw Error('Unknown role');const query=new URLSearchParams({status:'pending'});if(${isAfter})query.set('limit','25');if(u.searchParams.has('cursor'))query.set('cursor',u.searchParams.get('cursor'));const costBefore={...this.cost};const r=await super.fetch(new Request('https://room.example/api/rooms/'+f.room+'/access-requests?'+query,{headers:{Host:'room.example','x-room-visitor-ip':'192.0.2.1',Authorization:'Bearer '+f[role]}}));const text=await r.text(),body=JSON.parse(text);return Response.json({status:r.status,ids:body.requests?.map(row=>row.requestId)??[],cursor:body.page?.nextCursor??null,hasMore:body.page?.hasMore??false,error:body.error?.code??null,bytes:new TextEncoder().encode(text).length,cost:Object.fromEntries(Object.keys(costBefore).map(k=>[k,this.cost[k]-costBefore[k]]))});
 }
}
export default{fetch(request,env){return env.ROOM.getByName('upgrade').fetch(request);}};`;
 return(await build({stdin:{contents:fixture,resolveDir:root+'/cloudflare',sourcefile:'access-request-native-upgrade-fixture.mjs'},bundle:true,write:false,format:'esm',platform:'neutral',nodePaths:[afterRoot+'/node_modules',afterRoot+'/cloudflare/node_modules'],external:['node:*','cloudflare:*']})).outputFiles[0].text;
}
const oldScript=await bundle(beforeRoot,false),newScript=await bundle(afterRoot,true),dir=await mkdtemp(join(tmpdir(),'access-request-upgrade-'));
const create=script=>new Miniflare({modules:true,script,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:dir,durableObjects:{ROOM:{className:'AccessUpgradeRoom',useSQLite:true}},bindings:{ROOM_ORIGIN:'https://room.example'},serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});
let mf=create(oldScript);const call=async path=>{const r=await mf.dispatchFetch('https://room.example'+path);assert.equal(r.status,200,await r.clone().text());return r.json();};const result={schema:'member2-access-native-genuine-upgrade-v1',sourceBefore:pins[0],sourceAfter:pins[1],node:process.version,coldOpens:[],limits:'Local actual Native persistence, original producer/runtime and credentials. No restore, production, remote execution or elapsed speedup claim.'};
try{
 assert.deepEqual(await call('/seed'),{count:1000});result.before=await call('/snapshot');assert.equal(result.before.index,null);assert.equal(result.before.count,1000);assert.equal(result.before.allPending,true);
 for(const role of['owner','admin']){const p=await call('/page?role='+role);assert.equal(p.status,200);assert.equal(p.ids.length,1000);assert.equal(p.cost.rowsWritten,0);assert.equal(p.cost.unknown,0);}
 await mf.dispose();mf=create(newScript);
 for(let cold=1;cold<=2;cold++){
  const snapshot=await call('/snapshot');assert.equal(snapshot.index,'access_requests_pending_page');assert.equal(snapshot.fingerprint,result.before.fingerprint);assert.equal(snapshot.credentials,result.before.credentials);assert.equal(snapshot.identities,result.before.identities);
  const costs=[];for(const role of['owner','admin']){const first=await call('/page?role='+role);assert.equal(first.status,200);assert.equal(first.ids.length,25);assert.equal(first.cost.rowsWritten,0);assert.equal(first.cost.unknown,0);assert.ok(first.bytes<32768);costs.push({role,...first.cost,bytes:first.bytes});}
  const ids=[];let cursor=null,pages=0,maxRows=0;do{const p=await call('/page'+(cursor?'?cursor='+encodeURIComponent(cursor):''));assert.equal(p.status,200);assert.ok(p.ids.length<=25);assert.equal(p.cost.rowsWritten,0);assert.equal(p.cost.unknown,0);ids.push(...p.ids);cursor=p.cursor;maxRows=Math.max(maxRows,p.cost.rowsRead);assert.ok(++pages<=40);}while(cursor);assert.equal(ids.length,1000);assert.equal(new Set(ids).size,1000);assert.deepEqual(ids,Array.from({length:1000},(_,i)=>'pending-'+String(i).padStart(4,'0')));const after=await call('/snapshot');assert.equal(after.fingerprint,result.before.fingerprint);result.coldOpens.push({cold,originalCredentialsAccepted:true,requestsUnchanged:true,pages,unique:ids.length,maxRows,costs});
  if(cold===1){const p=await call('/page');await mf.dispose();mf=create(newScript);const stale=await call('/page?cursor='+encodeURIComponent(p.cursor));assert.equal(stale.status,409);assert.equal(stale.error,'stale_access_request_cursor');result.previousServiceCursorRefused=true;}
 }
}finally{await mf.dispose();await rm(dir,{recursive:true,force:true});}
for(const root of[beforeRoot,afterRoot])execFileSync(git,['-C',root,'diff','--exit-code','HEAD','--']);
console.log('ACCESS_REQUEST_NATIVE_UPGRADE '+JSON.stringify(result));
