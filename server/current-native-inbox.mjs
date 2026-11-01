import {withCurrentReadContext,readCurrentHead,readCurrentMessage,readCurrentReplyRequestWindow} from './current-room-repository.mjs';
import {readCurrentEventWindow} from './current-room-events.mjs';
import {messageInHistory} from './history-visibility.mjs';
import {stampInbox} from './content-trust.mjs';
// Conversation delivery and standing obligations are separate cursors. Reading
// a source window neither acknowledges conversation nor clears formal work.
export function readCurrentNativeInbox(store,secret,roomId,{limit=50,after=0,expectedSessionBinding=null}={}){
 return store.readTransaction(()=>withCurrentReadContext(store.db,roomId,()=>{
  const auth=store.authenticate(secret,roomId,expectedSessionBinding),memberId=auth.member.id,head=readCurrentHead(store.db,roomId);
  const page=readCurrentEventWindow(store,roomId,memberId,{after,limit:Math.min(limit,4)}),directMessages=[],directMentions=[],replies=[];
  for(const {sequence,event:e}of page.events){if(e.type!=='message.posted'||e.actorId===memberId||e.data.body===null)continue;
   const id=e.data.messageId??e.id,row={sequence,eventId:e.id,messageId:id,replyToId:id,from:e.actorId,body:e.data.body,at:e.at,channel:e.data.channelId??'general',private:Boolean(e.data.toMemberId),...(e.data.toMemberId?{replyToMemberId:e.actorId}:{}),...(e.data.requestKind==='reply'&&e.data.requestPolicyVersion===1?{requestKind:'reply',nextRead:{tool:'room_read_request',arguments:{requestMessageId:id}}}:{})};
   if(e.data.toMemberId===memberId)directMessages.push(row);
   const chip=e.mentions?.find(x=>x.memberId===memberId&&['delivered','acknowledged','timed_out'].includes(x.state));if(chip)directMentions.push({...row,state:chip.state});
   if(typeof e.data.replyToId==='string'){
    const parent=readCurrentMessage(store.db,roomId,e.data.replyToId)?.value;
    if(parent?.authorId===memberId)replies.push({...row,inReplyTo:e.data.replyToId});
   }
  }
  const requests=readCurrentReplyRequestWindow(store,roomId,{limit:1}),floor=store.historyFloor(roomId,memberId,head.sequence);
  const replyRequests=requests.requests.filter(r=>r.recipientId===memberId&&r.status==='open'&&messageInHistory({id:r.id,createdAt:r.createdAt},floor)).map(r=>({id:r.id,requesterId:r.requesterId,workItemId:r.workItemId,revision:r.revision,nextRead:{tool:'room_read_request',arguments:{requestMessageId:r.id}}}));
  const workNext={tool:'room_list_work',arguments:{roomId,focus:'needs_me',limit:1}},conversationNext=page.hasMore?{tool:'room_read_inbox',arguments:{limit,after:page.next}}:null;
  const next=[{action:'list-my-work',nextRead:workNext??{tool:'room_list_work',arguments:{roomId,focus:'needs_me',limit:1}}},...(conversationNext?[{action:'continue-conversation',nextRead:conversationNext}]:[])];
  return stampInbox({agentId:memberId,roomId,directMessages,directMentions,replies:stampInbox({directMessages:replies},memberId).directMessages,nativeWork:[],replyRequests,
   assignments:[],mentions:[],bondProposals:[],peerMessages:[],dmRequests:[],
   cursor:{after:page.next,hasMore:page.hasMore,nextRead:conversationNext},
   attention:{pendingMentions:directMentions.map(({sequence,replyToId,from,private:isPrivate})=>({sequence,replyToId,from,private:isPrivate})),hasMore:page.hasMore,acknowledges:false,nextRead:conversationNext},
   coverage:{mode:'native_bounded',globalAttentionComplete:false,conversation:{examined:page.next-after,through:page.next,complete:!page.hasMore},
    work:{complete:false,nextRead:workNext,examined:0},requests:{complete:!requests.hasMore,nextRead:requests.hasMore?workNext:null,examined:requests.requests.length},
    standingMentions:{complete:false,nextRead:{tool:'room_read_inbox',arguments:{limit,after:0}}},
    omitted:['ambient fleet and bond presentation','peer-routing presentation','global unresolved-mention census'],
    legacyAssignments:{reconciledBeforeActivation:true,historyInspect:{method:'GET',path:`/api/rooms/${encodeURIComponent(roomId)}/collab/assignments`}}},
   sequence:head.sequence,next},memberId);
 }));
}
