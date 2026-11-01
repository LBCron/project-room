import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {auditRecovery} from '../server/recovery.mjs';
import {exportNdjsonText,replayNdjson,sanitizeCell} from '../server/room-export.mjs';
import {replayCutoverSchema,captureReplayWitness,advanceReplayWitness} from '../server/replay-cutover.mjs';

function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'replay-recovery-'));
  const store=new RoomStore(join(directory,'source.sqlite'));
  store.initialize(initialRoom());store.db.exec(replayCutoverSchema());
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  const input={roomId:'commons',requestId:'capture-recovery',expectedHead:store.headSequence('commons'),reason:'Synthetic recovery control'};
  const captured=captureReplayWitness(store,input);
  return {store,directory,input,captured};
}

test('recovery recognizes explicit sidecar without activating it on ordinary opens',t=>{
  const f=fixture(t);
  assert.equal(auditRecovery(f.store).checks.writerFence,true);
  const plain=new RoomStore(':memory:');t.after(()=>plain.close());
  assert.equal(plain.db.prepare("SELECT name FROM sqlite_master WHERE name='message_replay_units'").get(),undefined);
});

test('whole-store restore preserves exact captured authority and historical phase receipts',t=>{
  const f=fixture(t),before=f.store.db.prepare('SELECT * FROM message_replay_units ORDER BY generation,domain,unit_key').all();
  const receipts=f.store.db.prepare("SELECT * FROM operator_actions WHERE action LIKE 'replay_cutover_%'").all();
  const filename=join(f.directory,'restored.sqlite');
  assert.equal(replayNdjson(exportNdjsonText(f.store.db),filename).verified,true);
  const restored=new RoomStore(filename);t.after(()=>restored.close());
  assert.deepEqual(restored.db.prepare('SELECT * FROM message_replay_units ORDER BY generation,domain,unit_key').all(),before);
  assert.deepEqual(restored.db.prepare("SELECT * FROM operator_actions WHERE action LIKE 'replay_cutover_%'").all(),receipts);
  assert.equal(captureReplayWitness(restored,f.input).duplicate,true);
  assert.equal(advanceReplayWitness(restored,{roomId:'commons',generation:f.captured.generation,expectedBytes:0,requestId:'recovered-step'}).phase,'witness_verified');
});

test('structured sidecar BLOBs obey the existing text token scrub policy',()=>{
  const token='pri_syntheticPrivateToken123';
  for(const value of [Buffer.from(JSON.stringify({body:token})),new TextEncoder().encode(token).buffer]){
    const sanitized=sanitizeCell('message_replay_units','payload',value);
    const decoded=Buffer.from(sanitized.$base64,'base64').toString('utf8');
    assert.ok(!decoded.includes(token));
    assert.equal(decoded.length,value.byteLength-token.length+64);
  }
  assert.throws(()=>sanitizeCell('message_replay_units','payload',Uint8Array.of(0xff)),/UTF-8|encoded data/);
});
