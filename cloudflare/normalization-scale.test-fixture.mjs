// Disposable synthetic scale qualification, no production entrypoint.
import {DurableObject} from 'cloudflare:workers';
import {RoomStore} from '../server/store.mjs';
import {DurableDatabase,durableStorage} from './storage.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event} from '../src/events.js';
import {readConversation} from '../server/conversation-sync.mjs';
import {operatorNormalization} from '../server/operator-normalization.mjs';
export class NormalizationScaleRoom extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);this.ctx=ctx;this.active=null;this.pending=null;
  const exec=ctx.storage.sql.exec.bind(ctx.storage.sql),finish=()=>{const p=this.pending;if(!p)return;this.pending=null;const g=p.group;try{g.rowsRead+=p.cursor.rowsRead;g.rowsWritten+=p.cursor.rowsWritten;}catch{g.unknown++;}};this.finish=finish;
  ctx.storage.sql.exec=(sql,...params)=>{finish();const cursor=exec(sql,...params);if(!this.active)return cursor;const key=sql.replace(/\s+/g,' ').trim(),g=this.active.get(key)??{sql:key,statements:0,rowsRead:0,rowsWritten:0,materializedBytes:0,unknown:0};this.active.set(key,g);g.statements++;this.pending={cursor,group:g};const charge=row=>{g.materializedBytes+=new TextEncoder().encode(JSON.stringify(row)).byteLength;};return new Proxy(cursor,{get(target,k){if(k==='toArray')return()=>{const rows=target.toArray();for(const row of rows)charge(row);return rows;};if(k===Symbol.iterator)return function*(){for(const row of target){charge(row);yield row;}};const v=Reflect.get(target,k,target);return typeof v==='function'?v.bind(target):v;}});};
  this.db=new DurableDatabase(ctx.storage);this.store=new RoomStore(null,{database:this.db,storagePlatform:durableStorage,integrity:'deferred'});
 }
 async fetch(request){
  const url=new URL(request.url);this.active=new Map();const started=performance.now();let phase=url.pathname;
  const cost=()=>{this.finish();const groups=[...this.active.values()];return {observedWorkerWallMs:performance.now()-started,...Object.fromEntries(['statements','rowsRead','rowsWritten','materializedBytes','unknown'].map(k=>[k,groups.reduce((n,g)=>n+g[k],0)])),top:groups.sort((a,b)=>b.rowsRead-a.rowsRead).slice(0,8)};};
  try{
   let result;
   if(url.pathname==='/seed'){
    const events=initialRoom();const small=url.searchParams.get('surface')==='small',posts=small?100:5000,total=small?1000:50000;
    for(let i=0;i<posts;i++)events.push(event({id:'post-'+i,idempotencyKey:'post-key-'+i,roomId:'commons',actorId:'owner',type:'message.posted',at:'2026-01-01T00:00:00.000Z',data:{messageId:'m'+i,body:i===0?'Small edit target':'S'.repeat(1250)}}));
    for(let i=events.length;i<total;i++)events.push(event({id:'edit-'+i,idempotencyKey:'edit-key-'+i,roomId:'commons',actorId:'owner',type:'message.edited',at:'2026-01-02T00:00:00.000Z',data:{messageId:'m0',body:'Small edit '+i,expectedMessageRevision:i-posts-2}}));
    phase='legacy initialize '+total+' events';console.log('NORMALIZATION_PHASE '+phase);this.store.initialize(events);
    phase='issue owner key';await this.ctx.storage.put('key',this.store.issueAccessKey('commons','owner'));
    result={events:total,posts,editedEvents:total-posts-2,...this.db.prepare("SELECT sequence,octet_length(projection) projectionBytes FROM rooms WHERE id='commons'").get(),eventCount:this.db.prepare('SELECT count(*) n FROM events').get().n};
   }else if(url.pathname==='/plan')result=operatorNormalization(this.store,{roomId:'commons',discardLegacyAssignments:true});
   else if(url.pathname==='/execute'){const input=await request.json();result=operatorNormalization(this.store,input,true);}
   else if(url.pathname==='/post'){const key=await this.ctx.storage.get('key'),id=url.searchParams.get('id');result=this.store.command(key,'commons',{id:'after-'+id,type:'message.posted',data:{messageId:'after-'+id,body:'Useful normalized result'}});}
   else if(url.pathname==='/read')result=readConversation(this.store,await this.ctx.storage.get('key'),'commons',{messageId:'after-one',limit:1});
   else if(url.pathname==='/state')result={...this.db.prepare("SELECT sequence,octet_length(projection) projectionBytes FROM rooms WHERE id='commons'").get(),messages:this.db.prepare('SELECT count(*) n FROM messages').get().n,events:this.db.prepare('SELECT count(*) n FROM events').get().n};
   else return new Response('not found',{status:404});
   return Response.json({result,cost:cost()});
  }catch(error){return Response.json({phase,error:{name:error.name,code:error.code,message:error.message},cost:cost()},{status:500});}
  finally{this.finish();this.active=null;}
 }
}
export default {fetch(request,env){return env.ROOM.getByName(new URL(request.url).searchParams.get('surface')==='small'?'small':'scale').fetch(request);}};
