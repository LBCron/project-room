// Explicit, unwired replay cutover. Exported DDL is not registered on store
// open. Capturing bytes never certifies replay or publishes serving rows.
import {createHash} from 'node:crypto';
import {initialProjectionScan,scanProjectionChunk,decodeProjectionSpan,projectionMapFrame} from './replay-projection-codec.mjs';
import {sqliteValueLimit} from './storage-limits.mjs';
import {STORE_SCHEMA_VERSION} from './writer-fence.mjs';
import {initialReplayHash, advanceReplayHash, finishReplayHash,
  encodeReplayHash, decodeReplayHash} from './replay-sha256.mjs';

export const REPLAY_CAPTURE_BYTES = 4 * 1024 * 1024;
export const REPLAY_CAPTURE_STEP_BYTES = 16 * 1024;
const CONTROL_BYTES = 4096;
const MAX = Number.MAX_SAFE_INTEGER;
const fatalText = bytes => new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(new Uint8Array(bytes));
const rawId = value => {
  if(typeof value!=='string'||!/^([A-F0-9]{2}){1,200}$/.test(value))throw Error('invalid replay event identity');
  return fatalText(Buffer.from(value,'hex'));
};
const hash = text => createHash('sha256').update(text).digest('hex');
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sourceNode=(level,left,right)=>hash(JSON.stringify(['project-room.replay-source-node.v1',level,left,right]));
const SOURCE_EMPTY=[hash('project-room.replay-source-empty.v1')];
for(let level=1;level<=8;level++)SOURCE_EMPTY.push(sourceNode(level,SOURCE_EMPTY[level-1],SOURCE_EMPTY[level-1]));
const sourceLeaf=(header,index,chunk)=>hash(JSON.stringify(['project-room.replay-source-leaf.v1',
  header.hash,header.value.generation,index,chunk.offset,chunk.length,header.value.bytes,chunk.sha256]));

// Separate typed identities are necessary: the existing (room_id,part) table
// already owns its part-zero legacy checkpoint. No internal room/key aliases.
export function replayCutoverSchema({durable = false} = {}) {
  const writer = durable ? '(SELECT version FROM room_writer_permit WHERE singleton=1)'
    : `project_room_writer_v${STORE_SCHEMA_VERSION}()`;
  return `CREATE TABLE message_replay_units (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    generation TEXT NOT NULL, domain TEXT NOT NULL, unit_key TEXT NOT NULL,
    row_version INTEGER NOT NULL, payload_bytes INTEGER NOT NULL,
    payload_sha256 TEXT NOT NULL, payload BLOB NOT NULL,
    PRIMARY KEY(room_id,generation,domain,unit_key),
    CHECK(domain IN ('control','header','witness','hash','codec','message','metadata','replay-message','replay-metadata','semantic','source-chunk','source-merkle','leaf-proof','metadata-entry'))
  );
  ${['INSERT','UPDATE','DELETE'].map(operation => `CREATE TRIGGER replay_units_writer_${operation.toLowerCase()}
    BEFORE ${operation} ON message_replay_units BEGIN
    SELECT CASE WHEN ${writer} IS NOT ${STORE_SCHEMA_VERSION}
    THEN RAISE(ABORT,'unsupported replay unit writer') END; END;`).join('\n')}
  ${['UPDATE','DELETE'].map(operation => `CREATE TRIGGER replay_source_${operation.toLowerCase()}
    AFTER ${operation} ON events BEGIN
    UPDATE message_replay_units SET row_version=CASE
      WHEN typeof(row_version)='integer' AND row_version BETWEEN 0 AND ${MAX - 1}
      THEN row_version+1 ELSE RAISE(ABORT,'invalid replay source epoch') END
      WHERE room_id ${operation === 'UPDATE' ? 'IN (OLD.room_id,NEW.room_id)' : '=OLD.room_id'} AND generation='' AND domain='control' AND unit_key='epoch';
    DELETE FROM message_replay_units WHERE room_id ${operation === 'UPDATE' ? 'IN (OLD.room_id,NEW.room_id)' : '=OLD.room_id'} AND generation<>'';
    END;`).join('\n')}
  CREATE TRIGGER replay_source_prefix_insert AFTER INSERT ON events
    WHEN EXISTS(SELECT 1 FROM message_replay_units WHERE room_id=NEW.room_id
      AND generation='' AND domain='control' AND unit_key='capture-head'
      AND (typeof(NEW.sequence)<>'integer'
        OR typeof(row_version)<>'integer' OR NEW.sequence<=row_version))
    BEGIN
    UPDATE message_replay_units SET row_version=CASE
      WHEN typeof(row_version)='integer' AND row_version BETWEEN 0 AND ${MAX - 1}
      THEN row_version+1 ELSE RAISE(ABORT,'invalid replay source epoch') END
      WHERE room_id=NEW.room_id AND generation='' AND domain='control' AND unit_key='epoch';
    DELETE FROM message_replay_units WHERE room_id=NEW.room_id AND generation<>'';
    END;
  CREATE TRIGGER replay_room_rollback AFTER UPDATE OF sequence ON rooms
    WHEN typeof(NEW.sequence)<>'integer' OR NEW.sequence<OLD.sequence
    BEGIN
    UPDATE message_replay_units SET row_version=CASE
      WHEN typeof(row_version)='integer' AND row_version BETWEEN 0 AND ${MAX - 1}
      THEN row_version+1 ELSE RAISE(ABORT,'invalid replay source epoch') END
      WHERE room_id=OLD.id AND generation='' AND domain='control' AND unit_key='epoch';
    DELETE FROM message_replay_units WHERE room_id=OLD.id AND generation<>'';
    END;`;
}

export function verifyReplayCutoverSchema(db) {
  const ddl=replayCutoverSchema({durable:Boolean(db.storage?.sql)});
  const definitions=[...ddl.matchAll(/(CREATE (?:TABLE|TRIGGER) ([a-z_]+)[\s\S]*?);(?=\s*CREATE |\s*$)/g)];
  if(definitions.length!==8)throw Error('invalid replay schema contract');
  for(const [,sql,name] of definitions){
    const row=db.prepare(`SELECT CASE WHEN typeof(sql)='text' AND octet_length(sql)<=8192
      THEN sql END AS sql FROM sqlite_master WHERE name=?`).get(name);
    if(row?.sql!==sql.trim())throw Error('replay schema requires reconciliation');
  }
}

function epoch(db, roomId) {
  const row = db.prepare(`SELECT CASE WHEN typeof(row_version)='integer'
    AND row_version BETWEEN 0 AND ${MAX} THEN row_version END AS value
    FROM message_replay_units WHERE room_id=? AND generation=''
      AND domain='control' AND unit_key='epoch'`).get(roomId);
  if (!row || row.value === null) throw Error('invalid replay source epoch');
  return row.value;
}
function activeCapture(db, roomId) {
  const row=db.prepare(`SELECT CASE WHEN typeof(row_version)='integer' AND row_version BETWEEN 1 AND ${MAX}
    AND typeof(payload)='blob' AND octet_length(payload)=64 AND payload_bytes=64
    AND typeof(payload_sha256)='text' AND octet_length(payload_sha256)=64
    THEN payload END AS payload,CASE WHEN typeof(payload_sha256)='text'
    AND octet_length(payload_sha256)=64 THEN payload_sha256 END AS payload_sha256,CASE WHEN typeof(row_version)='integer'
    AND row_version BETWEEN 1 AND ${MAX} THEN row_version END AS head
    FROM message_replay_units WHERE room_id=? AND generation='' AND domain='control' AND unit_key='capture-head'`).get(roomId);
  if(!row)return null;
  if(!row.payload)throw Error('invalid replay capture control');
  const generation=Buffer.from(row.payload).toString('utf8');
  if(!digest(generation) || hash(generation)!==row.payload_sha256)throw Error('invalid replay capture control');
  return {generation,head:row.head};
}

function put(db, roomId, generation, domain, value, version = 1) {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) > (domain==='codec'?24*1024:CONTROL_BYTES)) throw Error('replay control byte limit');
  db.prepare(`INSERT INTO message_replay_units VALUES(?,?,?,'state',?,?,?,?)
    ON CONFLICT(room_id,generation,domain,unit_key) DO UPDATE SET
    row_version=excluded.row_version,payload_bytes=excluded.payload_bytes,
    payload_sha256=excluded.payload_sha256,payload=excluded.payload`)
    .run(roomId,generation,domain,version,Buffer.byteLength(text),hash(text),Buffer.from(text));
  return hash(text);
}
function get(db, roomId, generation, domain) {
  const row = db.prepare(`SELECT CASE WHEN typeof(payload)='blob'
    AND typeof(payload_bytes)='integer' AND payload_bytes BETWEEN 1 AND ?
    AND octet_length(payload)=payload_bytes AND typeof(payload_sha256)='text'
    AND octet_length(payload_sha256)=64 THEN 1 ELSE 0 END AS admitted
    FROM message_replay_units WHERE room_id=? AND generation=? AND domain=? AND unit_key='state'`)
    .get(domain==='codec'?24*1024:CONTROL_BYTES,roomId,generation,domain);
  if (!row?.admitted) throw Error('missing or invalid replay control');
  const saved = db.prepare(`SELECT payload,payload_sha256,CASE WHEN typeof(row_version)='integer'
    AND row_version BETWEEN 1 AND ${MAX} THEN row_version END AS row_version FROM message_replay_units
    WHERE room_id=? AND generation=? AND domain=? AND unit_key='state'`).get(roomId,generation,domain);
  const text = fatalText(saved.payload);
  if (hash(new Uint8Array(saved.payload)) !== saved.payload_sha256) throw Error('corrupt replay control');
  const value=JSON.parse(text);
  if (saved.row_version !== (domain==='header'?value.head:1)) throw Error('replay control version changed');
  return {value, hash: saved.payload_sha256};
}
function auditBinding(db, receiptId) {
  if(typeof receiptId!=='string' || !/^oa_brc_[a-f0-9]{64}$/.test(receiptId))throw Error('invalid replay audit binding');
  const row=db.prepare(`SELECT CASE WHEN typeof(counts_json)='text' AND octet_length(counts_json)<=4096
    THEN counts_json END AS json FROM operator_actions WHERE id=?
    AND action IN ('replay_cutover_capture','replay_cutover_hash','replay_cutover_codec')`).get(receiptId);
  if(!row?.json)throw Error('missing independent replay audit binding');
  return JSON.parse(row.json);
}

function validate(input, phase) {
  if (!input || !id(input.roomId) || !id(input.requestId)) throw Error('invalid replay capture intent');
  const keys = phase === 'capture' ? ['roomId','requestId','expectedHead','reason','ceilingBytes']
    : ['roomId','requestId','generation','expectedBytes'];
  if (Object.keys(input).some(key => !keys.includes(key))) throw Error('invalid replay capture intent');
  if (phase === 'capture' && (!Number.isSafeInteger(input.expectedHead) || input.expectedHead < 1
    || typeof input.reason !== 'string' || input.reason.length>280 || Buffer.byteLength(input.reason)>280 || !input.reason.trim()
    || (input.ceilingBytes !== undefined && (!Number.isSafeInteger(input.ceilingBytes)
      || input.ceilingBytes<1 || input.ceilingBytes>REPLAY_CAPTURE_BYTES)))) throw Error('invalid replay capture intent');
  if (phase !== 'capture' && (!digest(input.generation) || !Number.isSafeInteger(input.expectedBytes)
    || input.expectedBytes<0 || input.expectedBytes>REPLAY_CAPTURE_BYTES)) throw Error('invalid replay hash intent');
}
function receipt(store, input, phase, operation) {
  validate(input, phase);
  const intent=phase==='capture'
    ? {phase,roomId:input.roomId,requestId:input.requestId,expectedHead:input.expectedHead,reason:input.reason,ceilingBytes:input.ceilingBytes??REPLAY_CAPTURE_BYTES}
    : {phase,roomId:input.roomId,requestId:input.requestId,generation:input.generation,expectedBytes:input.expectedBytes};
  const fingerprint = hash(JSON.stringify(intent));
  const receiptId = 'oa_brc_' + hash(phase+'\0'+input.roomId+'\0'+input.requestId);
  return store.transaction(() => {
    const old = store.db.prepare(`SELECT CASE WHEN typeof(counts_json)='text'
      AND octet_length(counts_json)<=4096 THEN counts_json END AS json
      FROM operator_actions WHERE id=? AND action=?`).get(receiptId,'replay_cutover_'+phase);
    if (old) {
      if (!old.json) throw Error('invalid replay receipt');
      const value = JSON.parse(old.json);
      if (value.fingerprint !== fingerprint) throw Error('replay idempotency conflict');
      return {...value,duplicate:true};
    }
    verifyReplayCutoverSchema(store.db);
    const value = {...operation({receiptId}),fingerprint,duplicate:false};
    if(Buffer.byteLength(JSON.stringify(value))>4096)throw Error('replay receipt byte limit');
    store.db.prepare(`INSERT INTO operator_actions
      (id,at,action,target_kind,target_id,reason,plan_hash,counts_json,result,request_id)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).run(receiptId,store.now(),'replay_cutover_'+phase,
      'room',input.roomId,input.reason??null,fingerprint,JSON.stringify(value),'pending',input.requestId);
    return value;
  });
}

export function captureReplayWitness(store, input) {
  return receipt(store,input,'capture',({receiptId}) => {
    const db=store.db, roomId=input.roomId, ceiling=input.ceilingBytes??REPLAY_CAPTURE_BYTES;
    const admitted=db.prepare(`SELECT
      CASE WHEN typeof(r.sequence)='integer' AND r.sequence BETWEEN 1 AND ${MAX} THEN r.sequence END AS head,
      CASE WHEN typeof(r.projection)='text' THEN octet_length(r.projection) END AS bytes,
      CASE WHEN typeof(p.sequence)='integer' AND p.sequence=r.sequence
        AND typeof(p.metadata_hash)='text' AND octet_length(p.metadata_hash)=64
        AND typeof(p.projection_hash)='text' AND octet_length(p.projection_hash)=64
        THEN p.metadata_hash END AS metadata_hash,
      CASE WHEN typeof(p.projection_hash)='text' AND octet_length(p.projection_hash)=64 THEN p.projection_hash END AS content_hash,
      CASE WHEN typeof(e.id)='text' AND octet_length(e.id) BETWEEN 1 AND 200 THEN hex(CAST(e.id AS BLOB)) END AS event_id_hex
      FROM rooms r LEFT JOIN integrity_room_state p ON p.room_id=r.id
      LEFT JOIN events e ON e.room_id=r.id AND e.sequence=r.sequence WHERE r.id=?`).get(roomId);
    if (!admitted || admitted.head!==input.expectedHead) throw Error('replay capture head changed');
    if (!Number.isSafeInteger(admitted.bytes) || admitted.bytes<1 || admitted.bytes>ceiling) throw Error('replay capture byte limit');
    const runtime=sqliteValueLimit(db);
    if(!Number.isSafeInteger(runtime?.valueLimitBytes) || admitted.bytes+512>runtime.valueLimitBytes)throw Error('replay capture runtime value limit');
    if (!digest(admitted.metadata_hash) || !digest(admitted.content_hash) || !admitted.event_id_hex) throw Error('independent replay proof required');
    const generation=hash(input.roomId+'\0'+input.requestId);
    const active=activeCapture(db,roomId);
    if(active && db.prepare(`SELECT 1 FROM message_replay_units WHERE room_id=? AND generation=?
      AND domain='header' AND unit_key='state'`).get(roomId,active.generation))throw Error('active replay capture requires continuation');
    db.prepare(`INSERT OR IGNORE INTO message_replay_units VALUES(?,'','control','epoch',0,0,'',X'')`).run(roomId);
    db.prepare(`INSERT INTO message_replay_units VALUES(?,'','control','capture-head',?,64,?,?)
      ON CONFLICT(room_id,generation,domain,unit_key) DO UPDATE SET row_version=excluded.row_version,
      payload_bytes=excluded.payload_bytes,payload_sha256=excluded.payload_sha256,payload=excluded.payload`)
      .run(roomId,admitted.head,hash(generation),Buffer.from(generation));
    const header={version:1,roomId,generation,captureReceiptId:receiptId,head:admitted.head,eventId:rawId(admitted.event_id_hex),
      bytes:admitted.bytes,metadataHash:admitted.metadata_hash,contentHash:admitted.content_hash,
      epoch:epoch(db,roomId),ceiling};
    const headerHash=put(db,roomId,generation,'header',header,header.head);
    db.prepare(`INSERT INTO message_replay_units
      SELECT ?,?,'witness','state',1,octet_length(projection),?,CAST(projection AS BLOB)
      FROM rooms WHERE id=?`).run(roomId,generation,admitted.metadata_hash,roomId);
    const state=encodeReplayHash(initialReplayHash());
    put(db,roomId,generation,'hash',{version:1,headerHash,state,sourceRoot:SOURCE_EMPTY[8],receiptId});
    const codecState=JSON.stringify(initialProjectionScan());
    put(db,roomId,generation,'codec',{version:1,headerHash,state:codecState,receiptId});
    return {generation,bindingHash:headerHash,hashStateHash:hash(state),sourceRoot:SOURCE_EMPTY[8],codecStateHash:hash(codecState),head:header.head,bytes:header.bytes,phase:'captured',publication:'pending',certified:false};
  });
}

function captureBinding(db,roomId,generation) {
  const header=get(db,roomId,generation,'header');
  const captured=auditBinding(db,header.value.captureReceiptId);
  if(captured.bindingHash!==header.hash || captured.generation!==generation)throw Error('independent replay capture binding changed');
  const active=activeCapture(db,roomId);
  if(active?.head!==header.value.head || active.generation!==generation)throw Error('replay capture control changed');
  if (header.value.roomId!==roomId || header.value.generation!==generation
    || epoch(db,roomId)!==header.value.epoch) throw Error('replay source epoch changed');
  const anchor=db.prepare(`SELECT CASE WHEN typeof(id)='text' AND octet_length(id)<=200
    THEN hex(CAST(id AS BLOB)) END AS id_hex FROM events WHERE room_id=? AND sequence=?`).get(roomId,header.value.head);
  if (!anchor?.id_hex || rawId(anchor.id_hex)!==header.value.eventId) throw Error('replay capture anchor changed');
  return header;
}

function putPointer(db,roomId,generation,domain,key,value){
  const bytes=Buffer.from(JSON.stringify(value));
  if(bytes.length>512)throw Error('replay pointer byte limit');
  db.prepare('INSERT INTO message_replay_units VALUES(?,?,?,?,1,?,?,?)')
    .run(roomId,generation,domain,key,bytes.length,hash(bytes),bytes);
}
function pointer(db,roomId,generation,domain,key){
  const row=db.prepare(`SELECT CASE WHEN typeof(payload)='blob' AND typeof(payload_bytes)='integer'
    AND payload_bytes BETWEEN 1 AND 512 AND octet_length(payload)=payload_bytes
    THEN payload END AS payload FROM message_replay_units
    WHERE room_id=? AND generation=? AND domain=? AND unit_key=?`).get(roomId,generation,domain,key);
  if(!row?.payload)throw Error('missing or invalid replay proof pointer');
  return JSON.parse(fatalText(row.payload));
}
const leafCommitment=(headerHash,sourceRoot,generation,domain,key,offset,sourceLength,bytes,sha256,keyFrame=null)=>hash(JSON.stringify(
  ['project-room.replay-leaf.v1',headerHash,sourceRoot,generation,domain,key,offset,sourceLength,bytes,sha256,keyFrame]));

// Exactly 256 fixed chunk slots: the supported source is at most 4 MiB.
// Missing slots have a code-owned empty commitment. A saved partial receipt
// cannot supply membership in a different completed root.
function sourceNodeAt(db,header,level,index){
  const row=db.prepare(`SELECT CASE WHEN typeof(payload)='blob' AND typeof(payload_bytes)='integer'
    AND payload_bytes=64 AND octet_length(payload)=64 AND typeof(row_version)='integer'
    AND row_version=1 THEN payload END AS payload FROM message_replay_units
    WHERE room_id=? AND generation=? AND domain='source-merkle' AND unit_key=?`)
    .get(header.value.roomId,header.value.generation,level+':'+index);
  if(!row)return undefined;
  const value=row.payload&&fatalText(row.payload);
  if(!digest(value))throw Error('invalid replay source inclusion node');
  return value;
}
function sourcePath(db,header,index,leaf,expectedRoot,checkOwn=false){
  if(!Number.isInteger(index)||index<0||index>=256||!digest(leaf)||!digest(expectedRoot))
    throw Error('invalid replay source inclusion');
  const siblings=[];let current=leaf,position=index;
  for(let level=0;level<8;level++){
    if(checkOwn){
      const own=sourceNodeAt(db,header,level,position);
      if((level===0&&own!==undefined)||(own===undefined?current!==SOURCE_EMPTY[level]:own!==current))
        throw Error('replay source inclusion cursor or node changed');
    }
    const sibling=sourceNodeAt(db,header,level,position^1)??SOURCE_EMPTY[level];
    siblings.push(sibling);
    current=position%2?sourceNode(level+1,sibling,current):sourceNode(level+1,current,sibling);
    position=Math.floor(position/2);
  }
  if(current!==expectedRoot)throw Error('replay source inclusion root changed');
  return siblings;
}

function advanceSourceMembership(db,header,chunk,previousRoot){
  const index=chunk.offset/REPLAY_CAPTURE_STEP_BYTES;
  const siblings=sourcePath(db,header,index,SOURCE_EMPTY[0],previousRoot,true);
  const write=db.prepare(`INSERT INTO message_replay_units VALUES(?,?,'source-merkle',?,1,64,?,?)
    ON CONFLICT(room_id,generation,domain,unit_key) DO UPDATE SET
    payload_sha256=excluded.payload_sha256,payload=excluded.payload`);
  let current=sourceLeaf(header,index,chunk),position=index;
  for(let level=0;level<8;level++){
    write.run(header.value.roomId,header.value.generation,level+':'+position,hash(current),Buffer.from(current));
    current=position%2?sourceNode(level+1,siblings[level],current):sourceNode(level+1,current,siblings[level]);position=Math.floor(position/2);
  }
  return current;
}

// Every read is charged before fetching. Cache fixed chunks only for this
// transaction, including repeated/span reads; neither a self-hash nor a later
// changed witness can replace the immutable completed-hash receipt evidence.
function readSourceRange(db,header,offset,length,budget){
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<1
    ||length>128*1024||offset+length>header.value.bytes)throw Error('invalid replay source range');
  const {roomId,generation}=header.value,out=new Uint8Array(length);
  for(let start=Math.floor(offset/REPLAY_CAPTURE_STEP_BYTES)*REPLAY_CAPTURE_STEP_BYTES;start<offset+length;start+=REPLAY_CAPTURE_STEP_BYTES){
    let bytes=budget.chunks.get(start);
    if(!bytes){
      const size=Math.min(REPLAY_CAPTURE_STEP_BYTES,header.value.bytes-start);
      if(budget.bytes+size+4096+512+8*64>256*1024)throw Error('replay source input byte limit');
      budget.bytes+=size+4096+512+8*64;
      const saved=pointer(db,roomId,generation,'source-chunk',String(start));
      const prior=auditBinding(db,saved.receiptId),chunk=prior.sourceChunk;
      if(prior.generation!==generation||prior.bindingHash!==header.hash||!chunk
        ||chunk.offset!==start||chunk.length!==size||!digest(chunk.sha256))throw Error('replay source chunk binding changed');
      sourcePath(db,header,start/REPLAY_CAPTURE_STEP_BYTES,sourceLeaf(header,start/REPLAY_CAPTURE_STEP_BYTES,chunk),budget.sourceRoot);
      const row=db.prepare(`SELECT substr(payload,?,?) AS chunk FROM message_replay_units
        WHERE room_id=? AND generation=? AND domain='witness' AND unit_key='state'
        AND typeof(payload)='blob' AND octet_length(payload)=?`)
        .get(start+1,size,roomId,generation,header.value.bytes);
      if(!row?.chunk)throw Error('replay source chunk missing');
      bytes=new Uint8Array(row.chunk);
      if(bytes.length!==size||hash(bytes)!==chunk.sha256)throw Error('replay source chunk changed');
      budget.chunks.set(start,bytes);
    }
    const lo=Math.max(offset,start),hi=Math.min(offset+length,start+bytes.length);
    out.set(bytes.subarray(lo-start,hi-start),lo-offset);
  }
  return out;
}

export function readReplayWitnessLeaf(store,input){
  if(!input||!id(input.roomId)||!digest(input.generation)
    ||!['message','metadata','metadata-entry'].includes(input.domain)||typeof input.key!=='string'
    ||Buffer.byteLength(input.key)>512||Object.keys(input).some(k=>!['roomId','generation','domain','key'].includes(k)))throw Error('invalid replay leaf intent');
  return store.readTransaction(()=>{
    const db=store.db;verifyReplayCutoverSchema(db);
    const header=captureBinding(db,input.roomId,input.generation);
    const saved=pointer(db,input.roomId,input.generation,'leaf-proof',JSON.stringify([input.domain,input.key]));
    const prior=auditBinding(db,saved.receiptId);
    if(!Number.isInteger(saved.index)||saved.index<0||saved.index>=32||prior.bindingHash!==header.hash
      ||prior.generation!==input.generation||!digest(prior.sourceRoot)||!Array.isArray(prior.leafCommitments)||prior.leafCommitments.length>32)
      throw Error('replay leaf receipt binding changed');
    const row=db.prepare(`SELECT CASE WHEN typeof(payload)='blob' AND typeof(payload_bytes)='integer'
      AND payload_bytes BETWEEN 1 AND 131072 AND octet_length(payload)=payload_bytes THEN payload END AS payload,
      CASE WHEN typeof(row_version)='integer' AND row_version BETWEEN 1 AND ? THEN row_version END AS position
      FROM message_replay_units WHERE room_id=? AND generation=? AND domain=? AND unit_key=?`)
      .get(header.value.bytes,input.roomId,input.generation,input.domain,input.key);
    if(!row?.payload||!row.position||!Number.isSafeInteger(saved.sourceLength)||saved.sourceLength<1
      ||row.position-1+saved.sourceLength>header.value.bytes)throw Error('invalid replay leaf source binding');
    const bytes=new Uint8Array(row.payload);
    if(input.domain==='metadata-entry' && (!Array.isArray(saved.keyFrame)||saved.keyFrame.length!==3
      ||saved.keyFrame.some(n=>!Number.isSafeInteger(n)||n<0)||saved.keyFrame[1]<2
      ||saved.keyFrame[0]+saved.keyFrame[1]>row.position-1))throw Error('invalid replay leaf key framing');
    const commitment=leafCommitment(header.hash,prior.sourceRoot,input.generation,input.domain,input.key,row.position-1,saved.sourceLength,bytes.length,hash(bytes),saved.keyFrame??null);
    if(prior.leafCommitments[saved.index]!==commitment)throw Error('independent replay leaf binding changed');
    return {value:JSON.parse(fatalText(bytes)),offset:row.position-1,bytes:bytes.length,certified:false};
  });
}

export function advanceReplayWitness(store, input) {
  return receipt(store,input,'hash',({receiptId}) => {
    const db=store.db, {roomId,generation}=input;
    const header=captureBinding(db,roomId,generation);
    const saved=get(db,roomId,generation,'hash').value;
    if (saved.version!==1 || saved.headerHash!==header.hash) throw Error('replay hash binding changed');
    const prior=auditBinding(db,saved.receiptId);
    if(prior.bindingHash!==header.hash || prior.hashStateHash!==hash(saved.state)||!digest(saved.sourceRoot)||prior.sourceRoot!==saved.sourceRoot)throw Error('independent replay checkpoint binding changed');
    const state=decodeReplayHash(saved.state);
    if (state.bytes!==input.expectedBytes) throw Error('replay hash cursor changed');
    const witness=db.prepare(`SELECT CASE WHEN typeof(row_version)='integer' AND row_version=1 AND typeof(payload)='blob'
      AND typeof(payload_bytes)='integer' AND payload_bytes=? AND octet_length(payload)=?
      AND typeof(payload_sha256)='text' AND payload_sha256=? THEN 1 ELSE 0 END AS admitted
      FROM message_replay_units WHERE room_id=? AND generation=? AND domain='witness' AND unit_key='state'`)
      .get(header.value.bytes,header.value.bytes,header.value.metadataHash,roomId,generation);
    if (!witness?.admitted || state.bytes>header.value.bytes) throw Error('replay witness changed');
    let next=state,sourceChunk=null,sourceRoot=saved.sourceRoot;
    if (state.bytes<header.value.bytes) {
      const row=db.prepare(`SELECT substr(payload,?,?) AS chunk FROM message_replay_units
        WHERE room_id=? AND generation=? AND domain='witness' AND unit_key='state'`)
        .get(state.bytes+1,REPLAY_CAPTURE_STEP_BYTES,roomId,generation);
      const bytes=new Uint8Array(row.chunk);
      next=advanceReplayHash(state,bytes);
      sourceChunk={offset:state.bytes,length:bytes.length,sha256:hash(bytes)};
      sourceRoot=advanceSourceMembership(db,header,sourceChunk,saved.sourceRoot);
      putPointer(db,roomId,generation,'source-chunk',String(state.bytes),{receiptId});
    }
    const complete=next.bytes===header.value.bytes;
    if (complete && finishReplayHash(next)!==header.value.metadataHash) throw Error('independent replay witness mismatch');
    const encoded=encodeReplayHash(next);
    put(db,roomId,generation,'hash',{version:1,headerHash:header.hash,state:encoded,sourceRoot,receiptId});
    return {generation,bindingHash:header.hash,hashStateHash:hash(encoded),sourceChunk,sourceRoot,head:header.value.head,bytes:next.bytes,phase:complete?'witness_verified':'hashing',
      publication:'pending',certified:false};
  });
}

// Partition only the independently verified immutable at-rest witness. These
// leaf rows are candidate inputs, never serving entities or new trust proofs.
export function partitionReplayWitness(store,input) {
  return receipt(store,input,'codec',({receiptId})=>{
    const db=store.db,{roomId,generation}=input,header=captureBinding(db,roomId,generation);
    const hashed=get(db,roomId,generation,'hash').value,hashReceipt=auditBinding(db,hashed.receiptId);
    if(hashed.headerHash!==header.hash || hashReceipt.bindingHash!==header.hash || hashReceipt.generation!==generation
      ||hashReceipt.hashStateHash!==hash(hashed.state)||!digest(hashed.sourceRoot)||hashReceipt.sourceRoot!==hashed.sourceRoot)throw Error('independent replay hash binding changed');
    const completeHash=decodeReplayHash(hashed.state);
    if(completeHash.bytes!==header.value.bytes || finishReplayHash(completeHash)!==header.value.metadataHash)throw Error('verified witness required before codec');
    const saved=get(db,roomId,generation,'codec').value,prior=auditBinding(db,saved.receiptId);
    if(saved.headerHash!==header.hash || prior.bindingHash!==header.hash || prior.codecStateHash!==hash(saved.state))throw Error('independent replay codec binding changed');
    const state=JSON.parse(saved.state);
    if(state.offset!==input.expectedBytes)throw Error('replay codec cursor changed');
    if(state.phase==='done' && state.offset===header.value.bytes)return {generation,bindingHash:header.hash,codecStateHash:hash(saved.state),bytes:state.offset,head:header.value.head,records:0,phase:'codec_partitioned',publication:'pending',certified:false};
    const budget={bytes:64*1024,chunks:new Map(),sourceRoot:hashed.sourceRoot};
    const chunk=readSourceRange(db,header,state.offset,Math.min(REPLAY_CAPTURE_STEP_BYTES-state.offset%REPLAY_CAPTURE_STEP_BYTES,header.value.bytes-state.offset),budget);
    const potentialChunks=state.phase==='value'
      ?1+Math.floor(state.offset/REPLAY_CAPTURE_STEP_BYTES)-Math.floor(state.tokenStart/REPLAY_CAPTURE_STEP_BYTES):1;
    if(!Number.isInteger(potentialChunks)||potentialChunks<1||potentialChunks>9)throw Error('invalid replay spanning source bound');
    const maximumRecords=Math.min(32,Math.floor((200-32-11*potentialChunks)/3));
    const scanned=scanProjectionChunk(state,chunk,{maximumRecords});
    if(scanned.state.offset>header.value.bytes || (!scanned.complete && scanned.state.offset===header.value.bytes))throw Error('incomplete replay projection codec');
    let outputBytes=8192;
    const records=scanned.records.map(record=>{
      const relative=record.offset-state.offset;
      const frame=record.kind==='metadata-map'?projectionMapFrame(record):null;
      const bytes=frame?Buffer.from(JSON.stringify(frame)):relative>=0 && relative+record.length<=chunk.length
        ? chunk.subarray(relative,relative+record.length)
        : readSourceRange(db,header,record.offset,record.length,budget);
      const value=frame??decodeProjectionSpan(bytes,record);
      // JSON.parse validates syntax but shadows duplicate keys. SQLite's
      // bounded tree walk sees every nested/escaped-equivalent object key.
      if(!frame&&db.prepare(`SELECT 1 FROM json_tree(?) WHERE key IS NOT NULL
        GROUP BY parent,key HAVING count(*)>1 LIMIT 1`).get(fatalText(bytes)))
        throw Error('duplicate replay projection object key');
      outputBytes+=bytes.length+1024;
      return {record,bytes,value};
    });
    const encoded=JSON.stringify(scanned.state);outputBytes+=Buffer.byteLength(encoded);
    if(outputBytes>256*1024)throw Error('replay codec output byte limit');
    const logicalUnitRows=32+budget.chunks.size*11+records.length*3;
    if(logicalUnitRows>200)throw Error('replay codec row limit');
    const insert=db.prepare(`INSERT INTO message_replay_units VALUES(?,?,?,?,?,?,?,?)`);
    const leafCommitments=[];
    for(const {record,bytes,value} of records){
      const domain=record.kind==='message'?'message':record.kind==='metadata-entry'?'metadata-entry':'metadata';
      const key=record.kind==='message'?value.id:record.kind==='metadata-entry'?JSON.stringify([record.key,record.entryKey]):record.key;
      if(db.prepare('SELECT 1 FROM message_replay_units WHERE room_id=? AND generation=? AND domain=? AND unit_key=?').get(roomId,generation,domain,key))
        throw Error('duplicate replay projection leaf key');
      insert.run(roomId,generation,domain,key,record.offset+1,bytes.length,hash(bytes),bytes);
      const keyFrame=record.kind==='metadata-entry'?[record.keyOffset,record.keyLength,record.index]:null;
      putPointer(db,roomId,generation,'leaf-proof',JSON.stringify([domain,key]),{receiptId,index:leafCommitments.length,sourceLength:record.length,keyFrame});
      leafCommitments.push(leafCommitment(header.hash,hashed.sourceRoot,generation,domain,key,record.offset,record.length,bytes.length,hash(bytes),keyFrame));
    }
    put(db,roomId,generation,'codec',{version:1,headerHash:header.hash,state:encoded,receiptId});
    return {generation,bindingHash:header.hash,codecStateHash:hash(encoded),head:header.value.head,
      bytes:scanned.state.offset,records:records.length,messages:scanned.state.messageIndex,leafCommitments,sourceRoot:hashed.sourceRoot,inputBytes:budget.bytes,logicalUnitRows,
      phase:scanned.complete&&scanned.state.offset===header.value.bytes?'codec_partitioned':'codec_partitioning',publication:'pending',certified:false};
  });
}

// Restore installs only code-owned DDL when an incoming whole-store artifact
// actually contains this optional table. Ordinary store opens do not call it.
export function ensureReplayCutoverRestoreSchema(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='message_replay_units'").get())
    db.exec(replayCutoverSchema({durable:Boolean(db.storage?.sql)}));
  verifyReplayCutoverSchema(db);
}

// Whole-store backup/recovery already performs a complete offline audit. This
// verifies preserved derivation inputs, not serving parity or completion. It is
// deliberately not called by ordinary appends or bounded continuation steps.
export function auditReplayCutoverRecovery(db) {
  verifyReplayCutoverSchema(db);
  if(db.prepare(`SELECT 1 FROM message_replay_units u WHERE generation<>''
    AND NOT EXISTS(SELECT 1 FROM message_replay_units h WHERE h.room_id=u.room_id
      AND h.generation=u.generation AND h.domain='header' AND h.unit_key='state') LIMIT 1`).get())
    throw Error('orphaned recovered replay generation');
  const headers=db.prepare(`SELECT CASE WHEN typeof(room_id)='text' AND octet_length(room_id)<=64
      THEN room_id END AS room_id,CASE WHEN typeof(generation)='text' AND octet_length(generation)=64
      THEN generation END AS generation FROM message_replay_units
    WHERE domain='header' AND unit_key='state'`).all();
  for(const {room_id:roomId,generation} of headers){
    if(!id(roomId)||!digest(generation))throw Error('invalid recovered replay identity');
    const header=captureBinding(db,roomId,generation);
    if(!Number.isSafeInteger(header.value.bytes)||header.value.bytes<1||header.value.bytes>REPLAY_CAPTURE_BYTES)
      throw Error('invalid recovered replay witness bound');
    for(const domain of ['hash','codec']){
      const saved=get(db,roomId,generation,domain).value;
      const prior=auditBinding(db,saved.receiptId);
      if(saved.headerHash!==header.hash||prior.bindingHash!==header.hash
        ||prior[domain==='hash'?'hashStateHash':'codecStateHash']!==hash(saved.state)
        ||(domain==='hash'&&(!digest(saved.sourceRoot)||prior.sourceRoot!==saved.sourceRoot)))
        throw Error('independent recovered replay checkpoint binding changed');
    }
    const witness=db.prepare(`SELECT CASE WHEN typeof(payload)='blob'
      AND typeof(payload_bytes)='integer' AND payload_bytes=? AND octet_length(payload)=?
      AND payload_sha256=? THEN 1 ELSE 0 END AS admitted FROM message_replay_units
      WHERE room_id=? AND generation=? AND domain='witness' AND unit_key='state'`)
      .get(header.value.bytes,header.value.bytes,header.value.metadataHash,roomId,generation);
    if(!witness?.admitted)throw Error('recovered replay witness changed');
    const independent=createHash('sha256');
    for(let offset=0;offset<header.value.bytes;offset+=REPLAY_CAPTURE_STEP_BYTES){
      const row=db.prepare(`SELECT substr(payload,?,?) AS chunk FROM message_replay_units
        WHERE room_id=? AND generation=? AND domain='witness' AND unit_key='state'`)
        .get(offset+1,REPLAY_CAPTURE_STEP_BYTES,roomId,generation);
      independent.update(new Uint8Array(row.chunk));
    }
    if(independent.digest('hex')!==header.value.metadataHash)
      throw Error('independent recovered replay witness mismatch');
  }
  return {captures:headers.length,certified:false,publication:'pending'};
}
