import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const pin = '7de0d256db177c9cb4846f910c4e3a9ffbc845c7';
const path = fileURLToPath(new URL('../server/needs-me.mjs', import.meta.url));
const original = readFileSync(path, 'utf8');
assert.equal(original, execFileSync('git', ['show', pin + ':server/needs-me.mjs'], { encoding: 'utf8' }));
const schemaProbe = { name: 'review-export-only', setup(builder) {
  builder.onLoad({ filter: /server\/needs-me\.mjs$/ }, () => ({ contents: original + '\nexport { repliesOf, mentionHorizon };\n', loader: 'js' }));
} };
const bundle = await build({ entryPoints: [fileURLToPath(new URL('./review-needs-me-input-window.test-fixture.mjs', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['node:*','cloudflare:*'], plugins: [schemaProbe] });
const mf = new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-07-30', compatibilityFlags: ['nodejs_compat'], durableObjects: { ROOM: { className: 'ReviewedAttentionWindowRoom', useSQLite: true } } });
const records = [];
const probe = async (count, mode) => {
  const response = await mf.dispatchFetch(`http://localhost/?count=${count}&mode=${mode}`);
  assert.equal(response.status, 200, await response.clone().text());
  const value = await response.json(); records.push(value); return value;
};
test.after(async () => {
  console.log(JSON.stringify({ source: pin, sourceSha256: createHash('sha256').update(original).digest('hex'), exportOnlyAdapter: true, actualWorkerRecords: records }));
  await mf.dispose();
});
test('7de fixes history-proportional work for ordinary no-match and sparse-member queries', async () => {
  for (const mode of ['plain','other-member']) {
    const small = await probe(1000, mode), large = await probe(10000, mode);
    assert.equal(large.rowsRead, small.rowsRead);
    assert.equal(large.payloadBytes, small.payloadBytes);
    assert.equal(large.scan.scannedRows, mode === 'plain' ? 256 : 512);
  }
});
test('single maximum escaped legal body is admitted', async () => {
  const value = await probe(1, 'legal-escaped');
  assert.equal(value.refusal, null); assert.equal(value.scan.scannedRows, 1);
  assert.ok(value.payloadBytes > 393000 && value.payloadBytes < 1048576);
});
test('aggregate payload admission precedes transferring a legal escaped-body batch', async () => {
  const value = await probe(3, 'escaped-batch');
  assert.ok(value.payloadBytes <= 1048576, `${value.payloadBytes} bytes transferred before admission`);
  assert.ok(value.scan.scannedBytes <= 1048576);
  assert.equal(value.scan.exhausted, true);
});
test('unsupported oversized imported event refuses before payload and cursor advance', async () => {
  const value = await probe(1, 'oversized');
  assert.equal(value.payloadBytes, 0, 'oversized payload never crosses SQL into JS');
  assert.deepEqual(value.refusal, { status: 503, code: 'storage_unavailable' });
});
test('covered replies do not amplify fetched input past the examined-row budget', async () => {
  const value = await probe(1000, 'covered-replies');
  assert.ok(value.payloadRows <= 256, `${value.payloadRows} payload rows fetched for ${value.scan.scannedRows} reported examined rows`);
  assert.deepEqual(value.scan.items, []);
});
