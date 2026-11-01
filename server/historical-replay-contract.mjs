// Exact-prefix evidence for a successfully committed explicit historical repair.
// Admission and independent serving/replay equality belong to the caller.
import { createHash } from 'node:crypto';
export const HISTORICAL_REPLAY_CONTRACT_VERSION = 1;
export const HISTORICAL_REPLAY_KIND = 'pre749-sessions';
export const PRE749_ADAPTER_VERSION = 1;
export function pre749PrefixDigest(roomId, rows) {
  if (typeof roomId !== 'string' || !roomId || !Array.isArray(rows) || !rows.length)
    throw new TypeError('Invalid historical prefix');
  const hash = createHash('sha256');
  const frame = text => { hash.update(String(Buffer.byteLength(text))).update(':').update(text); };
  frame('project-room.historical-replay-prefix.v1'); frame(roomId);
  for (const [index, row] of rows.entries()) {
    if (!Number.isSafeInteger(row?.sequence) || row.sequence !== index + 1
      || typeof row.id !== 'string' || !row.id || typeof row.body !== 'string')
      throw new TypeError('Invalid historical prefix');
    frame(String(row.sequence)); frame(row.id); frame(row.body);
  }
  return hash.digest('hex');
}
