// Regression for the #5953 follow-up: an incomplete page from a scoped
// collectNeedsMe call must keep roomId in nextRead, so an agent that
// follows nextRead verbatim stays in the room it asked about instead of
// continuing into its other rooms. Unscoped calls keep nextRead as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoomStore } from '../server/store.mjs';
import { AgentRooms } from '../server/agent-rooms.mjs';
import { collectNeedsMe } from '../server/needs-me.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'scoped-next-read-'));
  const s = new RoomStore(join(dir, 'room.sqlite'));
  t.after(() => { s.close(); rmSync(dir, { recursive: true, force: true }); });
  const owner = s.identities.create('Olive');
  const peer = s.identities.create('Parker');
  const rooms = new AgentRooms(s);
  for (const roomId of ['scope-a', 'scope-b']) {
    rooms.create(owner.secret, { roomId, title: roomId, purpose: 'Scoped nextRead', starter: false });
    s.invites.redeem(s.invites.create(owner.secret, roomId, { profile: 'member' }).code,
      { identitySecret: peer.secret, displayName: 'Parker' });
  }
  const send = (room, id, type, data) => s.command(owner.secret, room, { id, type, data });
  // Room A: more filtered decoys than the drain bound, so its first page is incomplete.
  for (let i = 0; i < 12; i++) {
    send('scope-a', 'decoy-' + i, 'work.proposed', {
      workItemId: 'aaa-decoy-' + String(i).padStart(2, '0'), title: 'Decoy ' + i, definitionOfDone: 'Saved',
      accountableMemberId: peer.identityId, verifierMemberId: owner.identityId, mode: 'read',
    });
  }
  send('scope-a', 'starter-a', 'work.proposed', {
    workItemId: 'starter-a', title: 'Room A work', definitionOfDone: 'Saved',
    accountableMemberId: owner.identityId, mode: 'read',
  });
  // Room B: addressed work that a scoped room A read must never surface.
  send('scope-b', 'starter-b', 'work.proposed', {
    workItemId: 'starter-b', title: 'Room B work', definitionOfDone: 'Saved',
    accountableMemberId: owner.identityId, mode: 'read',
  });
  return { s, owner };
}

test('scoped incomplete page keeps roomId in nextRead and following it stays in that room', t => {
  const f = fixture(t);
  let page = collectNeedsMe(f.s, f.owner.secret, { roomId: 'scope-a' });
  assert.equal(page.hasMore, true, 'fixture must produce an incomplete scoped page');
  const seen = [...page.items];
  for (let n = 0; n < 50 && page.hasMore; n++) {
    assert.equal(page.nextRead?.arguments?.roomId, 'scope-a', 'scoped continuation must keep roomId');
    page = collectNeedsMe(f.s, f.owner.secret, page.nextRead.arguments);
    seen.push(...page.items);
  }
  assert.equal(page.complete, true);
  assert.ok(seen.some(x => x.id === 'starter-a'), 'room A work is found');
  assert.ok(!seen.some(x => x.id === 'starter-b' || x.roomId === 'scope-b'), 'room B never appears in a room A read');
});

test('unscoped nextRead carries no roomId', t => {
  const f = fixture(t);
  const page = collectNeedsMe(f.s, f.owner.secret);
  if (page.hasMore) assert.equal(page.nextRead.arguments.roomId, undefined);
  else assert.equal(page.nextRead, undefined);
});
