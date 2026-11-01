import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RoomStore } from '../server/store.mjs';
import { event } from '../src/events.js';
import { repairLegacyMessages } from '../server/operator-legacy-message-repair.mjs';
import { historicalSequence, seedLegacyFixture } from './helpers/legacy-session-fixture.mjs';

function repaired(t, append = false) {
  const dir=mkdtempSync(join(tmpdir(),'saved-historical-contract-')),file=join(dir,'room.sqlite');
  let store=new RoomStore(file);
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const events=historicalSequence(),intro=[0,1].map(i=>event({id:'intro-'+i,roomId:'legacy-room',actorId:'owner',at:'2026-09-01T00:00:10.000Z',type:'message.posted',data:{messageId:'intro-'+i,body:'Synthetic ordinary message'}}));
  const f=seedLegacyFixture(store,[...events.slice(0,2),...intro,...events.slice(2)]);
  assert.equal(store.db.prepare("SELECT sequence FROM messages_backfill_blocks WHERE room_id='legacy-room'").get().sequence,9);
  const plan=repairLegacyMessages(store,f.request),receipt=repairLegacyMessages(store,{...f.request,planHash:plan.planHash,requestId:'saved-contract-reopen'},true);
  assert.equal(receipt.verified,1);assert.equal(receipt.replayContract.throughSequence,11);
  assert.equal(store.db.prepare("SELECT 1 FROM messages_backfill_blocks WHERE room_id='legacy-room'").get(),undefined);
  const savedReceipt=store.db.prepare("SELECT counts_json FROM operator_actions WHERE action='legacy_session_backfill_reconciled'").get().counts_json;
  store.transaction(()=>{
    store.db.prepare('DELETE FROM message_replay_snapshots WHERE room_id=?').run('legacy-room');
    store.db.prepare('DELETE FROM messages_backfill_state WHERE room_id IN (?,?)').run('legacy-room','legacy-room\0anchor');
    store.db.prepare('DELETE FROM projection_checkpoints WHERE room_id=?').run('legacy-room');
  });
  if(append){const key=store.issueAccessKey('legacy-room','owner');store.command(key,'legacy-room',{id:'after-contract',type:'message.posted',data:{messageId:'after-contract',body:'Synthetic modern suffix'}});}
  const expected=structuredClone(store.room('legacy-room').state);
  store.close();store=new RoomStore(file);
  assert.equal(store.db.prepare("SELECT counts_json FROM operator_actions WHERE action='legacy_session_backfill_reconciled'").get().counts_json,savedReceipt);
  return {store,expected,receipt};
}
test('ordinary projection replay consumes the saved successful exact-prefix contract after checkpoint loss and reopen',t=>{
  const {store,expected}=repaired(t);
  assert.deepEqual(store.rebuildProjection('legacy-room').state,expected);
});
test('ordinary message catch-up consumes saved contract then applies a modern suffix after checkpoint loss and reopen',t=>{
  const {store,expected}=repaired(t,true);
  const result=store.backfillMessages({limit:64});
  assert.deepEqual(result.quarantined,[]);
  assert.equal(store.db.prepare("SELECT 1 FROM messages_backfill_blocks WHERE room_id='legacy-room'").get(),undefined);
  assert.equal(store.checkMessagesParity({roomId:'legacy-room'}).ok,true);
  assert.deepEqual(store.room('legacy-room').state,expected);
});
