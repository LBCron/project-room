import {readCurrentEventEnvelope} from './current-event-envelope.mjs';
import {inboxNext} from './inbox-next.mjs';
import {readCurrentInboxDiscovery} from './current-inbox-discovery.mjs';
import {withCurrentReadContext,readCurrentHead,readCurrentMessage,readCurrentRecord,chargeCurrentReadBudget,currentConversationRows} from './current-room-repository.mjs';
import {conversationCursorCodec} from './conversation-sync.mjs';
import {ServiceError} from './service-error.mjs';
import {readCurrentEventWindow,validateCurrentEventSelection,CURRENT_EVENT_SOURCE_BYTES} from './current-room-events.mjs';
import {effectiveMentionState} from './mention-lifecycle.mjs';
import {stampInbox} from './content-trust.mjs';
// Bounded, fail-open skip-ahead. An event is skipped only when trusted
// sources positively show catch-up would never surface it to this viewer:
// - not message.posted (catch-up returns only message.posted), from the event log;
// - the viewer's own message, from the event log actor;
// - otherwise not a DM to the viewer, not mentioning the viewer, and not a reply
//   to the viewer, where recipient, author and parent come from the event log AND
//   must equal the protected messageWitness header (parent author from the
//   parent's witness header). The mention check uses the same mention_states
//   row the existing reader already relies on for directMentions.
// Anything missing, oversized, legacy (no header) or inconsistent stops the skip
// at that event, which then goes through the normal verified read.
const SKIP_WINDOW=64,SKIP_EVENT_BYTES=4096;
function firstAddressedSequence(db,roomId,memberId,after,headSequence,b){
 const small=key=>`CASE WHEN length(CAST(body AS BLOB))<=${SKIP_EVENT_BYTES} THEN json_extract(body,'${key}') END`;
 const rows=db.prepare(`SELECT sequence,id,length(CAST(body AS BLOB)) AS bytes,${small('$.type')} AS type,${small('$.actorId')} AS actorId,${small('$.data.messageId')} AS messageId,${small('$.data.toMemberId')} AS toMemberId,${small('$.data.replyToId')} AS replyToId
   FROM events WHERE room_id=? AND sequence>? AND sequence<=? ORDER BY sequence LIMIT ?`).all(roomId,after,headSequence,SKIP_WINDOW);
 chargeCurrentReadBudget(b,rows.reduce((n,row)=>n+Math.min(row.bytes??0,SKIP_EVENT_BYTES)+64,0),1);
 const mention=db.prepare('SELECT 1 FROM mention_states WHERE room_id=? AND message_event_id=? AND mentioned_member_id=? LIMIT 1');
 const header=id=>typeof id==='string'&&id?readCurrentRecord(db,roomId,'messageWitness',id,b)?.header:undefined;
 const stop=row=>({found:true,after:row.sequence-1,skipped:row.sequence-1-after});
 for(const row of rows){
  if(!(row.bytes<=SKIP_EVENT_BYTES)||typeof row.type!=='string')return stop(row);
  if(row.type!=='message.posted')continue;
  if(typeof row.actorId!=='string')return stop(row);
  if(row.actorId===memberId)continue;
  if(row.toMemberId===memberId||mention.get(roomId,row.id,memberId))return stop(row);
  const own=header(row.messageId??row.id);
  if(!own||own.author_id!==row.actorId||own.to_member_id!==(row.toMemberId??null)||own.reply_to_id!==(row.replyToId??null)||own.seq!==row.sequence)return stop(row);
  if(own.reply_to_id!==null){const parent=header(own.reply_to_id);if(!parent||parent.author_id===memberId)return stop(row);}
 }
 const last=rows.length?rows.at(-1).sequence:after;
 return {found:false,after:last,skipped:last-after};
}
// Conversation delivery and standing obligations are separate cursors. Reading
// a source window neither acknowledges conversation nor clears formal work.
export function readCurrentNativeInbox(store,secret,roomId,{limit=50,after,olderCursor,expectedSessionBinding=null,skipUnaddressed=false}={}){
 return store.readTransaction(()=>withCurrentReadContext(store.db,roomId,b=>{
  const auth=store.authenticate(secret,roomId,expectedSessionBinding),memberId=auth.member.id,head=readCurrentHead(store.db,roomId);
  const floor=store.historyFloor(roomId,memberId,head.sequence);
  const binding={kind:'native_inbox_older_v1',roomId,memberId,head:head.head_sha256,credential:auth.credentialHash,limit:Math.min(limit,4)};
  if(after!==undefined&&olderCursor!==undefined)throw new ServiceError(422,'invalid_inbox_cursor','Use after or olderCursor, not both');
  const recent=after===undefined;let older=null,page,start=null;
  if(recent){
    const saved=olderCursor===undefined?null:conversationCursorCodec(store).decode(olderCursor);
    if(olderCursor!==undefined&&(!saved||Object.entries(binding).some(([k,v])=>saved[k]!==v)))throw new ServiceError(409,'stale_inbox_cursor','Inbox source changed or the service restarted; restart without olderCursor');
    const selected=currentConversationRows(store,roomId,{viewerId:memberId,limit:binding.limit,before:saved?.before??head.sequence+1,beforeId:saved?.beforeId??'',messageId:null,channelId:null,peerMemberId:null,floor,liveOnly:true});
    const events=[];let sourceBytes=0,last=null,prefixTruncated=false;
    for(const row of selected.rows){
      const m=JSON.parse(row.body),scalar=store.db.prepare('SELECT length(CAST(id AS BLOB)) AS idBytes,length(CAST(body AS BLOB)) AS bodyBytes FROM events WHERE room_id=? AND sequence=?').get(roomId,row.position);
      if(!scalar)throw new ServiceError(409,'current_room_context_unavailable','Recent message needs a bounded opening event');
      const bytes=scalar.idBytes+scalar.bodyBytes+32;
      if (events.length && sourceBytes + bytes > CURRENT_EVENT_SOURCE_BYTES){prefixTruncated=true;break;}
      const source=readCurrentEventEnvelope(store.db,roomId,{sequence:row.position,...scalar},b),e=source.event;
      sourceBytes+=bytes;last=row;
      if(e.type!=='message.posted'||(e.data.messageId??e.id)!==m.id||e.actorId!==m.authorId||e.roomId!==roomId)throw Error('current_room_corrupt: recent opening identity differs');
      const chip=store.db.prepare("SELECT CASE WHEN length(CAST(state AS BLOB))<=128 THEN state END AS state,timeout_at AS timeoutAt FROM mention_states WHERE room_id=? AND message_event_id=? AND mentioned_member_id=?").get(roomId,e.id,memberId);chargeCurrentReadBudget(b,256);
      if(chip&&typeof chip.state!=='string')throw Error('current_room_corrupt: oversized mention state');
      e.mentions=chip?[{memberId,state:effectiveMentionState(chip,store.now())}]:[];
      events.push({sequence:row.position,event:{...e,data:{...e.data,body:m.deletedAt?null:m.body,toMemberId:m.toMemberId,replyToId:m.replyToId}}});
    }
    const continuation=prefixTruncated?{position:last.position,messageId:last.messageId}:selected.continuation;
    older={hasMore:prefixTruncated||!selected.complete,examined:selected.examined,nextRead:continuation?{tool:'room_read_inbox',arguments:{roomId,limit,olderCursor:conversationCursorCodec(store).encode({...binding,before:continuation.position,beforeId:continuation.messageId})}}:null};
    page={events,next:head.sequence,hasMore:false};
  }else{
    // Skip only events that trusted sources positively show are not addressed
    // to this viewer, so catch-up pages lead with attention (see above).
    validateCurrentEventSelection(after,Math.min(limit,4),{types:['message.posted']});
    if(after>head.sequence)throw new ServiceError(409,'cursor_ahead','Cursor exceeds room history; fetch a fresh snapshot');
    // Opt-in for room_read_inbox only: needs-me and digests keep their exact
    // four-event examined contract.
    start=skipUnaddressed?firstAddressedSequence(store.db,roomId,memberId,after,head.sequence,b):{found:true,after};
    page=start.found
      ?readCurrentEventWindow(store,roomId,memberId,{after:start.after,limit:Math.min(limit,4),types:['message.posted']})
      :{events:[],next:start.after,hasMore:start.after<head.sequence};
  }
  const directMessages=[],directMentions=[],replies=[],parents=new Map();
  for(const {sequence,event:e}of page.events){if(e.type!=='message.posted'||e.actorId===memberId||e.data.body===null)continue;
   const id=e.data.messageId??e.id,row={sequence,eventId:e.id,messageId:id,replyToId:id,from:e.actorId,body:e.data.body,at:e.at,channel:e.data.channelId??'general',private:Boolean(e.data.toMemberId),...(e.data.toMemberId?{replyToMemberId:e.actorId}:{}),...(e.data.requestKind==='reply'&&e.data.requestPolicyVersion===1?{requestKind:'reply',nextRead:{tool:'room_read_request',arguments:{roomId,requestMessageId:id}}}:{})};
   if(e.data.toMemberId===memberId)directMessages.push(row);
   const chip=e.mentions?.find(x=>x.memberId===memberId&&['delivered','acknowledged','timed_out'].includes(x.state));if(chip){
    const observed=store.db.prepare('SELECT responded_at,late_acknowledged_at FROM mention_observations WHERE room_id=? AND message_event_id=? AND mentioned_member_id=?').get(roomId,e.id,memberId);chargeCurrentReadBudget(b,256);
    if(observed?.responded_at==null&&observed?.late_acknowledged_at==null)directMentions.push({...row,state:chip.state});
   }
   if(typeof e.data.replyToId==='string'&&e.data.requestKind!=='reply'){
    if(!parents.has(e.data.replyToId))parents.set(e.data.replyToId,readCurrentMessage(store.db,roomId,e.data.replyToId)?.value);
    const parent=parents.get(e.data.replyToId);
    if(parent?.authorId===memberId)replies.push({...row,inReplyTo:e.data.replyToId});
   }
  }
  const ownerId=store.roomAuthority(roomId,{memberId}).ownerId,discovery=readCurrentInboxDiscovery(store,roomId,auth.member,ownerId,floor,b),replyRequests=discovery.requests;
  const workNext={tool:'room_list_work',arguments:{roomId,focus:'needs_me',limit:1}},conversationNext=page.hasMore?{tool:'room_read_inbox',arguments:{roomId,limit,after:page.next}}:null;
  const requestStates={};
  for(const item of [...directMessages,...directMentions])if(item.requestKind==='reply'){
   const request=readCurrentRecord(store.db,roomId,'replyRequests',item.messageId,b);
   if(request&&[request.requesterId,request.recipientId].includes(memberId))requestStates[item.messageId]=request;
  }
  for(const request of replyRequests)requestStates[request.id]={...request,status:'open'};
  const formalPointers=replyRequests.map(request=>({nextRead:request.nextRead}));
  const peer=store.bonds.nativeInboxForMember(roomId,memberId,limit,(bytes,records)=>chargeCurrentReadBudget(b,bytes,records));
  const next=inboxNext(roomId,directMessages,[],[],[...formalPointers,...directMentions],peer.bondProposals,peer.peerMessages,requestStates)
   .map(step=>step.nextRead?{...step,nextRead:{...step.nextRead,arguments:{roomId,...step.nextRead.arguments}}}:step);
  if(!peer.coverage.bonds.complete)next.push({action:'inspect-bonds',method:'POST',path:`/api/rooms/${encodeURIComponent(roomId)}/commands`,description:'This bounded proposal source is incomplete. Inspect bond.list before treating bond attention as complete.'});
  if(!peer.coverage.peerMessages.complete)next.push({action:'inspect-peer-messages',method:'GET',path:`/api/rooms/${encodeURIComponent(roomId)}/peer-dms`,description:'This bounded peer-message source is incomplete. Read selected peer threads for earlier messages.'});
  if(conversationNext)next.unshift({action:'continue-conversation',nextRead:conversationNext});
  if(older?.nextRead)next.push({action:'read-older-conversation',nextRead:older.nextRead});
  // A bounded empty source page is not proof that conversation is empty.
  const empty=next.find(step=>step.action==='watch-inbox');
  if(empty){const i=next.indexOf(empty);next[i]={...empty,description:'No conversation items in this bounded page. Follow conversation continuations and list-open-requests/list-my-work; reading does not acknowledge or accept anything.'};}
  return stampInbox({agentId:memberId,roomId,directMessages,directMentions,replies:stampInbox({directMessages:replies},memberId).directMessages,nativeWork:discovery.work,replyRequests,
   assignments:[],mentions:[],bondProposals:peer.bondProposals,peerMessages:peer.peerMessages,dmRequests:[],
   cursor:{after:page.next,hasMore:page.hasMore,nextRead:conversationNext},older,
   attention:{pendingMentions:directMentions.map(({sequence,replyToId,from,private:isPrivate})=>({sequence,replyToId,from,private:isPrivate})),hasMore:page.hasMore,acknowledges:false,nextRead:conversationNext},
   coverage:{mode:'native_bounded',globalAttentionComplete:false,conversation:{direction:recent?'recent':'catch_up',examined:recent?older.examined:page.next-(start?.after??after),through:page.next,complete:recent?!older.hasMore:!page.hasMore,...(!recent&&skipUnaddressed?{skippedUnaddressed:(start?.after??after)-after}:{})},
    work:{complete:false,nextRead:workNext,examined:discovery.examinedWork},requests:{complete:false,nextRead:workNext,examined:discovery.examinedRequests},
    standingMentions:{complete:false,nextRead:{tool:'room_read_inbox',arguments:{roomId,limit,after:0}}},
    peer:peer.coverage,
    omitted:['ambient fleet presentation','global unresolved-mention census'],
    legacyAssignments:{reconciledBeforeActivation:true,historyInspect:{method:'GET',path:`/api/rooms/${encodeURIComponent(roomId)}/collab/assignments`}}},
   sequence:head.sequence,next},memberId);
 // One bounded operation includes selected events, protected parent context,
 // overlapping mention/request obligations and indexed work discovery.
 // Keep source windows and byte limits unchanged; ordinary reads stay at 200.
 },{maxRecords:512}));
}
