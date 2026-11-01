import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import * as cutover from '../server/replay-cutover.mjs';
function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'replay-schema-')),filename=join(directory,'room.sqlite');
  let store=new RoomStore(filename);store.initialize(initialRoom());store.db.exec(cutover.replayCutoverSchema());
  const captured=cutover.captureReplayWitness(store,{roomId:'commons',requestId:'capture-schema',expectedHead:store.headSequence('commons'),reason:'Synthetic schema admission'});
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  const step=n=>cutover.advanceReplayWitness(store,{roomId:'commons',generation:captured.generation,expectedBytes:0,requestId:'schema-step-'+n});
  return {get store(){return store;},step,reopen(){store.close();store=new RoomStore(filename);}};
}
function measure(db){
  const counts={definitions:0,versions:0},original=db.prepare.bind(db);
  db.prepare=sql=>{if(sql.includes('FROM sqlite_master WHERE name=?'))counts.definitions++;
    if(sql==='PRAGMA schema_version')counts.versions++;return original(sql);};
  return counts;
}
test('warm bounded steps use scalar schema version instead of repeated full definition scans',t=>{
  const f=fixture(t),counts=measure(f.store.db);f.step(1);
  assert.equal(counts.definitions,0);assert.equal(counts.versions,1);
});
test('DROP and exact recreate refuses until explicit readmission',t=>{
  const f=fixture(t),db=f.store.db,sql=db.prepare("SELECT sql FROM sqlite_master WHERE name='replay_source_update'").get().sql;
  db.exec('DROP TRIGGER replay_source_update');db.exec(sql);
  assert.throws(()=>f.step(1),/schema.*reconciliation|readmission/);
  assert.throws(()=>f.step(2),/schema.*reconciliation|readmission/);
  cutover.admitReplayCutoverSchema(db);assert.equal(f.step(3).phase,'witness_verified');
});
test('unrelated DDL invalidates admission without silently accepting a changed contract',t=>{
  const f=fixture(t),db=f.store.db;db.exec('CREATE TABLE synthetic_unrelated_schema(value TEXT)');
  assert.throws(()=>f.step(1),/schema.*reconciliation|readmission/);
  cutover.admitReplayCutoverSchema(db);assert.equal(f.step(2).phase,'witness_verified');
});
test('reopen performs fresh exact admission and then uses its own connection cache',t=>{
  const f=fixture(t);f.reopen();const counts=measure(f.store.db);f.step(1);
  assert.equal(counts.definitions,8);counts.definitions=0;counts.versions=0;f.step(2);
  assert.equal(counts.definitions,0);assert.equal(counts.versions,1);
});
test('rolled back DDL restores the admitted schema version without a hidden rescan',t=>{
  const f=fixture(t),db=f.store.db,before=db.prepare('PRAGMA schema_version').get().schema_version;
  assert.throws(()=>f.store.transaction(()=>{db.exec('DROP TRIGGER replay_source_update');throw Error('synthetic rollback');}),/synthetic rollback/);
  assert.equal(db.prepare('PRAGMA schema_version').get().schema_version,before);
  const counts=measure(db);assert.equal(f.step(1).phase,'witness_verified');assert.equal(counts.definitions,0);
});
