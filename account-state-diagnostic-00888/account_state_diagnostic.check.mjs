import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { inspectAccountState, openReadOnlySnapshot, SOURCE_PIN } from './account_state_diagnostic.mjs';

const [checkout] = process.argv.slice(2);
assert.equal(process.argv.length, 3);
const [{ RoomStore }, { initialRoom }, { hashPassword }, { emailLookupHash }] = await Promise.all([
  'server/store.mjs', 'server/bootstrap.mjs', 'src/password-auth.mjs', 'server/account-login-methods.mjs',
].map(path => import(pathToFileURL(checkout + '/' + path))));
const directory = mkdtempSync(join(tmpdir(), 'account-diagnostic-'));
const now = Date.now(), results = [];
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
try {
  for (const kind of ['unverified-password', 'magic-only', 'disabled-password-with-magic', 'inactive-password', 'unknown-address']) {
    const filename = join(directory, kind + '.sqlite');
    const email = `${kind}-address-canary@example.invalid`, id = `account-id-canary-${kind}`;
    const store = new RoomStore(filename, { now: () => now });
    store.initialize(initialRoom());
    let verifier = null;
    if (kind !== 'unknown-address') {
      store.createAccount(id);
      let method;
      if (kind !== 'magic-only') {
        verifier = hashPassword('synthetic-original-password');
        method = store.accountLogins.linkPasswordMethod(id, { email, verifier });
      }
      if (kind === 'magic-only' || kind === 'disabled-password-with-magic') store.accountLogins.linkMagicMethod(id, { email });
      if (kind === 'disabled-password-with-magic') store.accountLogins.setMethodDisabled(id, method.id, true);
      if (kind === 'inactive-password') store.changeAccountAccess(id, { expectedRevision: 0, active: false, reason: 'Disposable diagnostic qualification' });
    }
    const proof = store.accountLogins.issuePasswordResetCode({ email });
    // A plain fixture table isolates SQLite's read-only guard from app writer triggers.
    store.db.exec('CREATE TABLE diagnostic_readonly_probe(value INTEGER); INSERT INTO diagnostic_readonly_probe VALUES(1)');
    store.close();
    const before = sha(filename);
    const report = await inspectAccountState({ checkout, filename, email, now });
    assert.equal(report.source, SOURCE_PIN);
    assert.equal(report.queryOnly, true);
    assert.equal(report.matchingAccounts, kind === 'unknown-address' ? 0 : 1);
    const eligible = kind === 'unverified-password';
    assert.equal(report.resetChallenge.latest.targetsEligiblePasswordAccount, eligible);
    assert.equal(report.resetChallenge.latest.targetsExistingAccount, eligible);
    if (kind !== 'unknown-address') {
      assert.equal(report.accounts[0].passwordResetEligible, eligible);
      assert.equal(report.accounts[0].active, kind !== 'inactive-password');
      assert.equal(report.accounts[0].emailVerification, ['magic-only', 'disabled-password-with-magic'].includes(kind) ? 'verified' : 'unverified');
    }
    const encoded = JSON.stringify(report);
    for (const secret of [email, id, proof.code, verifier, emailLookupHash(email)].filter(Boolean)) assert.equal(encoded.includes(secret), false, 'Diagnostic must not emit secret or identity canaries');
    const readonly = openReadOnlySnapshot(filename);
    try { assert.throws(() => readonly.exec('UPDATE diagnostic_readonly_probe SET value=2'), /readonly|read-only/i); }
    finally { readonly.close(); }
    assert.equal(sha(filename), before, 'Real snapshot bytes must remain unchanged');
    const input = join(directory, kind + '.private-input'); writeFileSync(input, email, { mode: 0o600 });
    const cli = execFileSync(process.execPath, [fileURLToPath(new URL('./account_state_diagnostic.mjs', import.meta.url)), checkout, filename, '--email-file', input], { encoding: 'utf8' });
    assert.equal(JSON.parse(cli).matchingAccounts, report.matchingAccounts);
    for (const secret of [email, id, proof.code, verifier, emailLookupHash(email)].filter(Boolean)) assert.equal(cli.includes(secret), false);
    assert.equal(sha(filename), before);
    results.push({ kind, eligiblePasswordReset: eligible, matchingAccounts: report.matchingAccounts, secretCanariesAbsent: true, actualWriteRefused: true, snapshotBytesUnchanged: true, cliPass: true });
  }
  const badInput = join(directory, 'bad-input'); writeFileSync(badInput, 'sensitive-invalid-input-canary');
  const refused = spawnSync(process.execPath, [fileURLToPath(new URL('./account_state_diagnostic.mjs', import.meta.url)), checkout, join(directory, 'does-not-exist.sqlite'), '--email-file', badInput], { encoding: 'utf8' });
  assert.equal(refused.status, 1); assert.equal(refused.stdout, ''); assert.equal(refused.stderr.includes('sensitive-invalid-input-canary'), false);
  console.log('ACCOUNT_STATE_DIAGNOSTIC_CHECK ' + JSON.stringify({ source: SOURCE_PIN, cases: results, invalidInputRefusedWithoutData: true, scope: 'Disposable real SQLite fixtures only; no production account or network access.' }));
} finally { rmSync(directory, { recursive: true, force: true }); }
