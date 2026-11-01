// Witness-first experiment only. Not imported by service code or a migration.
// The captured independent proof is preserved; a new self-hash is not authority.
export const BOOTSTRAP_CEILING = 8 * 1024 * 1024;
export const WITNESS_SLICE = 16 * 1024;
export const WITNESS_SCHEMA = `CREATE TABLE IF NOT EXISTS replay_projection_witness (
  capture_id TEXT PRIMARY KEY, room_id TEXT NOT NULL, head INTEGER NOT NULL,
  event_id TEXT NOT NULL, metadata_hash TEXT NOT NULL, content_hash TEXT NOT NULL,
  byte_length INTEGER NOT NULL, ceiling_bytes INTEGER NOT NULL, projection TEXT NOT NULL
)`;
export function captureProjectionWitness(db, {captureId, roomId, expectedHead, ceilingBytes=BOOTSTRAP_CEILING}) {
  if (!db.isTransaction) throw Error('witness capture requires writer transaction');
  if (![captureId,roomId].every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(x))
    || !Number.isSafeInteger(expectedHead)||expectedHead<1
    || !Number.isSafeInteger(ceilingBytes)||ceilingBytes<1||ceilingBytes>BOOTSTRAP_CEILING) throw Error('invalid witness input');
  const old=db.prepare(`SELECT
    CASE WHEN typeof(room_id)='text' AND length(CAST(room_id AS BLOB))<=64 THEN room_id END AS room_id,
    CASE WHEN typeof(head)='integer' AND head BETWEEN 1 AND 9007199254740991 THEN head END AS head,
    CASE WHEN typeof(byte_length)='integer' AND byte_length BETWEEN 1 AND 8388608 THEN byte_length END AS byte_length,
    CASE WHEN typeof(ceiling_bytes)='integer' AND ceiling_bytes BETWEEN 1 AND 8388608 THEN ceiling_bytes END AS ceiling_bytes
    FROM replay_projection_witness WHERE capture_id=?`).get(captureId);
  if (old) {
    if (old.room_id!==roomId||old.head!==expectedHead||old.ceiling_bytes!==ceilingBytes||old.byte_length===null) throw Error('witness intent conflict');
    return {room_id:old.room_id,head:old.head,byte_length:old.byte_length,duplicate:true};
  }
  const row=db.prepare(`SELECT
    CASE WHEN typeof(r.sequence)='integer' AND r.sequence BETWEEN 1 AND 9007199254740991 THEN r.sequence END AS head,
    CASE WHEN typeof(r.projection)='text' THEN length(CAST(r.projection AS BLOB)) END AS bytes,
    CASE WHEN typeof(p.sequence)='integer' AND p.sequence=r.sequence
      AND typeof(p.metadata_hash)='text' AND length(CAST(p.metadata_hash AS BLOB))=64
      AND typeof(p.projection_hash)='text' AND length(CAST(p.projection_hash AS BLOB))=64
      THEN 1 ELSE 0 END AS proved,
    CASE WHEN typeof(e.id)='text' AND length(CAST(e.id AS BLOB)) BETWEEN 1 AND 200 THEN 1 ELSE 0 END AS anchored
    FROM rooms r LEFT JOIN integrity_room_state p ON p.room_id=r.id
    LEFT JOIN events e ON e.room_id=r.id AND e.sequence=r.sequence WHERE r.id=?`).get(roomId);
  if (!row||row.head!==expectedHead) throw Error('witness head changed');
  if (!Number.isSafeInteger(row.bytes)||row.bytes>ceilingBytes) throw Error('witness byte ceiling');
  if (row.proved!==1||row.anchored!==1) throw Error('independent witness proof required');
  db.prepare(`INSERT INTO replay_projection_witness
    SELECT ?,r.id,r.sequence,e.id,p.metadata_hash,p.projection_hash,
      length(CAST(r.projection AS BLOB)),?,r.projection
    FROM rooms r JOIN integrity_room_state p ON p.room_id=r.id
    JOIN events e ON e.room_id=r.id AND e.sequence=r.sequence WHERE r.id=?`).run(captureId,ceilingBytes,roomId);
  return {room_id:roomId,head:row.head,byte_length:row.bytes,duplicate:false};
}
export function witnessChunk(db,captureId,offset) {
  if (typeof captureId!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(captureId)
    ||!Number.isSafeInteger(offset)||offset<0||offset>BOOTSTRAP_CEILING) throw Error('invalid witness slice');
  return db.prepare('SELECT substr(CAST(projection AS BLOB),?,?) AS chunk FROM replay_projection_witness WHERE capture_id=?').get(offset+1,WITNESS_SLICE,captureId)?.chunk??null;
}
