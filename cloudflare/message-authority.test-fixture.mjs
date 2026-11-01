// Local qualification only. No production route enables this migration.
import { HttpTestRoom } from './http-worker.test-fixture.mjs';
import { RoomStore } from '../server/store.mjs';
import { durableStorage } from './storage.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { readConversation } from '../server/conversation-sync.mjs';
export class MessageAuthorityTestRoom extends HttpTestRoom {
 async fetch() {
  const s=this.store; s.maintainMessageCertification=true;
  s.initialize(initialRoom()); const owner=s.issueAccessKey('commons','owner');
  const post=(id)=>s.command(owner,'commons',{id,type:'message.posted',data:{messageId:id,body:`Body ${id}`}});
  post('first');while(!s.backfillMessages({limit:1000}).done){};s.checkMessagesParity();
  s.migrateMessageAuthority('commons');post('second');
  const cold=new RoomStore(null,{database:s.db,storagePlatform:durableStorage});
  const read=readConversation(cold,owner,'commons',{});
  const raw=JSON.parse(s.db.prepare("SELECT projection FROM rooms WHERE id='commons'").get().projection);
  let refused=false;
  try{s.transaction(()=>{s.db.prepare("DELETE FROM messages WHERE message_id='first'").run();s.room('commons');});}catch(e){refused=e.message.includes('projection_corrupt');}
  const preserved=s.room('commons').state.messages.length;
  cold.migrateMessageAuthority('commons',{reverse:true});
  return Response.json({hasArray:Object.hasOwn(raw,'messages'),count:raw.messageAuthority.count,
   bodies:read.messages.map(m=>m.body),refused,preserved,reverse:cold.room('commons').state.messages.length});
 }
}
export default {fetch(request,env){return env.ROOM.getByName('authority-fixture').fetch(request);}};
