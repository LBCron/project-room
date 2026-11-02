import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {RESTORE_CONTROL_GUARDS,beginRestore,withRestoreTransaction} from '../server/restore-admission.mjs';
// Exact preceding protocol20 DDL fixture. Only its embedded protocol literal
// changes; no source rows, receipt or progress values are fabricated.
function install20(db) { for(const[name,sql] of RESTORE_CONTROL_GUARDS){db.exec('DROP TRIGGER '+name);db.exec(sql.replaceAll('audit-scratch-21:','audit-scratch-20:'));} }
function fixture(t,{empty=false}={}){const dir=mkdtempSync(join(tmpdir(),'channel-protocol-')),path=join(dir,'store.sqlite'),store=new RoomStore(path);if(!empty)store.initialize(initialRoom());const key=empty?null:store.issueAccessKey('commons','owner');t.after(()=>rmSync(dir,{recursive:true,force:true}));return{path,store,key};}
const dump=db=>['rooms','events','commands','accounts','credentials','current_room_head','current_room_records','current_room_record_proofs','current_restore_admission'].map(table=>[table,db.prepare('SELECT * FROM '+table).all()]);
test('exact clear20 cold upgrade preserves populated native room and authority; prepared old DML remains refused',t=>{
 const f=fixture(t),before=dump(f.store.db),held=new RoomStore(f.path);f.store.transaction(()=>install20(f.store.db));
 const prepared=held.db.prepare("UPDATE current_restore_admission SET revision=revision+1");
 assert.throws(()=>prepared.run(),/audit-scratch-20/);f.store.close();
 const current=new RoomStore(f.path);try{assert.deepEqual(dump(current.db),before);assert.equal(current.authenticate(f.key,'commons').member.id,'owner');assert.throws(()=>prepared.run(),/audit-scratch-21/);assert.ok(current.db.prepare("SELECT sql FROM sqlite_master WHERE name='current_restore_admission_update'").get().sql.includes('audit-scratch-21:'));}finally{current.close();held.close();}
});
test('pending20 is refused before DDL or business progress, preserving original bytes',t=>{
 const f=fixture(t,{empty:true});beginRestore(f.store);withRestoreTransaction(f.store,()=>install20(f.store.db));const before=dump(f.store.db),defs=f.store.db.prepare("SELECT name,sql FROM sqlite_master WHERE name GLOB 'current_restore_*' ORDER BY name").all();f.store.close();
 assert.throws(()=>new RoomStore(f.path),/Pending previous restore protocol requires explicit recovery|Restore admission schema requires reconciliation/);
 const db=new DatabaseSync(f.path);try{assert.deepEqual(dump(db),before);assert.deepEqual(db.prepare("SELECT name,sql FROM sqlite_master WHERE name GLOB 'current_restore_*' ORDER BY name").all(),defs);}finally{db.close();}
});
test('changed old guard and unfinished cleanup refuse exact upgrade without replacing observed SQL',t=>{
 const f=fixture(t);f.store.transaction(()=>install20(f.store.db));f.store.db.exec('DROP TRIGGER current_restore_admission_delete');f.store.db.exec("CREATE TRIGGER current_restore_admission_delete BEFORE DELETE ON current_restore_admission BEGIN SELECT RAISE(ABORT,'wrong'); END");const before=dump(f.store.db);f.store.close();assert.throws(()=>new RoomStore(f.path),/Previous restore protocol schema requires reconciliation/);const db=new DatabaseSync(f.path);try{assert.deepEqual(dump(db),before);assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE name='current_restore_admission_delete'").get().sql,/'wrong'/);}finally{db.close();}
});
