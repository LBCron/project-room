// Explicit, unwired replay cutover. Exported DDL is not registered on store
// open. Capturing bytes never certifies replay or publishes serving rows.
import {createHash} from 'node:crypto';
import {MESSAGE_PROOF_FIELDS,messageProofMatches} from './write-integrity.mjs';
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

// H-row copies preserve an existing independent field proof, not a new
// payload self-hash. The immutable dependency receipt fixes that old proof.
// Unsealed source units use row_version=0/payload_sha256=''; readers must verify
// the original row proof and receipt before using any field.
function messageCaptureSchema() {
  const textFields = MESSAGE_PROOF_FIELDS.filter(field => !['seq','pinned'].includes(field));
  const payload = `json_object(${[...MESSAGE_PROOF_FIELDS,'entity_hash']
    .map(field => `'${field}',OLD.${field}`).join(',')})`;
  const textTypes = textFields.map(field => `typeof(OLD.${field}) IN ('text','null')`).join(' AND ');
  const sourceBytes = [...textFields,'entity_hash']
    .map(field => `coalesce(octet_length(OLD.${field}),0)`).join('+');
  const rawAdmission = `${textTypes} AND typeof(OLD.message_id)='text'
    AND octet_length(OLD.message_id) BETWEEN 1 AND 200
    AND typeof(OLD.seq)='integer' AND OLD.seq BETWEEN 1 AND ${MAX}
    AND typeof(OLD.pinned)='integer' AND OLD.pinned IN (0,1)
    AND typeof(OLD.entity_hash)='text' AND octet_length(OLD.entity_hash)=64
    AND OLD.entity_hash NOT GLOB '*[^a-f0-9]*' AND (${sourceBytes})<=131072`;
  // CASE is intentional: never construct JSON from an unadmitted large value.
  // JSON escaping can expand this fixed raw ceiling; the actual encoded copy
  // must separately fit the existing 128 KiB unit ceiling before persistence.
  const admitted = `(CASE WHEN ${rawAdmission}
    THEN octet_length(${payload})<=131072 ELSE 0 END)`;
  const generation = `CASE WHEN typeof(c.payload)='blob' AND c.payload_bytes=64
    AND octet_length(c.payload)=64 THEN CAST(c.payload AS TEXT) END`;
  const activeView = `CREATE VIEW replay_capture_active AS SELECT c.room_id,${generation} AS generation,
    CASE WHEN typeof(h.payload_sha256)='text' AND octet_length(h.payload_sha256)=64
      THEN h.payload_sha256 END AS header_hash
    FROM message_replay_units c JOIN message_replay_units h ON h.room_id=c.room_id
      AND h.generation=(${generation}) AND h.domain='header' AND h.unit_key='state'
    WHERE c.generation='' AND c.domain='control' AND c.unit_key='capture-head'
      AND typeof(c.payload)='blob' AND octet_length(c.payload)=64
      AND (${generation}) NOT GLOB '*[^a-f0-9]*'
      AND typeof(h.payload_sha256)='text' AND octet_length(h.payload_sha256)=64;`;
  const active = room => `SELECT room_id,generation,header_hash FROM replay_capture_active WHERE room_id=${room}`;
  const uncaptured = (a, key) => `(CASE WHEN typeof(${key})='text'
    AND octet_length(${key}) BETWEEN 1 AND 200 THEN NOT EXISTS(SELECT 1 FROM message_replay_units x
    WHERE x.room_id=${a}.room_id AND x.generation=${a}.generation
      AND x.domain IN ('h-message','h-message-absent') AND x.unit_key=${key}) ELSE 1 END)`;
  const dependencyId = (prefix, key) => `'oa_brc_${prefix}_'||a.generation||'_'||lower(hex(CAST(${key} AS BLOB)))`;
  const time = `CAST(strftime('%s','now') AS INTEGER)*1000`;
  const oldCopy = () => {
    const receiptId = dependencyId('hm','OLD.message_id');
    const source = `(${active('OLD.room_id')}) a WHERE ${uncaptured('a','OLD.message_id')}`;
    const invalidId = `'oa_brc_inv_'||a.generation`;
    return `
      INSERT INTO operator_actions(id,at,action,target_kind,target_id,counts_json,result)
        SELECT ${invalidId},${time},'replay_cutover_abandon','room',a.room_id,
          json_object('roomId',a.room_id,'generation',a.generation,'lifecycle','abandoned',
            'abandonmentReceiptId',${invalidId},'reason','dependency_admission'), 'abandoned'
        FROM ${source} AND NOT ${admitted};
      INSERT INTO message_replay_units
        SELECT a.room_id,a.generation,'control','abandonment',1,
          octet_length(json_object('receiptId',${invalidId})),'',
          CAST(json_object('receiptId',${invalidId}) AS BLOB)
        FROM ${source} AND NOT ${admitted};
      DELETE FROM message_replay_units WHERE room_id=OLD.room_id AND generation=''
        AND domain='control' AND unit_key='capture-head' AND EXISTS(
          SELECT 1 FROM message_replay_units x WHERE x.room_id=OLD.room_id
          AND x.generation=CASE WHEN typeof(message_replay_units.payload)='blob'
            AND octet_length(message_replay_units.payload)=64 THEN CAST(message_replay_units.payload AS TEXT) END
          AND x.domain='control' AND x.unit_key='abandonment');
      INSERT INTO operator_actions(id,at,action,target_kind,target_id,counts_json,result)
        SELECT ${receiptId},${time},'replay_cutover_dependency','room',a.room_id,
          json_object('roomId',a.room_id,'generation',a.generation,'headerHash',a.header_hash,
            'domain','h-message','key',OLD.message_id,'entityHash',OLD.entity_hash),'pending'
        FROM ${source} AND ${admitted};
      INSERT INTO message_replay_units
        SELECT a.room_id,a.generation,'h-message',OLD.message_id,0,
          octet_length(${payload}),'',CAST(${payload} AS BLOB)
        FROM ${source} AND ${admitted};`;
  };
  const absence = () => {
    const receiptId = dependencyId('ha','NEW.message_id');
    const source = `(${active('NEW.room_id')}) a
      WHERE typeof(NEW.message_id)='text' AND octet_length(NEW.message_id) BETWEEN 1 AND 200
        AND ${uncaptured('a','NEW.message_id')}
        AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.room_id=NEW.room_id AND m.message_id=NEW.message_id)`;
    return `
      INSERT INTO operator_actions(id,at,action,target_kind,target_id,counts_json,result)
        SELECT ${receiptId},${time},'replay_cutover_dependency','room',a.room_id,
          json_object('roomId',a.room_id,'generation',a.generation,'headerHash',a.header_hash,
            'domain','h-message-absent','key',NEW.message_id,'entityHash',NULL),'pending'
        FROM ${source};
      INSERT INTO message_replay_units
        SELECT a.room_id,a.generation,'h-message-absent',NEW.message_id,0,4,'',CAST('null' AS BLOB)
        FROM ${source};`;
  };
  return `${activeView}
  CREATE TRIGGER replay_message_before_update BEFORE UPDATE ON messages
    WHEN EXISTS(${active('OLD.room_id')}) OR EXISTS(${active('NEW.room_id')}) BEGIN
    ${oldCopy()} ${absence()} END;
  CREATE TRIGGER replay_message_before_delete BEFORE DELETE ON messages
    WHEN EXISTS(${active('OLD.room_id')}) BEGIN
    ${oldCopy()} END;
  CREATE TRIGGER replay_message_before_insert BEFORE INSERT ON messages
    WHEN EXISTS(${active('NEW.room_id')}) BEGIN
    ${absence()} END;`;
}

// Work/body payloads are mutable storage dependencies of the immutable H
// witness. These copies bind their EXISTING digest; membership/reference
// validation still belongs to the protected witness equality pass.
function referenceCaptureSchema(kind) {
  const work=kind==='work', table=work?'work_entities':'projection_bodies';
  const key=work?'work_id':'sha', proof=work?'digest':'sha', prefix=work?'hw':'hb';
  const fields=work?['work_id','revision','digest','body']:['sha','body'];
  const payload=`json_object(${fields.map(f=>`'${f}',OLD.${f}`).join(',')})`;
  const keyOK=row=>`typeof(${row}.${key})='text' AND octet_length(${row}.${key}) BETWEEN 1 AND 200`;
  const raw=`${keyOK('OLD')} AND typeof(OLD.body)='text' AND octet_length(OLD.body)<=131072
    AND typeof(OLD.${proof})='text' AND octet_length(OLD.${proof})=64
    AND OLD.${proof} NOT GLOB '*[^a-f0-9]*'
    ${work?`AND typeof(OLD.revision)='integer' AND OLD.revision BETWEEN 0 AND ${MAX}`:''}`;
  const admitted=`(CASE WHEN ${raw} THEN octet_length(${payload})<=131072 ELSE 0 END)`;
  const active=row=>`SELECT room_id,generation,header_hash FROM replay_capture_active WHERE room_id=${row}.room_id`;
  const missing=row=>`NOT EXISTS(SELECT 1 FROM message_replay_units x WHERE x.room_id=a.room_id
    AND x.generation=a.generation AND x.domain IN ('h-${kind}','h-${kind}-absent') AND x.unit_key=${row}.${key})`;
  const dependency=(suffix,row)=>`'oa_brc_${prefix}${suffix}_'||a.generation||'_'||lower(hex(CAST(${row}.${key} AS BLOB)))`;
  const at=`CAST(strftime('%s','now') AS INTEGER)*1000`;
  const old=()=>{
    const source=`(${active('OLD')}) a WHERE (CASE WHEN ${keyOK('OLD')} THEN ${missing('OLD')} ELSE 1 END)`;
    const invalid=`'oa_brc_inv_'||a.generation`, receiptId=dependency('','OLD');
    return `INSERT INTO operator_actions(id,at,action,target_kind,target_id,counts_json,result)
      SELECT ${invalid},${at},'replay_cutover_abandon','room',a.room_id,
        json_object('roomId',a.room_id,'generation',a.generation,'lifecycle','abandoned',
          'abandonmentReceiptId',${invalid},'reason','dependency_admission'),'abandoned'
      FROM ${source} AND NOT ${admitted};
    INSERT INTO message_replay_units SELECT a.room_id,a.generation,'control','abandonment',1,
      octet_length(json_object('receiptId',${invalid})),'',CAST(json_object('receiptId',${invalid}) AS BLOB)
      FROM ${source} AND NOT ${admitted};
    DELETE FROM message_replay_units WHERE room_id=OLD.room_id AND generation=''
      AND domain='control' AND unit_key='capture-head' AND EXISTS(SELECT 1 FROM message_replay_units x
        WHERE x.room_id=OLD.room_id AND x.generation=CASE WHEN typeof(message_replay_units.payload)='blob'
          AND octet_length(message_replay_units.payload)=64 THEN CAST(message_replay_units.payload AS TEXT) END
        AND x.domain='control' AND x.unit_key='abandonment');
    INSERT INTO operator_actions(id,at,action,target_kind,target_id,counts_json,result)
      SELECT ${receiptId},${at},'replay_cutover_dependency','room',a.room_id,
        json_object('roomId',a.room_id,'generation',a.generation,'headerHash',a.header_hash,
          'domain','h-${kind}','key',OLD.${key},'entityHash',OLD.${proof}),'pending'
      FROM ${source} AND ${admitted};
    INSERT INTO message_replay_units SELECT a.room_id,a.generation,'h-${kind}',OLD.${key},0,
      octet_length(${payload}),'',CAST(${payload} AS BLOB) FROM ${source} AND ${admitted};`;
  };
  const absent=()=>{
    const source=`(${active('NEW')}) a WHERE ${keyOK('NEW')} AND ${missing('NEW')}
      AND NOT EXISTS(SELECT 1 FROM ${table} t WHERE t.room_id=NEW.room_id AND t.${key}=NEW.${key})`;
    const receiptId=dependency('a','NEW');
    return `INSERT INTO operator_actions(id,at,action,target_kind,target_id,counts_json,result)
      SELECT ${receiptId},${at},'replay_cutover_dependency','room',a.room_id,
        json_object('roomId',a.room_id,'generation',a.generation,'headerHash',a.header_hash,
          'domain','h-${kind}-absent','key',NEW.${key},'entityHash',NULL),'pending' FROM ${source};
    INSERT INTO message_replay_units SELECT a.room_id,a.generation,'h-${kind}-absent',NEW.${key},0,4,'',CAST('null' AS BLOB)
      FROM ${source};`;
  };
  return `CREATE TRIGGER replay_${kind}_before_update BEFORE UPDATE ON ${table}
    WHEN EXISTS(${active('OLD')}) OR EXISTS(${active('NEW')}) BEGIN ${old()} ${absent()} END;
  CREATE TRIGGER replay_${kind}_before_delete BEFORE DELETE ON ${table}
    WHEN EXISTS(${active('OLD')}) BEGIN ${old()} END;
  CREATE TRIGGER replay_${kind}_before_insert BEFORE INSERT ON ${table}
    WHEN EXISTS(${active('NEW')}) BEGIN ${absent()} END;`;
}

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
    CHECK(domain IN ('control','header','witness','hash','codec','message','metadata','replay-message','replay-metadata','semantic','source-chunk','source-merkle','leaf-proof','metadata-entry','h-message','h-message-absent','h-work','h-work-absent','h-body','h-body-absent','tail-event'))
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
    END;
  ${messageCaptureSchema()}
  ${referenceCaptureSchema('work')}
  ${referenceCaptureSchema('body')}`;
}

const schemaPresence=new WeakMap();
const schemaAdmissions=new WeakMap(),schemaContracts=new Map(),receiptInputBytes=new WeakMap();
function schemaContract(db){
  const durable=Boolean(db.storage?.sql);
  if(!schemaContracts.has(durable)){
    const ddl=replayCutoverSchema({durable});
    const definitions=[...ddl.matchAll(/(CREATE (?:TABLE|TRIGGER|VIEW) ([a-z_]+)[\s\S]*?);(?=\s*CREATE |\s*$)/g)];
    if(definitions.length!==18)throw Error('invalid replay schema contract');
    schemaContracts.set(durable,{definitions,hash:hash(ddl),
      bindingBytes:definitions.reduce((sum,[,sql])=>sum+Buffer.byteLength(sql.trim()),0)});
  }
  return schemaContracts.get(durable);
}
// sqlite_master exposes indexed rowids in both adapters. Durable SQLite does
// not authorize schema_version. These tuples prove current definitions only;
// they do not prove that no identical drop/recreate interval occurred.
function catalogDefinition(db,definition,catalogId=null){
  const [,sql,name]=definition,type=/^CREATE (TABLE|TRIGGER|VIEW)/.exec(sql)?.[1].toLowerCase();
  const table=type==='trigger'?/\bON ([a-z_]+)/.exec(sql)?.[1]:name,text=sql.trim();
  if(!table)throw Error('invalid replay schema object framing');
  const selector=catalogId===null?'name=?':'rowid=?';
  return db.prepare(`SELECT rowid AS catalog_id,CASE WHEN type=? AND name=? AND tbl_name=?
    AND typeof(sql)='text' AND octet_length(sql)=? THEN sql=? COLLATE BINARY ELSE 0 END AS matches
    FROM sqlite_master WHERE ${selector}`).get(type,name,table,Buffer.byteLength(text),text,catalogId??name);
}
export function admitReplayCutoverSchema(db){
  schemaPresence.set(db,true);
  schemaAdmissions.set(db,{invalid:true});
  const contract=schemaContract(db),objects=[];
  for(const definition of contract.definitions){
    const row=catalogDefinition(db,definition);
    if(!Number.isSafeInteger(row?.catalog_id)||row.catalog_id<1||row.matches!==1)
      throw Error('replay schema requires reconciliation');
    objects.push(row.catalog_id);
  }
  schemaAdmissions.set(db,{objects,contract:contract.hash,invalid:false});
}
export function verifyReplayCutoverSchema(db){
  const admitted=schemaAdmissions.get(db);
  if(!admitted)return admitReplayCutoverSchema(db);
  const contract=schemaContract(db);
  if(admitted.invalid||admitted.contract!==contract.hash)throw Error('replay schema requires reconciliation and exact readmission');
  for(let i=0;i<contract.definitions.length;i++){
    const row=catalogDefinition(db,contract.definitions[i],admitted.objects[i]);
    if(row?.catalog_id!==admitted.objects[i]||row.matches!==1){
      admitted.invalid=true;
      throw Error('replay schema requires reconciliation and exact readmission');
    }
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
  return {value, hash: saved.payload_sha256,inputBytes:saved.payload.byteLength};
}
function auditBinding(db, receiptId) {
  if(typeof receiptId!=='string' || !/^oa_brc_(?:[a-f0-9]{64}|inv_[a-f0-9]{64}|h(?:m|a|w|wa|b|ba)_[a-f0-9]{64}_[a-f0-9]{2,400}|tail_[a-f0-9]{64}_[1-9][0-9]{0,15})$/.test(receiptId))throw Error('invalid replay audit binding');
  const row=db.prepare(`SELECT CASE WHEN typeof(counts_json)='text' AND octet_length(counts_json)<=4096
    THEN counts_json END AS json FROM operator_actions WHERE id=?
    AND action IN ('replay_cutover_capture','replay_cutover_hash','replay_cutover_codec',
      'replay_cutover_abandon','replay_cutover_cleanup','replay_cutover_dependency','replay_cutover_tail')`).get(receiptId);
  if(!row?.json)throw Error('missing independent replay audit binding');
  const value=JSON.parse(row.json);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid replay audit binding');
  receiptInputBytes.set(value,Buffer.byteLength(row.json));
  return value;
}

function validate(input, phase) {
  if (!input || !id(input.roomId) || !id(input.requestId)) throw Error('invalid replay capture intent');
  if (phase === 'abandon' || phase === 'cleanup') {
    const keys = phase === 'abandon'
      ? ['roomId', 'generation', 'requestId', 'reason']
      : ['roomId', 'generation', 'requestId', 'expectedDeleted'];
    if (Object.keys(input).some(key => !keys.includes(key)) || !digest(input.generation))
      throw Error('invalid replay lifecycle intent');
    if (phase === 'abandon' && (typeof input.reason !== 'string'
      || Buffer.byteLength(input.reason) > 280 || !input.reason.trim()))
      throw Error('invalid replay lifecycle intent');
    if (phase === 'cleanup' && (!Number.isSafeInteger(input.expectedDeleted)
      || input.expectedDeleted < 0 || input.expectedDeleted > MAX))
      throw Error('invalid replay lifecycle intent');
    return;
  }
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
  const intent=phase==='abandon'
    ? {phase,roomId:input.roomId,requestId:input.requestId,generation:input.generation,reason:input.reason}
    : phase==='cleanup'
      ? {phase,roomId:input.roomId,requestId:input.requestId,generation:input.generation,expectedDeleted:input.expectedDeleted}
      : phase==='capture'
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
    const value = {...operation({receiptId}),schemaDefinitionBindingBytes:schemaContract(store.db).bindingBytes,fingerprint,duplicate:false};
    if(Buffer.byteLength(JSON.stringify(value))>4096)throw Error('replay receipt byte limit');
    store.db.prepare(`INSERT INTO operator_actions
      (id,at,action,target_kind,target_id,reason,plan_hash,counts_json,result,request_id)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).run(receiptId,store.now(),'replay_cutover_'+phase,
      'room',input.roomId,input.reason??null,fingerprint,JSON.stringify(value),value.lifecycle==='abandoned'?'abandoned':'pending',input.requestId);
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


// Abandonment is a derived lifecycle transition, never a serving repair. The
// retained pointer is independently bound to an immutable phase receipt. Cleanup
// keeps the header and lifecycle pointers until the final bounded delete.
function abandonedBinding(db, roomId, generation) {
  const exists = db.prepare(`SELECT 1 FROM message_replay_units
    WHERE room_id=? AND generation=? AND domain='control' AND unit_key='abandonment'`)
    .get(roomId, generation);
  if (!exists) return null;
  const saved = pointer(db, roomId, generation, 'control', 'abandonment');
  const independent = auditBinding(db, saved.receiptId);
  if (independent.lifecycle !== 'abandoned' || independent.generation !== generation
    || independent.roomId !== roomId || independent.abandonmentReceiptId !== saved.receiptId)
    throw Error('independent replay abandonment binding changed');
  return independent;
}

export function abandonReplayCapture(store, input) {
  return receipt(store, input, 'abandon', ({receiptId}) => {
    const db = store.db, {roomId, generation} = input;
    if (abandonedBinding(db, roomId, generation)) throw Error('replay capture already abandoned');
    if (!db.prepare(`SELECT 1 FROM message_replay_units
      WHERE room_id=? AND generation=? AND domain='header' AND unit_key='state'`)
      .get(roomId, generation)) throw Error('missing replay capture to abandon');
    // No unbounded control value is read. A malformed or different active
    // pointer cannot authorize deleting a later generation's active pointer.
    db.prepare(`DELETE FROM message_replay_units WHERE room_id=? AND generation=''
      AND domain='control' AND unit_key='capture-head'
      AND typeof(payload)='blob' AND octet_length(payload)=64 AND payload=?`)
      .run(roomId, Buffer.from(generation));
    putPointer(db, roomId, generation, 'control', 'abandonment', {receiptId});
    return {roomId, generation, abandonmentReceiptId:receiptId, lifecycle:'abandoned',
      certified:false, publication:'none', cleanup:'pending'};
  });
}

export function cleanupReplayCapture(store, input) {
  return receipt(store, input, 'cleanup', ({receiptId}) => {
    const db = store.db, {roomId, generation} = input;
    if (!abandonedBinding(db, roomId, generation)) throw Error('replay cleanup requires abandonment');
    if (db.prepare(`SELECT 1 FROM message_replay_units WHERE room_id=? AND generation=''
      AND domain='control' AND unit_key='capture-head' AND payload=?`)
      .get(roomId, Buffer.from(generation))) throw Error('replay cleanup cannot delete active source');
    const hasProgress = db.prepare(`SELECT 1 FROM message_replay_units
      WHERE room_id=? AND generation=? AND domain='control' AND unit_key='cleanup'`)
      .get(roomId, generation);
    const prior = hasProgress ? auditBinding(db,
      pointer(db, roomId, generation, 'control', 'cleanup').receiptId) : {deleted:0};
    if (hasProgress && (prior.roomId !== roomId || prior.generation !== generation
      || prior.lifecycle !== 'abandoned')) throw Error('independent replay cleanup binding changed');
    if (prior.deleted !== input.expectedDeleted) throw Error('replay cleanup progress changed');
    // Prefix lookup plus LIMIT stops at 194 rows; no payload/key materialization
    // or whole-generation count/sort. Three lifecycle rows, the phase receipt and two runtime writer-permit
    // writes are reserved for the final delete. Native removal of the one <=4 MiB witness is distinct from
    // JavaScript input bytes and is not a 256 KiB physical-delete claim.
    const candidates = db.prepare(`SELECT rowid AS id FROM message_replay_units
      WHERE room_id=? AND generation=?
      AND NOT (domain='header' AND unit_key='state')
      AND NOT (domain='control' AND unit_key IN ('abandonment','cleanup')) LIMIT 194`)
      .all(roomId, generation);
    const remove = db.prepare('DELETE FROM message_replay_units WHERE rowid=?');
    for (const row of candidates) remove.run(row.id);
    const remaining = db.prepare(`SELECT 1 FROM message_replay_units
      WHERE room_id=? AND generation=?
      AND NOT (domain='header' AND unit_key='state')
      AND NOT (domain='control' AND unit_key IN ('abandonment','cleanup')) LIMIT 1`)
      .get(roomId, generation);
    let rowsDeleted = candidates.length;
    if (!remaining) {
      rowsDeleted += db.prepare('DELETE FROM message_replay_units WHERE room_id=? AND generation=?')
        .run(roomId, generation).changes;
    } else {
      rowsDeleted += db.prepare(`DELETE FROM message_replay_units WHERE room_id=? AND generation=?
        AND domain='control' AND unit_key='cleanup'`).run(roomId, generation).changes;
      putPointer(db, roomId, generation, 'control', 'cleanup', {receiptId});
    }
    if (rowsDeleted > 200) throw Error('replay cleanup row limit');
    return {roomId, generation, lifecycle:'abandoned', deleted:prior.deleted+rowsDeleted,
      rowsDeleted, done:!remaining, certified:false, publication:'none'};
  });
}

function captureBinding(db,roomId,generation) {
  if(abandonedBinding(db,roomId,generation))throw Error('replay capture abandoned');
  const header=get(db,roomId,generation,'header');
  const captured=auditBinding(db,header.value.captureReceiptId);
  header.captureReceiptInputBytes=receiptInputBytes.get(captured);
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
function readUntouchedHMessage(db,header,messageId,budget) {
  const {roomId,generation,head}=header.value;
  // A missing shadow whose immutable mutation/absence receipt still exists is
  // corruption, never evidence that the later current row remained unchanged.
  for(const prefix of ['hm','ha'])if(db.prepare('SELECT 1 FROM operator_actions WHERE id=?')
    .get(`oa_brc_${prefix}_${generation}_${Buffer.from(messageId).toString('hex')}`))
    throw Error('missing independently bound H row');
  const textFields=MESSAGE_PROOF_FIELDS.filter(f=>!['seq','pinned'].includes(f));
  const payload=`json_object(${[...MESSAGE_PROOF_FIELDS,'entity_hash'].map(f=>`'${f}',${f}`).join(',')})`;
  const admission=`${textFields.map(f=>`typeof(${f}) IN ('text','null')`).join(' AND ')}
    AND typeof(message_id)='text' AND octet_length(message_id) BETWEEN 1 AND 200
    AND typeof(seq)='integer' AND seq BETWEEN 1 AND ? AND typeof(pinned)='integer' AND pinned IN (0,1)
    AND typeof(entity_hash)='text' AND octet_length(entity_hash)=64 AND entity_hash NOT GLOB '*[^a-f0-9]*'
    AND (${[...textFields,'entity_hash'].map(f=>`coalesce(octet_length(${f}),0)`).join('+')})<=131072`;
  const size=db.prepare(`SELECT CASE WHEN ${admission} THEN octet_length(${payload}) END AS bytes
    FROM messages WHERE room_id=? AND message_id=?`).get(head,roomId,messageId)?.bytes;
  if(!Number.isSafeInteger(size)||size<1||size>131072)throw Error('unchanged H row admission required');
  if(budget.bytes+size+4096>262144)throw replayReadBudget();
  const saved=db.prepare(`SELECT ${payload} AS json FROM messages WHERE room_id=? AND message_id=?`).get(roomId,messageId);
  const row=JSON.parse(saved.json);
  if(row.message_id!==messageId||!messageProofMatches(row))throw Error('unchanged H row proof changed');
  budget.bytes+=size+4096;
  return {absent:false,row,unchanged:true,inputBytes:budget.bytes,
    schemaDefinitionBindingBytes:schemaContract(db).bindingBytes,certified:false};
}

export function readReplayHMessage(store,input) {
  if(!input||!id(input.roomId)||!digest(input.generation)||typeof input.messageId!=='string'
    ||Buffer.byteLength(input.messageId)<1||Buffer.byteLength(input.messageId)>200
    ||Object.keys(input).some(k=>!['roomId','generation','messageId'].includes(k)))throw Error('invalid replay H-row intent');
  return store.readTransaction(()=>{
    verifyReplayCutoverSchema(store.db);
    const header=captureBinding(store.db,input.roomId,input.generation),budget={bytes:hReadControlBytes(store.db,header)};
    return readHMessageSource(store.db,header,input.messageId,budget);
  });
}
function replayReadBudget(){const error=Error('replay H-page byte budget exhausted');error.code='replay_read_budget';return error;}
function hReadControlBytes(db,header){return schemaContract(db).bindingBytes+header.inputBytes+header.captureReceiptInputBytes+8192;}
function readHMessageSource(db,header,messageId,budget){
  const {roomId,generation}=header.value;
  const maximumPayloadBytes=Math.min(131072,262144-budget.bytes-8192);
  const scalar=db.prepare(`SELECT CASE WHEN typeof(payload_bytes)='integer' AND payload_bytes BETWEEN 1 AND 131072
    THEN payload_bytes END AS bytes FROM message_replay_units
    WHERE room_id=? AND generation=? AND domain IN ('h-message','h-message-absent') AND unit_key=?`)
    .all(roomId,generation,messageId);
  if(scalar.some(row=>Number.isSafeInteger(row.bytes)&&row.bytes>maximumPayloadBytes))throw replayReadBudget();
  const rows = db.prepare(`SELECT domain,CASE WHEN typeof(row_version)='integer' AND row_version=0 AND typeof(payload)='blob'
    AND typeof(payload_bytes)='integer' AND payload_bytes BETWEEN 1 AND 131072
    AND octet_length(payload)=payload_bytes AND typeof(payload_sha256)='text'
    AND octet_length(payload_sha256)=0 THEN payload END AS payload
    FROM message_replay_units WHERE room_id=? AND generation=?
      AND domain IN ('h-message','h-message-absent') AND unit_key=?`)
    .all(roomId,generation,messageId);
  if(rows.length===0)return readUntouchedHMessage(db,header,messageId,budget);
  if (rows.length !== 1 || !rows[0].payload) throw Error('missing or invalid captured H row');
  const source = rows[0], absent = source.domain === 'h-message-absent';
  const receiptId = `oa_brc_${absent?'ha':'hm'}_${generation}_${Buffer.from(messageId).toString('hex')}`;
  const independent = auditBinding(db,receiptId);
  if (independent.roomId !== roomId || independent.generation !== generation
    || independent.headerHash !== header.hash || independent.domain !== source.domain
    || independent.key !== messageId) throw Error('independent replay H-row binding changed');
  budget.bytes+=source.payload.byteLength+receiptInputBytes.get(independent)+4096;
  if(budget.bytes>262144)throw Error('replay H-row aggregate byte limit');
  const inputBytes=budget.bytes;
  const value = JSON.parse(fatalText(source.payload));
  if (absent) {
    if (value !== null || independent.entityHash !== null)
      throw Error('independent replay H-absence changed');
    return {absent:true,receiptId,inputBytes,schemaDefinitionBindingBytes:schemaContract(db).bindingBytes};
  }
  const fields = [...MESSAGE_PROOF_FIELDS,'entity_hash'];
  if (!value || Object.keys(value).length !== fields.length
    || fields.some(field => !Object.hasOwn(value,field)) || value.message_id !== messageId
    || independent.entityHash !== value.entity_hash || !messageProofMatches(value))
    throw Error('independent replay H-row proof changed');
  return {absent:false,row:value,receiptId,inputBytes,schemaDefinitionBindingBytes:schemaContract(db).bindingBytes};
}


// Merge three separately indexed keyset ranges. Never UNION-sort a growing
// current/shadow domain, and never treat a post-H insert as an H member.
export function readReplayHMessagePage(store,input) {
  if(!input||!id(input.roomId)||!digest(input.generation)||typeof input.after!=='string'
    ||Buffer.byteLength(input.after)>200||!Number.isInteger(input.limit)||input.limit<1||input.limit>16
    ||Object.keys(input).some(k=>!['roomId','generation','after','limit'].includes(k)))throw Error('invalid replay H-page intent');
  return store.readTransaction(()=>{
    const db=store.db;verifyReplayCutoverSchema(db);
    const header=captureBinding(db,input.roomId,input.generation),budget={bytes:hReadControlBytes(db,header)},rows=[];
    let after=input.after,examined=0,done=false;
    while(examined<input.limit){
      const current=db.prepare(`SELECT CASE WHEN typeof(message_id)='text' AND octet_length(message_id) BETWEEN 1 AND 200
        THEN message_id END AS key FROM messages WHERE room_id=? AND message_id>? COLLATE BINARY ORDER BY message_id LIMIT 1`)
        .get(input.roomId,after);
      const candidates=current?[current]:[];
      for(const domain of ['h-message','h-message-absent']){
        const shadow=db.prepare(`SELECT CASE WHEN typeof(unit_key)='text' AND octet_length(unit_key) BETWEEN 1 AND 200 THEN unit_key END AS key
          FROM message_replay_units WHERE room_id=? AND generation=? AND domain=? AND unit_key>? COLLATE BINARY ORDER BY unit_key LIMIT 1`)
          .get(input.roomId,input.generation,domain,after);
        if(shadow)candidates.push(shadow);
      }
      if(candidates.some(row=>typeof row.key!=='string'))throw Error('replay H membership key admission required');
      if(!candidates.length){done=true;break;}
      const key=candidates.map(row=>row.key).sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)))[0];
      let source;
      try{source=readHMessageSource(db,header,key,budget);}catch(error){if(error.code==='replay_read_budget')break;throw error;}
      after=key;examined++;
      if(!source.absent)rows.push({key,row:source.row});
    }
    return {rows,after,examined,done,inputBytes:budget.bytes,logicalUnitRows:64+8*examined,
      basis:'protected-current-state',historyProvenance:'unknown',certified:false};
  });
}

// Called only by the existing code-owned positional append hook AFTER its
// INSERT and inside the same transaction. Old/out-of-transaction writers get
// no authority retrofit. Continuation must stop at a missing binding.
export function bindReplayAppend(db,{roomId,sequence,eventId,body}) {
  if(!db.isTransaction||!id(roomId)||!Number.isSafeInteger(sequence)||sequence<1
    ||typeof eventId!=='string'||Buffer.byteLength(eventId)<1||Buffer.byteLength(eventId)>200
    ||typeof body!=='string')return;
  if(!schemaPresence.has(db))schemaPresence.set(db,Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='message_replay_units'").get()));
  if(!schemaPresence.get(db))return;
  const active=db.prepare(`SELECT generation,header_hash FROM replay_capture_active WHERE room_id=?`).get(roomId);
  if(!active||!digest(active.generation)||!digest(active.header_hash))return;
  const pointer=db.prepare(`SELECT row_version AS head FROM message_replay_units
    WHERE room_id=? AND generation='' AND domain='control' AND unit_key='capture-head'`).get(roomId);
  if(!Number.isSafeInteger(pointer?.head)||sequence<=pointer.head)return;
  const bytes=Buffer.byteLength(body);if(bytes<1||bytes>131072)return;
  const bodyHash=hash(body),receiptId=`oa_brc_tail_${active.generation}_${sequence}`;
  const proof={roomId,generation:active.generation,headerHash:active.header_hash,sequence,eventId,bytes,bodyHash};
  db.prepare(`INSERT INTO operator_actions(id,at,action,target_kind,target_id,counts_json,result)
    VALUES(?,?,'replay_cutover_tail','room',?,?,'pending')`).run(receiptId,Date.now(),roomId,JSON.stringify(proof));
  db.prepare(`INSERT INTO message_replay_units VALUES(?,?,'tail-event',?,1,?,?,?)`)
    .run(roomId,active.generation,String(sequence),bytes,bodyHash,Buffer.from(body));
}
export function readReplayTailEvent(store,input) {
  if(!input||!id(input.roomId)||!digest(input.generation)||!Number.isSafeInteger(input.sequence)||input.sequence<1
    ||Object.keys(input).some(k=>!['roomId','generation','sequence'].includes(k)))throw Error('invalid replay tail intent');
  return store.readTransaction(()=>{
    const db=store.db;verifyReplayCutoverSchema(db);
    const header=captureBinding(db,input.roomId,input.generation);
    if(input.sequence<=header.value.head)throw Error('prospective replay tail must follow H');
    const receiptId=`oa_brc_tail_${input.generation}_${input.sequence}`,proof=auditBinding(db,receiptId);
    const controlBytes=schemaContract(db).bindingBytes+header.inputBytes+header.captureReceiptInputBytes
      +receiptInputBytes.get(proof)+8192;
    if(proof.roomId!==input.roomId||proof.generation!==input.generation||proof.headerHash!==header.hash
      ||proof.sequence!==input.sequence||typeof proof.eventId!=='string'||Buffer.byteLength(proof.eventId)>200
      ||!digest(proof.bodyHash)||!Number.isSafeInteger(proof.bytes)||proof.bytes<1||proof.bytes>131072
      ||controlBytes+2*proof.bytes>262144)throw Error('prospective replay binding admission changed');
    // Scalar admission precedes either payload fetch; the source may have been
    // modified without this code-owned observer since the original append.
    const current=db.prepare(`SELECT CASE WHEN typeof(id)='text' AND octet_length(id)<=200 THEN id END AS id,
      CASE WHEN typeof(body)='text' THEN octet_length(body) END AS bytes FROM events WHERE room_id=? AND sequence=?`)
      .get(input.roomId,input.sequence);
    const saved=db.prepare(`SELECT CASE WHEN typeof(payload)='blob' AND typeof(payload_bytes)='integer'
      AND payload_bytes=? AND octet_length(payload)=? AND row_version=1 AND payload_sha256=?
      THEN 1 ELSE 0 END AS admitted FROM message_replay_units
      WHERE room_id=? AND generation=? AND domain='tail-event' AND unit_key=?`)
      .get(proof.bytes,proof.bytes,proof.bodyHash,input.roomId,input.generation,String(input.sequence));
    if(current?.id!==proof.eventId||current?.bytes!==proof.bytes||saved?.admitted!==1)
      throw Error('prospective replay source changed');
    const payload=db.prepare(`SELECT payload FROM message_replay_units WHERE room_id=? AND generation=? AND domain='tail-event' AND unit_key=?`)
      .get(input.roomId,input.generation,String(input.sequence)).payload;
    const source=db.prepare('SELECT body FROM events WHERE room_id=? AND sequence=?').get(input.roomId,input.sequence).body;
    if(hash(new Uint8Array(payload))!==proof.bodyHash||hash(source)!==proof.bodyHash)
      throw Error('prospective replay source digest changed');
    const incoming=JSON.parse(fatalText(payload));
    if(incoming.id!==proof.eventId||incoming.roomId!==input.roomId||typeof incoming.type!=='string')
      throw Error('prospective replay event framing changed');
    return {event:incoming,sequence:input.sequence,inputBytes:controlBytes+2*proof.bytes,certified:false};
  });
}

// This verifies only the captured dependency bytes and existing digest. The
// protected H reference/member must separately match before candidate use.
function readUntouchedHReference(db,header,kind,key) {
  const {roomId,generation}=header.value,work=kind==='work',prefix=work?'hw':'hb';
  for(const suffix of ['', 'a'])if(db.prepare('SELECT 1 FROM operator_actions WHERE id=?')
    .get(`oa_brc_${prefix}${suffix}_${generation}_${Buffer.from(key).toString('hex')}`))
    throw Error('missing independently bound H reference');
  const table=work?'work_entities':'projection_bodies',keyColumn=work?'work_id':'sha',proof=work?'digest':'sha';
  const fields=work?['work_id','revision','digest','body']:['sha','body'];
  const payload=`json_object(${fields.map(f=>`'${f}',${f}`).join(',')})`;
  const admitted=`typeof(${keyColumn})='text' AND octet_length(${keyColumn}) BETWEEN 1 AND 200
    AND typeof(body)='text' AND octet_length(body)<=131072
    AND typeof(${proof})='text' AND octet_length(${proof})=64 AND ${proof} NOT GLOB '*[^a-f0-9]*'
    ${work?`AND typeof(revision)='integer' AND revision BETWEEN 0 AND ${MAX}`:''}`;
  const bytes=db.prepare(`SELECT CASE WHEN ${admitted} THEN octet_length(${payload}) END AS bytes
    FROM ${table} WHERE room_id=? AND ${keyColumn}=?`).get(roomId,key)?.bytes;
  const inputBytes=hReadControlBytes(db,header)+4096+(Number.isSafeInteger(bytes)?bytes:0);
  if(!Number.isSafeInteger(bytes)||bytes<1||bytes>131072||inputBytes>262144)
    throw Error('unchanged H reference admission required');
  const value=JSON.parse(db.prepare(`SELECT ${payload} AS json FROM ${table} WHERE room_id=? AND ${keyColumn}=?`).get(roomId,key).json);
  if(value[keyColumn]!==key||hash(value.body)!==value[proof])throw Error('unchanged H reference digest changed');
  if(work){const item=JSON.parse(value.body);if(item.id!==key||item.revision!==value.revision)throw Error('unchanged H work identity changed');}
  return {absent:false,row:value,unchanged:true,inputBytes,certified:false};
}

export function readReplayHReference(store,input) {
  if(!input||!id(input.roomId)||!digest(input.generation)||!['work','body'].includes(input.kind)
    ||typeof input.key!=='string'||Buffer.byteLength(input.key)<1||Buffer.byteLength(input.key)>200
    ||Object.keys(input).some(k=>!['roomId','generation','kind','key'].includes(k)))
    throw Error('invalid replay reference intent');
  return store.readTransaction(()=>{
    const db=store.db;verifyReplayCutoverSchema(db);
    const header=captureBinding(db,input.roomId,input.generation),domain='h-'+input.kind;
    const rows=db.prepare(`SELECT domain,CASE WHEN typeof(payload)='blob' AND typeof(payload_bytes)='integer'
      AND payload_bytes BETWEEN 1 AND 131072 AND octet_length(payload)=payload_bytes
      AND row_version=0 AND payload_sha256='' THEN payload END AS payload
      FROM message_replay_units WHERE room_id=? AND generation=? AND domain IN (?,?) AND unit_key=?`)
      .all(input.roomId,input.generation,domain,domain+'-absent',input.key);
    if(rows.length===0)return readUntouchedHReference(db,header,input.kind,input.key);
    if(rows.length!==1||!rows[0].payload)throw Error('missing or invalid captured H reference');
    const source=rows[0],absent=source.domain.endsWith('-absent');
    const receiptId=`oa_brc_h${input.kind==='work'?'w':'b'}${absent?'a':''}_${input.generation}_${Buffer.from(input.key).toString('hex')}`;
    const independent=auditBinding(db,receiptId);
    if(independent.roomId!==input.roomId||independent.generation!==input.generation
      ||independent.headerHash!==header.hash||independent.domain!==source.domain||independent.key!==input.key)
      throw Error('independent replay H-reference binding changed');
    const value=JSON.parse(fatalText(source.payload));
    if(absent){
      if(value!==null||independent.entityHash!==null)throw Error('independent replay H-absence changed');
    }else{
      const work=input.kind==='work',fields=work?['work_id','revision','digest','body']:['sha','body'];
      if(!value||Object.keys(value).length!==fields.length||fields.some(f=>!Object.hasOwn(value,f))
        ||value[work?'work_id':'sha']!==input.key||typeof value.body!=='string'
        ||!digest(value[work?'digest':'sha'])||independent.entityHash!==value[work?'digest':'sha']
        ||hash(value.body)!==independent.entityHash||(work&&(!Number.isSafeInteger(value.revision)||value.revision<0)))
        throw Error('independent replay H-reference digest changed');
      if(work){const item=JSON.parse(value.body);if(item.id!==input.key||item.revision!==value.revision)
        throw Error('independent replay H-work identity changed');}
    }
    const inputBytes=source.payload.byteLength+header.inputBytes+header.captureReceiptInputBytes
      +receiptInputBytes.get(independent)+schemaContract(db).bindingBytes+8192;
    if(inputBytes>262144)throw Error('replay reference aggregate byte limit');
    return {absent,...(absent?{}:{row:value}),receiptId,inputBytes,certified:false};
  });
}

// Explicit privacy erasure is stronger than abandonment. Delete every raw
// generation for this room in the caller's existing deletion transaction.
// Ordinary body cache releases instead use first-H COW until continuation.
export function purgeReplayCapturesForPrivacy(db,roomId) {
  if(!db.isTransaction)throw Error('replay privacy purge requires deletion transaction');
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='message_replay_units'").get())return;
  db.prepare("DELETE FROM message_replay_units WHERE room_id=? AND (generation<>'' OR (domain='control' AND unit_key='capture-head'))").run(roomId);
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
    const hashControl=get(db,roomId,generation,'hash'),hashed=hashControl.value,hashReceipt=auditBinding(db,hashed.receiptId);
    if(hashed.headerHash!==header.hash || hashReceipt.bindingHash!==header.hash || hashReceipt.generation!==generation
      ||hashReceipt.hashStateHash!==hash(hashed.state)||!digest(hashed.sourceRoot)||hashReceipt.sourceRoot!==hashed.sourceRoot)throw Error('independent replay hash binding changed');
    const completeHash=decodeReplayHash(hashed.state);
    if(completeHash.bytes!==header.value.bytes || finishReplayHash(completeHash)!==header.value.metadataHash)throw Error('verified witness required before codec');
    const codecControl=get(db,roomId,generation,'codec'),saved=codecControl.value,prior=auditBinding(db,saved.receiptId);
    if(saved.headerHash!==header.hash || prior.bindingHash!==header.hash || prior.codecStateHash!==hash(saved.state))throw Error('independent replay codec binding changed');
    const state=JSON.parse(saved.state);
    if(state.offset!==input.expectedBytes)throw Error('replay codec cursor changed');
    if(state.phase==='done' && state.offset===header.value.bytes)return {generation,bindingHash:header.hash,codecStateHash:hash(saved.state),bytes:state.offset,head:header.value.head,records:0,phase:'codec_partitioned',publication:'pending',certified:false};
    // Include exact schema-definition bind traffic and actual admitted control
    // payloads. Fixed head/epoch/request/output framing retains an 8 KiB reserve.
    const controlInputBytes=Math.max(64*1024,schemaContract(db).bindingBytes+header.inputBytes
      +header.captureReceiptInputBytes+hashControl.inputBytes+receiptInputBytes.get(hashReceipt)
      +codecControl.inputBytes+receiptInputBytes.get(prior)+8192);
    const budget={bytes:controlInputBytes,chunks:new Map(),sourceRoot:hashed.sourceRoot};
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
      bytes:scanned.state.offset,records:records.length,messages:scanned.state.messageIndex,leafCommitments,sourceRoot:hashed.sourceRoot,inputBytes:budget.bytes,controlInputBytes,logicalUnitRows,
      phase:scanned.complete&&scanned.state.offset===header.value.bytes?'codec_partitioned':'codec_partitioning',publication:'pending',certified:false};
  });
}

// Restore installs only code-owned DDL when an incoming whole-store artifact
// actually contains this optional table. Ordinary store opens do not call it.
export function ensureReplayCutoverRestoreSchema(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='message_replay_units'").get())
    db.exec(replayCutoverSchema({durable:Boolean(db.storage?.sql)}));
  admitReplayCutoverSchema(db);
}

// Whole-store backup/recovery already performs a complete offline audit. This
// verifies preserved derivation inputs, not serving parity or completion. It is
// deliberately not called by ordinary appends or bounded continuation steps.
export function auditReplayCutoverRecovery(db) {
  admitReplayCutoverSchema(db);
  if(db.prepare(`SELECT 1 FROM message_replay_units u WHERE generation<>''
    AND NOT EXISTS(SELECT 1 FROM message_replay_units h WHERE h.room_id=u.room_id
      AND h.generation=u.generation AND h.domain='header' AND h.unit_key='state') LIMIT 1`).get())
    throw Error('orphaned recovered replay generation');
  const headers=db.prepare(`SELECT CASE WHEN typeof(room_id)='text' AND octet_length(room_id)<=64
      THEN room_id END AS room_id,CASE WHEN typeof(generation)='text' AND octet_length(generation)=64
      THEN generation END AS generation FROM message_replay_units
    WHERE domain='header' AND unit_key='state'`).all();
  let abandoned=0;
  for(const {room_id:roomId,generation} of headers){
    if(!id(roomId)||!digest(generation))throw Error('invalid recovered replay identity');
    if(abandonedBinding(db,roomId,generation)){abandoned++;continue;}
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
  return {captures:headers.length-abandoned,abandoned,certified:false,publication:'pending'};
}
