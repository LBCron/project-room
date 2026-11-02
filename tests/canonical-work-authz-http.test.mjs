import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import {RoomStore} from '../server/store.mjs';
import {AgentRooms} from '../server/agent-rooms.mjs';
import {createRoomServer} from '../server/http.mjs';
import {auditRecovery} from '../server/recovery.mjs';

const ROLES = ['owner', 'collaborator', 'contributor', 'reviewer', 'chat', 'guest', 'outsider', 'anonymous', 'revoked'];
const ACTIONS = ['propose', 'accept-own', 'acquire-contributor', 'renew-contributor', 'release-contributor', 'configure'];
const ALLOWED = {
  propose: ['owner', 'collaborator'],
  'accept-own': ['owner', 'collaborator', 'contributor'],
  'acquire-contributor': ['contributor'],
  'renew-contributor': ['contributor'],
  'release-contributor': ['owner', 'contributor'],
  configure: ['owner'],
};
const BUSINESS_TABLES = [
  'rooms', 'events', 'commands', 'work_entities', 'work_claims',
  'current_room_records', 'current_room_record_proofs', 'current_room_head',
  'operator_actions', 'work_claim_config',
];

function denialFor(role, action) {
  if (role === 'outsider') return [403, 'no_access'];
  if (role === 'anonymous' || role === 'revoked') return [401, 'unauthenticated'];
  if (action === 'configure') return [403, 'work_claims_not_permitted'];
  if (['chat', 'guest'].includes(role) && ['acquire-contributor', 'renew-contributor', 'release-contributor'].includes(action)) {
    return [403, 'work_claims_not_permitted'];
  }
  return [422, 'command_rejected'];
}

test('canonical work HTTP preserves role authority, attribution and refusal atomicity', {timeout: 30000}, async t => {
  const store = new RoomStore(':memory:');
  const server = createRoomServer({store});
  t.after(async () => {
    if (server) {
      server.closeStreams();
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    store.close();
  });
  const owner = store.identities.create('Matrix Owner');
  // This matrix covers normalized authority, not the product's default format
  // for newly created rooms. Make the fixture format explicit only at setup.
  const initialize = store.initialize.bind(store);
  let roomId;
  try {
    store.initialize = (events, options) => initialize(events, {...options, representation: 'normalized-current-v1'});
    ({roomId} = new AgentRooms(store).create(owner.secret, {
      title: 'Canonical authorization regression', purpose: 'Disposable HTTP role matrix',
    }));
  } finally {
    store.initialize = initialize;
  }
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const keys = {owner: owner.secret}, actors = {owner: owner.identityId};
  async function http(path, token, body) {
    const response = await fetch(origin + path, {
      method: 'POST', headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
      body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
    });
    return {status: response.status, body: await response.json()};
  }
  const roomPath = `/api/rooms/${roomId}`;
  const request = (role, path, body) => http(roomPath + path, keys[role], body);
  for (const [role, profile] of Object.entries({
    collaborator: 'collaborate', contributor: 'contribute', reviewer: 'review', chat: 'chat', revoked: 'collaborate',
  })) {
    const identity = store.identities.create(`Matrix ${role}`);
    keys[role] = identity.secret;
    const invite = await request('owner', '/agent-invites', {profile});
    assert.equal(invite.status, 201, `invite ${role}`);
    const joined = await http('/api/agent-invites/redeem', identity.secret, {code: invite.body.code, displayName: `Matrix ${role}`});
    assert.ok([200, 201].includes(joined.status), `redeem ${role}`);
    assert.equal(typeof joined.body.memberId, 'string');
    actors[role] = joined.body.memberId;
  }
  const revoked = await http(`/api/agent-identities/${actors.revoked}/revoke`, keys.revoked, {confirm: true});
  assert.equal(revoked.status, 200);
  keys.outsider = store.identities.create('Unlinked outsider').secret;
  keys.anonymous = null;
  const linkToken = randomBytes(32).toString('base64url');
  const ownerRevision = store.roomAuthority(roomId, {memberId: actors.owner}).members[actors.owner].revision;
  const link = await request('owner', '/share-links', {
    requestId: 'matrix-share-link', linkToken, expiresAt: Date.now() + 3600000, maxJoins: 1, expectedMemberRevision: ownerRevision,
  });
  assert.ok([200, 201].includes(link.status));
  const guest = store.identities.create('Share-link guest');
  keys.guest = guest.secret;
  const joined = await http('/api/share-links/join-agent', guest.secret, {linkToken, displayName: 'Matrix Guest'});
  assert.ok([200, 201].includes(joined.status));
  assert.equal(typeof joined.body.memberId, 'string');
  actors.guest = joined.body.memberId;
  assert.deepEqual(store.roomAuthority(roomId, {memberId: actors.guest}).members[actors.guest].permissions, []);

  let serial = 0;
  const model = (role, type, data) => store.command(keys[role], roomId, {id: `seed-${++serial}`, type, data});
  const proposal = (id, accountableMemberId = actors.contributor) => ({
    workItemId: id, title: `PRIVATE-TASK-MARKER ${id}`, definitionOfDone: 'Saved result', mode: 'write', accountableMemberId,
  });
  const scope = id => ({
    workItemId: id, expectedRevision: 1, repository: 'synthetic/project', ref: 'main', paths: [`${id}.txt`],
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  const snapshot = () => createHash('sha256').update(JSON.stringify(Object.fromEntries(BUSINESS_TABLES.map(table => [
    table, store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
  ])))).digest('hex');

  // Each cell has independent valid work. Model commands seed prerequisites;
  // only the operation whose role is under test crosses the actual HTTP boundary.
  for (const action of ACTIONS) for (const role of ROLES) {
    await t.test(`${action}: ${role}`, async () => {
      const id = `${action}-${role}`;
      const accountable = action === 'accept-own' && !['outsider', 'anonymous', 'revoked'].includes(role)
        ? actors[role] : actors.contributor;
      let type, data, path = '/commands';
      if (action === 'propose') {
        type = 'work.proposed'; data = proposal(id);
      } else if (action === 'configure') {
        path = '/work-claims/config'; data = {maxOpenClaims: 1000};
      } else {
        model('owner', 'work.proposed', proposal(id, accountable));
        if (action !== 'accept-own') model('contributor', 'work.accepted', {workItemId: id, expectedRevision: 0});
        if (['renew-contributor', 'release-contributor'].includes(action)) model('contributor', 'claim.acquired', scope(id));
        if (action === 'accept-own') { type = 'work.accepted'; data = {workItemId: id, expectedRevision: 0}; }
        if (action === 'acquire-contributor') { type = 'claim.acquired'; data = scope(id); }
        if (action === 'renew-contributor') {
          type = 'claim.renewed'; data = {workItemId: id, expectedRevision: 2, expiresAt: new Date(Date.now() + 7200000).toISOString()};
        }
        if (action === 'release-contributor') { type = 'claim.released'; data = {workItemId: id, expectedRevision: 2}; }
      }
      const before = snapshot(), head = store.headSequence(roomId);
      const response = await request(role, path, path === '/commands' ? {id: `cell-${id}`, type, data} : data);
      if (ALLOWED[action].includes(role)) {
        assert.ok([200, 201].includes(response.status), `${id}: ${response.body.error?.code}`);
        if (path === '/commands') {
          assert.equal(response.body.event.actorId, actors[role]);
          assert.equal(store.headSequence(roomId), head + 1);
        }
      } else {
        const [status, code] = denialFor(role, action);
        assert.equal(response.status, status, id);
        assert.equal(response.body.error?.code, code, id);
        assert.equal(snapshot(), before, `${id} changed business state`);
      }
      if (['outsider', 'anonymous', 'revoked'].includes(role)) {
        assert.equal(JSON.stringify(response.body).includes('PRIVATE-TASK-MARKER'), false, `${id} exposed task content`);
      }
    });
  }
  assert.equal(store.db.prepare('SELECT count(*) n FROM work_claims').get().n, 0);
  assert.doesNotThrow(() => auditRecovery(store));
});
