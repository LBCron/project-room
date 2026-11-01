import {validateRecoveryHistoryEntry} from './recovery-history-entry.mjs';
import {savedHistoricalReplayCheckpoint} from './historical-replay-contract.mjs';
import {applyRecoveryReplayStep} from './recovery-replay-step.mjs';
import {planRecoveryReplayValue,readRecoveryReplayValue,writeRecoveryReplayValue} from './recovery-replay-value.mjs';
// Transitional independent fold over the frozen original source. Unsupported
// dependency/basis plans remain explicit and the original FULL oracle remains
// required for every room, including a room whose addressed fold completes.
export const initialRecoveryReplay=()=>({version:1,stage:'basis',sequence:0,counts:{members:0,channels:0,workItems:0,replyRequests:0,messages:0},reason:null});
export function validateRecoveryReplay(cursor){
 if(!cursor||Object.keys(cursor).sort().join(',')!=='counts,reason,sequence,stage,version'||cursor.version!==1||!['basis','events','complete','deferred'].includes(cursor.stage)||!Number.isSafeInteger(cursor.sequence)||cursor.sequence<0||!cursor.counts||Object.keys(cursor.counts).sort().join(',')!=='channels,members,messages,replyRequests,workItems'||Object.values(cursor.counts).some(value=>!Number.isSafeInteger(value)||value<0)||cursor.reason!==null&&(typeof cursor.reason!=='string'||cursor.reason.length>128)||((cursor.stage==='deferred')!==(cursor.reason!==null)))throw Error('Recovery replay cursor requires reconciliation');
}
export function advanceRecoveryReplay(db,scratch,roomId,previous,seal){
 validateRecoveryReplay(previous);const cursor=structuredClone(previous);let units=0,bytes=0;
 const defer=reason=>{cursor.stage='deferred';cursor.reason=reason;return{cursor,units,bytes,done:true};};
 const events=seal?.tables?.find(table=>table.name==='events'),checkpoint=seal?.tables?.find(table=>table.name==='projection_checkpoints');
 if(!events||!Number.isSafeInteger(events.maxRowBytes)||events.maxRowBytes<0)throw Error('Recovery replay source admission differs');
 const maximumValueBytes=4096+[events,checkpoint].filter(Boolean).reduce((sum,table)=>sum+table.maxRowBytes*table.expected.rows,0);if(!Number.isSafeInteger(maximumValueBytes)||maximumValueBytes<1)throw Error('Recovery replay source budget differs');
 const head=db.prepare('SELECT sequence FROM rooms WHERE id=?').get(roomId);if(!Number.isSafeInteger(head?.sequence)||head.sequence<0)throw Error('Recovery replay head differs');
 if(cursor.stage==='basis'){
  if(db.prepare('SELECT sequence FROM projection_checkpoints WHERE room_id=?').get(roomId))return defer('retained_checkpoint_seed_pending');
  // This existing exact contract admits at most64events/256KiB and independently
  // checks its immutable receipt. Do not replace its basis with full history.
  if(savedHistoricalReplayCheckpoint(db,roomId,head.sequence))return defer('saved_historical_checkpoint_seed_pending');
  cursor.stage='events';
 }
 if(['complete','deferred'].includes(cursor.stage))return{cursor,units,bytes,done:true};
 while(units<128){
  const scalar=db.prepare('SELECT rowid,sequence,length(CAST(body AS BLOB)) bytes FROM events WHERE room_id=? AND sequence>? ORDER BY sequence LIMIT 1').get(roomId,cursor.sequence);
  if(!scalar){if(cursor.sequence!==head.sequence)throw Error('Recovery replay tail differs');cursor.stage='complete';return{cursor,units,bytes,done:true};}
  if(!Number.isSafeInteger(scalar.bytes)||scalar.bytes<1||scalar.bytes>events.maxRowBytes)throw Error('Recovery replay event bytes differ');
  if(scalar.bytes>4*1024*1024)return defer('replay_atom_requires_staging');
  if(units&&bytes+scalar.bytes>4*1024*1024)break;
  const row=db.prepare('SELECT sequence,id,body FROM events WHERE rowid=?').get(scalar.rowid),incoming=validateRecoveryHistoryEntry(row,cursor.sequence+1,roomId);
  let readBytes=0,result;const budget=Symbol('replay_atom_byte_admission');
  try{result=applyRecoveryReplayStep((domain,key)=>readRecoveryReplayValue(scratch,roomId,domain,key,maximumValueBytes,{admit(size){if(bytes+scalar.bytes+readBytes+size>4*1024*1024)throw budget;readBytes+=size;}}),incoming,cursor.counts);}
  catch(error){if(error!==budget)throw error;if(units)break;return defer('replay_atom_requires_staging');}
  if(!result.supported)return defer(result.reason);
  const plans=result.patches.map(patch=>({...patch,plan:planRecoveryReplayValue(patch.value,maximumValueBytes)})),rows=plans.reduce((sum,patch)=>sum+patch.plan.rows,0),cost=scalar.bytes+readBytes+plans.reduce((sum,patch)=>sum+patch.plan.bytes,0);
  if(rows>scratch.remaining||bytes+cost>4*1024*1024){if(units)break;return defer('replay_atom_requires_staging');}
  for(const patch of plans)if(!writeRecoveryReplayValue(scratch,roomId,patch.domain,patch.key,patch.plan))throw Error('Recovery replay atom admission changed');
  cursor.sequence=row.sequence;cursor.counts=result.counts;units++;bytes+=cost;
 }
 return{cursor,units,bytes,done:false};
}
