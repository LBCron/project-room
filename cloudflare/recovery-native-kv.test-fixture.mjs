// Engine-only Native qualification. Completion here is not restore publication.
import {DurableObject} from 'cloudflare:workers';
import {RoomStore} from '../server/store.mjs';
import {DurableDatabase,durableStorage} from './storage.mjs';
import {beginRestore,withRestoreTransaction,checkpointRestore,restoreProgress} from '../server/restore-admission.mjs';
import {initialRecoveryEngine,advanceRecoveryEngine} from '../server/recovery-engine-continuation.mjs';
export class RecoveryKvProbe extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.store=new RoomStore(null,{database:new DurableDatabase(ctx.storage),storagePlatform:durableStorage});}
 async fetch(){
  await this.ctx.storage.put('engine-fixture-sentinel','original-private-kv');
  const s=this.store;s.db.exec('CREATE TABLE engine_parent(id INTEGER PRIMARY KEY); CREATE TABLE engine_child(id INTEGER REFERENCES engine_parent(id)); INSERT INTO engine_parent VALUES(1); INSERT INTO engine_child VALUES(1)');
  const names=s.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row=>row.name);
  const id=beginRestore(s);withRestoreTransaction(s,()=>checkpointRestore(s.db,{restoreId:id,expectedRevision:0,phase:'audit_pending',seal:{fixture:true},progress:{fixture:true},latest:null}));
  const seen=[];const prepare=s.db.prepare.bind(s.db);s.db.prepare=sql=>{if(/^PRAGMA (quick_check|foreign_key_check)/.test(sql))seen.push(sql);return prepare(sql);};
  let p=initialRecoveryEngine(),steps=0;
  while(p.stage!=='complete'){const before=JSON.stringify(p);p=withRestoreTransaction(s,()=>advanceRecoveryEngine(s,id,p));if(JSON.stringify(p)===before||++steps>1000)throw Error('Engine did not advance within finite table bound');if(p.lastBatch.atoms>16)throw Error('Engine batch exceeded existing limit');}
  return Response.json({engine:p,steps,privateTablePresent:names.includes('_cf_KV'),privateKv:await this.ctx.storage.get('engine-fixture-sentinel'),expectedQuickTables:names.filter(n=>!n.startsWith('sqlite_')&&!n.startsWith('_cf_')).length,expectedForeignTables:names.filter(n=>!n.startsWith('_cf_')).length,privateForeignChecks:seen.filter(sql=>/^PRAGMA foreign_key_check\("_cf_/.test(sql)).length,parentChecked:seen.includes('PRAGMA foreign_key_check("engine_parent")'),childChecked:seen.includes('PRAGMA foreign_key_check("engine_child")'),admissionStillPending:restoreProgress(s.db).state==='pending'});
 }
}
export default{fetch(request,env){return env.ROOM.getByName('engine').fetch(request);}};
