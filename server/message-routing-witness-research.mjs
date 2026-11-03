// RESEARCH ONLY. This codec does not authenticate a witness, write it, migrate
// legacy rows, or authorize callers. Use only after the complete message row
// has been certified and the witness is protected by the room transition.
import {isDeepStrictEqual} from 'node:util';
import {messageProofHash,messageProofMatches} from './write-integrity.mjs';
import {decodeMessageEntity} from './message-entity-projection.mjs';
const FIELDS=Object.freeze(['id','authorId','channelId','replyToId','toMemberId','workItemId','createdAt','deletedAt']);
const pairs=Object.freeze([['id','message_id'],['authorId','author_id'],['channelId','channel_id'],['replyToId','reply_to_id'],['toMemberId','to_member_id'],['workItemId','work_item_id'],['createdAt','created_at'],['deletedAt','deleted_at']]);
const bad=()=>{throw Error('routing witness is inconsistent')};
export function makeRoutingWitnessResearch(row){
 if(!messageProofMatches(row)||!Number.isSafeInteger(row.seq)||row.seq<1)bad();
 const message=decodeMessageEntity(row);
 for(const [key,column] of pairs)if((message[key]??null)!==(row[column]??null))bad();
 const routing=Object.fromEntries(FIELDS.filter(key=>Object.hasOwn(message,key)).map(key=>[key,message[key]]));
 return {version:2,sequence:row.seq,entityHash:messageProofHash(row),routing};
}
export function checkRoutingWitnessResearch(witness,id){
 if(!witness||witness.version!==2||!Number.isSafeInteger(witness.sequence)||witness.sequence<1||!/^[a-f0-9]{64}$/.test(witness.entityHash)||!witness.routing||witness.routing.id!==id)bad();
 if(Object.keys(witness).sort().join(',')!=='entityHash,routing,sequence,version'||Object.keys(witness.routing).some(key=>!FIELDS.includes(key)))bad();
 for(const key of FIELDS){const v=witness.routing[key];if(v!==undefined&&v!==null&&typeof v!=='string')bad();}
 if(typeof witness.routing.authorId!=='string'||typeof witness.routing.createdAt!=='string')bad();
 return structuredClone(witness.routing);
}
export function routingMatchesCertifiedRowResearch(witness,row){
 try{return isDeepStrictEqual(witness,makeRoutingWitnessResearch(row));}catch{return false;}
}
