// First independent audit phase: shared current-record checks plus complete
// proof/payload membership. The remaining full audit is still REQUIRED.
import {Buffer} from 'node:buffer';
import {isDeepStrictEqual} from 'node:util';
import {currentWorkSummary} from './current-work-summary.mjs';
import {emptyWorkPrivacy,validateWorkPrivacy,applyWorkPrivacyRequest,workRequestPrefix,workRequestKey,workRequestValue} from './current-work-privacy.mjs';
import {currentWorkCapacity} from './current-work-capacity.mjs';
import {archiveRetains,validateCurrentArchive,validateArchiveRetainedSlot} from './current-room-archive.mjs';
import {MESSAGE_PROOF_SELECT} from './write-integrity.mjs';
import {advanceHistoryActivation,historyJoinPoint,historyExclusionIds} from './history-visibility.mjs';
import {EVENT_TYPES,memberHistoryVisibility} from '../src/events.js';
import {validId} from '../src/events.js';
import {isCurrentRoom,withCurrentAuditUnits,currentAuditMessageRoot} from './current-room-repository.mjs';
import {withRestoreAuditRows,RESTORE_AUDIT_VERSION,RESTORE_AUDIT_UNIT_BYTES} from './restore-admission.mjs';
export const initialRecoveryCensus=()=>({version:RESTORE_AUDIT_VERSION,stage:'rooms',roomAfter:'',roomId:null,domainAfter:'',keyAfter:'',proofs:0,records:0,actualRecords:0,workAfter:'',workCount:0,workReferenceRecords:0,workSummaryRecords:0,workCapacityRecords:0,workPrivacyRecords:0,workRequestRecords:0,requestAfter:'',requestLinks:0,privacyAfter:'',privacyWork:null,privacyLinkAfter:'',privacyValue:null,privacyEntries:0,privacyLinks:0,messageAfterSeq:0,messageAfterId:'',messageCount:0,retainedMessages:0,witnessRecords:0,archiveRecords:0,participantRecords:0,expectedParticipants:0,memberRecords:0,requestRecords:0,archiveAfter:'',archiveSlots:0,historySequence:0,historyAfter:'',historyMember:null,historyJoinSequence:0,historyJoinAt:'',historyJoinFound:false,historyPart:0,historyExcluded:0,historyFloorRecords:0,historyExclusionRecords:0,expectedFloors:0,expectedExclusions:0,rooms:0,legacyRooms:0,units:0,bytes:0});
const fail=()=>{throw Error('Independent recovery census requires reconciliation');};
export function validateRecoveryCensus(value){
 if(!value||Object.keys(value).sort().join(',')!==Object.keys(initialRecoveryCensus()).sort().join(',')||value.version!==RESTORE_AUDIT_VERSION||!['rooms','proofs','records','work','request_links','privacy','archive','messages','history_events','history_members','history_exclusions','cleanup','full_audit_pending'].includes(value.stage)
  ||!['proofs','records','actualRecords','rooms','legacyRooms','units','bytes','workCount','workReferenceRecords','workSummaryRecords','workCapacityRecords','workPrivacyRecords','workRequestRecords','requestLinks','privacyEntries','privacyLinks','messageAfterSeq','messageCount','retainedMessages','witnessRecords','archiveRecords','participantRecords','expectedParticipants','memberRecords','requestRecords','archiveSlots','historySequence','historyJoinSequence','historyPart','historyExcluded','historyFloorRecords','historyExclusionRecords','expectedFloors','expectedExclusions'].every(key=>Number.isSafeInteger(value[key])&&value[key]>=0)
  ||typeof value.roomAfter!=='string'||Buffer.byteLength(value.roomAfter)>128||value.roomId!==null&&(!validId(value.roomId))
  ||typeof value.workAfter!=='string'||Buffer.byteLength(value.workAfter)>200
  ||!['requestAfter','privacyAfter','privacyLinkAfter','messageAfterId','archiveAfter','historyAfter'].every(key=>typeof value[key]==='string'&&Buffer.byteLength(value[key])<=200)||value.privacyWork!==null&&(typeof value.privacyWork!=='string'||Buffer.byteLength(value.privacyWork)>200)
  ||typeof value.historyJoinFound!=='boolean'||value.historyMember!==null&&(typeof value.historyMember!=='string'||Buffer.byteLength(value.historyMember)>200)||typeof value.historyJoinAt!=='string'||Buffer.byteLength(value.historyJoinAt)>128
  ||typeof value.domainAfter!=='string'||Buffer.byteLength(value.domainAfter)>64||typeof value.keyAfter!=='string'||Buffer.byteLength(value.keyAfter)>200)fail();
 if(value.privacyValue!==null){validateWorkPrivacy(value.privacyValue);if(Buffer.byteLength(JSON.stringify(value.privacyValue))>RESTORE_AUDIT_UNIT_BYTES)fail();}
 if((value.privacyWork===null)!==(value.privacyValue===null))fail();
}
function recordInputBytes(db,roomId,domain,key){
 const row=db.prepare(`SELECT r.payload_bytes,(SELECT length(CAST(a.counts_json AS BLOB)) FROM operator_actions a WHERE a.id=p.receipt_id AND a.action='current_room_transition') receipt_bytes
  FROM current_room_record_proofs p LEFT JOIN current_room_records r ON r.room_id=p.room_id AND r.domain=p.domain AND r.record_key=p.record_key WHERE p.room_id=? AND p.domain=? AND p.record_key=?`).get(roomId,domain,key);
 const bytes=(row?.payload_bytes??0)+(row?.receipt_bytes??0)+1024;if(!Number.isSafeInteger(bytes)||bytes<0)fail();return bytes;
}
export function advanceRecoveryCensus(store,restoreId,previous){
 validateRecoveryCensus(previous);const p={...previous},db=store.db;let units=0,bytes=0;
 return withRestoreAuditRows(db,restoreId,scratch=>{
  if(p.stage==='cleanup'){
   const result=scratch.deletePage(128);p.units+=result.deleted;if(result.done)p.stage='full_audit_pending';return p;
  }
  if(p.stage==='full_audit_pending')return p;
  while(units<128){
   if(p.stage==='rooms'){
    const scalar=db.prepare('SELECT rowid,length(CAST(id AS BLOB)) bytes FROM rooms WHERE id>? ORDER BY id LIMIT 1').get(p.roomAfter);
    if(!scalar){p.stage='cleanup';break;}
    if(scalar.bytes<1||scalar.bytes>128)fail();const row=db.prepare('SELECT id FROM rooms WHERE rowid=?').get(scalar.rowid);if(!validId(row?.id))fail();
    p.roomId=row.id;p.domainAfter='';p.keyAfter='';p.proofs=0;p.records=0;p.actualRecords=0;p.workAfter='';p.workCount=0;p.workReferenceRecords=0;p.workSummaryRecords=0;p.workCapacityRecords=0;p.workPrivacyRecords=0;p.workRequestRecords=0;p.requestAfter='';p.requestLinks=0;p.privacyAfter='';p.privacyWork=null;p.privacyLinkAfter='';p.privacyValue=null;p.privacyEntries=0;p.privacyLinks=0;p.messageAfterSeq=0;p.messageAfterId='';p.messageCount=0;p.retainedMessages=0;p.witnessRecords=0;p.archiveRecords=0;p.participantRecords=0;p.expectedParticipants=0;p.memberRecords=0;p.requestRecords=0;p.archiveAfter='';p.archiveSlots=0;p.historySequence=0;p.historyAfter='';p.historyMember=null;p.historyJoinSequence=0;p.historyJoinAt='';p.historyJoinFound=false;p.historyPart=0;p.historyExcluded=0;p.historyFloorRecords=0;p.historyExclusionRecords=0;p.expectedFloors=0;p.expectedExclusions=0;
    if(!isCurrentRoom(db,p.roomId)){p.legacyRooms++;p.roomAfter=p.roomId;p.roomId=null;units++;continue;}
    p.stage='proofs';
   }
   // Every callback/receipt cache ends before this synchronous transaction ends.
   const roomDone=withCurrentAuditUnits(store,p.roomId,reader=>{
    if(!reader.head)fail();
    while(units<128){
     if(p.stage==='history_events'){
      if(scratch.remaining<2)return false;
      const scalar=db.prepare("SELECT rowid,sequence,length(CAST(json_extract(body,'$.at') AS BLOB)) at_bytes,length(CAST(json_extract(body,'$.id') AS BLOB)) id_bytes,length(CAST(json_extract(body,'$.data.messageId') AS BLOB)) message_bytes,length(CAST(json_extract(body,'$.data.memberId') AS BLOB)) member_bytes,length(CAST(json_extract(body,'$.type') AS BLOB)) type_bytes FROM events WHERE room_id=? AND sequence>? ORDER BY sequence LIMIT 1").get(p.roomId,p.historySequence);
      if(!scalar){p.stage='history_members';continue;}
      if(!Number.isSafeInteger(scalar.sequence)||scalar.sequence<1||scalar.at_bytes>128||scalar.id_bytes>200||scalar.message_bytes>200||scalar.member_bytes>200||scalar.type_bytes>100)fail();
      const estimate=Object.entries(scalar).filter(([key])=>key.endsWith('_bytes')).reduce((sum,[,value])=>sum+(value??0),0)+4096;if(units&&bytes+estimate>4*1024*1024)return false;
      const row=db.prepare("SELECT sequence,json_extract(body,'$.at') at,json_extract(body,'$.type') type,json_extract(body,'$.data.memberId') member_id,CASE WHEN json_extract(body,'$.data.active') IN (0,1) THEN json_extract(body,'$.data.active') ELSE NULL END active,json_extract(body,'$.id') id,json_extract(body,'$.data.messageId') messageId FROM events WHERE rowid=?").get(scalar.rowid);
      if(typeof row.at==='string')scratch.put('history',p.roomId,'eventAt',row.at,{id:row.id,messageId:row.messageId},row.sequence);
      if([EVENT_TYPES.MEMBER_ADDED,EVENT_TYPES.MEMBER_JOINED_VIA_INVITATION,EVENT_TYPES.MEMBER_ACCESS_CHANGED].includes(row.type)&&typeof row.member_id==='string'){
       const previous=scratch.get('history',p.roomId,'activation',row.member_id)??{active:false,row:null};
       const entry={sequence:row.sequence,at:row.at,type:row.type,active:row.active};scratch.set('history',p.roomId,'activation',row.member_id,advanceHistoryActivation(previous,entry));
      }
      p.historySequence=row.sequence;p.units++;p.bytes+=estimate;units++;bytes+=estimate;continue;
     }
     if(p.stage==='history_members'){
      if(scratch.remaining<1)return false;
      const scalar=db.prepare("SELECT rowid,length(CAST(record_key AS BLOB)) bytes FROM current_room_record_proofs WHERE room_id=? AND domain='members' AND present=1 AND record_key>? ORDER BY record_key LIMIT 1").get(p.roomId,p.historyAfter);
      if(!scalar){if(p.expectedFloors!==p.historyFloorRecords||p.expectedFloors!==reader.head.counts.historyFloors||p.expectedExclusions!==p.historyExclusionRecords||p.expectedExclusions!==reader.head.counts.historyExclusions)fail();p.rooms++;p.roomAfter=p.roomId;p.roomId=null;p.stage='rooms';return true;}
      if(scalar.bytes<1||scalar.bytes>200)fail();const id=db.prepare('SELECT record_key FROM current_room_record_proofs WHERE rowid=?').get(scalar.rowid).record_key;
      const estimate=recordInputBytes(db,p.roomId,'members',id)+recordInputBytes(db,p.roomId,'metadata','room')+recordInputBytes(db,p.roomId,'historyFloors',id)+4096;if(units&&bytes+estimate>4*1024*1024)return false;
      const member=reader.record('members',id),room=reader.record('metadata','room'),floor=reader.record('historyFloors',id);
      if(memberHistoryVisibility({room,members:{[id]:member}},id)!=='since_join'){if(floor!==undefined)fail();p.historyAfter=id;}
      else{const activation=scratch.get('history',p.roomId,'activation',id),join=historyJoinPoint(activation?.row,reader.head.sequence);p.historyMember=id;p.historyJoinSequence=join.sequence;p.historyJoinAt=join.at;p.historyJoinFound=join.found;p.historyPart=0;p.historyExcluded=0;p.stage='history_exclusions';}
      p.units++;p.bytes+=estimate;units++;bytes+=estimate;continue;
     }
     if(p.stage==='history_exclusions'){
      if(scratch.remaining<4)return false;
      const scalar=p.historyJoinFound?db.prepare("SELECT part,payload_bytes,length(CAST(payload AS BLOB)) bytes FROM current_restore_audit_scratch WHERE restore_id=? AND lane='history' AND room_id=? AND domain='eventAt' AND unit_key=? AND part>? AND part<? ORDER BY part LIMIT 1").get(restoreId,p.roomId,p.historyJoinAt,p.historyPart,p.historyJoinSequence):null;
      if(!scalar){
       const estimate=recordInputBytes(db,p.roomId,'historyFloors',p.historyMember)+2048;if(units&&bytes+estimate>4*1024*1024)return false;
       const expected={sequence:p.historyJoinSequence,at:p.historyJoinAt,sameInstantCount:p.historyExcluded};if(!isDeepStrictEqual(reader.record('historyFloors',p.historyMember),expected))fail();scratch.put('history',p.roomId,'expectedFloor',p.historyMember,expected);p.expectedFloors++;p.historyAfter=p.historyMember;p.historyMember=null;p.stage='history_members';p.units++;p.bytes+=estimate;units++;bytes+=estimate;continue;
      }
      if(scalar.bytes!==scalar.payload_bytes||scalar.bytes<1||scalar.bytes>RESTORE_AUDIT_UNIT_BYTES)fail();let estimate=scalar.bytes+4096;if(units&&bytes+estimate>4*1024*1024)return false;
      const entry=scratch.get('history',p.roomId,'eventAt',p.historyJoinAt,scalar.part),ids=historyExclusionIds(entry);for(const id of ids)estimate+=recordInputBytes(db,p.roomId,'historyExclusions',p.historyMember+'\0'+id);if(units&&bytes+estimate>4*1024*1024)return false;
      for(const id of ids){const key=p.historyMember+'\0'+id;if(reader.record('historyExclusions',key)!==true)fail();if(scratch.ensure('history',p.roomId,'expectedExclusion',key,true)){p.historyExcluded++;p.expectedExclusions++;}}
      p.historyPart=scalar.part;p.units++;p.bytes+=estimate;units++;bytes+=estimate;continue;
     }
     if(p.stage==='archive'){
      const marker=validateCurrentArchive(reader.record('metadata','messagesArchive'));
      const scalar=db.prepare("SELECT rowid,length(CAST(record_key AS BLOB)) bytes FROM current_room_record_proofs WHERE room_id=? AND domain='archiveRetained' AND present=1 AND record_key>? ORDER BY record_key LIMIT 1").get(p.roomId,p.archiveAfter);
      if(!scalar){if(marker?p.archiveSlots!==marker.retainedCount||p.archiveSlots!==p.archiveRecords:p.archiveRecords!==0)fail();p.stage='messages';continue;}
      if(!marker||scalar.bytes<1||scalar.bytes>200)fail();const id=db.prepare('SELECT record_key FROM current_room_record_proofs WHERE rowid=?').get(scalar.rowid).record_key,estimate=recordInputBytes(db,p.roomId,'archiveRetained',id);
      if(units&&bytes+estimate>4*1024*1024)return false;if(scratch.remaining<1)return false;
      const slot=reader.record('archiveRetained',id),key=String(slot);validateArchiveRetainedSlot(slot,marker.retainedCount,scratch.get('history',p.roomId,'archiveSlot',key)!==undefined);
      scratch.put('history',p.roomId,'archiveSlot',key,id);p.archiveSlots++;p.archiveAfter=id;p.units++;p.bytes+=estimate;units++;bytes+=estimate;continue;
     }
     if(p.stage==='messages'){
      const scalar=db.prepare('SELECT rowid,length(CAST(message_id AS BLOB)) bytes FROM messages WHERE room_id=? AND (seq,message_id)>(?,?) ORDER BY seq,message_id LIMIT 1').get(p.roomId,p.messageAfterSeq,p.messageAfterId);
      if(!scalar){
       const marker=validateCurrentArchive(reader.record('metadata','messagesArchive'));
       if(p.messageCount!==reader.head.counts.messages||p.witnessRecords!==p.messageCount||p.retainedMessages+(marker?.count??0)!==p.messageCount||p.memberRecords!==reader.head.counts.members||p.requestRecords!==reader.head.counts.replyRequests||p.expectedParticipants!==p.participantRecords||p.expectedParticipants!==reader.head.counts.threadParticipants)fail();
       p.stage='history_events';continue;
      }
      if(scalar.bytes<1||scalar.bytes>200)fail();if(scratch.remaining<2)return false;
      const id=db.prepare('SELECT message_id FROM messages WHERE rowid=?').get(scalar.rowid).message_id;
      const sizes=db.prepare(`SELECT ${MESSAGE_PROOF_SELECT.split(',').map(key=>`length(CAST(${key} AS BLOB)) AS ${key}`).join(',')} FROM messages WHERE rowid=?`).get(scalar.rowid);
      let estimate=Object.values(sizes).reduce((sum,value)=>sum+(value??0),0)+recordInputBytes(db,p.roomId,'messageWitness',id)+recordInputBytes(db,p.roomId,'archiveRetained',id)+recordInputBytes(db,p.roomId,'metadata','messagesArchive')+4096;
      if(!Number.isSafeInteger(estimate)||estimate<0)fail();if(units&&bytes+estimate>4*1024*1024)return false;
      const source=reader.message(id);if(!source)fail();const root=currentAuditMessageRoot(source.value,parent=>scratch.get('history',p.roomId,'messageRoot',parent));
      const participantKey=root+'\0'+source.value.authorId;estimate+=recordInputBytes(db,p.roomId,'threadParticipants',participantKey);if(units&&bytes+estimate>4*1024*1024)return false;
      scratch.put('history',p.roomId,'messageRoot',id,root);
      const marker=reader.record('metadata','messagesArchive'),retained=reader.record('archiveRetained',id);
      if(archiveRetains(marker,source.row.seq,retained)){
       const key=root+'\0'+source.value.authorId,value={threadRootId:root,memberId:source.value.authorId};
       if(!isDeepStrictEqual(reader.record('threadParticipants',key),value))fail();
       if(scratch.ensure('history',p.roomId,'expectedParticipant',key,value))p.expectedParticipants++;p.retainedMessages++;
      }
      p.messageAfterSeq=source.row.seq;p.messageAfterId=id;p.messageCount++;p.units++;p.bytes+=estimate;units++;bytes+=estimate;continue;
     }
     if(p.stage==='work'){
      const scalar=db.prepare("SELECT rowid,length(CAST(record_key AS BLOB)) bytes FROM current_room_record_proofs WHERE room_id=? AND domain='workItems' AND present=1 AND record_key>? ORDER BY record_key LIMIT 1").get(p.roomId,p.workAfter);
      if(!scalar){
       if(p.workCount!==reader.head.counts.workItems||p.workCount!==reader.head.counts.workCapacity||p.workCount!==p.workReferenceRecords||p.workCount!==p.workSummaryRecords||p.workCount!==p.workCapacityRecords)fail();
       p.stage='request_links';continue;
      }
      if(scalar.bytes<1||scalar.bytes>200)fail();const id=db.prepare('SELECT record_key FROM current_room_record_proofs WHERE rowid=?').get(scalar.rowid).record_key;
      const sizes=db.prepare("SELECT r.payload_bytes,(SELECT length(CAST(a.counts_json AS BLOB)) FROM operator_actions a WHERE a.id=p.receipt_id AND a.action='current_room_transition') receipt_bytes FROM current_room_record_proofs p LEFT JOIN current_room_records r ON r.room_id=p.room_id AND r.domain=p.domain AND r.record_key=p.record_key WHERE p.room_id=? AND p.record_key=? AND p.domain IN ('workItems','workSummary','workCapacity','workPrivacy') LIMIT 4").all(p.roomId,id);
      const body=db.prepare('SELECT length(CAST(body AS BLOB)) bytes FROM work_entities WHERE room_id=? AND work_id=?').get(p.roomId,id);
      const estimate=(body?.bytes??0)+sizes.reduce((sum,row)=>sum+(row.payload_bytes??0)+(row.receipt_bytes??0)+1024,0);
      if(!Number.isSafeInteger(estimate)||estimate<0)fail();if(units&&bytes+estimate>4*1024*1024)return false;
      const ref=reader.record('workItems',id),item=reader.work(id,ref),summary=reader.record('workSummary',id),capacity=reader.record('workCapacity',id),privacy=reader.record('workPrivacy',id);
      if(privacy===undefined||!isDeepStrictEqual(summary,currentWorkSummary(item,ref))||!isDeepStrictEqual(capacity,currentWorkCapacity(item)))fail();
      scratch.put('actual',p.roomId,'workBody',id,item);p.workAfter=id;p.workCount++;p.units++;p.bytes+=estimate;units++;bytes+=estimate;continue;
     }
     if(p.stage==='request_links'){
      const scalar=db.prepare("SELECT rowid,length(CAST(record_key AS BLOB)) bytes FROM current_room_record_proofs WHERE room_id=? AND domain='replyRequests' AND present=1 AND record_key>? ORDER BY record_key LIMIT 1").get(p.roomId,p.requestAfter);
      if(!scalar){p.stage='privacy';continue;}
      if(scalar.bytes<1||scalar.bytes>200)fail();const id=db.prepare('SELECT record_key FROM current_room_record_proofs WHERE rowid=?').get(scalar.rowid).record_key;
      let estimate=recordInputBytes(db,p.roomId,'replyRequests',id);if(units&&bytes+estimate>4*1024*1024)return false;
      const request=reader.record('replyRequests',id);
      if(typeof request?.workItemId==='string'&&request.workItemId){const key=workRequestKey(request.workItemId,id);estimate+=recordInputBytes(db,p.roomId,'workRequest',key);if(units&&bytes+estimate>4*1024*1024)return false;const expected=workRequestValue(request.workItemId,id),link=reader.record('workRequest',key);if(!isDeepStrictEqual(link,expected))fail();p.requestLinks++;}
      p.requestAfter=id;p.units++;p.bytes+=estimate;units++;bytes+=estimate;continue;
     }
     if(p.stage==='privacy'){
      if(p.privacyWork===null){
       const scalar=db.prepare("SELECT rowid,length(CAST(record_key AS BLOB)) bytes FROM current_room_record_proofs WHERE room_id=? AND domain='workPrivacy' AND present=1 AND record_key>? ORDER BY record_key LIMIT 1").get(p.roomId,p.privacyAfter);
       if(!scalar){if(p.privacyEntries!==p.workPrivacyRecords||p.privacyLinks!==p.workRequestRecords||p.requestLinks!==p.workRequestRecords)fail();p.stage='archive';continue;}
       if(scalar.bytes<1||scalar.bytes>200)fail();p.privacyWork=db.prepare('SELECT record_key FROM current_room_record_proofs WHERE rowid=?').get(scalar.rowid).record_key;p.privacyLinkAfter='';p.privacyValue=emptyWorkPrivacy();
      }
      const prefix=workRequestPrefix(p.privacyWork),after=p.privacyLinkAfter||prefix,scalar=db.prepare("SELECT rowid,length(CAST(record_key AS BLOB)) bytes FROM current_room_record_proofs WHERE room_id=? AND domain='workRequest' AND present=1 AND record_key>? AND record_key<? ORDER BY record_key LIMIT 1").get(p.roomId,after,prefix+'g');
      if(!scalar){
       const estimate=recordInputBytes(db,p.roomId,'workPrivacy',p.privacyWork)+recordInputBytes(db,p.roomId,'workItems',p.privacyWork)+Buffer.byteLength(JSON.stringify(p.privacyValue));if(units&&bytes+estimate>4*1024*1024)return false;
       const actual=reader.record('workPrivacy',p.privacyWork),ref=reader.record('workItems',p.privacyWork);
       if(!isDeepStrictEqual(actual,p.privacyValue)||!ref&&p.privacyValue.requests===0)fail();
       scratch.put('actual',p.roomId,'expectedWorkPrivacy',p.privacyWork,p.privacyValue);p.privacyEntries++;p.privacyAfter=p.privacyWork;p.privacyWork=null;p.privacyLinkAfter='';p.privacyValue=null;p.units++;p.bytes+=estimate;units++;bytes+=estimate;continue;
      }
      if(scalar.bytes<1||scalar.bytes>200)fail();const key=db.prepare('SELECT record_key FROM current_room_record_proofs WHERE rowid=?').get(scalar.rowid).record_key;let estimate=recordInputBytes(db,p.roomId,'workRequest',key);if(units&&bytes+estimate>4*1024*1024)return false;const link=reader.record('workRequest',key);
      if(!link||link.workItemId!==p.privacyWork||key!==workRequestKey(link.workItemId,link.requestId)||!isDeepStrictEqual(link,workRequestValue(link.workItemId,link.requestId)))fail();
      estimate+=recordInputBytes(db,p.roomId,'replyRequests',link.requestId)+2*Buffer.byteLength(JSON.stringify(p.privacyValue))+2048;if(units&&bytes+estimate>4*1024*1024)return false;
      const request=reader.record('replyRequests',link.requestId);if(request?.workItemId!==p.privacyWork)fail();
      const value=applyWorkPrivacyRequest(p.privacyValue,request,1);if(Buffer.byteLength(JSON.stringify(value))>RESTORE_AUDIT_UNIT_BYTES)fail();
      p.privacyValue=value;p.privacyLinkAfter=key;p.privacyLinks++;p.units++;p.bytes+=estimate;units++;bytes+=estimate;continue;
     }
     const table=p.stage==='proofs'?'current_room_record_proofs':'current_room_records';
     const scalar=db.prepare(`SELECT rowid,length(CAST(domain AS BLOB)) domain_bytes,length(CAST(record_key AS BLOB)) key_bytes FROM ${table} WHERE room_id=? AND (domain,record_key)>(?,?) ORDER BY domain,record_key LIMIT 1`).get(p.roomId,p.domainAfter,p.keyAfter);
     if(!scalar){
      if(p.stage==='proofs'){
       if(p.proofs!==reader.head.counts.metadataProofs||p.records!==reader.head.counts.metadataRecords)fail();p.stage='records';p.domainAfter='';p.keyAfter='';continue;
      }
      if(p.actualRecords!==p.records)fail();p.stage='work';continue;
     }
     if(scalar.domain_bytes<1||scalar.domain_bytes>64||scalar.key_bytes<1||scalar.key_bytes>200)fail();
     const identity=db.prepare(`SELECT domain,record_key FROM ${table} WHERE rowid=?`).get(scalar.rowid);
     const size=db.prepare(`SELECT p.present,r.payload_bytes,(SELECT length(CAST(a.counts_json AS BLOB)) FROM operator_actions a WHERE a.id=p.receipt_id AND a.action='current_room_transition') receipt_bytes
       FROM current_room_record_proofs p LEFT JOIN current_room_records r ON r.room_id=p.room_id AND r.domain=p.domain AND r.record_key=p.record_key WHERE p.room_id=? AND p.domain=? AND p.record_key=?`).get(p.roomId,identity.domain,identity.record_key);
     const estimate=(size?.payload_bytes??0)+(size?.receipt_bytes??0)+1024;
     if(!Number.isSafeInteger(estimate)||estimate<0)fail();if(units&&bytes+estimate>4*1024*1024)return false;
     const value=reader.record(identity.domain,identity.record_key);
     if(p.stage==='proofs'){
      p.proofs++;if(size.present===1){p.records++;if(identity.domain==='historyFloors')p.historyFloorRecords++;if(identity.domain==='historyExclusions')p.historyExclusionRecords++;if(identity.domain==='messageWitness')p.witnessRecords++;if(identity.domain==='archiveRetained')p.archiveRecords++;if(identity.domain==='threadParticipants')p.participantRecords++;if(identity.domain==='members')p.memberRecords++;if(identity.domain==='replyRequests')p.requestRecords++;if(identity.domain==='workItems')p.workReferenceRecords++;if(identity.domain==='workSummary')p.workSummaryRecords++;if(identity.domain==='workCapacity')p.workCapacityRecords++;if(identity.domain==='workPrivacy')p.workPrivacyRecords++;if(identity.domain==='workRequest')p.workRequestRecords++;scratch.put('actual',p.roomId,identity.domain,identity.record_key,value);}
     }else {if(value===undefined||size?.present!==1)fail();p.actualRecords++;}
     p.domainAfter=identity.domain;p.keyAfter=identity.record_key;p.units++;p.bytes+=estimate;units++;bytes+=estimate;
    }
    return false;
   });
   if(!roomDone)break;
  }
  return p;
 });
}
