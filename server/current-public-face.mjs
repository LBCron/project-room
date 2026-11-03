import {isCurrentRoom,withCurrentReadContext,readCurrentHead,readCurrentRecord,readCurrentMessage,currentConversationRows,chargeCurrentReadBudget} from './current-room-repository.mjs';
import {ServiceError} from './service-error.mjs';

// Explicit publication is checked by PublicFace before entering this reader.
// The normalized viewer publishes only General, never a member's inbox or
// another channel. It does not hydrate the room or enumerate its history.
export const CURRENT_PUBLIC_FACE_LIMIT=8;
const visible=m=>m&&!m.toMemberId&&(m.channelId||'general')==='general'&&!m.deletedAt&&typeof m.body==='string'&&m.body.length>0;
const invalid=()=>{throw new ServiceError(422,'invalid_feed_cursor','Unknown public message cursor; reload the public view');};
export function currentPublicMetadata(store,roomId){
 if(typeof store.readTransaction!=='function'||!isCurrentRoom(store.db,roomId))return null;
 return store.readTransaction(()=>withCurrentReadContext(store.db,roomId,()=>({room:readCurrentRecord(store.db,roomId,'metadata','room'),members:{}})));
}
export function readCurrentPublicFace(store,roomId,{after=null,limit=CURRENT_PUBLIC_FACE_LIMIT,latest=false}={}){
 if(typeof store.readTransaction!=='function'||!isCurrentRoom(store.db,roomId))return null;
 return store.readTransaction(()=>withCurrentReadContext(store.db,roomId,b=>{
  const db=store.db,head=readCurrentHead(db,roomId,b),room=readCurrentRecord(db,roomId,'metadata','room',b);
  if(!room||room.id!==roomId)throw new ServiceError(409,'current_room_context_unavailable','Public room metadata is unavailable');
  if(room.archivedAt)throw new ServiceError(404,'face_not_found','No such public face');
  const messages=[],members={},n=Math.min(limit,CURRENT_PUBLIC_FACE_LIMIT);
  let hasMore=false;
  if(latest){
   const page=currentConversationRows(store,roomId,{viewerId:room.ownerId,limit:n,before:head.sequence+1,beforeId:'',messageId:null,channelId:'general',peerMemberId:null,floor:null,liveOnly:true});
   for(const row of page.rows.toReversed()){const m=JSON.parse(row.body);if(visible(m))messages.push(m);}
   hasMore=!page.complete;
  }else{
   let sequence=0;
   if(after!==null){const source=readCurrentMessage(db,roomId,after,b);if(!visible(source?.value))invalid();sequence=source.row.seq;}
   const rows=db.prepare("SELECT message_id,seq FROM messages INDEXED BY current_messages_channel_public_seq_live WHERE room_id=? AND channel_id='general' AND (to_member_id IS NULL OR to_member_id='') AND deleted_at IS NULL AND seq>? ORDER BY seq,message_id LIMIT ?").all(roomId,sequence,n+1);
   chargeCurrentReadBudget(b,rows.reduce((sum,r)=>sum+Buffer.byteLength(r.message_id)+32,0),rows.length);
   hasMore=rows.length>n;
   for(const row of rows.slice(0,n)){
    const source=readCurrentMessage(db,roomId,row.message_id,b);
    if(!source||source.row.seq!==row.seq||!visible(source.value))throw new ServiceError(409,'current_room_context_unavailable','Public message differs from its protected record');
    messages.push(source.value);
   }
  }
  for(const m of messages)if(!Object.hasOwn(members,m.authorId)){
   const member=readCurrentRecord(db,roomId,'members',m.authorId,b);
   if(member!==undefined&&member.id!==m.authorId)throw new ServiceError(409,'current_room_context_unavailable','Public author is unavailable');
   Object.defineProperty(members,m.authorId,{value:member,enumerable:true});
  }
  return {room,members,messages,hasMore,coverage:{channel:'general',bounded:true,limit:n}};
 },{maxRecords:512}));
}
