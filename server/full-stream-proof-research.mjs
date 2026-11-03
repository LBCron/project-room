// Research only. Does not enforce Room authorization or production budgets.
import {createHash} from 'node:crypto';import {StringDecoder} from 'node:string_decoder';
import {MESSAGE_PROOF_FIELDS} from './write-integrity.mjs';import {readCurrentRecord} from './current-room-repository.mjs';import {decodeMessageEntity} from './message-entity-projection.mjs';
export function fullStreamProofResearch(db,room,id,{maxBytes}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<0)throw Error('explicit experimental reservation required');
 const witness=readCurrentRecord(db,room,'messageWitness',id),meta=db.prepare('SELECT entity_hash,seq FROM messages WHERE room_id=? AND message_id=?').get(room,id);
 if(!witness||!meta||witness.entityHash!==meta.entity_hash||witness.sequence!==meta.seq)throw Error('witness mismatch');
 const row={entity_hash:meta.entity_hash},hash=createHash('sha256');let bytes=0,reads=0;hash.update('[');
 for(const [index,key] of MESSAGE_PROOF_FIELDS.entries()){
  if(index)hash.update(',');const info=db.prepare(`SELECT typeof(${key}) AS type,length(CAST(${key} AS BLOB)) AS size FROM messages WHERE room_id=? AND message_id=?`).get(room,id);
  if(info.type==='null'){row[key]=null;hash.update('null');continue}
  if(info.type==='integer'||info.type==='real'){const value=db.prepare(`SELECT ${key} AS value FROM messages WHERE room_id=? AND message_id=?`).get(room,id).value;row[key]=value;hash.update(JSON.stringify(value));continue}
  if(info.type!=='text')throw Error('unsupported field type');bytes+=info.size;if(bytes>maxBytes)throw Error('experimental reservation exceeded');const stmt=db.prepare(`SELECT substr(CAST(${key} AS BLOB),?,?) AS chunk FROM messages WHERE room_id=? AND message_id=?`),decoder=new StringDecoder('utf8'),parts=[];hash.update('"');
  for(let offset=0;offset<info.size;offset+=16384){const chunk=Buffer.from(stmt.get(offset+1,16384,room,id).chunk),part=decoder.write(chunk);parts.push(part);reads++;hash.update(JSON.stringify(part).slice(1,-1));}const end=decoder.end();parts.push(end);hash.update(JSON.stringify(end).slice(1,-1));hash.update('"');row[key]=parts.join('');
 }
 hash.update(']');if(hash.digest('hex')!==meta.entity_hash)throw Error('row mismatch');return{row,value:decodeMessageEntity(row),sourceBytes:bytes,blobReads:reads};
}
