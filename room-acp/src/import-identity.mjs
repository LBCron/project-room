// Import an operator-selected existing identity without persisting its global
// bearer. Generic key issuance has no replay contract: unknown means stop.
import { constants, openSync, closeSync, lstatSync, fstatSync, readFileSync } from 'node:fs';
import { join as pathJoin } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { normalizeBase } from './link.mjs';
import { RoomClient } from './room.mjs';
import { configDir, listConnections, saveConnection, loadConnection } from './credentials.mjs';
import { openJoinJournal } from './private-state.mjs';
import { defaultHostId } from './join.mjs';
import { registerSecret } from './redact.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
function privateStat(stat, directory = false) {
  if (!(directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1) || (stat.mode & 0o077)
    || process.getuid && stat.uid !== process.getuid()) throw Error('Identity connection must be private, owned by this user and without links');
}
export function readExistingIdentity(directory) {
  let fd;
  try {
    privateStat(lstatSync(directory), true);
    fd = openSync(pathJoin(directory, 'connection.json'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd); privateStat(stat);
    if (stat.size > 4096) throw Error('invalid');
    const value = JSON.parse(readFileSync(fd, 'utf8'));
    registerSecret(value?.token);
    if (value?.version !== 1 || !id(value.memberId) || typeof value.token !== 'string' || !/^pri_[A-Za-z0-9_-]+$/.test(value.token)
      || typeof value.origin !== 'string' || normalizeBase(value.origin) !== value.origin) throw Error('invalid');
    return { apiBase: value.origin, memberId: value.memberId, credential: value.token };
  } catch { throw Error('Select your existing private CLI connection directory with a global identity credential; no key was issued'); }
  finally { if (fd !== undefined) closeSync(fd); }
}

export async function importIdentity({ identityFrom, roomId, agent = null, env = process.env, fetchImpl = fetch }) {
  if (typeof identityFrom !== 'string' || !identityFrom || !id(roomId)) throw Error('Use import-identity --identity-from <private connection directory> --room <exact room ID>');
  const source = readExistingIdentity(identityFrom);
  const global = new RoomClient({ ...source, roomId, fetchImpl });
  const account = await global.request('/api/agent-rooms');
  if (!id(account?.identityId)) throw Error('Existing identity could not be verified; no key was issued');
  const access = await global.checkConnection();
  const member = access.state.members[source.memberId];
  const binding = { apiBase: source.apiBase, roomId, memberId: source.memberId, identityId: account.identityId };
  const key = digest(['import-identity', binding]);
  const journal = openJoinJournal(configDir(env), key);
  let destination;
  try {
    destination = openJoinJournal(configDir(env), 'room-' + digest(roomId.replace(/[^A-Za-z0-9._-]/g, '_')));
    const owner = destination.read();
    if (owner && (owner.version !== 1 || typeof owner.apiBase !== 'string' || typeof owner.roomId !== 'string'
      || owner.operationKey !== null && typeof owner.operationKey !== 'string')) throw Error('Saved destination ownership is invalid');
    if (owner?.operationKey && owner.operationKey !== key) throw Error('An earlier setup for this room has an unresolved outcome; reconcile that operation first');
    let pending = journal.read();
    registerSecret(pending?.connection?.credential);
    if (pending && (pending.version !== 1 || typeof pending.attempted !== 'boolean' || typeof pending.label !== 'string'
      || JSON.stringify(pending.binding) !== JSON.stringify(binding))) throw Error('Existing import receipt does not match this identity');
    const existing = listConnections(env).filter(entry => typeof entry.roomId === 'string' && entry.roomId.replace(/[^A-Za-z0-9._-]/g, '_') === roomId.replace(/[^A-Za-z0-9._-]/g, '_'));
    if (existing.length > 1 || existing.some(entry => entry.roomId !== roomId || entry.apiBase !== source.apiBase || entry.memberId !== source.memberId || entry.identityId !== account.identityId))
      throw Error('Another connection is already saved for this room; no key was issued or connection replaced');
    if (pending?.attempted && !pending.connection && !pending.completed)
      throw Error(`Key issuance outcome is unknown for label ${pending.label}. Do not issue again or delete this receipt; reconcile that exact label using your identity's API-key list`);
    if (existing[0]) {
      await new RoomClient({ ...existing[0], fetchImpl }).checkConnection();
      if (pending?.connection && pending.connection.credential !== existing[0].credential) throw Error('Saved connection differs from this import; reconcile before replacing anything');
      if (pending) { journal.save({ ...pending, completed: true, connection: null }); destination.save({ version: 1, apiBase: source.apiBase, roomId, operationKey: null }); }
      return existing[0];
    }
    if (pending?.completed) throw Error('This imported connection was forgotten; no replacement key was issued');
    if (!pending) {
      pending = { version: 1, binding, label: 'room-acp-import-' + randomUUID(), hostId: defaultHostId(), agent, attempted: false };
      journal.save(pending);
    }
    destination.save({ version: 1, apiBase: source.apiBase, roomId, operationKey: key });
    if (!pending.connection) {
      const scopes = [`mcp:room:${roomId}`, 'rooms:read', 'rooms:write', 'heartbeats:report', 'heartbeats:read'];
      pending.attempted = true; journal.save(pending); // Before the non-replayable POST.
      let issued;
      try { issued = await global.request('/api/agent-keys', { body: { scopes, label: pending.label, expiresAt: Date.now() + 30 * 86400000 } }); }
      catch { throw Error(`Key issuance outcome is unknown for label ${pending.label}. Do not issue again or delete this receipt; reconcile that exact label using your identity's API-key list`); }
      registerSecret(issued?.credential); registerSecret(issued?.secret);
      if (issued?.identityId !== account.identityId || typeof issued.credential !== 'string' || !/^rak_[A-Za-z0-9_-]+$/.test(issued.credential)
        || !Array.isArray(issued.scopes) || JSON.stringify([...issued.scopes].sort()) !== JSON.stringify([...scopes].sort())
        || !Number.isSafeInteger(issued.expiresAt) || issued.expiresAt <= Date.now()) throw Error('Issued connection could not be verified; reconcile the import label before another issuance');
      pending.connection = { version: 1, ...binding, displayName: member.displayName ?? source.memberId, permissions: member.permissions ?? [],
        credential: issued.credential, credentialExpiresAt: issued.expiresAt, hostId: pending.hostId, agent: pending.agent,
        permissionApproverId: null, joinedAt: new Date().toISOString() };
      journal.save(pending); // Scoped credential only: survives final-save failure.
    }
    await new RoomClient({ ...pending.connection, fetchImpl }).checkConnection();
    saveConnection(pending.connection, env);
    journal.save({ ...pending, completed: true, connection: null });
    destination.save({ version: 1, apiBase: source.apiBase, roomId, operationKey: null });
    return loadConnection({ roomId }, env);
  } finally { try { destination?.close(); } finally { journal.close(); } }
}
