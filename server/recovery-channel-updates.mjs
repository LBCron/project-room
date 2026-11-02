import { validateChannelUpdateJournalRow } from './channel-journal.mjs';
import { inRestoreContext, restoreProgress, RESTORE_AUDIT_VERSION } from './restore-admission.mjs';
import { verifyRestoreFreeze } from './writer-fence.mjs';
const TABLE = 'pending_channel_updates', LIMIT = 4 * 1024 * 1024, consumed = new WeakMap();
const fail = () => { throw Error('Recovery channel updates require operator reconciliation'); };
export const initialRecoveryChannelUpdates = () => ({ version: 1, stage: 'rows', after: null, rows: 0, pending: 0, imported: 0, failed: 0 });
function rowid(value) {
  if (typeof value !== 'string' || !/^(?:0|-[1-9][0-9]*|[1-9][0-9]*)$/.test(value) || value.length > 20) return false;
  const n = BigInt(value); return n >= -9223372036854775808n && n <= 9223372036854775807n;
}
export function validateRecoveryChannelUpdates(c) {
  if (!c || Object.keys(c).sort().join(',') !== Object.keys(initialRecoveryChannelUpdates()).sort().join(',') || c.version !== 1
    || !['rows', 'complete'].includes(c.stage) || c.after !== null && !rowid(c.after)
    || !['rows', 'pending', 'imported', 'failed'].every(k => Number.isSafeInteger(c[k]) && c[k] >= 0)
    || c.rows !== c.pending + c.imported + c.failed) fail();
}
function authority(store, id, sealId) {
  const db = store.db;
  if (!db.isTransaction || !inRestoreContext(db)) fail();
  const state = restoreProgress(db), audit = state.progress?.audit;
  if (state.state !== 'pending' || state.phase !== 'audit_pending' || state.restore_id !== id || state.seal?.id !== sealId
    || state.seal.auditVersion !== RESTORE_AUDIT_VERSION || audit?.version !== RESTORE_AUDIT_VERSION) fail();
  return state;
}
function entry(seal) {
  const e = seal.tables.find(e => e.name === TABLE);
  if (!e || !Number.isSafeInteger(e.maxRowBytes) || e.maxRowBytes < 0 || !Number.isSafeInteger(e.expected?.rows) || e.expected.rows < 0) fail();
  return e;
}
function complete(c, seal) { validateRecoveryChannelUpdates(c); if (c.stage !== 'complete' || c.rows !== entry(seal).expected.rows) fail(); }
export function advanceRecoveryChannelUpdates(store, id, previous, seal, { maxUnits = 32 } = {}) {
  validateRecoveryChannelUpdates(previous);
  if (!Number.isInteger(maxUnits) || maxUnits < 1 || maxUnits > 32) fail();
  const state = authority(store, id, seal?.id), audit = state.progress.audit, db = store.db, e = entry(state.seal);
  if (audit.stage !== 'channel_updates' || JSON.stringify(audit.channelUpdates) !== JSON.stringify(previous)) fail();
  const c = { ...previous }; let units = 0, bytes = 0;
  while (c.stage !== 'complete' && units < maxUnits && bytes < LIMIT) {
    // Admit bytes before fetching any payload. The signed int64 text cursor
    // preserves every SQLite rowid, including zero and values unsafe in JS.
    const s = db.prepare(`SELECT CAST(rowid AS TEXT) cursor,
      coalesce(length(CAST(account_id AS BLOB)),0)+coalesce(length(CAST(connection_id AS BLOB)),0)
      +coalesce(length(CAST(payload AS BLOB)),0)+coalesce(length(CAST(status AS BLOB)),0)
      +coalesce(length(CAST(last_error AS BLOB)),0)+4096 bytes FROM pending_channel_updates
      ${c.after === null ? '' : 'WHERE rowid>CAST(? AS INTEGER)'} ORDER BY rowid LIMIT 1`).get(...(c.after === null ? [] : [c.after]));
    if (!s) { c.stage = 'complete'; complete(c, state.seal); break; }
    if (!rowid(s.cursor) || !Number.isSafeInteger(s.bytes) || s.bytes < 4096 || s.bytes > e.maxRowBytes + 4096) fail();
    // Same sealed legal-atom exception as the existing recovery phases: a
    // historical row above the work quantum runs alone; no new source cap.
    if (units && bytes + s.bytes > LIMIT) break;
    const row = db.prepare('SELECT * FROM pending_channel_updates WHERE rowid=CAST(? AS INTEGER)').get(s.cursor);
    const status = validateChannelUpdateJournalRow(row);
    c[status]++; c.rows++; c.after = s.cursor; units++; bytes += s.bytes;
  }
  return { cursor: c, units, bytes, done: c.stage === 'complete' };
}
// A synchronous target-local capability, never a caller-supplied skip flag.
export function withCompletedRecoveryChannelUpdates(store, id, sealId, operation) {
  const state = authority(store, id, sealId), c = state.progress.audit.channelUpdates;
  if (state.progress.audit.stage !== 'full_audit_pending') fail();
  complete(c, state.seal); verifyRestoreFreeze(store.db, state.seal.inventory);
  const before = consumed.get(store.db);
  consumed.set(store.db, { id, sealId, revision: state.revision, cursor: JSON.stringify(c) });
  try { const result = operation(); if (result?.then) fail(); return result; }
  finally { if (before) consumed.set(store.db, before); else consumed.delete(store.db); }
}
export function verifyChannelUpdatesForRecovery(store) {
  const permit = consumed.get(store.db);
  if (!permit) return store.channelUpdates.verify();
  const state = authority(store, permit.id, permit.sealId), c = state.progress.audit.channelUpdates;
  if (state.revision !== permit.revision || state.progress.audit.stage !== 'full_audit_pending' || JSON.stringify(c) !== permit.cursor) fail();
  complete(c, state.seal);
  return { pending: c.pending, imported: c.imported, failed: c.failed };
}
