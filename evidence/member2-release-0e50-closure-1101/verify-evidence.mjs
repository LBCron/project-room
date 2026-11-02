import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const report=JSON.parse(await readFile(new URL('./local-qualification.json',import.meta.url),'utf8'));
assert.equal(report.sourceBefore.revision,'0e50e157f95f9fda4f16c1d3be3e0468f8413b65');
assert.equal(report.sourceBefore.tree,'7c36cc173c2d7536cd3fae8b441d1a36da117375');
assert.deepEqual(report.sourceAfter,report.sourceBefore);assert.equal(report.sourceBefore.clean,true);
assert.equal(report.jobs.length,7);assert.equal(report.expected.length,7);
for(const job of report.jobs) {
 assert.equal(job.status,'passed');assert.equal(job.code,0);
 assert.ok(report.expected.some(x=>x.suite===job.suite&&x.seed===job.seed));
 assert.match(job.logName,/^job-[1-7]-attempt-1\.log$/);
 const bytes=await readFile(new URL('./'+job.logName,import.meta.url));
 assert.equal(bytes.length,job.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),job.logHash);
 assert.equal(job.identity.source,report.sourceBefore.revision);assert.equal(job.observation.outcome,'passed');
}
console.log(JSON.stringify({historicalSource:report.sourceBefore.revision,jobs:7,logIntegrity:true,executionAttested:false,currentReleaseQualified:false}));
