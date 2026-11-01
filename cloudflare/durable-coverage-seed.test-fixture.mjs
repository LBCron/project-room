import {CurrentServingRoom} from './current-room-serving.test-fixture.mjs';
import {createBackupReplaySession} from '../server/restore-ndjson.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {setTier} from '../server/autonomy-tiers.mjs';
import {auditRecovery} from '../server/recovery.mjs';
export class DurableCoverageRoom extends CurrentServingRoom {
 async fetch(request){const path=new URL(request.url).pathname;
  if(path==='/__export'){auditRecovery(this.store);return new Response(exportNdjsonText(this.db));}
  if(path==='/__work'){const key=await this.ctx.storage.get('owner-key'),proposal={id:'native-restored-work-proposal',type:'work.proposed',data:{workItemId:'native-restored-work',title:'Preserve useful native work',definitionOfDone:'Exact task and retry survive recovery',accountableMemberId:'owner'}},proposed=this.store.command(key,'commons',proposal),accepted=this.store.command(key,'commons',{id:'native-restored-work-accept',type:'work.accepted',data:{workItemId:'native-restored-work',expectedRevision:0}});setTier(this.db,'commons','reader','t2_standard',{updatedBy:'owner',nowMs:Date.now()});const privateRequest=this.store.command(key,'commons',{id:'native-private-ask',type:'message.posted',data:{messageId:'native-private-question',toMemberId:'reader',requestKind:'reply',workItemId:'native-restored-work',body:'Preserve this synthetic private question'}});return Response.json({proposal,proposed,accepted,privateRequest,capacity:this.db.prepare("SELECT payload FROM current_room_records WHERE room_id='commons' AND domain='workCapacity' AND record_key='native-restored-work'").get()});}
  if(path==='/__key')return Response.json({key:await this.ctx.storage.get('owner-key')});
  if(path==='/__partial'){this.session=createBackupReplaySession(this.store);this.session.writeText(await request.text());return Response.json({pending:this.store.restoreStatus().pending,events:this.db.prepare('SELECT count(*) n FROM events').get().n});}
  return super.fetch(request);
 }
}
export default{fetch(request,env){return env.ROOM.getByName(new URL(request.url).searchParams.get('surface')??'source').fetch(request);}};
