import { MAX_MESSAGE_BODY_CHARS } from '../src/events.js';
import { chargeCurrentReadBudget } from './current-room-repository.mjs';
import { ServiceError } from './service-error.mjs';

export const CURRENT_EVENT_ENVELOPE_BYTES = 128 * 1024;
// JSON.stringify may use six ASCII bytes per UTF-16 unit (\u0001, lone
// surrogates). Metadata keeps its existing bound; this is SQL work admission,
// not a larger protected JavaScript-input budget.
export const CURRENT_EVENT_RAW_MESSAGE_BYTES = MAX_MESSAGE_BODY_CHARS * 6 + CURRENT_EVENT_ENVELOPE_BYTES;
const unavailable = () => { throw new ServiceError(409, 'current_room_context_unavailable',
  'Event source exceeds bounded input or is malformed; cursor was not advanced'); };
const source = `SELECT id,body,length(CAST(body AS BLOB)) AS rawBytes FROM events
  WHERE room_id=? AND sequence=? AND length(CAST(id AS BLOB)) BETWEEN 1 AND 512
  AND length(CAST(body AS BLOB)) BETWEEN 2 AND ${CURRENT_EVENT_RAW_MESSAGE_BYTES}`;
const projection = `CASE WHEN json_extract(body,'$.type') IN ('message.posted','message.edited')
  THEN json_set(body,'$.data.body',NULL) ELSE body END`;
const inspect = `WITH source AS MATERIALIZED (${source}),
  valid AS MATERIALIZED (SELECT id,rawBytes,CASE WHEN json_valid(body) THEN body END AS body FROM source),
  projected AS MATERIALIZED (SELECT rawBytes,body,${projection} AS envelope,
    json_extract(body,'$.type') IN ('message.posted','message.edited') AS isMessage FROM valid)
  SELECT rawBytes,length(CAST(envelope AS BLOB)) AS envelopeBytes,isMessage,
    json_type(body)='object' AND json_type(body,'$.type')='text' AND json_type(body,'$.data')='object' AS shapeValid,
    (SELECT count(*) FROM json_each(body) WHERE key='type') AS typeKeys,
    (SELECT count(*) FROM json_each(body) WHERE key='data') AS dataKeys,
    (SELECT count(*) FROM json_each(body,'$.data') WHERE key='body') AS bodyKeys,
    json_type(body,'$.data.body') IN ('text','null') AS bodyTypeValid,
    json_type(body,'$.data.redacted')='true' AS redactedBody FROM projected`;
const fetchEnvelope = `WITH source AS MATERIALIZED (${source})
  SELECT id,CASE WHEN json_valid(body) THEN ${projection} END AS envelope FROM source`;

// The source scalar/prefix must be admitted by the caller before this point.
// Both queries address one immutable row in the caller's read transaction.
// Only the effective envelope crosses into JS; rawBytes remains available for
// the independent raw-SQL source-prefix ledger in each consumer.
export function readCurrentEventEnvelope(db, roomId, row, budget) {
  if (!db.isTransaction) throw Error('Current event envelopes require a read transaction');
  if (!Number.isSafeInteger(row?.sequence) || !Number.isSafeInteger(row.idBytes) || row.idBytes < 1 || row.idBytes > 512
    || !Number.isSafeInteger(row.bodyBytes) || row.bodyBytes < 2 || row.bodyBytes > CURRENT_EVENT_RAW_MESSAGE_BYTES) unavailable();
  chargeCurrentReadBudget(budget, row.idBytes + 256);
  const meta = db.prepare(inspect).get(roomId, row.sequence);
  if (!meta || meta.rawBytes !== row.bodyBytes || !Number.isSafeInteger(meta.envelopeBytes)
    || meta.envelopeBytes < 2 || meta.envelopeBytes > CURRENT_EVENT_ENVELOPE_BYTES || meta.shapeValid !== 1
    || meta.typeKeys !== 1 || meta.dataKeys !== 1
    || (meta.isMessage === 1
      ? !(meta.bodyKeys === 1 && meta.bodyTypeValid === 1 || meta.bodyKeys === 0 && meta.redactedBody === 1)
      : meta.rawBytes > CURRENT_EVENT_ENVELOPE_BYTES)) unavailable();
  chargeCurrentReadBudget(budget, row.idBytes + meta.envelopeBytes + 32);
  const selected = db.prepare(fetchEnvelope).get(roomId, row.sequence);
  let event;
  try { event = JSON.parse(selected?.envelope); } catch { unavailable(); }
  if (!event || Array.isArray(event) || event.id !== selected.id || event.roomId !== roomId
    || typeof event.type !== 'string' || typeof event.actorId !== 'string' || typeof event.at !== 'string'
    || Number.isNaN(Date.parse(event.at)) || !event.data || typeof event.data !== 'object' || Array.isArray(event.data)
    || meta.isMessage === 1 && event.data.body !== null) unavailable();
  return { id: selected.id, event, rawBytes: meta.rawBytes, envelopeBytes: meta.envelopeBytes };
}
