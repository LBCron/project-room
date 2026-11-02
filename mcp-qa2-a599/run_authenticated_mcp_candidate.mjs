import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const lab = fileURLToPath(new URL('.', import.meta.url));
const [repo,pin]=process.argv.slice(2);assert.equal(process.argv.length,4);
const runtime = '/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies', git = runtime + '/bin/fallback/git';
assert.equal(execFileSync(git, ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pin); execFileSync(git, ['-C', repo, 'diff', '--exit-code', 'HEAD', '--']);
process.env = { PATH: [runtime + '/node/bin', runtime + '/python/bin', runtime + '/bin/fallback', lab + 'qualification-tools/bin', '/usr/bin', '/bin'].join(':'), TMPDIR: mkdtempSync('/tmp/member2-mcp-auth-'), LANG: 'en_US.UTF-8', HOST: '127.0.0.1' };
const { startServer, runChecker } = await import(pathToFileURL(repo + '/tests/qa2/helpers.js'));
const { createQaClient } = await import(pathToFileURL(repo + '/scripts/qa2/lib/client.mjs'));
const out = lab + 'authenticated-mcp-qa2-fixed'; mkdirSync(out, { recursive: true });
const server = await startServer(), client = createQaClient({ origin: server.origin, userAgent: 'member2-local-authenticated-mcp-qualification' });
const requireSuccess = async (method, path, options, label) => { const r = await client.request(method, path, options); assert.ok(r.status >= 200 && r.status < 300, label + ': HTTP' + r.status + ' ' + (r.json?.error?.code ?? '')); return r.json; };
let terminal;
try {
  const owner = await requireSuccess('POST', '/api/agent-identities', { body: { displayName: 'Local robustness owner' } }, 'owner identity');
  const foreignOwner = await requireSuccess('POST', '/api/agent-identities', { body: { displayName: 'Local foreign owner' } }, 'foreign identity');
  const room = await requireSuccess('POST', '/api/agent-rooms', { token: owner.secret, body: { title: 'Local robustness room', purpose: 'Disposable protocol qualification' } }, 'owner room');
  const foreign = await requireSuccess('POST', '/api/agent-rooms', { token: foreignOwner.secret, body: { title: 'Local foreign room', purpose: 'Private boundary control' } }, 'foreign room');
  const foreignCanary = 'foreign-private-content-canary-' + 'z'.repeat(24);
  await requireSuccess('POST', '/api/rooms/' + foreign.roomId + '/commands', { token: foreignOwner.secret, body: { id: 'foreign-canary', type: 'message.posted', data: { messageId: 'foreign-canary', body: foreignCanary } } }, 'foreign private message');
  process.env.ROOM_QA_TOKEN = owner.secret;
  writeFileSync(out + '/plan.json', JSON.stringify({ source: pin, checker: 'scripts/qa2/mcp-robustness.mjs', mode: 'authenticated --writes', target: 'disposable loopback server', environment: 'minimal; synthetic identity token only in child env', sourceRuntimeEdits: false }, null, 2) + '\n');
  const started = Date.now(), result = await runChecker('mcp-robustness.mjs', ['--url', server.origin + '/mcp', '--room', room.roomId, '--foreign-room', foreign.roomId, '--writes'], { timeout: 180000 });
  delete process.env.ROOM_QA_TOKEN;
  assert.equal(result.signal, null); assert.ok(result.report?.results.length > 0, 'Checker must return real case observations');
  const raw = JSON.stringify(result.report);
  assert.equal(raw.includes(foreignCanary), false, 'Foreign private body must not be exposed');
  assert.equal(raw.includes(owner.secret), false); assert.equal(raw.includes(foreignOwner.secret), false);
  const events = await requireSuccess('GET', '/api/rooms/' + room.roomId + '/events?after=0&limit=100', { token: owner.secret }, 'room events');
  const posted = events.events.map(e => e.event ?? e).filter(e => e.type === 'message.posted');
  const idempotentPosts = posted.filter(e => e.data?.body === 'qa2 idempotency probe').length;
  assert.equal(idempotentPosts, 1, 'Duplicate request must produce one stored message');
  const validUnicode = 'qa2 Unicode العربية עברית \u200B\u200D emoji 🧪 combining e\u0301 <script>alert(1)</script> ${7*7} {{7*7}}';
  assert.equal(posted.filter(e=>e.data?.body===validUnicode).length,1,'Valid Unicode must survive exactly');
  const refusedStored=posted.filter(e=>['qa2 bidi','qa2 nul','qa2 surrogate'].some(prefix=>e.data?.body?.startsWith(prefix))).length;
  assert.equal(refusedStored,0,'Rejected controls must not create messages');

  const report = { source: pin, code: result.code, signal: result.signal, elapsedMs: Date.now() - started, checks: result.report.results.length, pass: result.report.results.filter(r => r.ok).length, fail: result.report.results.filter(r => !r.ok).length, cases: result.report.results.map(r => Object.fromEntries(['name', 'ok', 'status', 'ms', 'why'].filter(k => k in r).map(k => [k, r[k]]))), foreignPrivateCanaryAbsent: true, credentialCanariesAbsent: true, actualIdempotentStoredMessages: idempotentPosts, unicodePayloadPreserved: true, rejectedControlMessagesStored: refusedStored, rawReportSha256: createHash('sha256').update(raw).digest('hex'), limits: ['Local Node HTTP only, not Native or release qualification', 'Raw response samples stay private; published cases omit samples'] };
  writeFileSync(out + '/sanitized-report.json', JSON.stringify(report, null, 2) + '\n');
  terminal = { source: pin, status: result.code, checks: report.checks, pass: report.pass, fail: report.fail, foreignPrivateCanaryAbsent: true, credentialCanariesAbsent: true, actualIdempotentStoredMessages: idempotentPosts, unicodePayloadPreserved: true, rejectedControlMessagesStored: refusedStored, elapsedMs: report.elapsedMs };
  assert.equal(result.code, 0, 'Robustness checker has failed cases; see sanitized report');
} finally {
  delete process.env.ROOM_QA_TOKEN; server.stop();
  const trackedDiff = execFileSync(git, ['-C', repo, 'diff', '--name-only', 'HEAD', '--'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  if (terminal) { terminal.trackedDiff = trackedDiff; writeFileSync(out + '/receipt.json', JSON.stringify(terminal, null, 2) + '\n'); console.log('AUTHENTICATED_MCP_TERMINAL ' + JSON.stringify(terminal)); }
}
