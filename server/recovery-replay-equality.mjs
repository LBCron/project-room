import {MESSAGE_PROOF_SELECT} from './write-integrity.mjs';
import {inRestoreContext,restoreProgress,RESTORE_AUDIT_VERSION} from './restore-admission.mjs';
import {Buffer} from 'node:buffer';
import {withCurrentAuditUnits} from './current-room-repository.mjs';
import {readRecoveryReplayValue} from './recovery-replay-value.mjs';
import {recoveryCanonical,stripRecoveryMessageChannel,stripRecoveryWorkControls,verifyRecoveryWorkDefaults,verifyRecoveryGeneralChannel} from './recovery-projection-rules.mjs';
const MAPS=['members','workItems','replyRequests','agentHalts','helpOffers','bonds'],LIMIT=4*1024*1024;
const fail=()=>{throw Error('Recovery stored projection differs from independently replayed state');};
export const initialRecoveryReplayEquality=()=>({version:1,stage:'metadata',after:'',mapIndex:0,messageIndex:0,retained:0,fields:0,values:0,archived:0,reason:null});
export function validateRecoveryReplayEquality(c) {
 if(!c||Object.keys(c).sort().join(',')!==Object.keys(initialRecoveryReplayEquality()).sort().join(',')||c.version!==1||!['metadata','shapes','maps','general','messages','complete','deferred'].includes(c.stage)
  ||typeof c.after!=='string'||Buffer.byteLength(c.after)>200||!['mapIndex','messageIndex','retained','fields','values','archived'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=0)||c.mapIndex>MAPS.length
  ||((c.stage==='deferred')!==(typeof c.reason==='string'))||c.reason!==null&&c.reason.length>128)fail();
}
export function advanceRecoveryReplayEquality(store,scratch,id,roomId,previous,replay,seal,{maxUnits=64}={}) {
 validateRecoveryReplayEquality(previous);if(!Number.isSafeInteger(maxUnits)||maxUnits<1||maxUnits>64)fail();
 const state=restoreProgress(store.db);if(!store.db.isTransaction||!inRestoreContext(store.db)||state.state!=='pending'||state.phase!=='audit_pending'||state.restore_id!==id||state.seal?.id!==seal?.id||state.seal.auditVersion!==RESTORE_AUDIT_VERSION||state.progress?.audit?.stage!=='replay_equality'||JSON.stringify(state.progress.audit.equality)!==JSON.stringify(previous)||JSON.stringify(state.progress.audit.replay)!==JSON.stringify(replay))fail();
 const c={...previous};let units=0,bytes=0;const db=store.db,quantum=Symbol('projection_equality_quantum');
 const maximum=4096+9*seal.tables.filter(e=>['events','projection_checkpoints'].includes(e.name)).reduce((n,e)=>n+e.maxRowBytes*e.expected.rows,0);
 if(!Number.isSafeInteger(maximum)||maximum<1)fail();
 const admit=n=>{if(!Number.isSafeInteger(n)||n<0)fail();if(bytes+n>LIMIT)throw quantum;bytes+=n;};
 const actual=(domain,key)=>{
  const s=db.prepare("SELECT payload_bytes,length(CAST(payload AS BLOB)) bytes FROM current_restore_audit_scratch WHERE restore_id=? AND lane='actual' AND room_id=? AND domain=? AND unit_key=? AND part=0").get(id,roomId,domain,key);
  if(!s)return undefined;if(!Number.isSafeInteger(s.bytes)||s.bytes!==s.payload_bytes||s.bytes<1)fail();admit(s.bytes+256);return scratch.get('actual',roomId,domain,key);
 };
 const folded=(domain,key)=>readRecoveryReplayValue(scratch,roomId,domain,key,maximum,{admit:n=>admit(n<=65536?n+256:Math.ceil(n/65536)*(4*Math.ceil(65536/3)+256)+1024)});
 const key=(domain,actualDomain=domain)=>{
  const a=scratch.nextKey('actual',roomId,actualDomain,c.after),b=scratch.nextKey('replay',roomId,domain,c.after);
  if(a===undefined)return b;if(b===undefined)return a;return Buffer.compare(Buffer.from(a),Buffer.from(b))<0?a:b;
 };
 const equal=(a,b)=>{if(recoveryCanonical(a)!==recoveryCanonical(b))fail();};
 if(replay.stage==='deferred'){c.stage='deferred';c.reason='replay_incomplete:'+replay.reason;return{cursor:c,units,bytes,done:true};}
 if(replay.stage!=='complete')fail();
 const defer=reason=>{c.stage='deferred';c.reason=reason;};
 return withCurrentAuditUnits(store,roomId,reader=>{
  if(!reader.head||reader.head.sequence!==replay.sequence)fail();
  try {
   // A partial checkpoint object has different missing-property behavior in the
   // original reducer. Never certify it by inventing an empty state skeleton.
   const presence=folded('replayControl','checkpointPresence');
   if(presence!==undefined&&(!Array.isArray(presence)||['room','members','workItems','messages'].some(k=>!presence.includes(k)))){
    defer('checkpoint_state_presence_requires_original_oracle');return{cursor:c,units,bytes,done:true};
   }
   while(units<maxUnits&&bytes<LIMIT&&!['complete','deferred'].includes(c.stage)) {
    if(c.stage==='metadata') {
     const k=key('metadata');if(k===undefined){c.stage='shapes';c.after='';c.mapIndex=0;continue;}
     if(Buffer.byteLength(k)>200) {defer('state_key_requires_original_oracle');break;}
     // These fields are compacted/stripped by the ORIGINAL oracle.
     if(['eventLog','seenEvents','seenIdempotencyKeys','channels'].includes(k)){c.after=k;units++;continue;}
     const a=actual('metadata',k),b=folded('metadata',k);
     if(k==='messagesArchive') {
      // compactReplayLikeArchive replaces this field from the independently
      // proved actual archive whenever a throughSeq marker is present.
      if(!a?.throughSeq)equal(a,b);
     } else equal(a,b);
     c.after=k;c.fields++;units++;continue;
    }
    if(c.stage==='shapes') {
     if(c.mapIndex===MAPS.length){c.stage='maps';c.mapIndex=0;c.after='';continue;}
     const name=MAPS[c.mapIndex],a=actual('shape',name),b=folded('shape',name);
     // Current census reconstructs base emptyRoomState even without a shape.
     equal(a??(['members','workItems'].includes(name)?'object':undefined),b);
     c.mapIndex++;c.fields++;units++;continue;
    }
    if(c.stage==='maps') {
     if(c.mapIndex===MAPS.length){c.stage='general';c.after='';continue;}
     const name=MAPS[c.mapIndex],actualDomain=name==='workItems'?'workBody':name,k=key(name,actualDomain);
     if(k===undefined){c.mapIndex++;c.after='';continue;}
     if(Buffer.byteLength(k)>200){defer('state_key_requires_original_oracle');break;}
     const a=actual(actualDomain,k),b=folded(name,k);
     if(name==='workItems'&&a!==undefined&&b!==undefined){equal(stripRecoveryWorkControls(a),stripRecoveryWorkControls(b));verifyRecoveryWorkDefaults(a,b);}else equal(a,b);
     c.after=k;c.values++;units++;continue;
    }
    if(c.stage==='general') {
     verifyRecoveryGeneralChannel(actual('channels','general'),folded('channels','general'));
     const archive=actual('metadata','messagesArchive');
     if(!archive?.throughSeq&&folded('replayControl','checkpointArchivePresent')!==undefined)fail();
     c.stage='messages';units++;continue;
    }
    if(c.stage==='messages') {
     if(c.messageIndex===replay.counts.messages){
      const archive=actual('metadata','messagesArchive'),expected=reader.head.counts.messages-(archive?.count??0);
      if(c.retained!==expected||actual('retainedMessageOrder',String(c.retained))!==undefined)fail();c.stage='complete';break;
     }
     const messageId=folded('replayOrder',JSON.stringify(['messages',c.messageIndex]));if(typeof messageId!=='string'||Buffer.byteLength(messageId)>200)fail();
     const witness=actual('messageWitness',messageId),archive=actual('metadata','messagesArchive'),retained=actual('archiveRetained',messageId);
     if(witness&&archive?.throughSeq&&witness.sequence<=archive.throughSeq&&retained===undefined){c.messageIndex++;c.archived++;units++;continue;}
     if(actual('retainedMessageOrder',String(c.retained))!==messageId)fail();
     const scalar=db.prepare(`SELECT ${MESSAGE_PROOF_SELECT.split(',').map(k=>`coalesce(length(CAST(${k} AS BLOB)),0)`).join('+')}+4096 bytes FROM messages WHERE room_id=? AND message_id=?`).get(roomId,messageId);
     if(!scalar)fail();admit(scalar.bytes+133120);const a=reader.message(messageId)?.value,b=folded('messages',messageId);
     if(a===undefined||b===undefined)fail();equal(stripRecoveryMessageChannel(a),stripRecoveryMessageChannel(b));
     c.messageIndex++;c.retained++;units++;continue;
    }
   }
  }catch(error){if(error!==quantum)throw error;if(!units)defer('equality_atom_requires_staging');}
  return{cursor:c,units,bytes,done:['complete','deferred'].includes(c.stage),evidence:c.stage==='complete'?{sequence:reader.head.sequence,headHash:reader.head.head_sha256,receiptId:reader.head.receipt_id}:null};
 });
}
