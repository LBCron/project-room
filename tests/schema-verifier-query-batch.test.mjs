import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {Reminders} from '../server/reminders.mjs';
import {RequestRuns} from '../server/request-runs.mjs';
test('service schema verifiers batch fresh names, preserve missing/changed DDL refusal and rollback',()=>{
 const store=new RoomStore(':memory:');try{
  const verify=()=>{store.channelUpdates.verifySchema();new Reminders(store).verifySchema();new RequestRuns(store).verifySchema();store.inbox.verify();};
  const db=store.db,prepare=db.prepare.bind(db),queries=[];db.prepare=sql=>{if(sql.includes('sqlite_master'))queries.push(sql);return prepare(sql);};
  verify();assert.equal(queries.filter(s=>s.startsWith('SELECT name,sql FROM sqlite_master WHERE name IN (')).length,4);assert.equal(queries.filter(s=>s==='SELECT sql FROM sqlite_master WHERE name=?').length,0);
  db.prepare=prepare;
  const name='private_reminder_commands_no_update',sql=db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name).sql;
  assert.throws(()=>store.transaction(()=>{db.exec('DROP TRIGGER '+name);db.exec(sql.replace(' BEGIN',' BEGIN SELECT 1;'));verify();}),/reconciliation/);
  assert.equal(db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name).sql,sql);verify();
  assert.throws(()=>store.transaction(()=>{db.exec('DROP TRIGGER '+name);verify();}),/reconciliation/);verify();
 }finally{store.close();}
});
