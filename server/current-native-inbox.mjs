import {readCurrentInboxDiscovery} from './current-inbox-discovery.mjs';
import {withCurrentReadContext,readCurrentHead,readCurrentMessage,chargeCurrentReadBudget,currentConversationRows} from './current-room-repository.mjs';
import {conversationCursorCodec} from './conversation-sync.mjs';
import {ServiceError} from './service-error.mjs';
import {readCurrentEventWindow} from './current-room-events.mjs';
import {effectiveMentionState} from './mention-lifecycle.mjs';
import {stampInbox} from './content-trust.mjs';
// Conversation delivery and standing obligations are separate cursors. Reading
// a source window neither acknowledges conversation nor clears formal work.
export function readCurrentNativeInbox(store,secret,roomId,{limit=50,after,olderCursor,expectedSessionBinding=null}={}){
 return store.readTransaction(()=>withCurrentReadContext(store.db,roomId,b=>{
  const auth=store.authenticate(secret,roomId,expectedSessionBinding),memberId=auth.member.id,head=readCurrentHead(store.db,roomId);
  const floor=store.historyFloor(roomId,memberId,head.sequence);
  const binding={kind:'native_inbox_older_v1',roomId,memberId,head:head.head_sha256,credential:auth.credentialHash,limit:Math.min(limit,4)};
  if(after!==undefined&&olderCursor!==undefined)throw new ServiceError(422,'invalid_inbox_cursor','Use after or olderCursor, not both');
  const recent=after===undefined;let older=null,page;
  if(recent){
    const saved=olderCursor===undefined?null:conversationCursorCodec(store).decode(olderCursor);
    if(olderCursor!==undefined&&(!saved||Object.entries(binding).some(([k,v])=>saved[k]!==v)))throw new ServiceError(409,'stale_inbox_cursor','Inbox source changed or the service restarted; restart without olderCursor');
    const selected=currentConversationRows(store,roomId,{viewerId:memberId,limit:binding.limit,before:saved?.before??head.sequence+1,beforeId:saved?.beforeId??'',messageId:null,channelId:null,peerMemberId:null,floor});
    const events=selected.rows.map(row=>{
      const m=JSON.parse(row.body),scalar=store.db.prepare('SELECT id,length(CAST(body AS BLOB)) AS bytes FROM events WHERE room_id=? AND sequence=?').get(roomId,row.position);
      if(!scalar||scalar.bytes>131072)throw new ServiceError(409,'current_room_context_unavailable','Recent message needs a bounded opening event');
      chargeCurrentReadBudget(b,scalar.bytes+256);const e=JSON.parse(store.db.prepare('SELECT body FROM events WHERE room_id=? AND sequence=?').get(roomId,row.position).body);
      if(e.id!==scalar.id||e.type!=='message.posted'||(e.data.messageId??e.id)!==m.id||e.actorId!==m.authorId||e.roomId!==roomId)throw Error('current_room_corrupt: recent opening identity differs');
      const chip=store.db.prepare("SELECT CASE WHEN length(CAST(state AS BLOB))<=128 THEN state END AS state,timeout_at AS timeoutAt FROM mention_states WHERE room_id=? AND message_event_id=? AND mentioned_member_id=?").get(roomId,e.id,memberId);chargeCurrentReadBudget(b,256);
      if(chip&&typeof chip.state!=='string')throw Error('current_room_corrupt: oversized mention state');
      e.mentions=chip?[{memberId,state:effectiveMentionState(chip,store.now())}]:[];
      return {sequence:row.position,event:{...e,data:{...e.data,body:m.deletedAt?null:m.body,toMemberId:m.toMemberId,replyToId:m.replyToId}}};
    });
    const continuation=selected.continuation;older={hasMore:!selected.complete,examined:selected.examined,nextRead:continuation?{tool:'room_read_inbox',arguments:{limit,olderCursor:conversationCursorCodec(store).encode({...binding,before:continuation.position,beforeId:continuation.messageId})}}:null};
    page={events,next:head.sequence,hasMore:false};
  }else page=readCurrentEventWindow(store,roomId,memberId,{after,limit:Math.min(limit,4)});
  const directMessages=[],directMentions=[],replies=[],parents=new Map();
  for(const {sequence,event:e}of page.events){if(e.type!=='message.posted'||e.actorId===memberId||e.data.body===null)continue;
   const id=e.data.messageId??e.id,row={sequence,eventId:e.id,messageId:id,replyToId:id,from:e.actorId,body:e.data.body,at:e.at,channel:e.data.channelId??'general',private:Boolean(e.data.toMemberId),...(e.data.toMemberId?{replyToMemberId:e.actorId}:{}),...(e.data.requestKind==='reply'&&e.data.requestPolicyVersion===1?{requestKind:'reply',nextRead:{tool:'room_read_request',arguments:{requestMessageId:id}}}:{})};
   if(e.data.toMemberId===memberId)directMessages.push(row);
   const chip=e.mentions?.find(x=>x.memberId===memberId&&['delivered','acknowledged','timed_out'].includes(x.state));if(chip){
    const observed=store.db.prepare('SELECT responded_at,late_acknowledged_at FROM mention_observations WHERE room_id=? AND message_event_id=? AND mentioned_member_id=?').get(roomId,e.id,memberId);chargeCurrentReadBudget(b,256);
    if(observed?.responded_at==null&&observed?.late_acknowledged_at==null)directMentions.push({...row,state:chip.state});
   }
   if(typeof e.data.replyToId==='string'){
    if(!parents.has(e.data.replyToId))parents.set(e.data.replyToId,readCurrentMessage(store.db,roomId,e.data.replyToId)?.value);
    const parent=parents.get(e.data.replyToId);
    if(parent?.authorId===memberId)replies.push({...row,inReplyTo:e.data.replyToId});
   }
  }
  const ownerId=store.roomAuthority(roomId,{memberId}).ownerId,discovery=readCurrentInboxDiscovery(store,roomId,auth.member,ownerId,floor,b),replyRequests=discovery.requests;
  const workNext={tool:'room_list_work',arguments:{roomId,focus:'needs_me',limit:1}},conversationNext=page.hasMore?{tool:'room_read_inbox',arguments:{limit,after:page.next}}:null;
  const next=[{action:'list-my-work',nextRead:workNext},{action:'list-open-requests',nextRead:workNext},...(conversationNext?[{action:'continue-conversation',nextRead:conversationNext}]:[])];
  return stampInbox({agentId:memberId,roomId,directMessages,directMentions,replies:stampInbox({directMessages:replies},memberId).directMessages,nativeWork:discovery.work,replyRequests,
   assignments:[],mentions:[],bondProposals:[],peerMessages:[],dmRequests:[],
   cursor:{after:page.next,hasMore:page.hasMore,nextRead:conversationNext},older,
   attention:{pendingMentions:directMentions.map(({sequence,replyToId,from,private:isPrivate})=>({sequence,replyToId,from,private:isPrivate})),hasMore:page.hasMore,acknowledges:false,nextRead:conversationNext},
   coverage:{mode:'native_bounded',globalAttentionComplete:false,conversation:{direction:recent?'recent':'catch_up',examined:recent?older.examined:page.next-after,through:page.next,complete:recent?!older.hasMore:!page.hasMore},
    work:{complete:false,nextRead:workNext,examined:discovery.examinedWork},requests:{complete:false,nextRead:workNext,examined:discovery.examinedRequests},
    standingMentions:{complete:false,nextRead:{tool:'room_read_inbox',arguments:{limit,after:0}}},
    omitted:['ambient fleet and bond presentation','peer-routing presentation','global unresolved-mention census'],
    legacyAssignments:{reconciledBeforeActivation:true,historyInspect:{method:'GET',path:`/api/rooms/${encodeURIComponent(roomId)}/collab/assignments`}}},
   sequence:head.sequence,next},memberId);
 }));
}
