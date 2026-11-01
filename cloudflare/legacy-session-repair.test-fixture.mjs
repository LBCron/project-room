// Isolated synthetic workerd qualification; never deployed.
import { DurableObject } from 'cloudflare:workers';
import { RoomStore } from '../server/store.mjs';
import { repairLegacyMessages } from '../server/operator-legacy-message-repair.mjs';
import { seedLegacyFixture } from '../tests/helpers/legacy-session-fixture.mjs';
import { DurableDatabase, durableStorage } from './storage.mjs';
export class LegacySessionRepairRoom extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env);
    this.db=new DurableDatabase(ctx.storage);
    this.store=new RoomStore(null,{database:this.db,storagePlatform:durableStorage});
  }
  async fetch(request) {
    const path=new URL(request.url).pathname,s=this.store,db=this.db;
    try {
      if(path==='/seed')return Response.json({request:seedLegacyFixture(s).request});
      if(path==='/plan'||path==='/execute')return Response.json(repairLegacyMessages(s,await request.json(),path==='/execute'));
      if(path==='/audit-fault') {
        db.exec("CREATE TRIGGER fail_repair BEFORE INSERT ON operator_actions WHEN NEW.action='legacy_session_backfill_reconciled' BEGIN SELECT RAISE(ABORT,'synthetic audit storage failure'); END");
        return Response.json({installed:true});
      }
      if(path==='/clear-fault') {db.exec('DROP TRIGGER fail_repair');return Response.json({removed:true});}
      if(path==='/append') {
        const key=s.issueAccessKey('legacy-room','owner');
        s.command(key,'legacy-room',{id:'after-repair',type:'message.posted',data:{messageId:'after-repair',body:'Synthetic later message'}});
        s.backfillMessages({limit:64});
        return Response.json({appended:true});
      }
      if(path==='/state') {
        const authority=Object.fromEntries(['rooms','messages','work_entities','integrity_room_state'].map(table=>[table,db.prepare(`SELECT * FROM ${table} WHERE ${table==='rooms'?'id':'room_id'}=?`).all('legacy-room')]));
        return Response.json({authority,head:s.headSequence('legacy-room'),cursor:db.prepare("SELECT * FROM messages_backfill_cursor WHERE room_id='legacy-room'").get(),
          blocks:db.prepare("SELECT count(*) AS n FROM messages_backfill_blocks WHERE room_id='legacy-room'").get().n,
          receipts:db.prepare("SELECT count(*) AS n FROM operator_actions WHERE action='legacy_session_backfill_reconciled'").get().n});
      }
      return new Response('Not found',{status:404});
    } catch(error) {return Response.json({error:{code:error.code??'internal',message:String(error.message).slice(0,160)}},{status:error.status??500});}
  }
}
export default {fetch(request,env){return env.ROOM.getByName('legacy-session-repair').fetch(request);}};
