import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [checkout, dependencies] = process.argv.slice(2); assert.equal(process.argv.length, 4);
const git = process.env.LOCAL_LAB_GIT ?? 'git', pin = '1084460ddcf6d22d36aeb6e8deed24e91e6ba927';
assert.equal(execFileSync(git, ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pin);
execFileSync(git, ['-C', checkout, 'diff', '--exit-code', 'HEAD', '--']);
const require = createRequire(dependencies + '/cloudflare/package.json');
const { build } = await import(pathToFileURL(require.resolve('esbuild'))), { Miniflare } = await import(pathToFileURL(require.resolve('miniflare')));
const contents = await readFile(new URL('./sponsor_transfer_restore_fixture.mjs', import.meta.url), 'utf8');
const script = (await build({ stdin: { contents, resolveDir: checkout + '/cloudflare', sourcefile: 'sponsor-transfer-restore-fixture.mjs' }, bundle: true, write: false, format: 'esm', platform: 'neutral', nodePaths: [dependencies + '/node_modules', dependencies + '/cloudflare/node_modules'], external: ['node:*', 'cloudflare:*'] })).outputFiles[0].text;
const directory = await mkdtemp(join(tmpdir(), 'native-sponsor-restore-')), operator = 'synthetic-sponsor-restore-000000000000000000', origin = 'https://room.example';
const create = () => new Miniflare({ modules: true, script, compatibilityDate: '2026-07-30', compatibilityFlags: ['nodejs_compat'], durableObjectsPersist: join(directory, 'do'), kvPersist: join(directory, 'kv'), durableObjects: { ROOM: { className: 'SponsorRestoreRoom', useSQLite: true } }, kvNamespaces: ['ROOM_BACKUPS_KV'], bindings: { ROOM_ORIGIN: origin, ROOM_RESTORE_TOKEN: operator }, serviceBindings: { ASSETS: async () => new Response('Not found', { status: 404 }) } });
let mf = create();
const call = (surface, path, options = {}) => { const u = new URL(path, origin); u.searchParams.set('surface', surface); return mf.dispatchFetch(u.href, options); };
const json = async (surface, path, expected, options) => { const r = await call(surface, path, options), body = await r.json(); assert.equal(r.status, expected, 'Fixture HTTP ' + r.status + ' code=' + (body.error?.code ?? body.error ?? 'none')); return body; };
const postRestore = async (body, encoded = false, query = '') => {
  const r = await call('target', '/api/operator/restore' + query, { method: 'POST', headers: { Authorization: 'Bearer ' + operator, ...(encoded ? { 'Content-Type': 'application/json' } : {}) }, body: encoded ? JSON.stringify(body) : body });
  const value = await r.json(); assert.ok([200, 202].includes(r.status), 'Restore HTTP ' + r.status + ' code=' + (value.error?.code ?? 'none'));
  console.log('SPONSOR_RESTORE_STEP ' + JSON.stringify({ status: r.status, phase: value.phase ?? null, revision: value.revision ?? null }));
  return { status: r.status, value };
};
const result = { source: pin, tree: execFileSync(git, ['-C', checkout, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(), node: process.version, scope: 'Actual local Native full restore of a transferred managed seat with old/new/unrelated OAuth grants. No production, hosted limits, release or peer-execution claim.' };
try {
  await json('source', '/__seed', 200);
  const exported = await json('source', '/__export', 200);
  assert.ok(Object.values(exported.security).every(v => v === true));
  result.backupBytes = Buffer.byteLength(exported.body); result.backupSha256 = createHash('sha256').update(exported.body).digest('hex'); result.sourceSecurity = exported.security; result.sourceTables = exported.tables; result.sourceEnumeration = exported.enumeration;
  await mf.dispose(); mf = create();
  await json('target', '/__adopt-fixture', 200, { method: 'POST', body: JSON.stringify(exported.fixture) });
  let step = await postRestore(exported.body); assert.equal(step.status, 202); assert.equal(step.value.pending, true);
  await json('target', '/api/ready', 503); result.partialReadinessRefused = true;
  await mf.dispose(); mf = create();
  const resumed = await postRestore(exported.body, false, '?resume=1'); assert.equal(resumed.status, 202); assert.deepEqual(resumed.value, step.value); result.exactColdSourceResume = true; step = resumed;
  let calls = 0, cleanupCalls = 0, publication; const seen = new Set();
  while (step.value.pending === true || step.value.cleanupComplete === false) {
    const previous = await json('target', '/__frontier', 200); let input;
    if (step.value.pending) input = { restoreId: step.value.restoreId, sourceSeal: step.value.sourceSeal, expectedRevision: step.value.revision, requestId: 'sponsor_restore_' + calls };
    else { assert.equal(step.value.verified, true); publication ??= step.value; assert.equal(step.value.nextCleanup?.method, 'POST'); input = step.value.nextCleanup.body; cleanupCalls++; }
    step = await postRestore(input, true); assert.ok(++calls < 20000, 'Finite diagnostic budget');
    if (step.value.pending) { const next = await json('target', '/__frontier', 200); assert.notEqual(next.sha256, previous.sha256, 'Actual frontier must advance'); assert.equal(seen.has(next.sha256), false, 'Actual frontier must not cycle'); seen.add(next.sha256); }
    if (step.value.verified) publication ??= step.value;
  }
  assert.equal(publication.verified, true); assert.equal(publication.audit.ok, true); assert.equal(step.value.cleanupComplete, true); assert.equal(step.value.cleanup.remaining, 0); assert.equal(step.value.cleanup.verifiedGuardCount, 0);
  result.restore = { calls, cleanupCalls, uniqueFrontiers: seen.size, diagnosticBudget: 20000, verified: true, auditOk: true, contentVerification: publication.contentVerification, cleanupComplete: true };
  await mf.dispose(); mf = create(); await json('target', '/api/ready', 200);
  const restored = await json('target', '/__snapshot', 200); assert.deepEqual(restored.tables, exported.tables); assert.deepEqual(restored.member, exported.member); assert.deepEqual(restored.security, exported.security); assert.equal(restored.restore.state, 'clear'); assert.equal(restored.frozenGuards, 0);
  result.allElevenTableFingerprintsPreserved = true; result.sameSeatIdentityPermissionsSponsorPreserved = true; result.restoredSecurity = restored.security; result.admissionClear = true; result.restoredEnumeration = restored.enumeration; assert.deepEqual(restored.enumeration, exported.enumeration);
  result.exercise = await json('target', '/__exercise', 200); assert.ok(Object.values(result.exercise).every(v => v === true));
  const kv = await mf.getKVNamespace('ROOM_BACKUPS_KV'); assert.equal((await kv.list({ prefix: 'room-restore-sources/' })).keys.length, 0); result.sourceKvClean = true;
} finally { await mf.dispose(); await rm(directory, { recursive: true, force: true }); }
execFileSync(git, ['-C', checkout, 'diff', '--exit-code', 'HEAD', '--']);
console.log('SPONSOR_TRANSFER_NATIVE_RESTORE ' + JSON.stringify(result));
