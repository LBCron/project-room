import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { projectionDigest, messageProofHash, MESSAGE_PROOF_SELECT } from '../server/write-integrity.mjs';
function fixture(t){const s=new RoomStore(':memory:');t.after(()=>s.close());s.initialize(initialRoom());const key=s.issueAccessKey('commons','owner');return {s,key};}
const proof=s=>s.db.prepare("SELECT metadata_hash FROM integrity_room_state WHERE room_id='commons'").get().metadata_hash;
test('unused serialized candidates never publish proof and expire after their transaction',t=>{
 const {s}=fixture(t),before=proof(s);let candidate;
 s.transaction(()=>{const state=structuredClone(s.room('commons').state);state.room.title='Unused candidate';candidate=s.storedProjection('commons',state);});
 assert.equal(proof(s),before);
 s.db.prepare("UPDATE rooms SET projection=? WHERE id='commons'").run(candidate);
 assert.equal(proof(s),before,'a later unregistered write cannot reuse an expired candidate');
});
test('proof updates roll back when the actual projection write fails',t=>{
 const {s,key}=fixture(t),before=proof(s),head=s.headSequence('commons');
 s.db.exec("CREATE TRIGGER fail_projection BEFORE UPDATE OF projection ON rooms BEGIN SELECT RAISE(ABORT,'injected projection failure'); END");
 assert.throws(()=>s.command(key,'commons',{id:'post',type:'message.posted',data:{messageId:'m',body:'Body'}}),/injected projection failure/);
 assert.equal(proof(s),before);assert.equal(s.headSequence('commons'),head);
 s.db.exec('DROP TRIGGER fail_projection');s.command(key,'commons',{id:'post',type:'message.posted',data:{messageId:'m',body:'Body'}});
 assert.equal(proof(s),projectionDigest(s.db.prepare("SELECT projection FROM rooms WHERE id='commons'").get().projection));
});
test('entity proof binds current payload and query indexes without scanning other messages',t=>{
 const {s,key}=fixture(t);s.command(key,'commons',{id:'post',type:'message.posted',data:{messageId:'m',body:'Body'}});
 const row=s.db.prepare(`SELECT ${MESSAGE_PROOF_SELECT},entity_hash FROM messages WHERE message_id='m'`).get();
 assert.equal(row.entity_hash,messageProofHash(row));
 for(const field of ['body','record_json','reducer_extras_json','author_id','to_member_id','thread_root_id','seq']) {
  assert.notEqual(messageProofHash({...row,[field]:field==='seq'?row.seq+1:'Changed'}),row.entity_hash,field);
 }
});
test('isolated rollback discards its candidate without consuming the outer candidate',t=>{
 const {s}=fixture(t);let rolledBack;
 s.transaction(()=>{
  const state=structuredClone(s.room('commons').state);state.room.title='Outer';const outer=s.storedProjection('commons',state);
  assert.throws(()=>s.transaction(()=>{const inner=structuredClone(state);inner.room.title='Inner';rolledBack=s.storedProjection('commons',inner);throw Error('rollback isolated');},{isolated:true}),/rollback isolated/);
  s.db.prepare("UPDATE rooms SET projection=? WHERE id='commons'").run(outer);
  assert.equal(proof(s),projectionDigest(outer));
 });
 s.db.prepare("UPDATE rooms SET projection=? WHERE id='commons'").run(rolledBack);
 assert.notEqual(proof(s),projectionDigest(rolledBack));
});

test('referral row, event, projection and proof stay atomic for standalone callers',t=>{
 const {s,key}=fixture(t);for(const id of ['referrer','referee'])s.command(key,'commons',{id,type:'member.added',data:{memberId:id,displayName:id,kind:'human',permissions:[]}});
 const before=proof(s),head=s.headSequence('commons');
 s.db.exec("CREATE TRIGGER fail_referral_projection BEFORE UPDATE OF projection ON rooms BEGIN SELECT RAISE(ABORT,'injected referral failure'); END");
 assert.throws(()=>s.referrals.record({roomId:'commons',referrerMemberId:'referrer',refereeMemberId:'referee',via:'invite'}),/injected referral failure/);
 assert.equal(s.db.prepare('SELECT count(*) AS n FROM referrals').get().n,0);assert.equal(s.headSequence('commons'),head);assert.equal(proof(s),before);
 s.db.exec('DROP TRIGGER fail_referral_projection');assert.equal(s.referrals.record({roomId:'commons',referrerMemberId:'referrer',refereeMemberId:'referee',via:'invite'}).duplicate,false);
 assert.equal(s.db.prepare('SELECT count(*) AS n FROM referrals').get().n,1);
});
