// First independent audit phase: shared current-record checks plus complete
// proof/payload membership. The remaining full audit is still REQUIRED.
import {Buffer} from 'node:buffer';
import {validId} from '../src/events.js';
import {isCurrentRoom,withCurrentAuditUnits} from './current-room-repository.mjs';
import {withRestoreAuditRows,RESTORE_AUDIT_VERSION} from './restore-admission.mjs';
export const initialRecoveryCensus=()=>({version:RESTORE_AUDIT_VERSION,stage:'rooms',roomAfter:'',roomId:null,domainAfter:'',keyAfter:'',proofs:0,records:0,actualRecords:0,rooms:0,legacyRooms:0,units:0,bytes:0});
const fail=()=>{throw Error('Independent recovery census requires reconciliation');};
export function validateRecoveryCensus(value){
 if(!value||Object.keys(value).sort().join(',')!=='actualRecords,bytes,domainAfter,keyAfter,legacyRooms,proofs,records,roomAfter,roomId,rooms,stage,units,version'||value.version!==RESTORE_AUDIT_VERSION||!['rooms','proofs','records','cleanup','full_audit_pending'].includes(value.stage)
  ||!['proofs','records','actualRecords','rooms','legacyRooms','units','bytes'].every(key=>Number.isSafeInteger(value[key])&&value[key]>=0)
  ||typeof value.roomAfter!=='string'||Buffer.byteLength(value.roomAfter)>128||value.roomId!==null&&(!validId(value.roomId))
  ||typeof value.domainAfter!=='string'||Buffer.byteLength(value.domainAfter)>64||typeof value.keyAfter!=='string'||Buffer.byteLength(value.keyAfter)>200)fail();
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
    p.roomId=row.id;p.domainAfter='';p.keyAfter='';p.proofs=0;p.records=0;p.actualRecords=0;
    if(!isCurrentRoom(db,p.roomId)){p.legacyRooms++;p.roomAfter=p.roomId;p.roomId=null;units++;continue;}
    p.stage='proofs';
   }
   // Every callback/receipt cache ends before this synchronous transaction ends.
   const roomDone=withCurrentAuditUnits(store,p.roomId,reader=>{
    if(!reader.head)fail();
    while(units<128){
     const table=p.stage==='proofs'?'current_room_record_proofs':'current_room_records';
     const scalar=db.prepare(`SELECT rowid,length(CAST(domain AS BLOB)) domain_bytes,length(CAST(record_key AS BLOB)) key_bytes FROM ${table} WHERE room_id=? AND (domain,record_key)>(?,?) ORDER BY domain,record_key LIMIT 1`).get(p.roomId,p.domainAfter,p.keyAfter);
     if(!scalar){
      if(p.stage==='proofs'){
       if(p.proofs!==reader.head.counts.metadataProofs||p.records!==reader.head.counts.metadataRecords)fail();p.stage='records';p.domainAfter='';p.keyAfter='';continue;
      }
      if(p.actualRecords!==p.records)fail();p.rooms++;p.roomAfter=p.roomId;p.roomId=null;p.stage='rooms';return true;
     }
     if(scalar.domain_bytes<1||scalar.domain_bytes>64||scalar.key_bytes<1||scalar.key_bytes>200)fail();
     const identity=db.prepare(`SELECT domain,record_key FROM ${table} WHERE rowid=?`).get(scalar.rowid);
     const size=db.prepare(`SELECT p.present,r.payload_bytes,(SELECT length(CAST(a.counts_json AS BLOB)) FROM operator_actions a WHERE a.id=p.receipt_id AND a.action='current_room_transition') receipt_bytes
       FROM current_room_record_proofs p LEFT JOIN current_room_records r ON r.room_id=p.room_id AND r.domain=p.domain AND r.record_key=p.record_key WHERE p.room_id=? AND p.domain=? AND p.record_key=?`).get(p.roomId,identity.domain,identity.record_key);
     const estimate=(size?.payload_bytes??0)+(size?.receipt_bytes??0)+1024;
     if(!Number.isSafeInteger(estimate)||estimate<0)fail();if(units&&bytes+estimate>4*1024*1024)return false;
     const value=reader.record(identity.domain,identity.record_key);
     if(p.stage==='proofs'){
      p.proofs++;if(size.present===1){p.records++;scratch.put('actual',p.roomId,identity.domain,identity.record_key,value);}
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
