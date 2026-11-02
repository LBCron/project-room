// Private, disposable fixtures. Never opens an existing database or edits runtime.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const [oldRoot,newRoot]=process.argv.slice(2);
assert.ok(oldRoot&&newRoot&&process.argv.length===4);
const git=process.env.LOCAL_LAB_GIT??'git';
const pins=[oldRoot,newRoot].map(root=>{
  execFileSync(git,['-C',root,'diff','--quiet','HEAD','--']);
  return execFileSync(git,['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
});
assert.deepEqual(pins,['8e65a6e73ae191ffa7fc89c2e88fa382ad2ac000','2ebce68b3c556f313476716afdae84f2a2b33e6d']);
const {RoomStore}=await import(pathToFileURL(oldRoot+'/server/store.mjs'));
const {upgradeUnusedCurrentFormat5}=await import(pathToFileURL(newRoot+'/server/current-room-repository.mjs'));
const tables=['current_room_head','current_room_records','current_room_record_proofs','current_restore_audit_scratch','current_room_writer_permit','current_restore_admission'];
const snapshot=db=>({catalog:db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY name').all(),tables:Object.fromEntries(tables.map(t=>[t,db.prepare('SELECT * FROM '+t).all()])),changes:db.prepare('SELECT total_changes() n').get().n});
const results=[];
for(const kind of ['open_writer_permit','leftover_audit_scratch']){
  const store=new RoomStore(':memory:'),db=store.db;
  try{
    const trigger=kind==='open_writer_permit'?'current_room_permit_update':'current_restore_audit_scratch_insert';
    const sql=db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(trigger).sql;
    db.exec('BEGIN IMMEDIATE');
    db.exec('DROP TRIGGER '+trigger);
    if(kind==='open_writer_permit')db.prepare("UPDATE current_room_writer_permit SET enabled=1,room_id='held-room',receipt_id='held-receipt'").run();
    else db.prepare("INSERT INTO current_restore_audit_scratch VALUES('held','actual','held-room','probe','key',0,2,'{}')").run();
    db.exec(sql);db.exec('COMMIT');
    for(const table of tables.slice(0,3))assert.equal(db.prepare('SELECT count(*) n FROM '+table).get().n,0);
    const before=snapshot(db),exec=db.exec.bind(db);let drops=0,error;
    db.exec=sql=>{if(/DROP\s+TRIGGER/i.test(sql))drops++;return exec(sql);};
    try{
      db.exec('BEGIN IMMEDIATE');
      try{upgradeUnusedCurrentFormat5(db);assert.fail('Expected refusal');}
      catch(e){error=e.message;db.exec('ROLLBACK');}
    }finally{db.exec=exec;}
    assert.match(error,kind==='open_writer_permit'?/unfinished authority/:/Populated previous current format/);
    assert.equal(drops,0);assert.deepEqual(snapshot(db),before);
    results.push({case:kind,pass:true,error,upgradeTriggerDrops:drops,catalogAndDataUnchanged:true});
  }finally{store.close();}
}
console.log(JSON.stringify({schema:'member2-empty-upgrade-extra-controls-v1',node:process.version,pins,fixture:'genuine old RoomStore, disposable in-memory Node SQLite; controlled state mutation with exact original guards restored',limits:'Not Native, production, completed restore, or populated-format migration evidence',results},null,2));
