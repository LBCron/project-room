// Compare the same owner-only offer journey on both room representations.
// Synthetic in-memory data, loopback HTTP only; no browser automation.
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
const { values } = parseArgs({ options: {
  repo: { type: 'string' }, source: { type: 'string' }, git: { type: 'string', default: 'git' },
  'expect-parity': { type: 'boolean', default: false }
} });
if (!values.repo || !/^[a-f0-9]{40}$/.test(values.source ?? '')) {
  throw Error('Usage: node project-offer-representation-probe.mjs --repo PATH --source FULL_SHA [--git PATH] [--expect-parity]');
}
const repo = resolve(values.repo), pin = values.source, git = values.git;
if (execFileSync(git, ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== pin) throw Error('Unexpected source revision');
execFileSync(git, ['-C', repo, 'diff', '--exit-code', 'HEAD', '--']);
const load = p => import(pathToFileURL(`${repo}/${p}`));
const [{ RoomStore }, { initialRoom }, { createRoomServer }] = await Promise.all([
  load('server/store.mjs'), load('server/bootstrap.mjs'), load('server/http.mjs')
]);
const results = [];
for (const representation of ['legacy', 'normalized-current-v1']) {
  const store = new RoomStore(':memory:');
  store.initialize(initialRoom(), representation === 'legacy' ? {} : { representation });
  const key = store.issueAccessKey('commons', 'owner');
  const server = createRoomServer({ store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const input = { requestId: 'local-create', offerId: 'local-offer', reviewerMemberIds: ['owner'],
    terms: { kind: 'task', title: 'Local check', summary: 'Synthetic offer', acceptanceCriteria: ['Reopen the result'],
      reward: { kind: 'unpaid' }, approvalPolicy: { mode: 'human' }, submissionUrl: 'https://example.invalid/result' } };
  const call = (method, body) => fetch(`${origin}/api/rooms/commons/project-offers`, {
    method, headers: { Origin: origin, Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  try {
    const get = await call('GET'); const getBody = await get.json();
    const post = await call('POST', input); const postBody = await post.json();
    const rowCount = store.db.prepare('SELECT count(*) AS n FROM project_offers').get().n;
    results.push({ representation, get: { status: get.status, code: getBody.error?.code ?? null },
      post: { status: post.status, code: postBody.error?.code ?? null, state: postBody.status ?? null }, rowCount,
      inputSha256: createHash('sha256').update(JSON.stringify(input)).digest('hex') });
  } finally {
    server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close();
  }
}
const parity = results.every(r => r.get.status === 200 && r.post.status === 201 && r.post.state === 'draft' && r.rowCount === 1);
console.log(JSON.stringify({ source: pin, expectParity: values['expect-parity'], parity, results }, null, 2));
if (values['expect-parity'] && !parity) process.exitCode = 1;
