// Offline cross-artifact reproduction. No credentials, network or host execution.
// node probe.mjs synthetic-fixture.json CANDIDATE_RUNTIME [LEGACY_RUNTIME]
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const [fixturePath, candidatePath, legacyPath] = process.argv.slice(2);
if (!fixturePath || !candidatePath) throw Error('Expected fixture, candidate runtime, optional legacy runtime');
const bytes = readFileSync(fixturePath), fixture = JSON.parse(bytes);
assert.equal(fixture.synthetic, true);
assert.equal(fixture.source, '0908cbcb76797601e878ee9f1f3b93bcb4afbfa1');
assert.equal(fixture.answered.request.answerCredential, 'room_credential');
assert.equal(fixture.open.request.status, 'open');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const options = row => ({name:'room_read_request', args:{requestMessageId:row.request.id}, roomId:row.roomId});
const cases = [
  ['saved_room_stamp', fixture.answered, true],
  ['open_unstamped', fixture.open, true],
];
for (const [name, stamp, expected] of [['saved_session_stamp','account_session',true], ['historical_unstamped',undefined,true], ['unknown_stamp','notarized',false]]) {
  const row = structuredClone(fixture.answered);
  if (stamp === undefined) delete row.request.answerCredential;
  else row.request.answerCredential = stamp;
  cases.push([name,row,expected]);
}
const forgedOpen = structuredClone(fixture.open);
forgedOpen.request.answerCredential = 'room_credential';
cases.push(['stamp_on_open_request',forgedOpen,false]);

const artifacts = [];
for (const [kind, root] of [['candidate',candidatePath], ['legacy',legacyPath]]) {
  if (!root) continue;
  const path = resolve(root,'client/reply-actions.mjs');
  const {validateReplyRead} = await import(pathToFileURL(path));
  const results = [];
  for (const [name,row,expected] of cases) {
    let accepted = false;
    try { validateReplyRead(row,options(row)); accepted = true; }
    catch (error) { assert.equal(error.code,'invalid_response'); }
    results.push({name,accepted,expected});
    if (kind === 'candidate') assert.equal(accepted,expected,name);
  }
  if (kind === 'legacy') {
    assert.equal(results.find(row=>row.name==='saved_room_stamp').accepted,false,'legacy reproduces stamped-read refusal');
    assert.equal(results.find(row=>row.name==='historical_unstamped').accepted,true,'removing only the stamp restores legacy acceptance');
  }
  artifacts.push({kind,validatorSha256:sha256(readFileSync(path)),results});
}
console.log(JSON.stringify({synthetic:true,networkRequests:0,source:fixture.source,fixtureSha256:sha256(bytes),artifacts},null,2));
