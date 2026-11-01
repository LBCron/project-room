// Explicit, unwired replay cutover. Exported DDL is not registered on store
// open. Capturing bytes never certifies replay or publishes serving rows.
import {createHash} from 'node:crypto';
import {initialProjectionScan,scanProjectionChunk,decodeProjectionSpan} from './replay-projection-codec.mjs';
import {sqliteValueLimit} from './storage-limits.mjs';
import {STORE_SCHEMA_VERSION} from './writer-fence.mjs';
import {initialReplayHash, advanceReplayHash, finishReplayHash,
  encodeReplayHash, decodeReplayHash} from './replay-sha256.mjs';

export const REPLAY_CAPTURE_BYTES = 4 * 1024 * 1024;
export const REPLAY_CAPTURE_STEP_BYTES = 16 * 1024;
const CONTROL_BYTES = 4096;
const MAX = Number.MAX_SAFE_INTEGER;
const fatalText = bytes => new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes));
const rawId = value => {
  if(typeof value!=='string'||!/^([A-F0-9]{2}){1,200}$/.test(value))throw Error('invalid replay event identity');
  return fatalText(Buffer.from(value,'hex'));
};
const hash = text => createHash('sha256').update(text).digest('hex');
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

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
    CHECK(domain IN ('control','header','witness','hash','codec','message','metadata','replay-message','replay-metadata','semantic'))
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
    || typeof input.reason !== 'string' || !input.reason.trim() || Buffer.byteLength(input.reason)>280
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
    put(db,roomId,generation,'hash',{version:1,headerHash,state,receiptId});
    const codecState=JSON.stringify(initialProjectionScan());
    put(db,roomId,generation,'codec',{version:1,headerHash,state:codecState,receiptId});
    return {generation,bindingHash:headerHash,hashStateHash:hash(state),codecStateHash:hash(codecState),head:header.head,bytes:header.bytes,phase:'captured',publication:'pending',certified:false};
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

export function advanceReplayWitness(store, input) {
  return receipt(store,input,'hash',({receiptId}) => {
    const db=store.db, {roomId,generation}=input;
    const header=captureBinding(db,roomId,generation);
    const saved=get(db,roomId,generation,'hash').value;
    if (saved.version!==1 || saved.headerHash!==header.hash) throw Error('replay hash binding changed');
    const prior=auditBinding(db,saved.receiptId);
    if(prior.bindingHash!==header.hash || prior.hashStateHash!==hash(saved.state))throw Error('independent replay checkpoint binding changed');
    const state=decodeReplayHash(saved.state);
    if (state.bytes!==input.expectedBytes) throw Error('replay hash cursor changed');
    const witness=db.prepare(`SELECT CASE WHEN typeof(row_version)='integer' AND row_version=1 AND typeof(payload)='blob'
      AND typeof(payload_bytes)='integer' AND payload_bytes=? AND octet_length(payload)=?
      AND typeof(payload_sha256)='text' AND payload_sha256=? THEN 1 ELSE 0 END AS admitted
      FROM message_replay_units WHERE room_id=? AND generation=? AND domain='witness' AND unit_key='state'`)
      .get(header.value.bytes,header.value.bytes,header.value.metadataHash,roomId,generation);
    if (!witness?.admitted || state.bytes>header.value.bytes) throw Error('replay witness changed');
    let next=state;
    if (state.bytes<header.value.bytes) {
      const row=db.prepare(`SELECT substr(payload,?,?) AS chunk FROM message_replay_units
        WHERE room_id=? AND generation=? AND domain='witness' AND unit_key='state'`)
        .get(state.bytes+1,REPLAY_CAPTURE_STEP_BYTES,roomId,generation);
      next=advanceReplayHash(state,new Uint8Array(row.chunk));
    }
    const complete=next.bytes===header.value.bytes;
    if (complete && finishReplayHash(next)!==header.value.metadataHash) throw Error('independent replay witness mismatch');
    const encoded=encodeReplayHash(next);
    put(db,roomId,generation,'hash',{version:1,headerHash:header.hash,state:encoded,receiptId});
    return {generation,bindingHash:header.hash,hashStateHash:hash(encoded),head:header.value.head,bytes:next.bytes,phase:complete?'witness_verified':'hashing',
      publication:'pending',certified:false};
  });
}

// Partition only the independently verified immutable at-rest witness. These
// leaf rows are candidate inputs, never serving entities or new trust proofs.
export function partitionReplayWitness(store,input) {
  return receipt(store,input,'codec',({receiptId})=>{
    const db=store.db,{roomId,generation}=input,header=captureBinding(db,roomId,generation);
    const hashed=get(db,roomId,generation,'hash').value,hashReceipt=auditBinding(db,hashed.receiptId);
    if(hashed.headerHash!==header.hash || hashReceipt.hashStateHash!==hash(hashed.state))throw Error('independent replay hash binding changed');
    const completeHash=decodeReplayHash(hashed.state);
    if(completeHash.bytes!==header.value.bytes || finishReplayHash(completeHash)!==header.value.metadataHash)throw Error('verified witness required before codec');
    const saved=get(db,roomId,generation,'codec').value,prior=auditBinding(db,saved.receiptId);
    if(saved.headerHash!==header.hash || prior.bindingHash!==header.hash || prior.codecStateHash!==hash(saved.state))throw Error('independent replay codec binding changed');
    const state=JSON.parse(saved.state);
    if(state.offset!==input.expectedBytes)throw Error('replay codec cursor changed');
    if(state.phase==='done' && state.offset===header.value.bytes)return {generation,bindingHash:header.hash,codecStateHash:hash(saved.state),bytes:state.offset,head:header.value.head,records:0,phase:'codec_partitioned',publication:'pending',certified:false};
    const chunkRow=db.prepare(`SELECT substr(payload,?,?) AS chunk FROM message_replay_units
      WHERE room_id=? AND generation=? AND domain='witness' AND unit_key='state'
      AND typeof(payload)='blob' AND payload_bytes=? AND octet_length(payload)=? AND payload_sha256=?`)
      .get(state.offset+1,REPLAY_CAPTURE_STEP_BYTES,roomId,generation,header.value.bytes,header.value.bytes,header.value.metadataHash);
    if(!chunkRow)throw Error('replay witness changed');
    const chunk=new Uint8Array(chunkRow.chunk),scanned=scanProjectionChunk(state,chunk);
    if(scanned.state.offset>header.value.bytes || (!scanned.complete && scanned.state.offset===header.value.bytes))throw Error('incomplete replay projection codec');
    let outputBytes=8192;
    const records=scanned.records.map(record=>{
      const relative=record.offset-state.offset;
      const bytes=relative>=0 && relative+record.length<=chunk.length
        ? chunk.subarray(relative,relative+record.length)
        : new Uint8Array(db.prepare(`SELECT substr(payload,?,?) AS chunk FROM message_replay_units
          WHERE room_id=? AND generation=? AND domain='witness' AND unit_key='state'`)
          .get(record.offset+1,record.length,roomId,generation).chunk);
      const value=decodeProjectionSpan(bytes,record);
      // JSON.parse validates syntax but shadows duplicate keys. SQLite's
      // bounded tree walk sees every nested/escaped-equivalent object key.
      if(db.prepare(`SELECT 1 FROM json_tree(?) WHERE key IS NOT NULL
        GROUP BY parent,key HAVING count(*)>1 LIMIT 1`).get(fatalText(bytes)))
        throw Error('duplicate replay projection object key');
      outputBytes+=bytes.length+512;
      return {record,bytes,value};
    });
    const encoded=JSON.stringify(scanned.state);outputBytes+=Buffer.byteLength(encoded);
    if(outputBytes>256*1024)throw Error('replay codec output byte limit');
    const insert=db.prepare(`INSERT INTO message_replay_units VALUES(?,?,?,?,?,?,?,?)`);
    for(const {record,bytes,value} of records)insert.run(roomId,generation,
      record.kind==='message'?'message':'metadata',record.kind==='message'?value.id:record.key,
      record.offset+1,bytes.length,hash(bytes),bytes);
    put(db,roomId,generation,'codec',{version:1,headerHash:header.hash,state:encoded,receiptId});
    return {generation,bindingHash:header.hash,codecStateHash:hash(encoded),head:header.value.head,
      bytes:scanned.state.offset,records:records.length,messages:scanned.state.messageIndex,
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
        ||prior[domain==='hash'?'hashStateHash':'codecStateHash']!==hash(saved.state))
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
