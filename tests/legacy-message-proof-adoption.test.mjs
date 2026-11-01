import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { repairLegacyMessages } from '../server/operator-legacy-message-repair.mjs';
import { MESSAGE_PROOF_FIELDS, messageProofMatches, projectionDigest } from '../server/write-integrity.mjs';
import { seedLegacyFixture } from './helpers/legacy-session-fixture.mjs';
const MODE = 'adopt-absent-inline-v1', roomId = 'legacy-room';
function fixture(t, { oldShape = false } = {}) {
  const s = new RoomStore(':memory:'); t.after(() => s.close());
  const f = seedLegacyFixture(s);
  if (oldShape) projection(f, state => {
    for (const message of state.messages) delete message.channelId;
    for (const item of Object.values(state.workItems)) {
      delete item.round_count; delete item.tool_calls; delete item.suspended_by;
    }
  });
  s.db.prepare('UPDATE messages SET entity_hash=NULL WHERE room_id=?').run(roomId);
  f.request = { ...f.request, messageProofMode: MODE }; return f;
}
function projection(f, change) {
  f.s.transaction(() => {
    const state = structuredClone(f.s.room(roomId).state); change(state);
    f.s.db.prepare('UPDATE rooms SET projection=? WHERE id=?').run(f.s.storedProjection(roomId,state),roomId);
    f.s.rememberReconstructedRoomProof(roomId);
  });
}
function snapshot(s, { audit = true, proof = true } = {}) {
  return Object.fromEntries(s.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .filter(({name}) => audit || name !== 'operator_actions').map(({name}) => [name,s.db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all().map(row => {
      const value = { ...row }; if (!proof && name === 'messages') delete value.entity_hash; return value;
    })]));
}
const execute = (f,plan,id='adopt-1',more={}) => repairLegacyMessages(f.s,{...f.request,planHash:plan.planHash,requestId:id,...more},true);
for (const oldShape of [false,true]) test(`explicit absent-proof plan and atomic execution preserve every serving value (${oldShape?'source-backed old view':'current view'})`, t => {
  const f = fixture(t,{oldShape}), before = snapshot(f.s,{audit:false}), prior = { ...f.request }; delete prior.messageProofMode;
  assert.throws(() => repairLegacyMessages(f.s,prior), e => e.code === 'repair_projection_unavailable' && e.detail.repairCheck === 'message_proof_missing');
  const plan = repairLegacyMessages(f.s,f.request);
  assert.equal(plan.messageProofMode,MODE); assert.equal(plan.derivedOnly,false); assert.equal(plan.servingContentChanged,false);
  assert.equal(plan.messageProofsToAdopt,1); assert.deepEqual(snapshot(f.s,{audit:false}),before,'plan never adopts proofs or changes derived data');
  const serving = Object.fromEntries(['rooms','messages','work_entities','integrity_room_state','events'].map(name=>[name,before[name].map(row=>{const out={...row};if(name==='messages')delete out.entity_hash;return out;})]));
  const completed = execute(f,plan);
  assert.equal(completed.messageProofsAdopted,1); assert.equal(completed.verified,1);
  for (const [name,rows] of Object.entries(serving)) assert.deepEqual(snapshot(f.s,{audit:false,proof:false})[name],rows);
  assert.equal(f.s.db.prepare('SELECT * FROM messages WHERE room_id=?').all(roomId).every(messageProofMatches),true);
  assert.equal(f.s.checkMessagesParity({roomId}).ok,true,'ordinary future parity accepts the unchanged serving representation');
  assert.deepEqual(execute(f,plan),{...completed,duplicate:true});
  assert.equal(completed.replayContract.version,1); assert.equal(completed.replayContract.adapterVersion,1);
  assert.equal(completed.replayContract.throughSequence,f.events.length); assert.equal(completed.replayContract.snapshotHash,plan.snapshotHash);
});
for (const value of ['', 'bad', '0'.repeat(64)]) test(`present invalid proof is never adopted: ${value.length}`, t => {
  const f=fixture(t);f.s.db.prepare('UPDATE messages SET entity_hash=? WHERE room_id=?').run(value,roomId);const before=snapshot(f.s);
  assert.throws(()=>repairLegacyMessages(f.s,f.request),e=>e.code==='repair_projection_unavailable'&&e.detail.repairCheck==='message_proof_mismatch');assert.deepEqual(snapshot(f.s),before);
});
for (const field of MESSAGE_PROOF_FIELDS) test(`independent adoption compares every persisted proof field: ${field}`, t => {
  const f=fixture(t), row=f.s.db.prepare('SELECT * FROM messages WHERE room_id=?').get(roomId);
  const value=field==='seq'?row.seq-1:field==='pinned'?1:field==='reactions_json'?'{}':field==='record_json'||field==='reducer_extras_json'?'{"untrusted":true}':'synthetic-changed';
  f.s.db.prepare(`UPDATE messages SET ${field}=? WHERE room_id=?`).run(value,roomId);const before=snapshot(f.s);
  assert.throws(()=>repairLegacyMessages(f.s,f.request),e=>e.status===409);assert.deepEqual(snapshot(f.s),before);
});
for (const damage of ['entity-ref','missing-row','extra-row','inactive-owner','grant-change','explicit-null-round','malformed-round','explicit-null-channel','extra-work-key','changed-existing-work','missing-record-key','extra-record-key','null-extras','malformed-record'])
  test(`adoption refuses ${damage} without certifying or replacing anything`, t=>{
    const f=fixture(t),db=f.s.db;
    if(damage==='entity-ref')projection(f,state=>{state.messages=state.messages.map(message=>({id:message.id,_entity:1}));});
    if(damage==='missing-row')db.prepare('DELETE FROM messages WHERE room_id=?').run(roomId);
    if(damage==='extra-row'){const row=db.prepare('SELECT * FROM messages WHERE room_id=?').get(roomId);db.prepare(`INSERT INTO messages(room_id,${MESSAGE_PROOF_FIELDS.join(',')},entity_hash) VALUES(${Array(MESSAGE_PROOF_FIELDS.length+2).fill('?').join(',')})`).run(roomId,...MESSAGE_PROOF_FIELDS.map(field=>field==='message_id'?'extra':row[field]),null);}
    if(damage==='inactive-owner')projection(f,state=>{state.members.owner.active=false;});
    if(damage==='grant-change')projection(f,state=>{state.members.owner.permissions=[];});
    if(damage==='explicit-null-round')projection(f,state=>{state.workItems.task.round_count=null;});
    if(damage==='malformed-round')projection(f,state=>{state.workItems.task.round_count=-1;});
    if(damage==='explicit-null-channel')projection(f,state=>{state.messages[0].channelId=null;});
    if(damage==='extra-work-key')projection(f,state=>{state.workItems.task.untrusted=true;});
    if(damage==='changed-existing-work')projection(f,state=>{state.workItems.task.title='Changed independent intent';});
    if(damage==='missing-record-key'||damage==='extra-record-key'){const row=db.prepare('SELECT record_json FROM messages WHERE room_id=?').get(roomId),record=JSON.parse(row.record_json);if(damage==='missing-record-key')delete record.authorId;else record.untrusted=true;db.prepare('UPDATE messages SET record_json=? WHERE room_id=?').run(JSON.stringify(record),roomId);}
    if(damage==='null-extras')db.prepare('UPDATE messages SET reducer_extras_json=NULL WHERE room_id=?').run(roomId);
    if(damage==='malformed-record')db.prepare("UPDATE messages SET record_json='{' WHERE room_id=?").run(roomId);
    const before=snapshot(f.s);assert.throws(()=>repairLegacyMessages(f.s,f.request),e=>e.status===409);assert.deepEqual(snapshot(f.s),before);
  });
test('equivalent JSON key order preserves exact row bytes when hashing an independently proved row',t=>{
  const f=fixture(t),db=f.s.db,row=db.prepare('SELECT record_json FROM messages WHERE room_id=?').get(roomId),record=JSON.parse(row.record_json);
  const wire=JSON.stringify(Object.fromEntries(Object.entries(record).reverse()),null,1);db.prepare('UPDATE messages SET record_json=? WHERE room_id=?').run(wire,roomId);
  const plan=repairLegacyMessages(f.s,f.request);execute(f,plan);const after=db.prepare('SELECT * FROM messages WHERE room_id=?').get(roomId);
  assert.equal(after.record_json,wire);assert.equal(messageProofMatches(after),true);
});
for(const stage of ['proof','derived','receipt'])test(`storage fault at ${stage} rolls back proofs, derived state and receipt before exact retry`,t=>{
  const f=fixture(t),plan=repairLegacyMessages(f.s,f.request),before=snapshot(f.s),db=f.s.db;
  const target=stage==='proof'?['messages','UPDATE','NEW.entity_hash IS NOT NULL']:stage==='derived'?['messages_backfill_cursor','UPDATE','1']:['operator_actions','INSERT',"NEW.action='legacy_session_backfill_reconciled'"];
  db.exec(`CREATE TRIGGER fail_adoption BEFORE ${target[1]} ON ${target[0]} WHEN ${target[2]} BEGIN SELECT RAISE(ABORT,'synthetic adoption storage fault'); END`);
  assert.throws(()=>execute(f,plan),/synthetic adoption storage fault/);assert.deepEqual(snapshot(f.s),before);
  db.exec('DROP TRIGGER fail_adoption');const completed=execute(f,plan);assert.equal(completed.messageProofsAdopted,1);assert.deepEqual(execute(f,plan),{...completed,duplicate:true});
});
test('same-head source mutation and opt-in intent changes cannot reuse a plan or saved response',t=>{
  const f=fixture(t),plan=repairLegacyMessages(f.s,f.request);
  f.s.db.prepare("UPDATE events SET body=json_set(body,'$.data.note','new source') WHERE room_id=? AND sequence=1").run(roomId);
  const before=snapshot(f.s);assert.throws(()=>execute(f,plan),e=>e.code==='repair_plan_changed');assert.deepEqual(snapshot(f.s),before);
});
test('lost response remains an immutable exact retry after later source writes',t=>{
  const f=fixture(t),plan=repairLegacyMessages(f.s,f.request),completed=execute(f,plan),key=f.s.issueAccessKey(roomId,'owner');
  f.s.command(key,roomId,{id:'later',type:'message.posted',data:{messageId:'later-message',body:'Later synthetic post'}});
  const before=snapshot(f.s);assert.deepEqual(execute(f,plan),{...completed,duplicate:true});assert.deepEqual(snapshot(f.s),before);
  assert.throws(()=>execute(f,plan,'adopt-1',{messageProofMode:undefined}),e=>e.code==='idempotency_conflict');
});
