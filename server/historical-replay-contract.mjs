// Exact-prefix evidence for a successfully committed explicit historical repair.
// SQL type/octet/count admission and independent serving equality belong to the caller.
import { createHash } from 'node:crypto';
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
