// RESEARCH ONLY: not integrated, not a general authenticated-message reader.
import {createHash} from 'node:crypto';import {StringDecoder} from 'node:string_decoder';import {MESSAGE_PROOF_FIELDS} from './write-integrity.mjs';import {readCurrentRecord} from './current-room-repository.mjs';
export function assertPreviewStructure(db,room,id){
 const shapes=db.prepare(`SELECT json_valid(record_json) AS recordValid,json_valid(reducer_extras_json) AS extrasValid FROM messages WHERE room_id=? AND message_id=?`).get(room,id);
 if(!shapes.recordValid||!shapes.extrasValid)throw Error('invalid message json');
 const structure=db.prepare(`SELECT json_type(record_json) AS recordType,json_type(reducer_extras_json) AS extrasType FROM messages WHERE room_id=? AND message_id=?`).get(room,id);
 if(structure.recordType!=='object'||structure.extrasType!=='object')throw Error('invalid message structure');
 const invalid=db.prepare(`SELECT EXISTS(SELECT 1 FROM json_each(record_json) GROUP BY key HAVING count(*)>1) AS duplicateRecord, EXISTS(SELECT 1 FROM json_each(reducer_extras_json) WHERE key<>'editHistory' OR type<>'array') AS invalidExtra, EXISTS(SELECT 1 FROM json_each(reducer_extras_json) GROUP BY key HAVING count(*)>1) AS duplicateExtra FROM messages WHERE room_id=? AND message_id=?`).get(room,id);
 if(invalid.duplicateRecord||invalid.invalidExtra||invalid.duplicateExtra)throw Error('ambiguous message json');
}
export function verifyPreview(db,room,id,maxBytes=2*1024*1024){
 const witness=readCurrentRecord(db,room,'messageWitness',id),meta=db.prepare('SELECT entity_hash,seq FROM messages WHERE room_id=? AND message_id=?').get(room,id);if(!witness||!meta||witness.entityHash!==meta.entity_hash||witness.sequence!==meta.seq)throw Error('witness mismatch');
 const lengths=db.prepare(`SELECT ${MESSAGE_PROOF_FIELDS.map(k=>`coalesce(length(CAST(${k} AS BLOB)),0)`).join('+')} AS total FROM messages WHERE room_id=? AND message_id=?`).get(room,id),total=lengths.total;
 if(total>maxBytes)throw Error('stream limit');let hash=createHash('sha256'),reads=0,bodyUnits=0;hash.update('[');
 for(const [i,key] of MESSAGE_PROOF_FIELDS.entries()){
  if(i)hash.update(',');const info=db.prepare(`SELECT typeof(${key}) AS type,length(CAST(${key} AS BLOB)) AS size FROM messages WHERE room_id=? AND message_id=?`).get(room,id);if(info.type==='null'){hash.update('null');continue}
  if(info.type==='integer'||info.type==='real'){hash.update(JSON.stringify(db.prepare(`SELECT ${key} AS value FROM messages WHERE room_id=? AND message_id=?`).get(room,id).value));continue}
  if(info.type!=='text')throw Error('unexpected type');const stmt=db.prepare(`SELECT substr(CAST(${key} AS BLOB),?,?) AS chunk FROM messages WHERE room_id=? AND message_id=?`),decoder=new StringDecoder('utf8');hash.update('"');
  for(let p=0;p<info.size;p+=16384){const chunk=Buffer.from(stmt.get(p+1,16384,room,id).chunk),part=decoder.write(chunk);reads++;if(key==='body')bodyUnits+=part.length;hash.update(JSON.stringify(part).slice(1,-1));}const end=decoder.end();if(key==='body')bodyUnits+=end.length;hash.update(JSON.stringify(end).slice(1,-1));hash.update('"');
 }
 hash.update(']');if(hash.digest('hex')!==meta.entity_hash)throw Error('row mismatch');
 assertPreviewStructure(db,room,id);
 const result=db.prepare(`SELECT json_valid(record_json) AS valid,json_extract(record_json,'$.id') AS id,json_extract(record_json,'$.authorId') AS authorId,json_extract(record_json,'$.channelId') AS channel,json_extract(record_json,'$.toMemberId') AS recipient,json_extract(record_json,'$.deletedAt') AS deleted,CASE WHEN length(CAST(json_extract(record_json,'$.createdAt') AS BLOB))<=128 THEN json_extract(record_json,'$.createdAt') END AS createdAt,json_extract(record_json,'$.body')=body AS bodyMatches,substr(CAST(json_extract(record_json,'$.body') AS BLOB),1,8000) AS preview FROM messages WHERE room_id=? AND message_id=?`).get(room,id);
 if(!result.valid||result.id!==id||!result.bodyMatches||result.recipient||result.deleted||(result.channel&&result.channel!=='general')||(result.authorId!==null&&typeof result.authorId!=='string'))throw Error('not verified public message');const preview=Buffer.from(result.preview).toString('utf8').slice(0,2000);const value={id,authorId:result.authorId,channelId:result.channel||'general',toMemberId:null,deletedAt:null,createdAt:result.createdAt,body:preview+(bodyUnits>2000?' …':'')};return{total,reads,value,seq:meta.seq};
}
