import {CurrentEventsRoom} from './current-events-worker.test-fixture.mjs';
import {seedPostOAuth,postWithOAuth} from '../tests/helpers/work-linked-post-oauth.mjs';
import {readCurrentMessage} from '../server/current-room-repository.mjs';
import {auditRecovery} from '../server/recovery.mjs';
export class WorkLinkedPostRoom extends CurrentEventsRoom {
 async fetch(request){
  const path=new URL(request.url).pathname,s=this.store;
  try{
   if(path==='/seed'){const saved=seedPostOAuth(s);await this.ctx.storage.put('saved',saved);return Response.json({members:s.db.prepare("SELECT count(*) n FROM current_room_records WHERE domain='members'").get().n});}
   const saved=await this.ctx.storage.get('saved');s.room=()=>{throw Error('whole-room hydration');};
   const before={...this.stats},rawBefore={...this.raw},started=performance.now();let result;
   const data={messageId:'native-linked',body:'x'.repeat(1648),workItemId:'task'};
   if(path==='/post')result=postWithOAuth(s,saved,data);
   else if(path==='/plain')result=postWithOAuth(s,saved,{messageId:'native-plain',body:'Plain result'});
   else if(path==='/read'){
    auditRecovery(s);result={body:s.readTransaction(()=>readCurrentMessage(s.db,'commons','native-linked').value.body),carrierBytes:s.db.prepare("SELECT octet_length(projection) n FROM rooms WHERE id='commons'").get().n,permit:s.db.prepare('SELECT enabled,room_id,receipt_id FROM current_room_writer_permit').get()};
   }else throw Error('Unknown test route');
   return Response.json({result,cost:{...Object.fromEntries(Object.keys(before).map(k=>[k,this.stats[k]-before[k]])),rawRuntime:Object.fromEntries(Object.keys(rawBefore).map(k=>[k,this.raw[k]-rawBefore[k]])),observedWorkerWallMs:performance.now()-started}});
  }catch(error){return Response.json({code:error.code,message:error.message},{status:error.status??500});}
 }
}
export default {fetch(request,env){return env.ROOM.getByName('work-post').fetch(request);}};
