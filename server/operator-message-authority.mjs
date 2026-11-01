// Explicit, bounded admission to the existing per-room authority migration.
// No rolling-storage flag, automatic replay, new schema or public agent grant.
import { createHash } from 'node:crypto';
import { validId } from '../src/events.js';
import { servingProofDrift } from './write-integrity.mjs';
import { tableExists } from './db-util.mjs';
import { hasMessageAuthority } from './message-authority.mjs';
import { appendOperatorAction } from './operator-actions.mjs';
import { ServiceError } from './service-error.mjs';

export const MESSAGE_AUTHORITY_LIMITS = Object.freeze({ projectionBytes: 524288, events: 2048,
  messages: 1024, workItems: 128, bodies: 1024, payloadBytes: 1048576, reverseBytes: 1048576 });
const fail=(status,code,message)=>{throw new ServiceError(status,code,message);};
const digest=value=>createHash('sha256').update(value).digest('hex');
const FIELDS=new Set(['roomId','reason','reverse','planHash','requestId']);
function parse(input,execute) {
  if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(k=>!FIELDS.has(k)))
    fail(422,'invalid_authority_request','Send roomId, reason, optional reverse, and the planHash for execution');
  if(!validId(input.roomId))fail(422,'invalid_room_id','roomId must be a room id');
  const reason=typeof input.reason==='string'?input.reason.trim():'';
  if(!reason || reason.length>200)fail(422,'reason_required','Give a reason of 1 to 200 characters');
  const reverse=input.reverse??false;
  if(typeof reverse!=='boolean')fail(422,'invalid_authority_request','reverse must be boolean');
  if(execute ? !/^[a-f0-9]{64}$/.test(input.planHash??'') : input.planHash!==undefined)
    fail(422,'authority_plan_required','Execute needs the exact planHash; planning does not accept one');
  if(execute && (typeof input.requestId!=='string' || !/^[a-zA-Z0-9:_-]{1,128}$/.test(input.requestId)))
    fail(422,'request_id_required','Execute needs a stable requestId; preserve it and the exact input on retry');
  return {roomId:input.roomId,reason,reverse,planHash:input.planHash,requestId:input.requestId};
}
// Each query reads at most cap+1 indexed room rows, returns only byte counts,
// and runs before any hydration/parity/replay. Payloads are read only after
// every domain passes admission. These are size bounds, not a CPU SLA.
function boundedDomain(db,roomId,table,order,columns,cap) {
  const lengths=columns.map(c=>`COALESCE(length(CAST(${c} AS BLOB)),0)`).join('+');
  const rows=db.prepare(`SELECT ${lengths} AS bytes FROM ${table} WHERE room_id=? ORDER BY ${order} LIMIT ?`).all(roomId,cap+1);
  const bytes=rows.reduce((n,row)=>n+row.bytes,0);
  if (rows.length > cap || bytes > MESSAGE_AUTHORITY_LIMITS.payloadBytes)
    fail(409,'authority_budget_exceeded','This room needs bounded continuation before authority migration; no conversion was attempted');
  return {rows:rows.length,bytes};
}
function inspect(store,request) {
  const {roomId,reverse}=request,db=store.db,L=MESSAGE_AUTHORITY_LIMITS;
  const meta=db.prepare("SELECT CASE WHEN typeof(sequence)='integer' THEN sequence ELSE -1 END AS sequence,length(CAST(projection AS BLOB)) AS bytes FROM rooms WHERE id=?").get(roomId);
  if(!meta)fail(404,'room_not_found','Room not found');
  if(meta.bytes>L.projectionBytes || meta.sequence<0 || meta.sequence>L.events)
    fail(409,'authority_budget_exceeded','This room needs bounded continuation before authority migration; no conversion was attempted');
  const domains={
    events:boundedDomain(db,roomId,'events','sequence',['room_id','sequence','id','body'],L.events),
    messages:boundedDomain(db,roomId,'messages','message_id',['room_id','message_id','seq','pinned','body','record_json','reducer_extras_json','reactions_json','channel_id','thread_root_id','reply_to_id','to_member_id','work_item_id','author_id','created_at','edited_at','deleted_at','entity_hash'],L.messages),
    workItems:boundedDomain(db,roomId,'work_entities','work_id',['room_id','work_id','revision','digest','body'],L.workItems),
    bodies:boundedDomain(db,roomId,'projection_bodies','sha',['room_id','sha','body'],L.bodies)
  };
  const proofBytes=db.prepare('SELECT COALESCE(length(CAST(sequence AS BLOB)),0)+COALESCE(length(CAST(projection_hash AS BLOB)),0)+COALESCE(length(CAST(metadata_hash AS BLOB)),0) AS bytes FROM integrity_room_state WHERE room_id=?').get(roomId)?.bytes??0;
  const anchorBytes=db.prepare('SELECT COALESCE(length(CAST(applied_seq AS BLOB)),0)+COALESCE(length(CAST(state_seq AS BLOB)),0)+COALESCE(length(CAST(parity_at_seq AS BLOB)),0)+COALESCE(length(CAST(applied_event_id AS BLOB)),0)+COALESCE(length(CAST(replay_event_id AS BLOB)),0) AS bytes FROM messages_backfill_cursor WHERE room_id=?').get(roomId)?.bytes??0;
  if(proofBytes>256 || anchorBytes>256)fail(409,'authority_budget_exceeded','Proof or cursor anchors exceed the migration budget');
  const raw=db.prepare('SELECT projection FROM rooms WHERE id=?').get(roomId).projection;
  const state=JSON.parse(raw),canonical=hasMessageAuthority(state);
  if(state.messagesArchive?.count>0 || state.messagesArchive?.throughSeq>0)
    fail(409,'authority_archive_not_supported','Archived history requires separately qualified migration; no conversion was attempted');
  if((state.messages?.length??0)>L.messages)
    fail(409,'authority_budget_exceeded','Hydrated message count exceeds the migration budget');
  // Bound repeated references, not merely unique side-table body bytes.
  const lengths=new Map(db.prepare('SELECT sha,length(CAST(body AS BLOB)) AS bytes FROM projection_bodies WHERE room_id=?').all(roomId).map(row=>[row.sha,row.bytes]));
  const referencedBytes=(state.messages??[]).reduce((n,message)=>n+(lengths.get(message?.bodyRef)??0),0);
  const reverseBound=meta.bytes+domains.messages.bytes+domains.workItems.bytes+referencedBytes;
  if(reverseBound>L.reverseBytes)
    fail(409,'authority_budget_exceeded','Hydrated output exceeds the bounded migration budget; no conversion was attempted');
  const hash=createHash('sha256').update('room.message-authority-plan.v1\0').update(JSON.stringify({roomId,reverse,sequence:meta.sequence,raw}));
  for(const [table,order,columns]of [['events','sequence','room_id,sequence,id,body'],['messages','message_id','room_id,message_id,seq,channel_id,thread_root_id,reply_to_id,to_member_id,work_item_id,author_id,body,created_at,edited_at,deleted_at,reactions_json,pinned,record_json,reducer_extras_json,entity_hash'],['work_entities','work_id','room_id,work_id,revision,digest,body'],['projection_bodies','sha','room_id,sha,body']]) {
    hash.update('\0'+table+'\0');
    for(const row of db.prepare(`SELECT ${columns} FROM ${table} WHERE room_id=? ORDER BY ${order}`).iterate(roomId))hash.update(JSON.stringify(row));
  }
  const block=db.prepare('SELECT 1 FROM messages_backfill_blocks WHERE room_id=?').get(roomId);
  if(block)fail(409,'authority_not_ready','The room has a parked message backfill; resolve its recorded cause first');
  const proof=db.prepare('SELECT sequence,projection_hash,metadata_hash FROM integrity_room_state WHERE room_id=?').get(roomId);
  hash.update(JSON.stringify(proof??null));
  const cursor=db.prepare('SELECT applied_seq,applied_event_id,state_seq,replay_event_id,parity_at_seq FROM messages_backfill_cursor WHERE room_id=?').get(roomId);
  hash.update(JSON.stringify(cursor??null));
  for(const step of (tableExists(db,'integrity_failures')?['projection_content','messages_parity']:[])) {
    const failure=db.prepare('SELECT 1 FROM integrity_failures WHERE step=? AND record_id=?').get(step,roomId);
    if(failure)fail(409,'authority_integrity_failure','Resolve the recorded integrity failure through its qualified recovery path first');
  }
  return {roomId,reverse,sequence:meta.sequence,canonical,projectionBytes:meta.bytes,domains,reverseBound,planHash:hash.digest('hex')};
}
export function operatorMessageAuthority(store,input,execute=false,requestId=null) {
  if(store.readOnly)fail(409,'read_only','This store is read-only');
  const request=parse(input,execute);
  return store.transaction(()=>{
    const receiptId=execute?'oa_ma_'+digest(request.roomId+'\0'+request.requestId):null;
    const inputHash=execute?digest(JSON.stringify(request)):null;
    const prior=execute?store.db.prepare('SELECT counts_json FROM operator_actions WHERE id=?').get(receiptId):null;
    if(prior) {
      const saved=JSON.parse(prior.counts_json);
      if(saved.inputHash!==inputHash)fail(409,'idempotency_conflict','The requestId was already used with different input');
      return {...saved.receipt,duplicate:true};
    }
    const plan=inspect(store,request);
    if(execute && plan.planHash!==request.planHash)fail(409,'plan_changed','Room data or migration direction changed; inspect a fresh plan');
    // Planning is inventory plus audit only: no certification or hydration.
    // Execute never starts the global backfill loop.
    if(execute) {
      if(servingProofDrift(store.db,request.roomId,store.db.prepare('SELECT projection FROM rooms WHERE id=?').get(request.roomId).projection))
        fail(409,'authority_integrity_failure','Stored content differs from its independent serving proof; no conversion was attempted');
      const cursor=store.db.prepare('SELECT applied_seq FROM messages_backfill_cursor WHERE room_id=?').get(request.roomId);
      if(!cursor || cursor.applied_seq!==plan.sequence)
        fail(409,'authority_not_ready','The existing message backfill must reach the exact room head first');
      const parity=store.checkMessagesParity({roomId:request.roomId});
      if(!parity.ok || parity.checked!==1)fail(409,'authority_not_ready','Exact-head message parity is required');
    }
    const result=execute?store.migrateMessageAuthority(request.roomId,{reverse:request.reverse}):null;
    const receipt={ok:true,...plan,...(result?{result}:{})};
    if(execute) {
      // Saved response and representation change share the transaction. The
      // deterministic audit PK makes lost-response retry a point lookup,
      // including after intervening room edits, without a new persistence rail.
      store.db.prepare(`INSERT INTO operator_actions
        (id,at,action,target_kind,target_id,reason,plan_hash,counts_json,result,request_id)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run(receiptId,store.now(),'message_authority_execute','room',request.roomId,
        request.reason,plan.planHash,JSON.stringify({inputHash,receipt}),'ok',request.requestId);
    } else appendOperatorAction(store,{action:'message_authority_plan',targetKind:'room',targetId:request.roomId,
      reason:request.reason,planHash:plan.planHash,counts:{sequence:plan.sequence,reverse:request.reverse,projectionBytes:plan.projectionBytes},result:'ok',requestId});
    return receipt;
  });
}
