// Exact-prefix evidence for a successfully committed explicit historical repair.
// Shared producer rules and bounded saved-prefix consumption; no proof baseline.
import { createHash } from 'node:crypto';
import { ServiceError } from './service-error.mjs';
import { replayPre749Sessions } from './legacy-session-replay.mjs';
export const HISTORICAL_REPLAY_CONTRACT_VERSION = 1;
export const HISTORICAL_REPLAY_KIND = 'pre749-sessions';
export const PRE749_ADAPTER_VERSION = 1;
function sourceBytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Uint8Array) return value;
  throw new TypeError('Invalid historical source bytes');
}
function sourceText(value) {
  const bytes = sourceBytes(value);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new TypeError('Invalid historical source bytes'); }
  if (!Buffer.from(text, 'utf8').equals(Buffer.from(bytes))) throw new TypeError('Invalid historical source bytes');
  return text;
}
export function decodeHistoricalEventRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new TypeError('Invalid historical prefix');
  return rows.map((row, index) => {
    if (!Number.isSafeInteger(row?.sequence) || row.sequence !== index + 1) throw new TypeError('Invalid historical prefix');
    const id = sourceText(row.id), body = sourceText(row.body);
    if (!id) throw new TypeError('Invalid historical prefix');
    return { ...row, id, body };
  });
}
// Only raw CAST(... AS BLOB) results are accepted. Driver-decoded TEXT loses
// provenance: invalid UTF-8 and a valid U+FFFD can otherwise alias.
export function pre749PrefixDigest(roomId, rows) {
  if (typeof roomId !== 'string' || !roomId) throw new TypeError('Invalid historical prefix');
  decodeHistoricalEventRows(rows);
  const hash = createHash('sha256');
  const frame = bytes => { hash.update(String(bytes.byteLength)).update(':').update(bytes); };
  frame(Buffer.from('project-room.historical-replay-prefix.v1')); frame(Buffer.from(roomId));
  for (const row of rows) {
    frame(Buffer.from(String(row.sequence))); frame(sourceBytes(row.id)); frame(sourceBytes(row.body));
  }
  return hash.digest('hex');
}

// Producer and ordinary consumers share these rules; discovery is not authority.
export const HISTORICAL_REPAIR_KIND = 'pre749-session-backfill';
export const HISTORICAL_REPAIR_ACTION = 'legacy_session_backfill_reconciled';
export const HISTORICAL_PROOF_MODE = 'adopt-absent-inline-v1';
const KIND = HISTORICAL_REPAIR_KIND, PROOF_MODE = HISTORICAL_PROOF_MODE;
const LIMIT = 64, BYTES = 256 * 1024;
const LOOKUP_ACTION = 'legacy_session_replay_lookup';
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const inputFailure = (code, status = 409) => { throw new ServiceError(status, code, 'Historical session repair refused; inspect fresh plan and independent serving proofs'); };
export class SavedHistoricalReplayError extends ServiceError {
  constructor() { super(500, 'projection_corrupt', 'Saved historical replay evidence requires operator reconciliation'); }
}
const unavailable = () => { throw new SavedHistoricalReplayError(); };
export function validateHistoricalRepairInput(input, execute) {
  if (!input || Object.keys(input).some(k => !['repairKind', 'rooms', 'reason', 'planHash', 'requestId', 'messageProofMode'].includes(k))
  || (input.messageProofMode !== undefined && input.messageProofMode !== PROOF_MODE)
  || input.repairKind !== KIND || !Array.isArray(input.rooms) || input.rooms.length !== 1
  || !input.rooms[0] || Object.keys(input.rooms[0]).some(k => !['roomId', 'expectedHead'].includes(k))
  || typeof input.rooms[0].roomId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(input.rooms[0].roomId)
  || !Number.isSafeInteger(input.rooms[0].expectedHead) || input.rooms[0].expectedHead < 1
  || input.rooms[0].expectedHead > LIMIT || typeof input.reason !== 'string'
  || !input.reason.trim() || Buffer.byteLength(input.reason) > 280 || Buffer.byteLength(JSON.stringify(input)) > 1024) inputFailure('invalid_legacy_repair', 422);
  if (execute && (typeof input.planHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.planHash)
  || typeof input.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(input.requestId))) inputFailure('repair_plan_required', 422);
  if (!execute && (input.planHash !== undefined || input.requestId !== undefined)) inputFailure('invalid_legacy_repair', 422);
  return input.rooms[0];
}
export function historicalRepairFingerprint(input, target) {
  return hash({ repairKind: KIND,
    ...(input.messageProofMode === PROOF_MODE ? { messageProofMode: PROOF_MODE } : {}),
    target, reason: input.reason, planHash: input.planHash ?? null, requestId: input.requestId ?? null });
}
export const historicalRepairReceiptId = (roomId, requestId) => 'oa_lsr_' + hash(roomId + '\0' + requestId);
const lookupId = (roomId, head) => 'oa_lsr_lookup_v1_' + hash(roomId) + '_' + String(head).padStart(2, '0');
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function validContract(c, roomId, head) {
  const keys = ['version','kind','adapterVersion','roomId','throughSequence','headEventId','prefixSha256','snapshotHash'];
  return c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length === keys.length && keys.every(key => Object.hasOwn(c,key))
    && c.version === HISTORICAL_REPLAY_CONTRACT_VERSION && c.kind === HISTORICAL_REPLAY_KIND && c.adapterVersion === PRE749_ADAPTER_VERSION
    && c.roomId === roomId && c.throughSequence === head && Number.isSafeInteger(head) && head >= 1 && head <= LIMIT
    && typeof c.headEventId === 'string' && c.headEventId.length > 0 && Buffer.byteLength(c.headEventId) <= 256 && sha(c.prefixSha256) && sha(c.snapshotHash);
}
const contractHash = c => hash([c.version,c.kind,c.adapterVersion,c.roomId,c.throughSequence,c.headEventId,c.prefixSha256,c.snapshotHash]);
function objectJson(db, text) {
  let value;
  try { value = JSON.parse(text); } catch (error) { if (error instanceof SyntaxError) unavailable(); throw error; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) unavailable();
  if (db.prepare('SELECT 1 FROM json_tree(?) WHERE key IS NOT NULL GROUP BY parent,key HAVING count(*)>1 LIMIT 1').get(text)) unavailable();
  return value;
}
// Every transferred text is first type/octet admitted, then decoded from raw
// bytes. Invalid UTF-8 must not alias a legitimate replacement character.
function admittedRows(db, ids, columns, caps, spent) {
  const where = `id IN (${ids.map(() => '?').join(',')})`;
  const invalid = columns.map((key,i) => `(typeof(${key})!='text' OR length(CAST(${key} AS BLOB))>${caps[i]})`).join(' OR ')
    + (columns.length === 6 ? " OR reason!='Discover verified historical replay contract' OR typeof(reason)!='text' OR plan_hash IS NOT NULL OR request_id IS NOT NULL" : '');
  const sizes = columns.map(key => `length(CAST(${key} AS BLOB))+32`).join('+');
  const size = db.prepare(`SELECT count(*) AS n,coalesce(sum(nbytes),0) AS bytes,coalesce(max(invalid),0) AS invalid FROM (SELECT ${sizes} AS nbytes,CASE WHEN ${invalid} THEN 1 ELSE 0 END AS invalid FROM operator_actions WHERE ${where})`).get(...ids);
  if (size.invalid || size.n > ids.length || !Number.isSafeInteger(size.bytes) || spent.bytes + size.bytes > BYTES) unavailable();
  spent.bytes += size.bytes;
  const rows = db.prepare(`SELECT ${columns.map(key => `CAST(${key} AS BLOB) AS ${key}`).join(',')} FROM operator_actions WHERE ${where}`).all(...ids);
  try { return rows.map(row => Object.fromEntries(columns.map(key => [key,sourceText(row[key])]))); }
  catch (error) { if (error instanceof TypeError) unavailable(); throw error; }
}
function originalReceipt(db, id, roomId, head, spent) {
  if (!/^oa_lsr_[a-f0-9]{64}$/.test(id)) unavailable();
  const columns = ['id','action','target_kind','target_id','reason','plan_hash','counts_json','result','request_id'];
  const row = admittedRows(db,[id],columns,[71,64,16,64,280,64,4096,16,64],spent)[0];
  if (!row || row.action !== HISTORICAL_REPAIR_ACTION || row.target_kind !== 'room' || row.target_id !== roomId || row.result !== 'verified') unavailable();
  const saved = objectJson(db,row.counts_json), contract = saved.replayContract;
  if (!validContract(contract,roomId,head) || saved.repairKind !== KIND || saved.verified !== 1 || saved.duplicate !== false
    || typeof saved.derivedOnly !== 'boolean' || saved.snapshotHash !== contract.snapshotHash || saved.planHash !== row.plan_hash
    || !sha(saved.requestFingerprint) || !sha(saved.priorCursorHash) || !Array.isArray(saved.rooms) || saved.rooms.length !== 1
    || saved.rooms[0]?.roomId !== roomId || saved.rooms[0]?.head !== head || saved.rooms[0]?.events !== head) unavailable();
  const keys = ['repairKind','derivedOnly','rooms','planHash','snapshotHash','priorCursorHash','admission','requestFingerprint','verified','duplicate','replayContract'];
  if (!saved.derivedOnly) keys.push('messageProofMode','messageProofsToAdopt','servingContentChanged','messageProofsAdopted');
  if (Object.keys(saved).length !== keys.length || !keys.every(key => Object.hasOwn(saved,key))
    || Object.keys(saved.rooms[0]).length !== 3
    || (!saved.derivedOnly && (!Number.isSafeInteger(saved.messageProofsAdopted) || saved.messageProofsAdopted < 0
      || saved.messageProofsAdopted > LIMIT || saved.messageProofsToAdopt !== saved.messageProofsAdopted))) unavailable();
  const mode = saved.messageProofMode;
  if (saved.derivedOnly ? mode !== undefined : mode !== PROOF_MODE || saved.servingContentChanged !== false) unavailable();
  const request = { repairKind: KIND, ...(mode === PROOF_MODE ? {messageProofMode:mode} : {}), rooms:[{roomId,expectedHead:head}],
    reason:row.reason, planHash:row.plan_hash, requestId:row.request_id };
  try { validateHistoricalRepairInput(request,true); } catch (error) { if (error instanceof ServiceError) unavailable(); throw error; }
  if (historicalRepairReceiptId(roomId,row.request_id) !== id) unavailable();
  // The original producer preserves these two valid input object-key orders.
  // Do not canonicalize an old fingerprint or change its saved retry response.
  if (![request.rooms[0],{expectedHead:head,roomId}].some(target => historicalRepairFingerprint(request,target) === saved.requestFingerprint)) unavailable();
  const a = saved.admission;
  if (!a || Object.keys(a).length !== 4 || !['inputBytes','outputBytes','receiptReserveBytes','limitBytes'].every(key => Number.isSafeInteger(a[key]) && a[key] >= 0)
    || a.receiptReserveBytes !== 4096 || a.limitBytes !== BYTES || a.inputBytes + a.outputBytes + a.receiptReserveBytes > BYTES) unavailable();
  return { row, saved, contract };
}
export function appendHistoricalReplayLookup(db, roomId, head, receiptId, contract, at) {
  if (!db.isTransaction || !validContract(contract,roomId,head)) unavailable();
  const id = lookupId(roomId,head), digest = contractHash(contract), spent = {bytes:1024};
  const prior = admittedRows(db,[id],['id','action','target_kind','target_id','counts_json','result'],[128,64,16,64,512,16],spent)[0];
  if (prior) {
    const value = lookupValue(db,prior,roomId,head);
    const old = originalReceipt(db,value.receiptId,roomId,head,spent);
    if (value.contractSha256 !== digest || contractHash(old.contract) !== digest) unavailable();
    return;
  }
  const original = originalReceipt(db,receiptId,roomId,head,spent);
  if (contractHash(original.contract) !== digest) unavailable();
  const value = {version:1,roomId,throughSequence:head,receiptId,contractSha256:digest};
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) > 512 || spent.bytes + Buffer.byteLength(json) > 4096) unavailable();
  db.prepare('INSERT INTO operator_actions(id,at,action,target_kind,target_id,reason,plan_hash,counts_json,result,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(id,at,LOOKUP_ACTION,'room',roomId,'Discover verified historical replay contract',null,json,'verified',null);
}
function lookupValue(db, row, roomId, head) {
  const value = objectJson(db,row.counts_json), keys = ['version','roomId','throughSequence','receiptId','contractSha256'];
  if (row.id !== lookupId(roomId,head) || row.action !== LOOKUP_ACTION || row.target_kind !== 'room' || row.target_id !== roomId || row.result !== 'verified'
    || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value,key)) || value.version !== 1
    || value.roomId !== roomId || value.throughSequence !== head || typeof value.receiptId !== 'string'
    || !/^oa_lsr_[a-f0-9]{64}$/.test(value.receiptId) || !sha(value.contractSha256)) unavailable();
  return value;
}
// Caller holds its read/writer transaction. This reconstructs only a previously
// proved exact prefix; it never reads serving payloads or establishes a proof.
export function savedHistoricalReplayCheckpoint(db, roomId, through, eventBudget = LIMIT) {
  if (!db.isTransaction) throw Error('Historical checkpoint requires a transaction');
  if (!Number.isSafeInteger(through) || through < 1 || typeof roomId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(roomId)) return null;
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='operator_actions'").get()) return null;
  const heads = Array.from({length:Math.min(LIMIT,through)},(_,i)=>i+1), ids = heads.map(head=>lookupId(roomId,head));
  const spent = {bytes:1024 + ids.reduce((n,id)=>n+Buffer.byteLength(id)+32,0)};
  const rows = admittedRows(db,ids,['id','action','target_kind','target_id','counts_json','result'],[128,64,16,64,512,16],spent);
  if (!rows.length) return null; // No legacy namespace scan or implicit adoption.
  let selected;
  for (const row of rows) {
    const head = heads[ids.indexOf(row.id)];
    const value = lookupValue(db,row,roomId,head);
    if (!selected || head > selected.head) selected = {head,value};
  }
  const {head,value} = selected, original = originalReceipt(db,value.receiptId,roomId,head,spent), c = original.contract;
  if (value.contractSha256 !== contractHash(c)) unavailable();
  if (head > eventBudget) return {budgetExceeded:true,sequence:head};
  const size = db.prepare(`SELECT count(*) AS n,coalesce(sum(nbytes),0) AS bytes,coalesce(max(invalid),0) AS invalid FROM (
    SELECT length(CAST(id AS BLOB))+length(CAST(body AS BLOB))+96 AS nbytes,
      CASE WHEN typeof(sequence)!='integer' OR sequence<1 OR typeof(id)!='text' OR length(CAST(id AS BLOB))>256 OR typeof(body)!='text' THEN 1 ELSE 0 END AS invalid
    FROM events WHERE room_id=? AND sequence<=? ORDER BY sequence LIMIT 65)`).get(roomId,head);
  if (size.invalid || size.n !== head || !Number.isSafeInteger(size.bytes) || spent.bytes + size.bytes + original.saved.admission.outputBytes > BYTES) unavailable();
  const raw = db.prepare('SELECT sequence,CAST(id AS BLOB) AS id,CAST(body AS BLOB) AS body FROM events WHERE room_id=? AND sequence<=? ORDER BY sequence LIMIT 65').all(roomId,head);
  let events;
  try {
    if (pre749PrefixDigest(roomId,raw) !== c.prefixSha256) unavailable();
    const decoded = decodeHistoricalEventRows(raw);
    if (decoded.at(-1).id !== c.headEventId) unavailable();
    events = decoded.map(row => { const incoming = objectJson(db,row.body); if (incoming.id !== row.id || incoming.roomId !== roomId) unavailable(); return incoming; });
  } catch (error) { if (error instanceof TypeError) unavailable(); throw error; }
  let state;
  try { state = replayPre749Sessions(events); }
  catch (error) { if (error.constructor === Error && !error.code) unavailable(); throw error; }
  const json = JSON.stringify(state);
  if (hash(json) !== c.snapshotHash || Buffer.byteLength(json) > original.saved.admission.outputBytes || spent.bytes + size.bytes + Buffer.byteLength(json) > BYTES) unavailable();
  return {state,json,sequence:head,eventId:c.headEventId,events:head};
}
