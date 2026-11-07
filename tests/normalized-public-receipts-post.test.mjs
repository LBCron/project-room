import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event, EVENT_TYPES as T} from '../src/events.js';
import {auditRecovery} from '../server/recovery.mjs';
import {createRoomServer} from '../server/http.mjs';
import {textVersion} from '../server/text-results.mjs';
import {publicWorkItemReceiptId} from '../server/public-read-model.mjs';

// QA Round 1 defect 5: after room.public_receipts_set succeeds on a
// normalized room, the next plain message.posted refused 409
// current_room_context_unavailable ("Published/starter room dependencies
// require qualification"). Chat posts neither read nor change receipts.
function room(t) {
  const s = new RoomStore(':memory:'); t.after(() => s.close());
  const log = initialRoom();
  log.push(event({roomId: 'commons', actorId: 'owner', type: T.MEMBER_ADDED, data: {memberId: 'agent', displayName: 'Agent', kind: 'agent', permissions: ['steer']}}));
  s.initialize(log, {representation: 'normalized-current-v1'});
  return {s, owner: s.issueAccessKey('commons', 'owner'), agent: s.issueAccessKey('commons', 'agent')};
}

test('a receipts-on normalized room accepts plain and mention posts and stays replay-exact', t => {
  const {s, owner, agent} = room(t);
  s.command(owner, 'commons', {id: 'receipts-on', type: T.ROOM_PUBLIC_RECEIPTS_SET, data: {enabled: true}});
  const receiptsBefore = s.db.prepare('SELECT count(*) n FROM public_receipts').get().n;
  s.command(owner, 'commons', {id: 'plain', type: T.MESSAGE_POSTED, data: {messageId: 'plain', body: 'hello after opt-in'}});
  s.command(agent, 'commons', {id: 'mention', type: T.MESSAGE_POSTED, data: {messageId: 'mention', body: '@Agent noted, thanks'}});
  assert.equal(s.db.prepare('SELECT count(*) n FROM public_receipts').get().n, receiptsBefore);
  assert.doesNotThrow(() => auditRecovery(s));
});

test('commands outside the qualified chain in a receipts-on room still need qualification', t => {
  const {s, owner} = room(t);
  s.command(owner, 'commons', {id: 'receipts-on', type: T.ROOM_PUBLIC_RECEIPTS_SET, data: {enabled: true}});
  assert.throws(() => s.command(owner, 'commons', {id: 'ch', type: 'channel.created', data: {channelId: 'side', name: 'side'}}),
    err => err.code === 'current_room_context_unavailable');
});

// QA Round 1 defect 6: a normalized room that opted in could not run work,
// and a completed item never got a public row, so publicId stayed null and
// the anonymous receipt URL 404'd.
test('normalized receipts-on room: completion publishes one public receipt; opt-out withdraws it', async t => {
  const s = new RoomStore(':memory:'); t.after(() => s.close());
  const log = initialRoom();
  log.push(event({roomId: 'commons', actorId: 'owner', type: T.MEMBER_ADDED, data: {memberId: 'worker', displayName: 'Worker', kind: 'agent', permissions: ['accept_work', 'complete_work']}}));
  s.initialize(log, {representation: 'normalized-current-v1'});
  const keys = {owner: s.issueAccessKey('commons', 'owner'), worker: s.issueAccessKey('commons', 'worker')};
  const cmd = (who, id, type, data) => s.command(keys[who], 'commons', {id, type, data});
  const rev = id => JSON.parse(s.db.prepare('SELECT body FROM work_entities WHERE work_id=?').get(id).body).revision;
  cmd('owner', 'receipts-on', T.ROOM_PUBLIC_RECEIPTS_SET, {enabled: true});
  cmd('owner', 'p', 'work.proposed', {workItemId: 'task', title: 'Publish me', definitionOfDone: 'Saved', accountableMemberId: 'worker', mode: 'read'});
  cmd('worker', 'a', 'work.accepted', {workItemId: 'task', expectedRevision: 0});
  cmd('worker', 's', 'work.started', {workItemId: 'task', expectedRevision: rev('task')});
  const body = 'Result text', post = cmd('worker', 'result', 'message.posted', {messageId: 'result', body, workItemId: 'task'});
  cmd('worker', 'c', 'work.completed', {workItemId: 'task', expectedRevision: rev('task'), evidenceKind: 'room_text', evidenceMessageId: 'result',
    evidenceMessageEventId: post.event.id, evidenceVersion: textVersion(body), previousCompletionEventId: null, producerId: 'worker', summary: 'Saved', nextAction: 'Review'});
  const id = publicWorkItemReceiptId('commons', 'task');
  const row = s.db.prepare('SELECT title, source, verification_state AS v, agents_json AS agents FROM public_receipts WHERE id=?').get(id);
  assert.deepEqual({title: row?.title, source: row?.source, v: row?.v}, {title: 'Publish me', source: 'work-item', v: 'room_recorded'});
  assert.match(row.agents, /Worker/);
  assert.equal(s.db.prepare("SELECT enabled FROM room_public_receipts_setting WHERE room_id='commons'").get()?.enabled, 1);
  assert.doesNotThrow(() => auditRecovery(s));

  const server = createRoomServer({store: s});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const live = await fetch(`${origin}/receipts/${id}.json`);
  assert.equal(live.status, 200, await live.clone().text());
  assert.equal((await live.json()).title, 'Publish me');

  cmd('owner', 'receipts-off', T.ROOM_PUBLIC_RECEIPTS_SET, {enabled: false});
  assert.equal(s.db.prepare('SELECT count(*) n FROM public_receipts WHERE id=?').get(id).n, 0);
  assert.equal((await fetch(`${origin}/receipts/${id}.json`)).status, 404);
  assert.doesNotThrow(() => auditRecovery(s));
});
