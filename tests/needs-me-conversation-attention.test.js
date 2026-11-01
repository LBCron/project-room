// RES-1538 (reply-alert): needs-me misses conversation attention.
//
// (a) A reply to one's own post carrying no @mention and no formal reply
// request had no selection of its own in server/needs-me.mjs. It surfaced
// only through a store write-time side effect (the mention_states reply row
// in trackMentions), which fires solely when the parent author is an
// agent-kind member AND the parent is resident in the live projection at
// reply time. A human-kind seat (below) got no row and no item: the reply
// was invisible. Fixed by a first-class "reply" kind selected from the
// event log, the way roomDmsOf selects DMs.
//
// (b) The mention scan window (mentionHorizon) counted raw mention_states
// rows, including rows openDirectMentions itself discards: deleted/redacted
// messages, and timed_out rows the member already answered or
// late-acknowledged. With a provided cursor, dead rows consumed the whole
// 100-row window: the read returned a window ending before live mentions
// newer than the cursor, the returned cursor sat ahead of the returned
// items, and hasMore was true. Live shape (Jill's seat, muse-room,
// 2026-10-31): window seq 15210-16196, cursor 16269, hasMore=true, newer
// mentions unreturned. Fixed by counting only selection-eligible rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { AgentRooms } from '../server/agent-rooms.mjs';
import { collectNeedsMe, roomAttention } from '../server/needs-me.mjs';
import { setTier } from '../server/autonomy-tiers.mjs';
import { linkWithProof } from "./helpers/link-with-proof.mjs";

function setup(t, roomId) {
  const store = new RoomStore(':memory:');
  let clock = Date.now();
  store.now = () => (clock += 2100); // stay under the chat flood guard
  t.after(() => store.close());
  const rooms = new AgentRooms(store);
  const ada = store.identities.create('Ada');
  const bob = store.identities.create('Bob');
  const owner = store.identities.create('OwnerC');
  rooms.create(owner.secret, { roomId, title: roomId, purpose: 'Conversation attention', kind: 'personal' });
  linkWithProof(store, owner.secret, roomId, ada, { displayName: 'Ada', permissions: [] });
  linkWithProof(store, owner.secret, roomId, bob, { displayName: 'Bob', permissions: [] });
  setTier(store.db, roomId, bob.identityId, 't2_standard', { updatedBy: 'owner', nowMs: Date.now() });
  return { store, ada, bob, owner, roomId, advanceClock: ms => { clock += ms; } };
}

test('needs-me selects a reply to my post with no mention and no formal request as its own kind', t => {
  const { store, ada, bob, owner, roomId } = setup(t, 'conv-reply');
  // A human-kind seat: trackMentions writes no reply row for this member, so
  // at the pre-fix head nothing selected the reply at all.
  store.command(owner.secret, roomId, { id: 'add-maya', type: 'member.added', data: { memberId: 'maya', displayName: 'Maya', kind: 'human', permissions: [] } });
  const maya = store.identities.create('Maya');
  store.db.prepare("INSERT INTO identity_links(room_id, identity_id, member_id, linked_at) VALUES(?,?,?,?)")
    .run(roomId, maya.identityId, 'maya', Date.now());
  const post = (secret, id, data) => store.command(secret, roomId, { id, type: 'message.posted', data: { messageId: id, ...data } });
  post(maya.secret, 'maya-post', { body: 'Maya original post' });
  post(bob.secret, 'bob-reply', { body: 'Bob replying in thread, no mention', replyToId: 'maya-post' });
  // Controls that must NOT become reply items for Maya:
  post(bob.secret, 'bob-ask-reply', { body: 'formal ask threaded on the post', replyToId: 'maya-post', toMemberId: 'maya', requestKind: 'reply' });
  post(maya.secret, 'maya-self-reply', { body: 'Maya following up herself', replyToId: 'maya-post' });
  post(bob.secret, 'bob-post', { body: 'Bob original post' });
  post(owner.secret, 'owner-reply-to-bob', { body: 'Owner replying to Bob', replyToId: 'bob-post' });

  const page = collectNeedsMe(store, maya.secret, {});
  const replies = page.items.filter(item => item.kind === 'reply');
  assert.deepEqual(replies.map(item => item.id), ['bob-reply'], 'the plain thread reply is selected as kind "reply"');
  assert.equal(replies[0].roomId, roomId);
  assert.equal(replies[0].replyToId, 'maya-post', 'the reply item names its parent post');
  assert.equal(replies[0].summary, 'Bob replying in thread, no mention');
  assert.equal(replies[0].next.tool, 'room_reply');
  assert.equal(replies[0].next.arguments.replyToId, 'bob-reply');
  // The formal ask still surfaces through its own kinds, never as a reply.
  assert.ok(page.items.some(item => item.id === 'bob-ask-reply' && item.kind !== 'reply'), 'formal reply request keeps its own kind');
  assert.ok(!page.items.some(item => item.id === 'maya-self-reply'), 'own replies are not attention');
  assert.ok(!page.items.some(item => item.id === 'owner-reply-to-bob'), 'replies to another member\'s post are not mine');
  // The room digest shares the same selection.
  const attention = roomAttention(store, roomId, 'maya', maya.identityId, 0);
  assert.ok(attention.some(item => item.kind === 'reply' && item.id === 'bob-reply'), 'roomAttention carries the reply kind');

  // Agent-kind control: the reply row side effect already surfaces Bob's
  // reply to Ada as a mention; the reply kind must not double-list it.
  post(ada.secret, 'ada-post', { body: 'Ada original post' });
  post(bob.secret, 'bob-reply-ada', { body: 'Bob replying to Ada, no mention', replyToId: 'ada-post' });
  const adaPage = collectNeedsMe(store, ada.secret, {});
  const adaHits = adaPage.items.filter(item => item.id === 'bob-reply-ada');
  assert.equal(adaHits.length, 1, 'a reply already surfaced as an open mention is listed once');
  assert.equal(adaHits[0].kind, 'mention');
});

test('needs-me mention window is not consumed by mentions the selection discards', t => {
  const { store, ada, bob, roomId, advanceClock } = setup(t, 'conv-window');
  const post = (secret, id, data) => store.command(secret, roomId, { id, type: 'message.posted', data: { messageId: id, ...data } });
  // 50 dead rows of the timed_out-and-answered class: minimum timeout, let
  // them expire, then Ada answers each in thread (her first answer's
  // trackMentions flips them to timed_out; the terminal state stays).
  // mentionHorizon counted these rows; openDirectMentions discards them
  // (timed_out + hasReply).
  store.db.prepare("INSERT INTO room_mention_settings(room_id, timeout_ms, updated_at) VALUES(?,?,?)")
    .run(roomId, 60_000, Date.now());
  for (let i = 0; i < 50; i++) post(bob.secret, `stale-t-${i}`, { body: `@Ada stale timed mention ${i}` });
  advanceClock(180_000);
  for (let i = 0; i < 50; i++) post(ada.secret, `ada-answer-${i}`, { body: 'answered in thread', replyToId: `stale-t-${i}` });
  // 50 dead rows of the deleted class: mentioned, then deleted.
  for (let i = 0; i < 50; i++) {
    post(bob.secret, `stale-d-${i}`, { body: `@Ada stale deleted mention ${i}` });
    store.command(bob.secret, roomId, { id: `del-d-${i}`, type: 'message.deleted', data: { messageId: `stale-d-${i}`, expectedMessageRevision: 0 } });
  }
  post(bob.secret, 'fresh-mention', { body: '@Ada fresh mention that matters' });
  const head = store.roomAuthority(roomId).sequence;
  const freshSeq = store.db.prepare("SELECT sequence FROM events WHERE room_id=? AND json_extract(body,'$.data.messageId')='fresh-mention'").get(roomId).sequence;

  // A read carrying a provided cursor (the caller's saved position at the
  // room's start) must not return a window that misses the live mention
  // newer than that cursor. At the pre-fix head this returned items=[] with
  // cursor=304 (ahead of the returned window) and hasMore=true.
  const page = collectNeedsMe(store, ada.secret, { since: { rooms: { [roomId]: 0 }, land: {}, landIds: {} } });
  assert.ok(page.items.some(item => item.kind === 'mention' && item.id === 'fresh-mention'),
    `fresh mention (seq ${freshSeq} of head ${head}) is selected on the first read; got ${JSON.stringify(page.items.map(i => i.id))} cursor=${JSON.stringify(page.cursor.rooms)} hasMore=${page.hasMore}`);
  assert.equal(page.hasMore, false, 'the read reached the head truthfully instead of paging through dead rows');
});

test('needs-me cursor chain still enumerates a live mention backlog completely', t => {
  const { store, ada, bob, roomId } = setup(t, 'conv-chain');
  const post = (secret, id, data) => store.command(secret, roomId, { id, type: 'message.posted', data: { messageId: id, ...data } });
  const expected = [];
  for (let i = 0; i < 25; i++) {
    post(bob.secret, `live-${i}`, { body: `@Ada live mention ${i}` });
    expected.push(`live-${i}`);
  }
  const seen = [];
  let since;
  let page;
  for (let count = 0; count < 20; count++) {
    page = collectNeedsMe(store, ada.secret, { since });
    for (const item of page.items) if (item.kind === 'mention') seen.push(item.id);
    since = JSON.parse(JSON.stringify(page.cursor));
    if (!page.hasMore) break;
  }
  assert.equal(page.hasMore, false, 'continuation finishes');
  assert.deepEqual(seen.sort(), expected.sort(), 'every live mention is enumerated exactly once across the chain');
});
