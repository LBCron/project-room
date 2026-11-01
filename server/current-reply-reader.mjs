import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {isCurrentRoom,readCurrentHead,readCurrentRecord,readCurrentMessage,readCurrentHistoryFloor,readCurrentReplyRequestWindow,readCurrentWorkItem,currentRoomAuthority,withCurrentReadContext,chargeCurrentReadBudget} from './current-room-repository.mjs';
import {validId,ownMember} from '../src/events.js';
import {messageInHistory} from './history-visibility.mjs';
import {charterContext} from '../src/room-charter.js';
import {currentWorkRecord} from './work-context.mjs';
import {stampReplyRead} from './content-trust.mjs';
import {ServiceError} from './service-error.mjs';

const keys=new WeakMap(),WINDOW=8,PAGE_BYTES=65536;
const fail=(code,message,status=409)=>{throw new ServiceError(status,code,message);};
const changed=()=>fail('reply_history_changed','Request context changed or lacks its protected source; reconcile before resuming');
const directionMatches=(r,id,d)=>d==='incoming'?r.recipientId===id:d==='outgoing'?r.requesterId===id:[r.requesterId,r.recipientId].includes(id);
const visible=(m,id,floor)=>m&&messageInHistory(m,floor)&&(!m.toMemberId||m.authorId===id||m.toMemberId===id);
function codec(store){
 if(!keys.has(store))keys.set(store,randomBytes(32));
 return {
  encode(value){const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',keys.get(store),nonce),body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([nonce,cipher.getAuthTag(),body]).toString('base64url');},
  decode(token){try{
   if(typeof token!=='string'||token.length>4096||!/^[A-Za-z0-9_-]+$/.test(token))throw Error();
   const bytes=Buffer.from(token,'base64url');if(bytes.length<29||bytes.toString('base64url')!==token)throw Error();
   const decipher=createDecipheriv('aes-256-gcm',keys.get(store),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));
   return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
  }catch{fail('invalid_reply_cursor','Continuation expired, is malformed, or belongs to another store; restart this read. No request was changed.');}}
 };
}
const selectionKeys='v mode roomId viewerId accountId authEpoch roomCreatedEventId direction status requestMessageId'.split(' ');
function decodeBound(crypto,token,binding){
 const saved=crypto.decode(token);
 if(!saved||!selectionKeys.every(key=>saved[key]===binding[key]))fail('reply_cursor_identity_changed','Continuation belongs to another viewer or selection');
 return saved;
}
export function readCurrentReplies(store,token,roomId,mode,args,shape){
 if(!isCurrentRoom(store.db,roomId))return undefined;
 return store.readTransaction(()=>withCurrentReadContext(store.db,roomId,b=>{
  const auth=store.authenticate(token,roomId,args.expectedSessionBinding??null),db=store.db,head=readCurrentHead(db,roomId,b);
  const floor=readCurrentHistoryFloor(db,roomId,auth.member.id,b),authority=currentRoomAuthority(db,roomId),crypto=codec(store);
  const limit=args.limit??20;if(!Number.isSafeInteger(limit)||limit<1||limit>50)fail('invalid_reply_selection','Choose a page limit from1 to50',422);
  const requestMessageId=mode==='selected'?args.requestMessageId:null,direction=mode==='list'||mode==='history'?args.direction??'incoming':null,status=mode==='list'?args.status??'open':null;
  if(direction!==null&&!['incoming','outgoing','both'].includes(direction)||status!==null&&!['open','answered','declined','cancelled','all'].includes(status))fail('invalid_reply_selection','Choose a request direction and status',422);
  const eventCache=new Map(),messages=new Map(),requests=new Map();let evaluatedThrough=0;
  const eventAt=sequence=>{
   if(eventCache.has(sequence))return eventCache.get(sequence);
   const scalar=db.prepare('SELECT id,length(CAST(body AS BLOB)) AS bytes FROM events WHERE room_id=? AND sequence=?').get(roomId,sequence);
   if(!scalar||!validId(scalar.id)||scalar.bytes>131072)changed();chargeCurrentReadBudget(b,scalar.bytes+128);
   const row=db.prepare("SELECT sequence,id,json_extract(body,'$.id') AS eventId,json_extract(body,'$.type') AS type,json_extract(body,'$.actorId') AS actorId,json_extract(body,'$.at') AS at,json_extract(body,'$.data.messageId') AS messageId,json_extract(body,'$.data.requestMessageId') AS requestMessageId,json_extract(body,'$.data.responseToRequestId') AS responseToRequestId FROM events WHERE room_id=? AND sequence=?").get(roomId,sequence);
   if(row.id!==row.eventId)changed();eventCache.set(sequence,row);return row;
  };
  const created=eventAt(1);if(created.type!=='room.created')changed();
  const binding={v:2,mode,roomId,viewerId:auth.member.id,accountId:auth.account?.id??null,authEpoch:auth.account?.authEpoch??null,roomCreatedEventId:created.id,direction,status,requestMessageId};
  const base={contractVersion:2,roomId,viewerId:auth.member.id,viewerAccountId:auth.account?.id??null,viewerAuthEpoch:auth.account?.authEpoch??null,viewerSessionBinding:auth.sessionBinding,viewerSessionRevision:auth.sessionRevision??null,scope:{...shape.scope,coverage:'bounded-source-window'},evaluationScope:'visible-encountered-anchors'};
  const loadMessage=id=>{
   if(!validId(id)&&!(typeof id==='string'&&id.endsWith(':channel')))changed();
   if(!messages.has(id))messages.set(id,readCurrentMessage(db,roomId,id,b));return messages.get(id);
  };
  const loadRequest=id=>{
   if(!requests.has(id)){const request=readCurrentRecord(db,roomId,'replyRequests',id,b);
    if(request&&(request.id!==id||!validId(request.openingEventId)||!validId(request.requesterId)||!validId(request.recipientId)||request.requesterId===request.recipientId||!['open','answered','declined','cancelled'].includes(request.status)||!Number.isSafeInteger(request.revision)||request.revision<0))changed();requests.set(id,request);}
   return requests.get(id);
  };
  const noteRequest=request=>{
   for(const id of [request.openingEventId,request.contextEventId,request.terminalEventId].filter(Boolean)){
    const row=db.prepare('SELECT sequence FROM events WHERE room_id=? AND id=?').get(roomId,id);chargeCurrentReadBudget(b,128);if(!row)changed();evaluatedThrough=Math.max(evaluatedThrough,row.sequence);
   }
  };
  if(mode==='list'){
   const saved=args.cursor==null?null:decodeBound(crypto,args.cursor,binding);
   if(saved&&typeof saved.after!=='string')fail('invalid_reply_cursor','Invalid request source continuation');
   const source=readCurrentReplyRequestWindow(store,roomId,{after:saved?.after??'',limit:Math.min(limit,WINDOW)});
   const selected=source.requests.filter(r=>directionMatches(r,auth.member.id,direction)&&messageInHistory({id:r.id,createdAt:r.createdAt},floor)&&(status==='all'||r.status===status));
   for(const request of selected)noteRequest(request);
   const nextCursor=source.hasMore?crypto.encode({...binding,after:source.examinedAfter}):null;
   const nextRead=nextCursor?{tool:'room_list_requests',arguments:{direction,status,limit,cursor:nextCursor}}:null;
   return {...base,evaluatedThrough,selection:{direction,status},requests:selected.map(shape.compactRequest),nextReads:selected.map(r=>({requestMessageId:r.id,http:{method:'GET',path:`/api/rooms/${encodeURIComponent(roomId)}/reply-context?requestMessageId=${encodeURIComponent(r.id)}`},nextRead:{tool:'room_read_request',arguments:{requestMessageId:r.id}}})),sourceWindow:{complete:!source.hasMore,consistency:'current-per-page'},page:{cursor:args.cursor??null,limit,hasMore:source.hasMore,nextCursor,nextRead},nextRead};
  }
  if(mode!=='selected')fail('current_reply_context_unavailable','Normalized request history requires its qualified bounded reader');
  const request=loadRequest(requestMessageId);
  if(!request||!directionMatches(request,auth.member.id,'both')||!messageInHistory({id:request.id,createdAt:request.createdAt},floor))fail('reply_request_not_found','Request not found in this Room',404);
  const opening=loadMessage(request.id),context=loadMessage(request.contextMessageId);
  if(!opening||!context)changed();
  const openingEvent=eventAt(opening.row.seq),contextEvent=eventAt(context.row.seq);
  if(openingEvent.type!=='message.posted'||openingEvent.id!==request.openingEventId||openingEvent.messageId!==request.id||opening.value.authorId!==request.requesterId||opening.value.toMemberId!==request.recipientId||openingEvent.actorId!==opening.value.authorId||openingEvent.at!==opening.value.createdAt||opening.value.createdAt!==request.createdAt||contextEvent.type!=='message.posted'||contextEvent.id!==request.contextEventId||contextEvent.messageId!==request.contextMessageId||contextEvent.actorId!==context.value.authorId||contextEvent.at!==context.value.createdAt)changed();
  if(!visible(context.value,auth.member.id,floor))fail('reply_context_unavailable','Latest request context is outside the visible conversation; ask for a new request');
  evaluatedThrough=Math.max(opening.row.seq,context.row.seq);
  const ownerCache=new Map();
  const ownerOf=id=>{
   if(ownerCache.has(id))return ownerCache.get(id);
   const path=[];let cursor=id,previous=Number.MAX_SAFE_INTEGER,owner=null;
   for(let depth=0;cursor;depth++){
    if(depth>=32)fail('current_reply_context_unavailable','Reply ancestry exceeds the addressed context budget');
    if(ownerCache.has(cursor)){owner=ownerCache.get(cursor);break;}
    const message=loadMessage(cursor);if(!message)changed();if(message.row.seq>=previous)changed();previous=message.row.seq;
    const explicit=loadRequest(cursor);if(explicit){owner=explicit;ownerCache.set(cursor,owner);break;}
    path.push(message.value);cursor=message.value.replyToId;
   }
   for(const message of path.reverse()){if(owner&&message.workItemId&&message.workItemId!==owner.workItemId)owner=null;ownerCache.set(message.id,owner);}
   return owner;
  };
  if(ownerOf(context.value.id)?.id!==request.id)changed();
  // Required prior constraints must not be silently dropped from actionable preparation.
  if(opening.value.replyToId){const parent=loadMessage(opening.value.replyToId),prior=parent?.value.replyToId&&loadRequest(parent.value.replyToId);
   if(prior?.status==='answered'&&prior.responseMessageId===parent.value.id&&prior.requesterId===request.requesterId&&prior.recipientId===request.recipientId&&prior.workItemId===request.workItemId)fail('reply_follow_up_unavailable','Earlier exchange preparation requires qualified normalized context; start a new request with the relevant context');}
  const saved=args.cursor==null?null:decodeBound(crypto,args.cursor,binding);
  if(saved&&saved.requestRevision!==request.revision)fail('reply_history_changed','Request revision changed; reconcile before resuming');
  const horizon=saved?.horizon??head.sequence,anchor=saved?.anchor??eventAt(horizon).id;
  if(!Number.isSafeInteger(horizon)||horizon>head.sequence||eventAt(horizon).id!==anchor)changed();
  const after=saved?.after??{sequence:opening.row.seq-1,id:'\uffff'};
  if(!Number.isSafeInteger(after.sequence)||typeof after.id!=='string')fail('invalid_reply_cursor','Invalid request source continuation');
  const count=Math.min(limit,WINDOW),indexed=db.prepare('SELECT message_id,seq FROM messages INDEXED BY messages_room_thread_seq WHERE room_id=? AND thread_root_id=? AND (seq,message_id)>(?,?) AND seq<=? ORDER BY seq,message_id LIMIT ?').all(roomId,opening.row.thread_root_id??opening.value.id,after.sequence,after.id,horizon,count+1);
  // Root posts have NULL thread_root_id; descendants name that root. Merge
  // the one addressed root with its bounded indexed descendant stream.
  const root=opening.row.thread_root_id===null&&(opening.row.seq>after.sequence||opening.row.seq===after.sequence&&opening.value.id>after.id)&&opening.row.seq<=horizon?[{message_id:opening.value.id,seq:opening.row.seq}]:[];
  const source=[...root,...indexed].sort((a,c)=>a.seq-c.seq||Buffer.compare(Buffer.from(a.message_id),Buffer.from(c.message_id))).slice(0,count+1);
  chargeCurrentReadBudget(b,source.reduce((n,row)=>n+Buffer.byteLength(row.message_id)+32,0),source.length);
  const items=[];let rowBytes=0,last=after,examined=0;
  for(const row of source.slice(0,count)){
   const message=loadMessage(row.message_id);if(!message||message.row.seq!==row.seq)changed();
   const owner=ownerOf(row.message_id);let item=null;
   if(owner?.id===request.id&&visible(message.value,auth.member.id,floor)){
    const event=eventAt(row.seq);if(event.type!=='message.posted'||event.messageId!==row.message_id||event.actorId!==message.value.authorId||event.at!==message.value.createdAt)changed();
    const kind=event.id===request.openingEventId?'opened':event.id===request.terminalEventId?request.status:'context';
    item={sequence:row.seq,eventId:event.id,requestMessageId:request.id,kind,requesterId:request.requesterId,recipientId:request.recipientId,workItemId:request.workItemId,actorId:event.actorId,at:event.at,message:shape.readMessage({...message.value,body:message.value.deletedAt?null:message.value.body})};
    const bytes=Buffer.byteLength(JSON.stringify(item));if(rowBytes+bytes>PAGE_BYTES){if(!items.length)fail('reply_entry_too_large','One request entry exceeds the page budget',413);break;}rowBytes+=bytes;items.push(item);evaluatedThrough=Math.max(evaluatedThrough,row.seq);
   }
   last={sequence:row.seq,id:row.message_id};examined++;
  }
  const hasMore=source.length>examined;
  const nextCursor=hasMore?crypto.encode({...binding,requestRevision:request.revision,horizon,anchor,after:last}):null;
  const nextRead=nextCursor?{tool:'room_read_request',arguments:{requestMessageId,limit,cursor:nextCursor}}:null;
  if(request.status==='cancelled')fail('current_reply_context_unavailable','Cancelled request context requires its qualified terminal reader');
  if(request.terminalEventId){const terminal=loadMessage(request.responseMessageId);if(!terminal||eventAt(terminal.row.seq).id!==request.terminalEventId||request.responseContextSequence!==context.row.seq)changed();evaluatedThrough=Math.max(evaluatedThrough,terminal.row.seq);}
  const requester=ownMember(authority.members,request.requesterId),recipient=ownMember(authority.members,request.recipientId),room=readCurrentRecord(db,roomId,'metadata','room',b);
  const denied=store.dmConsents.deniedDirection(roomId,auth.member.id,auth.member.id===request.requesterId?request.recipientId:request.requesterId);
  const canReply=!denied&&requester?.active===true&&recipient?.active===true;
  const answerBasis=request.status==='open'&&auth.member.id===request.recipientId&&canReply&&!hasMore&&context.row.seq<=horizon?{expectedRequestRevision:request.revision,contextEventId:contextEvent.id,contextSequence:context.row.seq}:null;
  const instructions=charterContext(room),work=request.workItemId?readCurrentWorkItem(db,roomId,request.workItemId):null;
  return stampReplyRead({...base,evaluatedThrough,selection:{direction:null,requestMessageId},request:structuredClone(request),roomCreatedEventId:created.id,sourceWindow:{complete:!hasMore,consistency:'frozen-conversation-current-preparation'},page:{cursor:args.cursor??null,checkpoint:null,items,rowBytes,limit,hasMore,nextCursor,completedCheckpoint:null,nextRead},nextRead,
   ...shape.responseTemplates(roomId,auth.member.id,request,answerBasis),
   current:{evaluatedThrough,requesterAvailable:requester?.active===true,recipientAvailable:recipient?.active===true,contextEventId:contextEvent.id,contextSequence:context.row.seq,answerBasis,actions:{reply:canReply,answer:Boolean(answerBasis),decline:Boolean(answerBasis),cancel:false},blockedBy:[...(denied?[denied]:[]),'normalized_cancel_unavailable'],workItemId:request.workItemId,instructionsRevision:room.charter?.revision??0},
   preparation:{version:1,evaluatedThrough,room:{id:room.id,title:room.title,purpose:instructions.charter?.purpose??room.purpose??''},instructions,previousExchanges:[],work:work?currentWorkRecord(work):null,omitted:['other_work','other_messages','private_inbox','external_resources'],externalExecution:false}},auth.member.id);
 }));
}
