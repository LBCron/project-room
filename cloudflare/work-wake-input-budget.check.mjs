import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
test('actual AgentHeartbeats work delivery bounds examined backlog before filtering', async t => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL('./work-wake-input-budget.test-fixture.mjs', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['node:*', 'cloudflare:*'] });
  const mf = new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-07-30', compatibilityFlags: ['nodejs_compat'], durableObjects: { ROOM: { className: 'WorkWakeBudgetProbe', useSQLite: true } } });
  t.after(() => mf.dispose());
  const observations = [];
  for (const kind of ['opted-out', 'stale']) for (const count of [1000, 10000]) {
    const response = await mf.dispatchFetch('http://localhost/' + kind + count, { method: 'POST', body: JSON.stringify({ count, kind }) });
    const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); observations.push(result); console.log(JSON.stringify(result));
  }
  for (const result of observations) {
    assert.deepEqual(result.signals, [{ kind: 'work', workItemId: 'task', workRevision: 0, action: 'accept', nextRead: { tool: 'room_read_work', arguments: { roomId: 'commons', workItemId: 'task' } } }]);
    assert.equal(result.more, false); assert.equal(result.nextCursor, null);
    if (result.controls) assert.deepEqual(result.controls, { optedOut: 0, paused: 0, quiet: 0, restored: 1, removed: 0 });
  }
  for (const result of observations) assert.ok(result.selected <= 512, 'examined work rows must be admitted before payload/filtering, independent of backlog');
});
