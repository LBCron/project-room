import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
if (!process.argv[2]) throw new Error('Usage: node inbox-query-prototype.mjs SOURCE_ROOT [REVISION_LABEL] [RESULT_PATH]');
const sourceRoot = resolve(process.argv[2]);
const importSource = file => import(pathToFileURL(join(sourceRoot, file)).href);
const { createDurableWorkClaimRegistry, workClaimSchema, workClaimInboxIndexSchema } = await importSource('server/work-claim-sqlite.mjs');
const { resolveNamedReviewers, hasCurrentReview } = await importSource('server/work-claims.mjs');
const sourceFileHashes = Object.fromEntries(['server/work-claim-sqlite.mjs', 'server/work-claims.mjs'].map(file => [file, createHash('sha256').update(readFileSync(join(sourceRoot, file))).digest('hex')]));

// Disposable research adapter. It is not a production migration or cursor API.
const revision = process.argv[3] ?? 'not-supplied'; // Label only; file hashes independently bind imported inputs.
const slug = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const data = "(CASE WHEN json_type(item_json, '$.v') IN ('integer','real') THEN json_extract(item_json, '$.data') ELSE item_json END)";
const owner = `json_extract(${data}, '$.owner')`;
const state = `json_extract(${data}, '$.state')`;
const active = `${state} IN ('claimed','in_progress','blocked','delivered')`;
const baseClaim = (id, extra = {}) => ({ id, state: 'in_progress', owner: 'other', tags: ['rev-me'], reviews: [], claimedAt: null, ...extra });
const currentBasis = { version: 1, owner: 'other', claimedAt: null, revision: null, headSha: null, deliveryDigest: null, deliveryGeneration: 0 };
const defaultMembers = () => ({ me: { displayName: 'My Reviewer', active: true }, other: { displayName: 'Other', active: true } });
const eligible = (item, members) => Boolean(item.owner && item.owner !== 'me' && !['done', 'closed'].includes(item.state) && !item.supersededBy && (item.state === 'in_progress' || item.pullRequest || item.pullRequests?.length) && resolveNamedReviewers(item, members).includes('me') && !hasCurrentReview(item, 'me'));

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(workClaimSchema);
  db.exec(workClaimInboxIndexSchema);
  db.exec(`CREATE TABLE reviewer_tokens(room_id TEXT NOT NULL, claim_rowid INTEGER NOT NULL, exact TEXT NOT NULL, slug TEXT NOT NULL, PRIMARY KEY(room_id,claim_rowid,exact));
    CREATE INDEX reviewer_exact ON reviewer_tokens(room_id,exact,claim_rowid);
    CREATE INDEX reviewer_slug ON reviewer_tokens(room_id,slug,claim_rowid);`);
  const queries = {};
  const wrapped = { prepare(sql) { if (sql.includes('AS metadata')) queries[sql.includes('!=?') ? 'review' : 'assignment'] = sql; return db.prepare(sql); } };
  const registry = createDurableWorkClaimRegistry(wrapped);
  [...registry.inboxCandidates('room', 'me')];
  [...registry.inboxCandidates('room', 'me', { review: true })];
  const addToken = db.prepare('INSERT OR IGNORE INTO reviewer_tokens VALUES(?,?,?,?)');
  function write(item, { room = 'room', legacy = false } = {}) {
    // Both statements are inside the caller's transaction in mutation tests.
    db.prepare('INSERT INTO work_claims VALUES(?,?,?,0) ON CONFLICT(room_id,claim_id) DO UPDATE SET item_json=excluded.item_json').run(room, item.id, JSON.stringify(legacy ? item : { v: 1, kind: 'work-claim', data: item }));
    const rowid = db.prepare('SELECT rowid FROM work_claims WHERE room_id=? AND claim_id=?').get(room, item.id).rowid;
    db.prepare('DELETE FROM reviewer_tokens WHERE room_id=? AND claim_rowid=?').run(room, rowid);
    for (const tag of item.tags ?? []) if (typeof tag === 'string' && tag.startsWith('rev-')) addToken.run(room, rowid, tag.slice(4), slug(tag.slice(4)));
  }
  function remove(id) {
    const rowid = db.prepare('SELECT rowid FROM work_claims WHERE room_id=? AND claim_id=?').get('room', id)?.rowid;
    db.prepare('DELETE FROM reviewer_tokens WHERE room_id=? AND claim_rowid=?').run('room', rowid);
    db.prepare('DELETE FROM work_claims WHERE room_id=? AND claim_id=?').run('room', id);
  }
  function prototype(members = defaultMembers(), { budget = Infinity, after = 0, bounded = false } = {}) {
    if (bounded) return boundedPrototype(members, { budget, after });
    const sql = queries.review.replace('ORDER BY rowid ASC LIMIT 128', `AND rowid IN (
      SELECT claim_rowid FROM reviewer_tokens WHERE room_id=? AND exact=?
      UNION SELECT claim_rowid FROM reviewer_tokens WHERE room_id=? AND slug=?)
      ORDER BY rowid ASC LIMIT 128`);
    const matches = [];
    let candidates = 0, pages = 0, exhausted = false, cursor = after;
    while (matches.length < 51 && candidates < budget) {
      const rows = db.prepare(sql).all('room', cursor, 'me', 'room', 'me', 'room', slug(members.me?.displayName));
      pages++;
      if (!rows.length) { exhausted = true; break; }
      for (const row of rows) {
        const item = JSON.parse(row.metadata);
        candidates++; cursor = row.ordinal;
        if (eligible(item, members)) matches.push(item.id);
        if (matches.length === 51 || candidates >= budget) break;
      }
      if (candidates < budget && matches.length < 51 && rows.length < 128) { exhausted = true; break; }
    }
    return { matches, candidates, pages, exhausted, continuation: exhausted ? null : cursor, sql };
  }
  function boundedPrototype(members, { budget, after }) {
    const keysSql = `SELECT claim_rowid FROM reviewer_tokens WHERE room_id=? AND exact=? AND claim_rowid>?
      UNION SELECT claim_rowid FROM reviewer_tokens WHERE room_id=? AND slug=? AND claim_rowid>?
      ORDER BY claim_rowid LIMIT ?`;
    const matches = [];
    let candidates = 0, pages = 0, cursor = after, exhausted = false;
    while (matches.length < 51 && candidates < budget) {
      const limit = Math.min(128, budget - candidates);
      const keys = db.prepare(keysSql).all('room', 'me', cursor, 'room', slug(members.me?.displayName), cursor, limit);
      pages++;
      if (!keys.length) { exhausted = true; break; }
      const selectedSql = queries.review.replace('ORDER BY rowid ASC LIMIT 128', `AND rowid IN (${keys.map(() => '?').join(',')}) ORDER BY rowid ASC LIMIT 128`);
      const selected = new Map(db.prepare(selectedSql).all('room', cursor, 'me', ...keys.map(row => row.claim_rowid)).map(row => [row.ordinal, JSON.parse(row.metadata)]));
      // Advance over raw keys too: an SQL-filtered batch must not mean EOF.
      for (const key of keys) {
        candidates++; cursor = key.claim_rowid;
        const item = selected.get(cursor);
        if (item && eligible(item, members)) matches.push(item.id);
        if (matches.length === 51 || candidates >= budget) break;
      }
      if (matches.length < 51 && candidates < budget && keys.length < limit) { exhausted = true; break; }
    }
    return { matches, candidates, pages, exhausted, continuation: exhausted ? null : cursor, sql: keysSql };
  }
  function oracle(members = defaultMembers()) { return registry.list('room').filter(item => eligible(item, members)).slice(0, 51).map(item => item.id); }
  return { db, registry, queries, write, remove, prototype, oracle };
}

const checks = [];
function check(name, fn) { fn(); checks.push(name); }
check('late relevant review survives 270 current reviews and budgeted empty pages', () => {
  const f = setup();
  for (let i = 0; i < 270; i++) f.write(baseClaim(`current-${i}`, { reviews: [{ memberId: 'me', basis: currentBasis }] }));
  f.write(baseClaim('wanted'));
  const full = f.prototype(); assert.deepEqual(full.matches, ['wanted']); assert.deepEqual(full.matches, f.oracle());
  const first = f.prototype(defaultMembers(), { budget: 128 });
  assert.deepEqual(first.matches, []); assert.equal(first.exhausted, false); assert.ok(first.continuation);
  const second = f.prototype(defaultMembers(), { budget: 128, after: first.continuation });
  assert.deepEqual(second.matches, []); assert.equal(second.exhausted, false);
  const last = f.prototype(defaultMembers(), { budget: 128, after: second.continuation });
  assert.deepEqual(last.matches, ['wanted']); assert.equal(last.exhausted, true); f.db.close();
});
check('aliases, ID precedence, collisions, inactive members and renames match existing resolver', () => {
  const f = setup(); const members = defaultMembers();
  f.write(baseClaim('exact')); f.write(baseClaim('alias', { tags: ['rev-My Reviewer'] }));
  f.write(baseClaim('normalized', { tags: ['rev-MY_reviewer!'] }));
  f.write(baseClaim('ambiguous', { tags: ['rev-other'] }));
  for (const mutate of [() => {}, () => { members.collision = { displayName: 'My Reviewer' }; }, () => { delete members.collision; members.me.displayName = 'Renamed'; }, () => { members.me.active = false; }]) {
    mutate(); assert.deepEqual(f.prototype(members).matches, f.oracle(members));
  }
  members.me.active = true; members.me.displayName = 'Other';
  assert.deepEqual(f.prototype(members).matches, f.oracle(members));
  assert.ok(!f.prototype(members).matches.includes('ambiguous')); f.db.close();
});
check('late matches survive unrelated tags, supersession, wrong room and legacy missing state', () => {
  const f = setup();
  for (let i = 0; i < 300; i++) f.write(baseClaim(`noise-${i}`, { tags: ['rev-nobody'] }));
  f.write(baseClaim('superseded', { supersededBy: 'replacement' }));
  f.write(baseClaim('done', { state: 'done' }));
  f.write(baseClaim('private'), { room: 'private-room' });
  f.write({ id: 'legacy', owner: 'other', tags: ['rev-me'], pullRequest: 'https://example.test/pr' }, { legacy: true });
  f.write(baseClaim('wanted'));
  assert.deepEqual(f.prototype().matches, ['legacy', 'wanted']); assert.deepEqual(f.prototype().matches, f.oracle()); f.db.close();
});
check('revision/head/digest/generation changes preserve current-review semantics', () => {
  const f = setup();
  const extras = [{}, { revision: 'new' }, { ci: { headSha: 'a'.repeat(40) } }, { deliveryGeneration: 2 }, { delivery: { digest: 'a'.repeat(64) }, reviews: [{ memberId: 'me', basis: { ...currentBasis, deliveryDigest: 'b'.repeat(64) } }] }];
  extras.forEach((extra, i) => f.write(baseClaim(`basis-${i}`, { reviews: [{ memberId: 'me', basis: currentBasis }], ...extra })));
  assert.deepEqual(f.prototype().matches, f.oracle()); assert.ok(!f.prototype().matches.includes('basis-0')); assert.equal(f.prototype().matches.length, 4); f.db.close();
});
check('50-result boundary counts semantic matches rather than raw candidates', () => {
  const f = setup();
  for (let i = 0; i < 140; i++) f.write(baseClaim(`current-${i}`, { reviews: [{ memberId: 'me', basis: currentBasis }] }));
  for (let i = 0; i < 52; i++) f.write(baseClaim(`wanted-${i}`));
  assert.deepEqual(f.prototype().matches, f.oracle()); assert.equal(f.prototype().matches.length, 51); f.db.close();
});
check('tag replacement, deletion, rollback and reused rowid do not retain routing', () => {
  const f = setup(); f.write(baseClaim('one')); assert.deepEqual(f.prototype().matches, ['one']);
  f.db.exec('BEGIN'); f.write(baseClaim('one', { tags: ['rev-nobody'] })); assert.deepEqual(f.prototype().matches, []); f.db.exec('ROLLBACK');
  assert.deepEqual(f.prototype().matches, ['one']);
  f.db.exec('BEGIN'); f.remove('one'); f.write(baseClaim('replacement', { tags: ['rev-nobody'] })); f.db.exec('COMMIT');
  assert.deepEqual(f.prototype().matches, []); assert.deepEqual(f.prototype().matches, f.oracle()); f.db.close();
});
check('bounded raw-token pages continue after SQL filters remove the entire first page', () => {
  const f = setup();
  for (let i = 0; i < 270; i++) f.write(baseClaim(`terminal-${i}`, { state: 'done' }));
  f.write(baseClaim('wanted'));
  const first = f.prototype(defaultMembers(), { bounded: true, budget: 128 });
  assert.deepEqual(first.matches, []); assert.equal(first.exhausted, false);
  const second = f.prototype(defaultMembers(), { bounded: true, budget: 128, after: first.continuation });
  assert.deepEqual(second.matches, []); assert.equal(second.exhausted, false);
  const third = f.prototype(defaultMembers(), { bounded: true, budget: 128, after: second.continuation });
  assert.deepEqual(third.matches, ['wanted']); assert.equal(third.exhausted, true);
  assert.deepEqual(f.prototype(defaultMembers(), { bounded: true }).matches, f.oracle());
  f.db.close();
});
check('bounded keys preserve dynamic aliases and late review-basis matches', () => {
  const f = setup(), members = defaultMembers();
  for (let i = 0; i < 270; i++) f.write(baseClaim(`current-${i}`, { tags: ['rev-My Reviewer'], reviews: [{ memberId: 'me', basis: currentBasis }] }));
  f.write(baseClaim('late', { tags: ['rev-MY_reviewer!'], deliveryGeneration: 2, reviews: [{ memberId: 'me', basis: currentBasis }] }));
  assert.deepEqual(f.prototype(members, { bounded: true }).matches, ['late']);
  members.collision = { displayName: 'My Reviewer' };
  assert.deepEqual(f.prototype(members, { bounded: true }).matches, f.oracle(members));
  f.db.close();
});

const measurements = [];
for (const mode of ['terminal-owned', 'unrelated-review-tags']) {
  for (const count of [100, 1000, 5000]) {
    const f = setup(); f.db.exec('BEGIN');
    for (let i = 0; i < count; i++) f.write(baseClaim(`c${i}`, { owner: mode === 'terminal-owned' ? 'me' : 'other', state: mode === 'terminal-owned' ? 'done' : 'in_progress', tags: ['rev-nobody'], history: [{ note: 'x'.repeat(4096) }] }));
    f.write(baseClaim('wanted', { owner: mode === 'terminal-owned' ? 'me' : 'other' })); f.db.exec('COMMIT');
    const assignment = mode === 'terminal-owned';
    const originalSql = assignment ? f.queries.assignment : f.queries.review;
    const planBefore = f.db.prepare(`EXPLAIN QUERY PLAN ${originalSql}`).all('room', 0, 'me');
    const baseline = [], proposed = [];
    for (let i = 0; i < 5; i++) { const start = performance.now(); [...f.registry.inboxCandidates('room', 'me', { review: !assignment })]; baseline.push(performance.now() - start); }
    const buildStart = performance.now();
    if (assignment) f.db.exec(`CREATE INDEX active_owner_prototype ON work_claims(room_id,${owner}) WHERE ${active}`);
    const indexBuildMs = performance.now() - buildStart;
    let sql, args, last;
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      if (assignment) { last = [...f.registry.inboxCandidates('room', 'me')].map(x => x.id); sql = originalSql; args = ['room', 0, 'me']; }
      else { const result = f.prototype(); last = result.matches; sql = result.sql; args = ['room', 0, 'me', 'room', 'me', 'room', slug('My Reviewer')]; }
      proposed.push(performance.now() - start);
    }
    assert.deepEqual(last, ['wanted']);
    const planAfter = f.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args);
    const median = xs => xs.sort((a, b) => a - b)[2];
    measurements.push({ mode, count, baselineMedianMs: median(baseline), prototypeMedianMs: median(proposed), indexBuildMs, planBefore, planAfter });
    f.db.close();
  }
}
const boundedFixture = setup();
const boundedPlan = boundedFixture.db.prepare(`EXPLAIN QUERY PLAN ${boundedFixture.prototype(defaultMembers(), { bounded: true }).sql}`).all('room', 'me', 0, 'room', slug('My Reviewer'), 0, 128);
boundedFixture.db.close();
const boundedMeasurements = [];
for (const count of [100, 1000, 5000]) {
  const f = setup(); f.db.exec('BEGIN');
  for (let i = 0; i < count; i++) f.write(baseClaim(`reviewed-${i}`, { reviews: [{ memberId: 'me', basis: currentBasis }], history: [{ note: 'x'.repeat(4096) }] }));
  f.write(baseClaim('wanted')); f.db.exec('COMMIT');
  const timings = [];
  let result;
  for (let i = 0; i < 5; i++) { const start = performance.now(); result = f.prototype(defaultMembers(), { bounded: true, budget: 128 }); timings.push(performance.now() - start); }
  if (count >= 128) { assert.deepEqual(result.matches, []); assert.equal(result.exhausted, false); assert.equal(result.candidates, 128); }
  boundedMeasurements.push({ count, budget: 128, medianMs: timings.sort((a, b) => a - b)[2], candidates: result.candidates, matches: result.matches, exhausted: result.exhausted, continuation: result.continuation });
  f.db.close();
}
const writeMeasurements = [];
for (const maintainTokens of [false, true]) {
  const f = setup(); const count = 1000;
  f.db.exec('BEGIN');
  for (let i = 0; i < count; i++) f.write(baseClaim(`claim-${i}`));
  f.db.exec('COMMIT');
  const statement = f.db.prepare('UPDATE work_claims SET item_json=? WHERE room_id=? AND claim_id=?');
  const before = f.db.prepare('SELECT total_changes() AS n').get().n;
  const started = performance.now();
  f.db.exec('BEGIN');
  for (let i = 0; i < count; i++) {
    const item = baseClaim(`claim-${i}`, { revision: 'updated' });
    if (maintainTokens) f.write(item);
    else statement.run(JSON.stringify({ v: 1, kind: 'work-claim', data: item }), 'room', item.id);
  }
  f.db.exec('COMMIT');
  writeMeasurements.push({ maintainTokens, count, elapsedMs: performance.now() - started, logicalRowChanges: f.db.prepare('SELECT total_changes() AS n').get().n - before });
  f.db.close();
}
const report = { revision, sourceFileHashes, checksPassed: checks.length, checks, measurements, boundedPlan, boundedMeasurements, writeMeasurements, limitations: ['Revision is caller-supplied provenance; imported file hashes bind actual source bytes.', 'Disposable Node SQLite prototype; no shared production source edits.', 'Tag sidecar is synchronously maintained by this fixture adapter only; every real writer/import/restore must participate before adoption.', 'Token-sidecar population is included in fixture setup, not reviewer query timing. Write measurements compare naive replacement against raw item update, not full production registry writes or on-disk WAL.', 'Fast reviewer timings use IN-subquery lookup, which can materialize all matching token IDs; bounded raw-key timings are separately listed under boundedMeasurements.', 'Cursor is an experiment rowid checkpoint; production needs authorization/selection/revision binding and restart-on-change behavior.', 'Result equivalence uses the current exact resolver/review-basis implementation, including its inherited behavior.'] };
writeFileSync(resolve(process.argv[4] ?? 'inbox-query-prototype-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
