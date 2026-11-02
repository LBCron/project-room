// Local snapshot inspection only. No server endpoints, credentials or network.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SOURCE_PIN = '00888c52110d36250d3e07629036701b72926d09';
export function openReadOnlySnapshot(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    db.exec('PRAGMA query_only=ON');
    return db;
  } catch (error) { db.close(); throw error; }
}

export async function inspectAccountState({ checkout, filename, email, now = Date.now() }) {
  const git = process.env.LOCAL_LAB_GIT ?? 'git';
  const head = execFileSync(git, ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== SOURCE_PIN) throw Error('Unsupported source pin');
  execFileSync(git, ['-C', checkout, 'diff', '--exit-code', 'HEAD', '--'], { stdio: 'pipe' });
  const { normalizeEmail, emailLookupHash } = await import(pathToFileURL(checkout + '/server/account-login-methods.mjs'));
  const normalized = normalizeEmail(email);
  if (!normalized || !Number.isSafeInteger(now) || now < 0) throw Error('Invalid diagnostic input');
  const db = openReadOnlySnapshot(filename);
  try {
    db.exec('BEGIN');
    // No email, method identifier, verifier, code or hash is selected for output.
    const matching = db.prepare(`SELECT m.account_id, m.type, m.disabled,
      (m.verifier IS NOT NULL AND length(m.verifier)>0) AS verifier_present,
      a.active, a.password_reset_required
      FROM account_login_methods m LEFT JOIN accounts a ON a.id=m.account_id
      WHERE m.email_hash=? AND m.email IS NOT NULL AND m.type IN ('password','magic','oauth')
      ORDER BY m.account_id,m.created_at,m.id LIMIT 101`).all(emailLookupHash(normalized));
    if (matching.length > 100) throw Error('Method metadata exceeds diagnostic bound');
    const ids = [...new Set(matching.map(row => row.account_id))];
    const accounts = ids.map((id, index) => {
      const row = matching.find(item => item.account_id === id);
      const methods = db.prepare(`SELECT type,disabled,(verified_at IS NOT NULL) AS verified,
        (email IS NOT NULL) AS email_bearing FROM account_login_methods
        WHERE account_id=? ORDER BY type,created_at,id LIMIT 101`).all(id);
      if (methods.length > 100) throw Error('Account metadata exceeds diagnostic bound');
      const emailMethods = methods.filter(m => m.email_bearing && ['password','magic','oauth'].includes(m.type));
      const addressPasswords = matching.filter(m => m.account_id === id && m.type === 'password' && !m.disabled);
      const eligible = row.active === 1 && addressPasswords.length > 0;
      const observations = [];
      if (row.active !== 1) observations.push('account_not_active');
      if (!addressPasswords.length) observations.push('no_enabled_password_for_address');
      if (addressPasswords.some(m => !m.verifier_present)) observations.push('password_verifier_missing');
      if (eligible && addressPasswords.every(m => m.verifier_present)) observations.push('password_login_and_reset_preconditions_present');
      return {
        label: `candidate-${index + 1}`, accountPresent: row.active !== null,
        active: row.active === 1, passwordResetRequired: row.password_reset_required === 1,
        emailVerification: emailMethods.some(m => m.verified) ? 'verified' : emailMethods.length ? 'unverified' : 'none',
        methods: methods.map(m => ({ type: m.type, enabled: !m.disabled, verified: !!m.verified })),
        enabledPasswordMethodsForAddress: addressPasswords.length,
        enabledPasswordVerifierPresent: addressPasswords.length > 0 && addressPasswords.every(m => m.verifier_present === 1),
        passwordResetEligible: eligible, observations,
      };
    });
    // Purpose bucket follows the pinned source; proof material is never read.
    const bucket = createHash('sha256').update('password-reset-email:v1\0' + normalized).digest('hex');
    const liveCount = db.prepare(`SELECT count(*) AS n FROM account_magic_codes
      WHERE email_hash=? AND consumed_at IS NULL AND expires_at>?`).get(bucket, now).n;
    const latest = db.prepare(`SELECT account_id,attempts,expires_at FROM account_magic_codes
      WHERE email_hash=? AND consumed_at IS NULL AND expires_at>?
      ORDER BY created_at DESC,expires_at DESC LIMIT 1`).get(bucket, now);
    const eligibleIds = new Set(ids.filter((_, i) => accounts[i].passwordResetEligible));
    const result = {
      schema: 'member2-readonly-account-state-v1', source: SOURCE_PIN,
      matchingAccounts: accounts.length, ambiguousAccountLookup: accounts.length > 1, accounts,
      resetChallenge: { liveCount, latest: latest ? {
        targetsExistingAccount: latest.account_id !== null,
        targetsMatchedAccount: ids.includes(latest.account_id),
        targetsEligiblePasswordAccount: eligibleIds.has(latest.account_id),
        attempts: latest.attempts, expiresInMs: latest.expires_at - now,
      } : null },
      queryOnly: db.prepare('PRAGMA query_only').get().query_only === 1,
      limits: ['Local authorized snapshot only; freshness and deployed state are not established.',
        'Eligibility is not proof of a correct password or valid/latest reset code.',
        'No identifiers, addresses, credential hashes, verifiers or reset proofs are emitted.'],
    };
    db.exec('ROLLBACK');
    return result;
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [checkout, filename, flag, inputFile, ...extra] = process.argv.slice(2);
    if (!checkout || !filename || flag !== '--email-file' || !inputFile || extra.length) {
      throw Error('Usage: node account_state_diagnostic.mjs CHECKOUT SNAPSHOT --email-file PRIVATE_INPUT');
    }
    const input = readFileSync(inputFile);
    if (input.length > 1024) throw Error('Input file too large');
    console.log(JSON.stringify(await inspectAccountState({ checkout, filename, email: input.toString('utf8').trim() }), null, 2));
  } catch {
    // Avoid accidentally printing paths, input data, SQL or provider material.
    console.error('Account diagnostic refused: check source pin, input and local snapshot schema/access. No account data was emitted.');
    process.exitCode = 1;
  }
}
