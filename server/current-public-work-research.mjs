// RESEARCH ONLY: bounded complete-census experiment, not for serving.
// It deliberately refuses rooms with >8 work items and does not implement
// public pagination, receipt publication, or migration qualification.
import {publicPage,publicTask} from '../src/events.js';
import {readCurrentHead,readCurrentRecord,readCurrentWorkItem,readCurrentWorkPrivacy,withCurrentReadContext} from './current-room-repository.mjs';
const OPEN=new Set(['proposed','accepted','working','blocked']);
export function researchPublicTasks(store,roomId){
 return store.readTransaction(()=>withCurrentReadContext(store.db,roomId,b=>{
  const db=store.db,head=readCurrentHead(db,roomId,b);if(!head)return null;
  const room=readCurrentRecord(db,roomId,'metadata','room',b);
  if(!room||room.id!==roomId)throw Error('room identity mismatch');
  if(!publicPage({room}).enabled)return {available:false,tasks:[]};
  if(head.counts.workItems>8)return {available:false,tasks:[]};
  const keys=db.prepare("SELECT record_key FROM current_room_record_proofs WHERE room_id=? AND domain='workItems' AND present=1 ORDER BY record_key LIMIT 9").all(roomId);
  if(keys.length!==head.counts.workItems)throw Error('work census mismatch');
  const tasks=[];
  for(const {record_key:id} of keys){
   const item=readCurrentWorkItem(db,roomId,id,b),privacy=readCurrentWorkPrivacy(db,roomId,id,b);
   if(!item||!privacy)throw Error('work proof missing');
   if(privacy.requests===0 && publicTask(item).enabled===true && OPEN.has(item.state) && typeof item.title==='string')tasks.push({title:item.title,definitionOfDone:typeof item.definitionOfDone==='string'?item.definitionOfDone:''});
  }
  return {available:true,tasks};
 }));
}
