// Account-agent binding needs only the currently linked human and agent members.
// Epoch/account/link/connection/credential/identity checks remain independently
// fresh on access, refresh and descriptor barriers. No message, work or archive
// payload is an authorization dependency. Qualified canonical metadata must have
// its existing write proof and fit scalar admission; absent proof, legacy and
// archive shapes retain the original full path. Present proof/storage failures
// must refuse rather than fall back. This is not a whole-history audit: unrelated
// missing message rows remain detectable by existing full reads/recovery; no count
// or proof may be rewritten or certified by this authorization-only context.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bindingFixture, measureBinding } from './helpers/oauth-binding-context-fixture.mjs';
for (const retained of [1000, 10000]) test(`resource-bound account OAuth binding avoids retained history at ${retained}`, t => {
  const f = bindingFixture(t, retained);
  const measured = measureBinding(f, () => f.resolve());
  assert.equal(measured.value.memberId, 'binding-agent');
  console.log(JSON.stringify({ retained, fullRoomReads: measured.fullRoomReads,
    messageRows: measured.messageRows, messageBytes: measured.messageBytes }));
  assert.equal(measured.fullRoomReads, 0);
  assert.equal(measured.messageRows, 0);
  assert.equal(measured.messageBytes, 0);
});
