// Issue 5759 acceptance, intentionally red on the unrepaired normalized reader.
// Independent HTTP consumers; writer/proof/Worker qualification lives elsewhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoomStore } from '../server/store.mjs';
import { createRoomServer } from '../server/http.mjs';
import { seedScopedInbox } from './helpers/scoped-inbox-source.mjs';

const bodies = [
  ['CJK', '界'.repeat(65536)],
  // Offset the first surrogate pair by one UTF-16 unit, preserving the limit.
  ['astral', '界' + '🪷'.repeat(32767) + '界']
];

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'large-http-consumers-'));
  const filename = join(directory, 'room.sqlite');
  let store = new RoomStore(filename), server, clock = Date.now() + 10000;
  const saved = seedScopedInbox(store);
  const keys = { owner: saved.owner, worker: saved.token, other: store.issueAccessKey('commons', 'other') };
  const open = async () => {
    store.now = () => clock;
    store.room = () => { throw new Error('Consumer must not hydrate the whole room'); };
    server = createRoomServer({ store });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  };
  const close = async () => {
    server.closeStreams(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  };
  await open();
  t.after(async () => { await close(); store.close(); rmSync(directory, { recursive: true, force: true }); });
  const call = async (actor, path, data) => {
    if (data !== undefined) clock += 3000;
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(origin + '/api/rooms/commons' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, authorization: 'Bearer ' + keys[actor],
        ...(data === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    return { status: response.status, value: await response.json() };
  };
  const command = (id, type, data) => call('owner', '/commands', { id, type, data });
  return {
    call, command, head: () => store.headSequence('commons'),
    async reopen() { await close(); store.close(); store = new RoomStore(filename); await open(); }
  };
}

function status(response, expected, context) {
  assert.equal(response.status, expected, `${context}: ${response.value.error?.code ?? 'unexpected response'}`);
}
function exactBody(actual, expected, context) {
  assert.equal(typeof actual, 'string', context);
  assert.equal(actual.length, expected.length, context + ' UTF-16 length');
  assert.ok(actual === expected, context + ' must preserve every UTF-16 unit');
}
async function denyNonparty(f) {
  const before = f.head();
  for (const path of ['/conversation?messageId=consumer-large', '/messages/consumer-large/thread']) {
    const denied = await f.call('other', path);
    status(denied, 404, 'Nonparty selected read');
    assert.equal(denied.value.error.code, 'message_not_found');
  }
  const deniedPin = await f.call('other', '/pins', { messageId: 'consumer-large', pinned: true, requestId: 'nonparty-pin' });
  status(deniedPin, 404, 'Nonparty pin action');
  assert.equal(deniedPin.value.error.code, 'message_not_found');
  assert.equal(f.head(), before, 'Denied actions must not append anything');
}
async function postLarge(f, body) {
  assert.equal(body.length, 65536);
  const posted = await f.command('post-consumer-large', 'message.posted', {
    messageId: 'consumer-large', body, toMemberId: 'worker'
  });
  status(posted, 201, 'Maximum-length message accepted through real HTTP');
  await f.reopen();
  await denyNonparty(f);
}

for (const [label, body] of bodies) {
  test(`accepted 65536-unit ${label} DM remains current in the cold recent HTTP inbox`, async t => {
    const f = await fixture(t);
    await postLarge(f, body);
    const before = f.head(), page = await f.call('worker', '/agent-inbox?limit=1');
    status(page, 200, 'Recipient recent inbox must deliver the accepted message');
    assert.deepEqual(page.value.directMessages.map(row => row.messageId), ['consumer-large']);
    exactBody(page.value.directMessages[0].body, body, 'Recent inbox accepted body');
    assert.equal(f.head(), before, 'Inbox read must not acknowledge or write');
    const hidden = await f.call('other', '/agent-inbox?limit=1');
    status(hidden, 200, 'Nonparty recent inbox');
    assert.ok(!JSON.stringify(hidden.value).includes('consumer-large'));
    assert.ok(!JSON.stringify(hidden.value).includes(body.slice(0, 64)));

    status(await f.command('edit-consumer-large', 'message.edited', {
      messageId: 'consumer-large', expectedMessageRevision: 0, body: 'Current replacement'
    }), 201, 'Author edit');
    await f.reopen();
    const edited = await f.call('worker', '/agent-inbox?limit=1');
    status(edited, 200, 'Inbox must not rehydrate the oversized obsolete opening body');
    exactBody(edited.value.directMessages.find(row => row.messageId === 'consumer-large')?.body,
      'Current replacement', 'Inbox current edited body');
    await denyNonparty(f);
    status(await f.command('delete-consumer-large', 'message.deleted', {
      messageId: 'consumer-large', expectedMessageRevision: 1
    }), 201, 'Author deletion');
    await f.reopen();
    const deleted = await f.call('worker', '/agent-inbox?limit=1');
    status(deleted, 200, 'Inbox after deletion');
    assert.ok(!deleted.value.directMessages.some(row => row.messageId === 'consumer-large'));
    await denyNonparty(f);
    t.diagnostic(JSON.stringify({ utf16Units: body.length, utf8Bytes: Buffer.byteLength(body), consumer: 'recent-inbox' }));
  });

  test(`accepted 65536-unit ${label} DM supports cold HTTP pin/edit/unpin lifecycle`, async t => {
    const f = await fixture(t);
    await postLarge(f, body);
    const pinned = await f.call('worker', '/pins', { messageId: 'consumer-large', pinned: true, requestId: 'pin-consumer-large' });
    status(pinned, 201, 'Recipient must be able to pin an accepted message');
    exactBody(pinned.value.pins.find(pin => pin.messageId === 'consumer-large')?.body, body, 'Pin save current body');
    await f.reopen();
    const before = f.head(), listed = await f.call('worker', '/pins');
    status(listed, 200, 'Cold pinned message');
    assert.deepEqual(listed.value.pins.map(pin => pin.messageId), ['consumer-large']);
    exactBody(listed.value.pins[0].body, body, 'Cold pin current body');
    const hidden = await f.call('other', '/pins');
    status(hidden, 200, 'Hidden pin must not expose a body-dependent failure');
    assert.deepEqual(hidden.value.pins, []);
    assert.equal(f.head(), before, 'Pin reads must not write');

    status(await f.command('edit-consumer-large', 'message.edited', {
      messageId: 'consumer-large', expectedMessageRevision: 0, body: 'Current pinned replacement'
    }), 201, 'Author edit of pinned message');
    await f.reopen();
    const edited = await f.call('worker', '/pins');
    status(edited, 200, 'Cold pin after edit');
    exactBody(edited.value.pins.find(pin => pin.messageId === 'consumer-large')?.body,
      'Current pinned replacement', 'Pin must expose current body');
    await denyNonparty(f);
    const unpinned = await f.call('worker', '/pins', { messageId: 'consumer-large', pinned: false, requestId: 'unpin-consumer-large' });
    status(unpinned, 201, 'Recipient unpin');
    assert.deepEqual(unpinned.value.pins, []);
    await f.reopen();
    assert.deepEqual((await f.call('worker', '/pins')).value.pins, []);
    t.diagnostic(JSON.stringify({ utf16Units: body.length, utf8Bytes: Buffer.byteLength(body), consumer: 'pins' }));
  });
}
