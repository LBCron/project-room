// Byte-counting db harness for tests/integrity-parity-bytes.test.js
// (P1 design §5, lane B8: tests T-L2a/b, T-L3a/b).
//
// The design's rule: a budget is checked before work is fetched, in the
// units the work actually costs. These tests therefore measure what the
// db layer actually hands back to the parity engine, not what the
// engine's internal counters claim. This wrapper replaces
// `store.db.prepare` with a counting shim: every `.all()` / `.get()` /
// `.iterate()` result's text bytes are summed per returned row (string
// values by UTF-8 byte length, blobs by byteLength), and every write to
// `integrity_parity_checkpoint` is recorded with the serialized size of
// its JSON payload parameters (the string parameters that are JSON
// objects/arrays: counts_json, missing_json, staged_seq_json).
//
// SEGMENT DEFINITION (the quantity T-L2a bounds): a "visit segment" is
// the run of fetches between two consecutive checkpoint commits inside
// one visit — the design's "commit segment" (§2.2: 8 sub-chunks x 200
// rows = 2,089,600 B per commit segment at the base head). Fetches
// before a visit's first commit (the preamble segment: sweep reads,
// the start-checkpoint insert's reads, the counts phase) form the first
// segment. A checkpoint write (INSERT/UPDATE/DELETE on
// integrity_parity_checkpoint issued via .run()) closes the current
// segment. This matches §3.3: byte counters are per visit segment and
// never reset inside one.
//
// The wrapper is measurement only: results pass through untouched, and
// `restore()` puts the original prepare back.

export const VISIT_BYTES = 256 * 1024;      // design §3.3, = PARITY_CHUNK_BYTES at the base head
export const CHECKPOINT_BYTES = 256 * 1024; // design §3.3

function rowTextBytes(row) {
  let bytes = 0;
  for (const value of Object.values(row)) {
    if (typeof value === "string") bytes += Buffer.byteLength(value, "utf8");
    else if (value instanceof Uint8Array) bytes += value.byteLength;
  }
  return bytes;
}

function jsonPayloadBytes(params) {
  // The JSON payload parameters of a checkpoint write: string params
  // that are serialized JSON objects or arrays. (Phase names, room ids
  // and cursors are plain strings and never start with { or [.)
  let total = 0;
  let largest = 0;
  for (const param of params) {
    if (typeof param === "string" && (param.startsWith("{") || param.startsWith("["))) {
      const bytes = Buffer.byteLength(param, "utf8");
      total += bytes;
      if (bytes > largest) largest = bytes;
    }
  }
  return { total, largest };
}

export function installByteCounter(store) {
  const db = store.db;
  const originalPrepare = db.prepare.bind(db);
  const counter = {
    segments: [],          // closed: { bytes, largestRow, fetches }
    queries: [],           // every fetch: { sql, bytes, rows, largestRow }
    checkpointWrites: [],  // every checkpoint write: { sql, jsonBytes, largestJsonField }
    totalFetchedBytes: 0,
    totalCheckpointJsonBytes: 0,
    maxQueryBytes: 0
  };
  let current = { bytes: 0, largestRow: 0, fetches: 0 };
  const closeSegment = () => {
    counter.segments.push(current);
    current = { bytes: 0, largestRow: 0, fetches: 0 };
  };
  const recordFetch = (sql, rows) => {
    let bytes = 0;
    let largestRow = 0;
    for (const row of rows) {
      const rowBytes = rowTextBytes(row);
      bytes += rowBytes;
      if (rowBytes > largestRow) largestRow = rowBytes;
    }
    counter.queries.push({ sql: sql.trim().split("\n")[0].slice(0, 80), bytes, rows: rows.length, largestRow });
    counter.totalFetchedBytes += bytes;
    if (bytes > counter.maxQueryBytes) counter.maxQueryBytes = bytes;
    current.bytes += bytes;
    if (largestRow > current.largestRow) current.largestRow = largestRow;
    current.fetches += 1;
  };
  db.prepare = sql => {
    const statement = originalPrepare(sql);
    const isCheckpointWrite = /integrity_parity_checkpoint/i.test(sql)
      && /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql);
    return {
      all: (...params) => {
        const rows = statement.all(...params);
        recordFetch(sql, rows);
        return rows;
      },
      get: (...params) => {
        const row = statement.get(...params);
        recordFetch(sql, row ? [row] : []);
        return row;
      },
      iterate: (...params) => {
        const iterator = statement.iterate(...params);
        return (function* () {
          for (const row of iterator) {
            recordFetch(sql, [row]);
            yield row;
          }
        })();
      },
      run: (...params) => {
        const result = statement.run(...params);
        if (isCheckpointWrite) {
          const { total, largest } = jsonPayloadBytes(params);
          counter.checkpointWrites.push({
            sql: sql.trim().split("\n")[0].slice(0, 80), jsonBytes: total, largestJsonField: largest
          });
          counter.totalCheckpointJsonBytes += total;
          closeSegment();
        }
        return result;
      }
    };
  };
  counter.finish = () => {
    closeSegment();
    db.prepare = originalPrepare;
    return counter;
  };
  return counter;
}
