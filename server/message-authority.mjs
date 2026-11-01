// Canonical message payloads live in messages, not an array of room references.
// This is an internal migration boundary, not an authorization or wire API.
import { decodeMessageEntity } from './message-entity-projection.mjs';

export function hasMessageAuthority(state) {
  if (!Object.hasOwn(state ?? {}, 'messageAuthority')) return false;
  const marker = state.messageAuthority;
  if (!marker || marker.version !== 1 || !Number.isSafeInteger(marker.count) || marker.count < 0
    || Object.keys(marker).some(key => !['version', 'count'].includes(key)))
    throw new Error('projection_corrupt: invalid message authority');
  return true;
}

export function messageAuthorityProjection(state) {
  if (!hasMessageAuthority(state) || !Array.isArray(state.messages))
    throw new Error('projection_corrupt: missing canonical message context');
  const { messages, ...metadata } = state;
  return { ...metadata, messageAuthority: { version: 1, count: messages.length } };
}

// Full compatibility hydration is explicit. Targeted command/read contexts will
// use point queries; this operation intentionally returns the retained view.
export function hydrateMessageAuthority(db, roomId, state) {
  if (!hasMessageAuthority(state)) return state;
  if (Object.hasOwn(state, 'messages'))
    throw new Error('projection_corrupt: competing canonical message array');
  const archive = state.messagesArchive;
  if (archive && (!Number.isSafeInteger(archive.throughSeq) || archive.throughSeq < 0
    || !Array.isArray(archive.retainedIds) || archive.retainedIds.some(id => typeof id !== 'string')))
    throw new Error('projection_corrupt: invalid canonical archive');
  const where = archive ? ' AND (seq>? OR message_id IN (SELECT value FROM json_each(?)))' : '';
  const params = archive ? [roomId, archive.throughSeq, JSON.stringify(archive.retainedIds)] : [roomId];
  const rows = db.prepare(`SELECT message_id,body,record_json,reducer_extras_json FROM messages
    WHERE room_id=?${where} ORDER BY seq,message_id`).all(...params);
  if (rows.length !== state.messageAuthority.count)
    throw new Error('projection_corrupt: canonical message count differs');
  return { ...state, messages: rows.map(decodeMessageEntity) };
}
