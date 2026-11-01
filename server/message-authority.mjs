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

export function messageAuthorityProjection(state, count = state.messages?.length) {
  if (!hasMessageAuthority(state) || !Array.isArray(state.messages))
    throw new Error('projection_corrupt: missing canonical message context');
  if (!Number.isSafeInteger(count) || count < state.messages.length)
    throw new Error('projection_corrupt: invalid canonical context count');
  const { messages, ...metadata } = state;
  return { ...metadata, messageAuthority: { version: 1, count } };
}

function validateArchive(archive) {
  if (archive && (!Number.isSafeInteger(archive.throughSeq) || archive.throughSeq < 0
    || !Number.isSafeInteger(archive.count) || archive.count < 0
    || !Array.isArray(archive.retainedIds) || archive.retainedIds.some(id => typeof id !== 'string')))
    throw new Error('projection_corrupt: invalid canonical archive');
}

// Full compatibility hydration is explicit. Targeted command/read contexts will
// use point queries; this operation intentionally returns the retained view.
export function hydrateMessageAuthority(db, roomId, state) {
  if (!hasMessageAuthority(state)) return state;
  if (Object.hasOwn(state, 'messages'))
    throw new Error('projection_corrupt: competing canonical message array');
  const archive = state.messagesArchive;
  validateArchive(archive);
  const where = archive ? ' AND (seq>? OR message_id IN (SELECT value FROM json_each(?)))' : '';
  const params = archive ? [roomId, archive.throughSeq, JSON.stringify(archive.retainedIds)] : [roomId];
  const rows = db.prepare(`SELECT message_id,body,record_json,reducer_extras_json FROM messages
    WHERE room_id=?${where} ORDER BY seq,message_id`).all(...params);
  if (rows.length !== state.messageAuthority.count)
    throw new Error('projection_corrupt: canonical message count differs');
  return { ...state, messages: rows.map(decodeMessageEntity) };
}

// First bounded command context: a retained top-level edit changes neither
// message membership nor thread ancestry. Other commands and published rooms
// keep their full context until their own dependency contracts are qualified.
export function canonicalMessageEditContext(db, roomId, command) {
  if (command.type !== 'message.edited' || typeof command.data?.messageId !== 'string') return null;
  const row = db.prepare('SELECT sequence,projection FROM rooms WHERE id=?').get(roomId);
  if (!row) return null;
  const raw = JSON.parse(row.projection);
  if (!hasMessageAuthority(raw) || raw.room?.publicPage?.enabled || raw.room?.publicReceipts?.enabled) return null;
  if (Object.hasOwn(raw, 'messages')) throw new Error('projection_corrupt: competing canonical message array');
  validateArchive(raw.messagesArchive);
  const id = command.data.messageId;
  const rows = db.prepare(`SELECT message_id,seq,body,record_json,reducer_extras_json FROM messages
    WHERE room_id=? AND message_id IN (?,?) ORDER BY seq,message_id`).all(roomId,id,`${id}:channel`);
  const target = rows.find(record=>record.message_id===id);
  if (!target) return null;
  const messages = rows.map(decodeMessageEntity);
  if (messages.some(message=>message.replyToId)) return null;
  const archive=raw.messagesArchive;
  if (archive && target.seq<=archive.throughSeq && !archive.retainedIds?.includes(id)) return null;
  return { room: { sequence: row.sequence, state: { ...raw, messages } }, count: raw.messageAuthority.count };
}
