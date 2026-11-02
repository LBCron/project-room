import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const [root]=process.argv.slice(2);assert.equal(process.argv.length,3);
const git=process.env.LOCAL_LAB_GIT??'git';const pin=execFileSync(git,['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(pin,'f02132a1c921af7953368a7340f6d03b87a78d28');execFileSync(git,['-C',root,'diff','--quiet','HEAD','--']);
const require=createRequire(root+'/cloudflare/package.json');const {build}=await import(pathToFileURL(require.resolve('esbuild')));const {Miniflare}=await import(pathToFileURL(require.resolve('miniflare')));
const seed=fileURLToPath(new URL('./access_request_seed.mjs',import.meta.url));
const fixture=`
import {ProjectRoom} from './room.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {AccessRequests} from '../server/access-requests.mjs';
import {seedAccessStore} from ${JSON.stringify(seed)};
export class AccessScaleRoom extends ProjectRoom {
 constructor(ctx,env){super(ctx,env);this.cost={statements:0,rowsRead:0,rowsWritten:0,unknown:0};const old=this.store.db.observeStatement;this.store.db.observeStatement=()=>{const finish=old?.();return sample=>{finish?.(sample);this.cost.statements++;for(const key of ['rowsRead','rowsWritten']){if(Number.isSafeInteger(sample[key]))this.cost[key]+=sample[key];else this.cost.unknown++;}};};}
 async fetch(request){
  const u=new URL(request.url),s=this.store;
  if(u.pathname==='/__seed'){const f=seedAccessStore(s,Number(u.searchParams.get('count')),{initialRoom,AccessRequests});await this.ctx.storage.put('fixture',f);return Response.json({count:f.count});}
  const f=await this.ctx.storage.get('fixture');if(!f)throw Error('Missing fixture');
  s.room=()=>{throw Error('whole-room/history hydration forbidden');};
  const endpoint=u.searchParams.get('endpoint')??'access-requests?status=pending';
  if(!['access-requests?status=pending','needs-attention'].includes(endpoint))throw Error('Unsupported endpoint');
  const role=u.searchParams.get('role')??'owner';if(!['owner','admin'].includes(role))throw Error('Unsupported role');
  const before={...this.cost},started=performance.now();
  const response=await super.fetch(new Request('https://room.example/api/rooms/'+f.room+'/'+endpoint,{headers:{Host:'room.example','x-room-visitor-ip':'192.0.2.1',Authorization:'Bearer '+f[role]}}));
  const text=await response.text(),cost=Object.fromEntries(Object.keys(before).map(k=>[k,this.cost[k]-before[k]]));let body;try{body=JSON.parse(text);}catch{}
  return Response.json({httpStatus:response.status,cost,ms:performance.now()-started,payloadBytes:new TextEncoder().encode(text).length,returnedRequests:body?.requests?.length??null,returnedItems:body?.items?.length??null,contractVersion:body?.contractVersion??null,hasQueueContinuation:Boolean(body?.nextCursor||body?.page?.hasMore),error:body?.error?.code??null});
 }
}
export default{fetch(request,env){return env.ROOM.getByName('scale').fetch(request);}};
`;
const script=(await build({stdin:{contents:fixture,resolveDir:root+'/cloudflare',sourcefile:'access-scale-private-fixture.mjs'},bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']})).outputFiles[0].text;
const samples=[];
for(const count of [25,1000]){
 const dir=await mkdtemp(join(tmpdir(),'access-scale-native-'));const mf=new Miniflare({modules:true,script,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:dir,durableObjects:{ROOM:{className:'AccessScaleRoom',useSQLite:true}},bindings:{ROOM_ORIGIN:'https://room.example'},serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});
 const call=async path=>{const r=await mf.dispatchFetch('https://room.example/'+path);assert.equal(r.status,200,await r.clone().text());return r.json();};
 try{
  assert.deepEqual(await call('__seed?count='+count),{count});
  for(const role of ['owner','admin'])for(let repeat=0;repeat<2;repeat++){
   const facts=await call('__measure?role='+role);assert.equal(facts.httpStatus,200);assert.equal(facts.returnedRequests,count);assert.equal(facts.cost.unknown,0);samples.push({count,role,repeat,endpoint:'access-requests',...facts});
  }
  const rollup=await call('__measure?endpoint=needs-attention');assert.equal(rollup.httpStatus,200);samples.push({count,role:'owner',endpoint:'needs-attention',...rollup});
 }finally{await mf.dispose();await rm(dir,{recursive:true,force:true});}
}
execFileSync(git,['-C',root,'diff','--quiet','HEAD','--']);
console.log(JSON.stringify({schema:'member2-access-request-native-baseline-v1',pin,node:process.version,samples,scope:'Actual local Native HTTP owner/admin list and native owner attention, normal producer seeding, no room/history hydration. Costs exclude constructor and seeding; no CPU or production claim.'},null,2));
