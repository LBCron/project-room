// Research fixture only: no production endpoint or authority.
import {CurrentEventsRoom} from './current-events-worker.test-fixture.mjs';
import {initialRoom} from '../server/bootstrap.mjs';import {event} from '../src/events.js';
import {auditRecovery} from '../server/recovery.mjs';import {certifyOneMessageRoutingResearch} from '../server/current-room-repository.mjs';
export class RoutingCertificationRoom extends CurrentEventsRoom{
 async fetch(req){const path=new URL(req.url).pathname,s=this.store;try{
  if(path==='/seed'){const es=initialRoom();es.push(event({roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'legacy-large',body:'界'.repeat(65536)}}));s.initialize(es,{representation:'normalized-current-v1'});const key=s.issueAccessKey('commons','owner');await this.ctx.storage.put('key',key);return Response.json({ok:true});}
  if(path==='/witness'){const r=s.db.prepare("SELECT payload FROM current_room_records WHERE room_id='commons' AND domain='messageWitness' AND record_key='legacy-large'").get();return Response.json(JSON.parse(r.payload));}
  if(path==='/certify'){const before={...this.stats};const result=certifyOneMessageRoutingResearch(s,'commons','legacy-large');return Response.json({result,cost:Object.fromEntries(Object.keys(before).map(k=>[k,this.stats[k]-before[k]]))});}
  if(path==='/reply'){const key=await this.ctx.storage.get('key');const result=s.command(key,'commons',{id:'legacy-reply',type:'message.posted',data:{messageId:'legacy-reply',replyToId:'legacy-large',body:'hello'}});return Response.json({duplicate:result.duplicate});}
  if(path==='/audit'){return Response.json({audit:auditRecovery(s)});}
  throw Error('unknown test route');
 }catch(e){return Response.json({error:e.message},{status:e.status??500})}}
}
export default{fetch:(request,env)=>env.ROOM.getByName('certification').fetch(request)};
