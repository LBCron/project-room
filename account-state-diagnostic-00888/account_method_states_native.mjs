import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectAccountState, openReadOnlySnapshot, SOURCE_PIN } from './account_state_diagnostic.mjs';

const [checkout, dependencies] = process.argv.slice(2); assert.equal(process.argv.length, 4);
const git = process.env.LOCAL_LAB_GIT ?? 'git';
assert.equal(execFileSync(git, ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), SOURCE_PIN);
execFileSync(git, ['-C', checkout, 'diff', '--exit-code', 'HEAD', '--']);
const require = createRequire(dependencies + '/cloudflare/package.json');
const { build } = await import(pathToFileURL(require.resolve('esbuild')));
const { Miniflare } = await import(pathToFileURL(require.resolve('miniflare')));
const kinds = ['magic-only', 'disabled-password-with-magic'];
const fixture = `
import {ProjectRoom} from './room.mjs';
import {hashPassword} from '../src/password-auth.mjs';
export class MethodStateRoom extends ProjectRoom {
 async fetch(request) {
  const u=new URL(request.url),kind=u.searchParams.get('kind');
  if(u.pathname==='/__seed') {
   if(!['magic-only','disabled-password-with-magic'].includes(kind))throw Error('Unknown fixture');
   const s=this.store,id='state-'+kind,email=kind+'-native-canary@example.invalid';s.createAccount(id);
   let password;if(kind!=='magic-only')password=s.accountLogins.linkPasswordMethod(id,{email,verifier:hashPassword('synthetic-original-password')});
   s.accountLogins.linkMagicMethod(id,{email});
   if(password)s.accountLogins.setMethodDisabled(id,password.id,true);
   s.db.exec('CREATE TABLE diagnostic_readonly_probe(value INTEGER); INSERT INTO diagnostic_readonly_probe VALUES(1)');
   return Response.json({seeded:true});
  }
  if(u.pathname==='/__state')return Response.json({accountCount:this.store.db.prepare('SELECT count(*) AS n FROM accounts').get().n});
  return super.fetch(request);
 }
}
export default {fetch(request,env){const u=new URL(request.url),surface=u.searchParams.get('surface');if(!['magic-only','disabled-password-with-magic'].includes(surface))throw Error('Unknown surface');u.searchParams.delete('surface');const h=new Headers(request.headers);h.set('Host','room.example');return env.ROOM.getByName(surface).fetch(new Request(u,{method:request.method,headers:h,...(!['GET','HEAD'].includes(request.method)?{body:request.body}:{})}));}};`;
const script = (await build({ stdin: { contents: fixture, resolveDir: checkout + '/cloudflare', sourcefile: 'account-method-state-fixture.mjs' }, bundle: true, write: false, format: 'esm', platform: 'neutral', nodePaths: [dependencies + '/node_modules', dependencies + '/cloudflare/node_modules'], external: ['node:*', 'cloudflare:*'] })).outputFiles[0].text;
const directory = await mkdtemp(join(tmpdir(), 'account-method-states-')), origin = 'https://room.example', sent = [], results = [];
const create = () => new Miniflare({ modules: true, script, compatibilityDate: '2026-07-30', compatibilityFlags: ['nodejs_compat'], durableObjectsPersist: join(directory, 'do'), durableObjects: { ROOM: { className: 'MethodStateRoom', useSQLite: true } }, bindings: { ROOM_ORIGIN: origin, RESEND_API_KEY: 'synthetic-fixture-not-a-real-key', ROOM_MAGIC_FROM: 'Local Fixture <noreply@example.invalid>' }, serviceBindings: { ASSETS: async () => new Response('Not found', { status: 404 }) }, outboundService: async request => { assert.equal(request.url, 'https://api.resend.com/emails'); assert.equal(request.method, 'POST'); sent.push(await request.json()); return Response.json({ id: 'synthetic-intercepted-delivery' }); } });
let mf = create(), surface;
const request = (path, options = {}) => { const u = new URL(path, origin); u.searchParams.set('surface', surface); const headers = new Headers(options.headers); headers.set('Origin', origin); headers.set('x-room-visitor-ip', '192.0.2.9'); return mf.dispatchFetch(u.href, { ...options, headers }); };
const open = async () => { const r = await request('/api/account-session'); assert.equal(r.status, 200); return { token: /account_session=([^;]+)/.exec(r.headers.get('set-cookie'))[1], view: await r.json() }; };
const post = async (steps, label, path, slot, payload, expected) => { const r = await request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: '__Host-account_session=' + slot.token, 'X-CSRF-Token': slot.view.csrf }, body: JSON.stringify(payload) }); const value = await r.json(); steps.push({ label, status: r.status, ...(value.error ? { error: value.error.code } : {}), ...(value.status ? { responseStatus: value.status } : {}) }); assert.equal(r.status, expected, label + ': ' + (value.error?.code ?? value.status ?? 'unexpected response')); return value; };
const latestCode = purpose => { const urls = sent.at(-1).text.match(/https:\/\/room\.example[^\s]+/g) ?? []; const link = urls.map(s => new URL(s)).find(u => u.searchParams.has(purpose)); assert.ok(link, 'Local intercepted mail lacks expected link'); return link.searchParams.get(purpose); };
let disposed = false;
try {
  for (const kind of kinds) {
    surface = kind; const seeded = await request('/__seed?kind=' + kind); assert.equal(seeded.status, 200);
    await mf.dispose(); mf = create();
    const email = kind + '-native-canary@example.invalid', slot = await open(), steps = [];
    await post(steps, 'password-login', '/api/auth/password/login', slot, { email, password: 'synthetic-original-password', sessionRevision: slot.view.sessionRevision }, 401);
    await post(steps, 'request-fresh-reset', '/api/auth/password/reset/request', slot, { email }, 200);
    const resetCode = latestCode('reset');
    await post(steps, 'consume-fresh-reset', '/api/auth/password/reset/consume', slot, { email, code: resetCode, newPassword: 'synthetic-replacement-password', sessionRevision: slot.view.sessionRevision }, 401);
    await post(steps, 'repeat-signup', '/api/auth/password/signup', slot, { email, password: 'synthetic-different-password', sessionRevision: slot.view.sessionRevision }, 202);
    assert.match(sent.at(-1).subject, /already have/i);
    const state = await (await request('/__state')).json(); assert.equal(state.accountCount, 1);
    await post(steps, 'request-correct-magic-method', '/api/auth/magic/request', slot, { email }, 200);
    const magicCode = latestCode('magic');
    const signedIn = await post(steps, 'consume-correct-magic-method', '/api/auth/magic/consume', slot, { email, code: magicCode, sessionRevision: slot.view.sessionRevision }, 201);
    assert.equal(signedIn.authenticated, true); assert.equal(signedIn.account.id, 'state-' + kind);
    results.push({ kind, steps, accountPreserved: true, correctMethodRecoversAccount: true });
  }
  await mf.dispose(); disposed = true;
  const files = (await readdir(join(directory, 'do'), { recursive: true })).filter(p => p.endsWith('.sqlite')).map(p => join(directory, 'do', p));
  const snapshots = [];
  for (const filename of files) {
    const db = openReadOnlySnapshot(filename); let hasAccounts;
    try { hasAccounts = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='account_login_methods'").get(); }
    finally { db.close(); }
    if (!hasAccounts) continue;
    for (const kind of kinds) {
      const before = createHash('sha256').update(await readFile(filename)).digest('hex');
      const report = await inspectAccountState({ checkout, filename, email: kind + '-native-canary@example.invalid' });
      if (!report.matchingAccounts) continue;
      assert.equal(report.matchingAccounts, 1); assert.equal(report.accounts[0].passwordResetEligible, false);
      assert.equal(report.resetChallenge.latest.targetsExistingAccount, false); assert.equal(report.queryOnly, true);
      const writeProbe = openReadOnlySnapshot(filename); try { assert.throws(() => writeProbe.exec('UPDATE diagnostic_readonly_probe SET value=2'), /readonly|read-only/i); } finally { writeProbe.close(); }
      assert.equal(createHash('sha256').update(await readFile(filename)).digest('hex'), before);
      snapshots.push({ kind, diagnostic: report, actualWriteRefused: true, snapshotBytesUnchanged: true });
    }
  }
  assert.equal(snapshots.length, 2);
  console.log('ACCOUNT_METHOD_STATES_NATIVE ' + JSON.stringify({ source: SOURCE_PIN, results, coldReopens: 2, localMailIntercepts: sent.length, externalNetworkRequests: 0, nativeSnapshotDiagnostics: snapshots, scope: 'Disposable actual Native fixtures and read-only closed local SQLite snapshots. Matches symptom classes, not deployed account state or production diagnosis.' }));
} finally { if (!disposed) await mf.dispose(); await rm(directory, { recursive: true, force: true }); }
execFileSync(git, ['-C', checkout, 'diff', '--exit-code', 'HEAD', '--']);
