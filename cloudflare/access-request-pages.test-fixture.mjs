import {ProjectRoom} from './room.mjs';
import {seedAccessQueue,addAccessRequest} from '../tests/helpers/access-request-queue-source.mjs';
import {AccessRequests,REQUEST_TTL_MS} from '../server/access-requests.mjs';
export class AccessRequestPageRoom extends ProjectRoom{
 constructor(ctx,env){super(ctx,env);this.cost={statements:0,rowsRead:0,rowsWritten:0,unknown:0};const old=this.store.db.observeStatement;this.store.db.observeStatement=()=>{const finish=old?.();return sample=>{finish?.(sample);this.cost.statements++;for(const key of ['rowsRead','rowsWritten'])if(Number.isSafeInteger(sample[key]))this.cost[key]+=sample[key];else this.cost.unknown++;};};}
 async fetch(request){
  const url=new URL(request.url),s=this.store;
  if(url.pathname==='/seed'){const f=seedAccessQueue(s,Number(url.searchParams.get('count')));await this.ctx.storage.put('fixture',{room:f.room,owner:f.owner,admin:f.admin,count:Number(url.searchParams.get('count'))});return Response.json({seeded:true});}
  const f=await this.ctx.storage.get('fixture');if(f.clock)s.now=()=>f.clock;
  if(url.pathname==='/expire'){
   f.clock=s.now()+REQUEST_TTL_MS+1;s.now=()=>f.clock;
   const access=new AccessRequests(s);
   for(let i=1000;i<1027;i++)addAccessRequest(s,access,f.room,i);
   f.owner=s.issueAccessKey(f.room,'owner');f.admin=s.issueAccessKey(f.room,'admin');await this.ctx.storage.put('fixture',f);return Response.json({expiredFixture:true});
  }
  s.room=()=>{throw Error('whole-room/history hydration forbidden');};
  const role=url.searchParams.get('role')??'owner';if(!['owner','admin'].includes(role))throw Error('Unknown role');
  const query=new URLSearchParams({status:'pending'});if(url.searchParams.get('unselected')!=='1')query.set('limit','25');if(url.searchParams.has('cursor'))query.set('cursor',url.searchParams.get('cursor'));
  const before={...this.cost};
  const response=await super.fetch(new Request('https://room.example/api/rooms/'+f.room+'/access-requests?'+query,{headers:{Host:'room.example','x-room-visitor-ip':'192.0.2.1',Authorization:'Bearer '+f[role]}}));
  const text=await response.text(),body=JSON.parse(text),cost=Object.fromEntries(Object.keys(before).map(k=>[k,this.cost[k]-before[k]]));
  return Response.json({status:response.status,cost,bytes:new TextEncoder().encode(text).length,ids:body.requests?.map(row=>row.requestId)??[],cursor:body.page?.nextCursor??null,hasMore:body.page?.hasMore??false,error:body.error?.code??null});
 }
}
export default{fetch(request,env){return env.ROOM.getByName('requests').fetch(request);}};
