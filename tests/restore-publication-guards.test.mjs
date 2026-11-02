import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {operatorRestoreResponse} from '../server/restore-ndjson.mjs';
import {restoreProgress} from '../server/restore-admission.mjs';
import {installRestoreFreeze} from '../server/writer-fence.mjs';
const token='synthetic-publication-restore-00000000000000';
const next=(body,id)=>({restoreId:body.restoreId,sourceSeal:body.sourceSeal,expectedRevision:body.revision,requestId:id});
async function post(store,body){
 const response=await operatorRestoreResponse(new Request('https://room.example/api/operator/restore',{method:'POST',headers:{Authorization:'Bearer '+token,...(typeof body==='string'?{}:{'Content-Type':'application/json'})},body:typeof body==='string'?body:JSON.stringify(body)}),token,store);
 return {status:response.status,body:await response.json()};
}
async function reachPublication(store,text){
 let response=await post(store,text),n=0;
 while(response.body.auditProgress?.stage!=='full_audit_pending'){
  assert.equal(response.status,202,JSON.stringify(response));assert.ok(++n<400);
  response=await post(store,next(response.body,'publication-prep-'+n));
 }
 return response.body;
}
const guards=db=>db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name GLOB 'restore_frozen_*' ORDER BY name").all();
test('publication keeps sealed guards through a failed commit, then deactivates without business-table DDL',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'restore-publication-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const source=new RoomStore(':memory:');t.after(()=>source.close());source.initialize(initialRoom(),{representation:'normalized-current-v1'});const key=source.issueAccessKey('commons','owner');
 const filename=join(dir,'target.sqlite');let store=new RoomStore(filename);t.after(()=>store.close());
 const prepared=store.db.prepare('UPDATE credentials SET revoked=revoked');
 const pending=await reachPublication(store,exportNdjsonText(source.db)),input=next(pending,'publication-final'),before=restoreProgress(store.db),sealed=guards(store.db);
 assert.ok(sealed.length>600);assert.throws(()=>prepared.run(),/restore target is sealed/);
 const prepare=store.db.prepare.bind(store.db);let injected=false;
 store.db.prepare=sql=>{const stmt=prepare(sql);if(!sql.startsWith('UPDATE current_restore_admission SET state='))return stmt;return new Proxy(stmt,{get(target,property){const fn=Reflect.get(target,property,target);if(property!=='run')return typeof fn==='function'?fn.bind(target):fn;return(...args)=>{const result=fn.apply(target,args);if(args[0]==='clear'){injected=true;throw Error('synthetic publication interrupted after clear');}return result;};}});};
 const failed=await post(store,input);store.db.prepare=prepare;assert.equal(failed.status,422);assert.equal(injected,true);assert.deepEqual(restoreProgress(store.db),before);assert.deepEqual(guards(store.db),sealed);assert.throws(()=>prepared.run(),/restore target is sealed/);
 const exec=store.db.exec.bind(store.db),drops=[];store.db.exec=sql=>{if(/^DROP TRIGGER /i.test(sql))drops.push(sql);return exec(sql);};
 const completed=await post(store,input);store.db.exec=exec;assert.equal(completed.status,200,JSON.stringify(completed));assert.equal(completed.body.verified,true);assert.equal(drops.filter(sql=>sql.includes('restore_frozen_')).length,0);assert.equal(drops.length,3);assert.deepEqual(guards(store.db),sealed);prepared.run();
 store.close();store=new RoomStore(filename);assert.deepEqual(await post(store,input),completed);assert.equal(store.authenticate(key,'commons').member.id,'owner');
 store.command(key,'commons',{id:'after-publication',type:'message.posted',data:{messageId:'after-publication',body:'Useful work after recovery'}});
 const target=new RoomStore(':memory:');t.after(()=>target.close());let again=await post(target,exportNdjsonText(store.db)),n=0;while(again.body.pending){assert.equal(again.status,202);assert.ok(++n<400);again=await post(target,next(again.body,'second-generation-'+n));}assert.equal(again.status,200,JSON.stringify(again));assert.equal(again.body.verified,true);assert.equal(target.authenticate(key,'commons').member.id,'owner');
});
test('a retained freeze family can only be reused with exactly matching definitions',t=>{
 const s=new RoomStore(':memory:');t.after(()=>s.close());const tables=s.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row=>row.name);
 s.transaction(()=>installRestoreFreeze(s.db,tables));const original=guards(s.db);s.transaction(()=>installRestoreFreeze(s.db,tables));assert.deepEqual(guards(s.db),original);
 s.db.exec('DROP TRIGGER '+original[0].name);assert.throws(()=>s.transaction(()=>installRestoreFreeze(s.db,tables)),/requires reconciliation/);
});
