import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import * as cutover from '../server/replay-cutover.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(t,patch={}){
  const store=new RoomStore(':memory:');t.after(()=>store.close());store.initialize(initialRoom());
  const state=structuredClone(store.room('commons').state);Object.assign(state,patch);
  store.transaction(()=>store.db.prepare("UPDATE rooms SET projection=? WHERE id='commons'").run(store.storedProjection('commons',state)));
  store.db.exec(cutover.replayCutoverSchema());
  const captured=cutover.captureReplayWitness(store,{roomId:'commons',requestId:'capture',expectedHead:store.headSequence('commons'),reason:'Synthetic leaf provenance'});
  let step={bytes:0},n=0;
  while(step.phase!=='witness_verified')step=cutover.advanceReplayWitness(store,{roomId:'commons',generation:captured.generation,expectedBytes:step.bytes,requestId:'hash-'+n++});
  return {store,captured};
}
function partition(f){let step={bytes:0},n=0;while(step.phase!=='codec_partitioned')step=cutover.partitionReplayWitness(f.store,{roomId:'commons',generation:f.captured.generation,expectedBytes:step.bytes,requestId:'codec-'+n++});return step;}

test('changed witness bytes after completed independent hashing refuse before codec writes',t=>{
  const f=fixture(t),db=f.store.db;
  db.prepare("UPDATE message_replay_units SET payload=CAST(replace(CAST(payload AS TEXT),'Commons','Changed') AS BLOB) WHERE domain='witness'").run();
  const before=db.prepare('SELECT * FROM message_replay_units').all();
  assert.throws(()=>partition(f),/source chunk|witness/);
  assert.deepEqual(db.prepare('SELECT * FROM message_replay_units').all(),before);
});

test('Muse-shaped replyRequests partition by addressed entry without raising token caps',t=>{
  const replyRequests=Object.fromEntries(Array.from({length:305},(_,i)=>['request-'+i,{id:'request-'+i,body:'x'.repeat(720)}]));
  assert.ok(Buffer.byteLength(JSON.stringify(replyRequests))>223420);
  const f=fixture(t,{replyRequests}),result=partition(f);
  assert.equal(result.certified,false);assert.equal(result.publication,'pending');
  assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM message_replay_units WHERE domain='metadata-entry'").get().n,305);
  assert.deepEqual(cutover.readReplayWitnessLeaf(f.store,{roomId:'commons',generation:f.captured.generation,domain:'metadata-entry',key:JSON.stringify(['replyRequests','request-17'])}).value,replyRequests['request-17']);
});

for(const mutation of ['leaf-with-new-self-hash','pointer-index'])test(`point leaf proof refuses ${mutation}`,t=>{
  const f=fixture(t);partition(f);const db=f.store.db;
  assert.equal(typeof cutover.readReplayWitnessLeaf,'function');
  const input={roomId:'commons',generation:f.captured.generation,domain:'metadata',key:'room'};
  const original=cutover.readReplayWitnessLeaf(f.store,input);
  if(mutation==='leaf-with-new-self-hash'){
    const bytes=Buffer.from(JSON.stringify({...original.value,name:'Changed'}));
    db.prepare("UPDATE message_replay_units SET payload=?,payload_bytes=?,payload_sha256=? WHERE domain='metadata' AND unit_key='room'").run(bytes,bytes.length,sha(bytes));
  }else{
    const row=db.prepare("SELECT payload FROM message_replay_units WHERE domain='leaf-proof' AND unit_key=?").get(JSON.stringify(['metadata','room']));
    const pointer=JSON.parse(Buffer.from(row.payload).toString());pointer.index++;
    const bytes=Buffer.from(JSON.stringify(pointer));
    db.prepare("UPDATE message_replay_units SET payload=?,payload_bytes=?,payload_sha256=? WHERE domain='leaf-proof' AND unit_key=?").run(bytes,bytes.length,sha(bytes),JSON.stringify(['metadata','room']));
  }
  assert.throws(()=>cutover.readReplayWitnessLeaf(f.store,input),/leaf|binding/);
});

test('a spanning token cannot reread changed bytes from an earlier verified chunk',t=>{
  const f=fixture(t,{messages:[{id:'large',body:'x'.repeat(50000)}]}),db=f.store.db;
  let step=cutover.partitionReplayWitness(f.store,{roomId:'commons',generation:f.captured.generation,expectedBytes:0,requestId:'partial-0'});
  assert.equal(step.phase,'codec_partitioning');
  const row=db.prepare("SELECT payload FROM message_replay_units WHERE domain='witness'").get();
  const bytes=Buffer.from(row.payload),at=bytes.indexOf(Buffer.from('xxxxxxxx'));assert.ok(at>=0&&at<step.bytes);bytes[at]=121;
  db.prepare("UPDATE message_replay_units SET payload=? WHERE domain='witness'").run(bytes);
  assert.throws(()=>{for(let i=1;i<5;i++)step=cutover.partitionReplayWitness(f.store,{roomId:'commons',generation:f.captured.generation,expectedBytes:step.bytes,requestId:'partial-'+i});},/source chunk changed/);
  assert.notEqual(step.phase,'codec_partitioned');
});

test('changed chunk receipt pointer refuses independently of pointer self hashes',t=>{
  const f=fixture(t,{messages:[{id:'large',body:'x'.repeat(50000)}]}),db=f.store.db;
  const other=db.prepare("SELECT payload FROM message_replay_units WHERE domain='source-chunk' AND unit_key='16384'").get();
  db.prepare("UPDATE message_replay_units SET payload=? WHERE domain='source-chunk' AND unit_key='0'").run(other.payload);
  assert.throws(()=>partition(f),/source chunk binding/);
});

test('receipt vectors and charged repeated source reads stay within admitted unit limits',t=>{
  const f=fixture(t,{messages:[{id:'large',body:'x'.repeat(128*1024-200)},...Array.from({length:100},(_,i)=>({id:'m'+i,body:'small'}))]});
  let step={bytes:0},n=0,maxInput=0;
  while(step.phase!=='codec_partitioned'){
    step=cutover.partitionReplayWitness(f.store,{roomId:'commons',generation:f.captured.generation,expectedBytes:step.bytes,requestId:'bound-'+n++});
    assert.ok(step.leafCommitments.length<=32);assert.ok(Buffer.byteLength(JSON.stringify(step))<=4096);
    maxInput=Math.max(maxInput,step.inputBytes);assert.ok(step.inputBytes<=256*1024);
  }
  assert.ok(maxInput>128*1024,'spanning reads are included, not just the current chunk');
});
