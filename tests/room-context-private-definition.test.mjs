import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { createAcceptanceFixture } from '../scripts/acceptance-fixture.mjs';
import { createRoomServer } from '../server/http.mjs';

test('composed context preserves the same private definition boundary as default orientation', async t => {
  const f = createAcceptanceFixture();
  const server = createRoomServer({ store: f.store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    f.store.close(); rmSync(f.directory, { recursive: true, force: true }); });
  const send = (type, data) => f.store.command(f.keys.owner, 'commons', { id: crypto.randomUUID(), type, data });
  send('member.added', { memberId: 'observer', displayName: 'Observer agent', kind: 'agent', permissions: [] });
  const observer = f.store.issueAccessKey('commons', 'observer');
  send('work.proposed', { workItemId: 'private-brief', title: 'PRIVATE-TITLE-SENTINEL',
    definitionOfDone: 'PRIVATE-DONE-SENTINEL', accountableMemberId: 'producer', independentVerificationRequired: false, ownerDecisionRequired: false });
  f.store.dmConsents.request('commons', 'owner', 'producer', 'Synthetic private brief');
  f.store.dmConsents.decide('commons', 'producer', 'owner', 'approve');
  send('message.posted', { messageId: 'private-question', toMemberId: 'producer', workItemId: 'private-brief',
    requestKind: 'reply', body: 'PRIVATE-BODY-SENTINEL' });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const read = async path => {
    const response = await fetch(origin + path, { headers: { Authorization: `Bearer ${observer}` } });
    assert.equal(response.status, 200); return response.json();
  };
  const orientation = await read('/api/rooms/commons?view=orientation');
  assert.equal(orientation.state.workItems['private-brief'].title, null);
  assert.equal(orientation.state.workItems['private-brief'].definitionOfDone, null);
  const context = await read('/api/rooms/commons/context');
  const pathsOf = (value, sentinel, path = '') => {
    if (value === sentinel) return [path];
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, child]) => pathsOf(child, sentinel, path + '/' + key));
  };
  const findings = ['PRIVATE-TITLE-SENTINEL', 'PRIVATE-DONE-SENTINEL', 'PRIVATE-BODY-SENTINEL']
    .map(sentinel => ({ sentinel, paths: pathsOf(context, sentinel) }));
  t.diagnostic(JSON.stringify({ surface: 'composed context', findings }));
  assert.deepEqual(findings.filter(finding => finding.paths.length), [], 'private work definition must not reappear through composed context');
});
