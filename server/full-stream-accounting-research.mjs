// RESEARCH ONLY: measurement, not a production budget or authorization path.
import {createHash} from 'node:crypto';import {StringDecoder} from 'node:string_decoder';
import {MESSAGE_PROOF_FIELDS} from './write-integrity.mjs';import {decodeMessageEntity} from './message-entity-projection.mjs';
export class ProofBudgetExceededResearch extends Error {}
export class ProofIntegrityErrorResearch extends Error {}
// Exact UTF-8 bytes inside JSON.stringify's quoted string, with no expanded copy.
export function escapedJsonBytesResearch(text){
 let n=0;
 for(let i=0;i<text.length;i++){
  const c=text.charCodeAt(i);
  if(c===34||c===92||c===8||c===9||c===10||c===12||c===13)n+=2;
  else if(c<32)n+=6;
  else if(c<128)n++;
  else if(c<2048)n+=2;
  else if(c>=0xd800&&c<=0xdbff){const next=text.charCodeAt(i+1);if(next>=0xdc00&&next<=0xdfff){n+=4;i++;}else n+=6;}
  else if(c>=0xdc00&&c<=0xdfff)n+=6;
  else n+=3;
 }
 return n;
}
export function measureFullProofResearch(db,room,id,{witness,maxBytes,maxHashBytes,maxBlobReads}){
 if([maxBytes,maxHashBytes,maxBlobReads].some(n=>!Number.isSafeInteger(n)||n<0))throw Error('explicit measurement caps required');
 const meta=db.prepare('SELECT entity_hash,seq FROM messages WHERE room_id=? AND message_id=?').get(room,id);
 if(!witness||!meta||witness.entityHash!==meta.entity_hash||witness.sequence!==meta.seq)throw new ProofIntegrityErrorResearch('witness mismatch');
 const row={entity_hash:meta.entity_hash},hash=createHash('sha256'),stats={sourceBytes:0,blobBytes:0,blobReads:0,hashBytes:0,maxBlobChunk:0,maxEscapedChunk:0,decodedUtf16Units:0};
 const update=value=>{const n=Buffer.byteLength(value);if(n>maxHashBytes-stats.hashBytes)throw new ProofBudgetExceededResearch('hash reservation exceeded');stats.hashBytes+=n;hash.update(value)};update('[');
 for(const [index,key] of MESSAGE_PROOF_FIELDS.entries()){
  if(index)update(',');const info=db.prepare(`SELECT typeof(${key}) AS type,length(CAST(${key} AS BLOB)) AS size FROM messages WHERE room_id=? AND message_id=?`).get(room,id);
  if(info.type==='null'){row[key]=null;update('null');continue}
  if(info.type==='integer'||info.type==='real'){const v=db.prepare(`SELECT ${key} AS value FROM messages WHERE room_id=? AND message_id=?`).get(room,id).value;row[key]=v;update(JSON.stringify(v));continue}
  if(info.type!=='text'||!Number.isSafeInteger(info.size)||info.size<0)throw new ProofIntegrityErrorResearch('unsupported field');stats.sourceBytes+=info.size;if(stats.sourceBytes>maxBytes)throw new ProofBudgetExceededResearch('measurement cap exceeded');
  const stmt=db.prepare(`SELECT substr(CAST(${key} AS BLOB),?,?) AS chunk FROM messages WHERE room_id=? AND message_id=?`),decoder=new StringDecoder('utf8'),parts=[];update('"');
  const consume=part=>{const escapedBytes=escapedJsonBytesResearch(part);if(escapedBytes>maxHashBytes-stats.hashBytes)throw new ProofBudgetExceededResearch('hash reservation exceeded');parts.push(part);stats.decodedUtf16Units+=part.length;const escaped=JSON.stringify(part).slice(1,-1);if(Buffer.byteLength(escaped)!==escapedBytes)throw new ProofIntegrityErrorResearch('escaped size differs');stats.maxEscapedChunk=Math.max(stats.maxEscapedChunk,escapedBytes);update(escaped)};
  for(let off=0;off<info.size;off+=16384){if(stats.blobReads>=maxBlobReads)throw new ProofBudgetExceededResearch('chunk reservation exceeded');const chunk=Buffer.from(stmt.get(off+1,16384,room,id).chunk);if(chunk.length!==Math.min(16384,info.size-off))throw new ProofIntegrityErrorResearch('short chunk');stats.blobBytes+=chunk.length;stats.blobReads++;stats.maxBlobChunk=Math.max(stats.maxBlobChunk,chunk.length);consume(decoder.write(chunk));}consume(decoder.end());update('"');row[key]=parts.join('');
 }
 update(']');if(hash.digest('hex')!==meta.entity_hash)throw new ProofIntegrityErrorResearch('row mismatch');return {row,value:decodeMessageEntity(row),stats};
}
