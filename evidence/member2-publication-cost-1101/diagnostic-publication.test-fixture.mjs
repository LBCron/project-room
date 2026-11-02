import {DurableCoverageRoom as SeedRoom} from './durable-coverage-seed.test-fixture.mjs';
import {DurableCoverageRoom as NativeRoom} from './durable-coverage-native.test-fixture.mjs';
import {measureSql} from './member2-restore-scale-meter.test-helper.mjs';
import {measureQuerySql} from './member2-restore-query-meter.test-helper.mjs';
import {readConversation} from '../server/conversation-sync.mjs';
const measured=Base=>class extends Base {
 constructor(ctx,env) {
  const native=ctx.storage.sql,constructorMeter=measureSql(native),start=performance.now();let active=constructorMeter;
  // Keep the branded DurableObjectState untouched. Shadow only this disposable
  // storage instance's JS SQL property, preserving the real native receiver.
  Object.defineProperty(ctx.storage,'sql',{configurable:true,get(){return active?.sql??native;}});
  super(ctx,env);
  this.constructorReport={...constructorMeter.snapshot(),localWallMs:performance.now()-start};active=null;
  this.setMeter=value=>{active=value;};this.nativeSql=native;
 }
 async fetch(request) {
  if(new URL(request.url).pathname==='/__debug-conversation') {
   try{return Response.json({ok:true,page:readConversation(this.store,request.headers.get('Authorization')?.replace(/^Bearer /,''),'commons',{channelId:'general',limit:1})});}
   catch(error){return Response.json({ok:false,name:error.name,message:error.message,code:error.code??null,stack:error.stack?.split('\n').slice(0,8)});}
  }
  if(new URL(request.url).pathname==='/__scale-census')return Response.json({events:this.store.db.prepare('SELECT count(*) n FROM events').get().n,records:this.store.db.prepare('SELECT count(*) n FROM current_room_records').get().n,admission:this.store.restoreStatus()});
  const meter=measureQuerySql(this.nativeSql);this.setMeter(meter);
  try {
   const response=await super.fetch(request),headers=new Headers(response.headers);
   headers.set('x-member2-sql-meter',JSON.stringify(meter.snapshot()));
   headers.set('x-member2-constructor-meter',JSON.stringify(this.constructorReport));
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  } catch(error) {
   return Response.json({error:{name:error.name,code:error.code??null,message:String(error.message).slice(0,500)}},{status:500,headers:{'x-member2-sql-meter':JSON.stringify(meter.snapshot()),'x-member2-constructor-meter':JSON.stringify(this.constructorReport)}});
  } finally {this.setMeter(null);}
 }
};
export class ScaleSeedRoom extends measured(SeedRoom) {}
export class ScaleNativeRoom extends measured(NativeRoom) {}
export default {fetch(request,env) {
 const u=new URL(request.url),surface=u.searchParams.get('surface')??'target';u.searchParams.delete('surface');
 const headers=new Headers(request.headers);headers.set('Host','room.example.test');headers.set('x-room-visitor-ip','192.0.2.1');
 const init={method:request.method,headers};if(!['GET','HEAD'].includes(request.method))init.body=request.body;
 return env.ROOM.getByName(surface).fetch(new Request(u,init));
}};
