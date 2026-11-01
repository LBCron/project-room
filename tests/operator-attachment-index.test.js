import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { createRoomServer } from '../server/http.mjs';

const TOKEN = 'synthetic-attachment-index-operator-0123456789';
async function fixture(t) {
  const prior = process.env.ROOM_OPERATOR_TOKEN_SHA256;
  process.env.ROOM_OPERATOR_TOKEN_SHA256 = createHash('sha256').update(TOKEN).digest('hex');
  const store = new RoomStore(':memory:'); store.initialize(initialRoom());
  const server = createRoomServer({ store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close();
    if (prior === undefined) delete process.env.ROOM_OPERATOR_TOKEN_SHA256; else process.env.ROOM_OPERATOR_TOKEN_SHA256 = prior;
  });
  const call = async (phase, input = {}, token = TOKEN) => {
    const response = await fetch(origin + '/api/operator/attachments/live-index/' + phase, { method: 'POST',
      headers: { origin, 'content-type': 'application/json', ...(token ? { authorization: 'Operator ' + token } : {}) },
      body: JSON.stringify({ reason: 'Synthetic bounded attachment qualification', ...input }) });
    return { status: response.status, body: await response.json() };
  };
  return { store, call };
}
test('attachment index is an explicit operator action, absent on ordinary startup', async t => {
  const f = await fixture(t);
  const installed = () => Boolean(f.store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='room_attachments_live'").get());
  assert.equal(installed(), false);
  assert.equal((await f.call('plan', {}, null)).status, 404);
  const plan = await f.call('plan'); assert.equal(plan.status, 200, JSON.stringify(plan.body));
  assert.equal(plan.body.scope, 'database'); assert.equal(installed(), false);
  const done = await f.call('execute', { requestId: 'install-once', planHash: plan.body.planHash });
  assert.equal(done.status, 200, JSON.stringify(done.body)); assert.equal(installed(), true);
});
test('quota and expiry explicitly constrain live rows without changing attachment quantities', t => {
  const store = new RoomStore(':memory:'); t.after(() => store.close()); store.initialize(initialRoom());
  const key = store.issueAccessKey('commons', 'owner'), queries = [], prepare = store.db.prepare.bind(store.db);
  store.db.prepare = sql => { queries.push(sql); return prepare(sql); };
  store.roomAttachments.stage(key, 'commons', { id: 'first', filename: 'x.txt', mediaType: 'text/plain', data: 'eA==' });
  const quota = queries.find(sql => sql.includes('AS roomBytes'));
  assert.match(quota, /WHERE room_id=\? AND state IN \('staged','committed'\)/);
  const expiry = queries.find(sql => sql.includes("SET state='expired'"));
  assert.match(expiry, /state IN \('staged','committed'\)/);
});
