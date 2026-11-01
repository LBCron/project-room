// Independent, disposable old-source qualification. No serving database used.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createRuntimePackage } from './runtime-package.mjs';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
const source = '4b060ff07ce0bbedb3eae216e40825315cc9eff5';
const weakSource = '72a7d6e4d7e67e866b6314c2218e8a2a0cac8fc5';
const root = mkdtempSync(join(tmpdir(), 'member2-upgrade-'));
const records = [];
try {
  const runtime = join(root, 'prior-runtime');
  createRuntimePackage({ repository: process.cwd(), commit: source, destination: runtime });
  const { RoomStore: OldStore } = await import(pathToFileURL(join(runtime, 'server/store.mjs')));
  const weakRuntime = join(root, 'weak-runtime');
  createRuntimePackage({ repository: process.cwd(), commit: weakSource, destination: weakRuntime });
  const { RoomStore: WeakStore } = await import(pathToFileURL(join(weakRuntime, 'server/store.mjs')));
  for (const variant of ['intact-strong-baseline', 'corrupt-strong-baseline', 'no-historical-baseline']) {
    const filename = join(root, `${variant}.sqlite`);
    const old = variant === 'no-historical-baseline' ? new WeakStore(filename) : new OldStore(filename);
    old.initialize(initialRoom());
    const token = old.issueAccessKey('commons', 'owner');
    if (variant !== 'no-historical-baseline') {
      await old.verifyRoomIntegrity({ yieldBetween: async () => {} });
      await old.verifyRoomIntegrity({ yieldBetween: async () => {} });
      assert.match(old.db.prepare("SELECT projection_hash FROM integrity_room_state WHERE room_id='commons'").get().projection_hash, /^[a-f0-9]{64}$/);
    }
    if (variant === 'corrupt-strong-baseline') {
      const { projection } = old.db.prepare("SELECT projection FROM rooms WHERE id='commons'").get();
      const changed = projection.replace('Commons', 'Xommons');
      assert.notEqual(changed, projection);
      old.db.prepare("UPDATE rooms SET projection=? WHERE id='commons'").run(changed);
    }
    const original = old.db.prepare("SELECT projection FROM rooms WHERE id='commons'").get().projection;
    const beforeVersion = old.db.prepare('PRAGMA user_version').get().user_version;
    assert.equal(beforeVersion, 43);
    old.close();
    let current, error = null;
    try {
      current = new RoomStore(filename);
      if (variant === 'corrupt-strong-baseline') throw Error('INDEPENDENT CHECK: corrupted strong baseline was accepted');
      const proof = current.db.prepare("SELECT projection_hash,metadata_hash FROM integrity_room_state WHERE room_id='commons'").get();
      assert.match(proof.metadata_hash, /^[a-f0-9]{64}$/);
      if (variant === 'no-historical-baseline') assert.equal(proof.projection_hash, null);
      current.command(token, 'commons', { id: 'after-upgrade', type: 'message.posted', data: { messageId: 'after-upgrade', body: 'Preserved Unicode: café 🧪' } });
      assert.equal(current.room('commons').state.messages.at(-1).body, 'Preserved Unicode: café 🧪');
      records.push({ variant, accepted: true, proof, commandSucceeded: true });
    } catch (caught) {
      error = caught.message;
      if (variant !== 'corrupt-strong-baseline') throw caught;
      assert.match(error, /projection_corrupt|legacy content does not match/);
    } finally { current?.close(); }
    if (error) {
      const inspect = new DatabaseSync(filename, { readOnly: true });
      try {
        const afterVersion = inspect.prepare('PRAGMA user_version').get().user_version;
        const retained = inspect.prepare("SELECT projection FROM rooms WHERE id='commons'").get().projection;
        records.push({ variant, accepted: false, error, beforeVersion, afterVersion,
          projectionUnchanged: retained === original,
          proof: inspect.prepare("SELECT * FROM integrity_room_state WHERE room_id='commons'").get() });
        assert.equal(retained, original);
      } finally { inspect.close(); }
      let reopened;
      try {
        reopened = new RoomStore(filename);
        const observation = { accepted: true, title: reopened.room('commons').state.room.title };
        try {
          reopened.command(token, 'commons', { id: 'after-refusal', type: 'message.posted', data: { messageId: 'after-refusal', body: 'Must not bless old corruption' } });
          observation.commandAccepted = true;
        } catch (caught) { observation.commandAccepted = false; observation.commandError = caught.message; }
        observation.integrity = await reopened.verifyRoomIntegrity({ yieldBetween: async () => {} });
        observation.failures = reopened.integrityFailures();
        records.at(-1).secondOpen = observation;
      } catch (caught) { records.at(-1).secondOpen = { accepted: false, error: caught.message }; }
      finally { reopened?.close(); }
    }
  }
  const report = { candidate: '61225bed6bce0a4b4df3f6edddbfb995857056fc', genuinePriorSource: source, weakSource, records };
  const text = JSON.stringify(report, null, 2) + '\n';
  writeFileSync(resolve(process.argv[2] ?? 'member2-upgrade-negative-results.json'), text);
  console.log(text);
  console.log('reportSha256=' + createHash('sha256').update(text).digest('hex'));
} finally { rmSync(root, { recursive: true, force: true }); }
