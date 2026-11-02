import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

test('Workers native admin consent remains room-bound and revocable', async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL('./native-admin.test-fixture.mjs', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['node:*', 'cloudflare:*'] });
  const runtime = new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-07-30',
    compatibilityFlags: ['nodejs_compat'], durableObjects: { ROOM: { className: 'NativeAdminTestRoom', useSQLite: true } },
    bindings: { ROOM_ORIGIN: 'https://room.example' } });
  try {
    const response = await runtime.dispatchFetch('https://room.example/');
    assert.equal(response.status, 200, await response.clone().text());
    assert.deepEqual(await response.json(), { previewAdmin: true, advertised: true, listSucceeded: true, wrongRoomRefused: true, removalRefused: true });
  } finally { await runtime.dispose(); }
});
