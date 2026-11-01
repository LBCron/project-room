import {ownMember} from '../src/events.js';
// Normalized event-log compatibility reader. Candidate admission precedes all
// residual/audience filters; an empty visible page can still have more source.
import {currentRoomAuthority,readCurrentRecord,readCurrentHead,readCurrentMessage,readCurrentHistoryFloor,withCurrentReadContext,chargeCurrentReadBudget} from './current-room-repository.mjs';
import {dmEventVisibility,dmConsentEventVisible,DM_FOLLOW_UP_TYPES} from './dm-event-visibility.mjs';
import {peerEventVisible} from './bonds.mjs';
import {rowInHistory,messageInHistory} from './history-visibility.mjs';
import {redactEventPage} from './redact-read.mjs';
import {effectiveMentionState} from './mention-lifecycle.mjs';
import {ServiceError} from './service-error.mjs';

export const CURRENT_EVENT_WINDOW=16;
const contexts=new WeakMap();
const fail=(status,code,message)=>{throw new ServiceError(status,code,message);};
const unavailable=()=>fail(409,'current_room_context_unavailable','Event source exceeds bounded input or is malformed; cursor was not advanced');
export function currentEventRedactionMessages(roomId,page){
 const context=page&&contexts.get(page);
 if(!context||context.roomId!==roomId)fail(409,'current_room_context_unavailable','Normalized event redaction requires its selected event page');
 return context.messages;
}
export function validateCurrentEventSelection(after,limit,opts){
 if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>100)fail(422,'invalid_cursor','Invalid event cursor or limit');
 if(opts.actor!=null&&(typeof opts.actor!=='string'||!opts.actor))fail(422,'invalid_cursor','Invalid actor filter');
 for(const name of ['since','until'])if(opts[name]!=null&&(typeof opts[name]!=='string'||Number.isNaN(Date.parse(opts[name]))))fail(422,'invalid_cursor','Invalid '+name+' timestamp');
 if(opts.types!=null&&(!Array.isArray(opts.types)||!opts.types.length||opts.types.length>16||opts.types.some(type=>typeof type!=='string'||!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(type))))fail(422,'invalid_cursor','Invalid type filter');
 if(opts.mentions!=null&&(typeof opts.mentions!=='string'||!opts.mentions||opts.mentions.length>128))fail(422,'invalid_cursor','Invalid mentions filter');
}
function compactEvent(event){
 const out={};for(const [key,value]of Object.entries(event)){
  if(key==='idempotencyKey'||key==='roomId'||(key==='causationId'&&value===null))continue;
  out[key]=key==='mentions'?value.map(({displayName,...rest})=>rest):value;
 }return out;
}
// Caller owns the read transaction/authentication. Nested current contexts reuse
// the same budget, including auth, source envelopes, proofs, messages and chips.
export function readCurrentEventWindow(store,roomId,viewerId,{after=0,limit=100,...opts}={}){
 return withCurrentReadContext(store.db,roomId,b=>{
  validateCurrentEventSelection(after,limit,opts);
  const db=store.db,head=readCurrentHead(db,roomId,b),authority=currentRoomAuthority(db,roomId,{memberId:viewerId});
  if(!head||!ownMember(authority?.members,viewerId)||ownMember(authority.members,viewerId).active===false)fail(403,'member_required','Viewer must belong to this room');
  if(after>head.sequence)fail(409,'cursor_ahead','Cursor exceeds room history; fetch a fresh snapshot');
  const floor=readCurrentHistoryFloor(db,roomId,viewerId,b),isOwner=viewerId===authority.ownerId;
  const identityId=store.bonds.identityForMember(roomId,viewerId);
  // The primary key (room_id,sequence) bounds physical candidates. No JSON
  // predicate occurs before LIMIT. Scalar lengths admit payloads before fetch.
  const selected=db.prepare('SELECT sequence,length(CAST(id AS BLOB)) AS idBytes,length(CAST(body AS BLOB)) AS bodyBytes FROM events WHERE room_id=? AND sequence>? AND sequence<=? ORDER BY sequence LIMIT ?').all(roomId,after,head.sequence,Math.min(limit,CURRENT_EVENT_WINDOW));
  for(const row of selected){if(!Number.isSafeInteger(row.sequence)||row.idBytes>512||row.bodyBytes>131072||row.bodyBytes<2)unavailable();chargeCurrentReadBudget(b,row.idBytes+row.bodyBytes+32);}
  const rows=selected.map(row=>{
   const source=db.prepare('SELECT id,body FROM events WHERE room_id=? AND sequence=?').get(roomId,row.sequence);let e;
   try{e=JSON.parse(source.body);}catch{unavailable();}
   if(!e||Array.isArray(e)||e.id!==source.id||e.roomId!==roomId||typeof e.type!=='string'||typeof e.actorId!=='string'||typeof e.at!=='string'||Number.isNaN(Date.parse(e.at))||!e.data||typeof e.data!=='object'||Array.isArray(e.data))unavailable();
   return {sequence:row.sequence,event:e};
  });
  const chipMembers=new Map(),chipMember=id=>{if(!chipMembers.has(id)){const member=readCurrentRecord(db,roomId,'members',id,b);if(member!==undefined&&member.id!==id)unavailable();chipMembers.set(id,member);}return chipMembers.get(id);};
  const messages=new Map(),load=id=>{
   if(typeof id!=='string'||!id||id.length>200)return undefined;
   if(!messages.has(id))messages.set(id,readCurrentMessage(db,roomId,id,b)?.value);
   return messages.get(id);
  };
  // Follow-up party resolution and floor checks use only addressed records.
  for(const {event:e}of rows)if(DM_FOLLOW_UP_TYPES.has(e.type)||e.data.requestMessageId)load(e.data.messageId??e.data.requestMessageId);
  const dm=dmEventVisibility(viewerId,[...messages.values()].filter(Boolean),rows);
  const mentioned=opts.mentions==='me'?viewerId:opts.mentions;
  const visible=rows.filter(row=>{
   const e=row.event;
   if(!rowInHistory(row,floor,messages)||!dm(e)||!dmConsentEventVisible(e,viewerId,isOwner)||!peerEventVisible(e,{memberId:viewerId,identityId,isOwner}))return false;
   if(opts.actor!=null&&e.actorId!==opts.actor||opts.since!=null&&e.at<opts.since||opts.until!=null&&e.at>opts.until||opts.types!=null&&!opts.types.includes(e.type))return false;
   if(mentioned!=null&&!db.prepare('SELECT 1 FROM mention_states WHERE room_id=? AND message_event_id=? AND mentioned_member_id=? LIMIT 1').get(roomId,e.id,mentioned))return false;
   if(e.type==='message.posted'){
    const message=load(e.data.messageId??e.id);
    if(floor&&!messageInHistory(message,floor))return false;
   }
   return true;
  });
  for(const {event:e}of visible){
   if(e.type!=='message.posted')continue;
   const scalars=db.prepare('SELECT length(CAST(mentioned_member_id AS BLOB)) AS memberBytes,length(CAST(state AS BLOB)) AS stateBytes FROM mention_states WHERE room_id=? AND message_event_id=? LIMIT 101').all(roomId,e.id);
   if(scalars.length>100||scalars.some(r=>r.memberBytes>512||r.stateBytes>128))unavailable();
   chargeCurrentReadBudget(b,scalars.reduce((n,r)=>n+r.memberBytes+r.stateBytes+32,0),scalars.length);
   const chips=db.prepare('SELECT mentioned_member_id AS memberId,state,timeout_at AS timeoutAt FROM mention_states WHERE room_id=? AND message_event_id=? LIMIT 101').all(roomId,e.id);
   if(chips.length)e.mentions=chips.map(chip=>({memberId:chip.memberId,state:effectiveMentionState(chip,store.now()),displayName:chipMember(chip.memberId)?.displayName??chip.memberId}));
  }
  const next=selected.length?selected.at(-1).sequence:head.sequence;
  let page=redactEventPage({events:visible,next,hasMore:next<head.sequence},[...messages.values()].filter(Boolean));
  if(opts.compact===true)page={...page,events:page.events.map(row=>({...row,event:compactEvent(row.event)}))};
  contexts.set(page,{roomId,messages:[...messages.values()].filter(Boolean)});
  return page;
 });
}

export function redactSelectedEventPage(store,roomId,page){return redactEventPage(page,store.redactionMessages(roomId,page));}
