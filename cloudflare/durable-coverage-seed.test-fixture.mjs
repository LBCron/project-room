import {CurrentServingRoom} from './current-room-serving.test-fixture.mjs';
import {createBackupReplaySession} from '../server/restore-ndjson.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {auditRecovery} from '../server/recovery.mjs';
export class DurableCoverageRoom extends CurrentServingRoom {
 async fetch(request){const path=new URL(request.url).pathname;
  if(path==='/__export'){auditRecovery(this.store);return new Response(exportNdjsonText(this.db));}
  if(path==='/__key')return Response.json({key:await this.ctx.storage.get('owner-key')});
  if(path==='/__partial'){this.session=createBackupReplaySession(this.store);this.session.writeText(await request.text());return Response.json({pending:this.store.restoreStatus().pending,events:this.db.prepare('SELECT count(*) n FROM events').get().n});}
  return super.fetch(request);
 }
}
export default{fetch(request,env){return env.ROOM.getByName(new URL(request.url).searchParams.get('surface')??'source').fetch(request);}};
