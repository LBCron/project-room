import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {REPORT_CHUNK_UNITS,initialRecoveryReportTable,appendRecoveryReportChunk,sealRecoveryReportTable,advanceRecoveryReportTable,recoveryReportTableResult,initialRecoveryReportDigest,appendRecoveryReportDigest,finishRecoveryReportDigest} from '../server/recovery-report-continuation.mjs';
// Independent existing whole-oracle definition, not the implementation's feed.
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
 : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}` : JSON.stringify(value);
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
function sqliteScratch(){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE scratch(lane,room,domain,key,part,payload,PRIMARY KEY(lane,room,domain,key,part))');
 let writes=0,reads=0,bytes=0,maxBytes=0;
 return {db,reset(){writes=reads=bytes=0;},get remaining(){return 128-writes;},get(l,r,d,k,p=0){reads++;const row=db.prepare('SELECT payload FROM scratch WHERE lane=? AND room=? AND domain=? AND key=? AND part=?').get(l,r,d,k,p);if(!row)return undefined;bytes+=Buffer.byteLength(row.payload);return JSON.parse(row.payload);},set(l,r,d,k,v,p=0){writes++;const payload=JSON.stringify(v);maxBytes=Math.max(maxBytes,Buffer.byteLength(payload));db.prepare('INSERT INTO scratch VALUES(?,?,?,?,?,?) ON CONFLICT(lane,room,domain,key,part) DO UPDATE SET payload=excluded.payload').run(l,r,d,k,p,payload);},stats(){return {writes,reads,bytes,maxBytes};}};
}
function run(values,{table='fixture',restart=true}={}){
 const s=sqliteScratch();let p=initialRecoveryReportTable(table),calls=0,maxReads=0,maxBytes=0;
 for(const row of values){const text=canonical(row);for(let offset=0;offset<text.length||offset===0;offset+=REPORT_CHUNK_UNITS){s.reset();p=appendRecoveryReportChunk(s,p,text.slice(offset,offset+REPORT_CHUNK_UNITS),offset+REPORT_CHUNK_UNITS>=text.length);}}
 p=sealRecoveryReportTable(p);
 while(p.stage!=='complete'){
  s.reset();const result=advanceRecoveryReportTable(s,p);assert.ok(result.units<=16);p=restart?JSON.parse(JSON.stringify(result.state)):result.state;
  const stats=s.stats();maxReads=Math.max(maxReads,stats.reads);maxBytes=Math.max(maxBytes,stats.bytes);assert.ok(stats.writes<=16);assert.ok(++calls<100000);
 }
 const result=recoveryReportTableResult(p);assert.deepEqual(result,{table,rows:values.length,sha256:digest(values.map(canonical).sort())});
 return {result,calls,maxReads,maxBytes,stats:s.stats(),db:s.db};
}
test('whole-oracle differential: empty, one, duplicates, numbers, nested objects, Unicode and SQL sort disagreement',()=>{
 for(const values of [[],[null],[{b:1,a:2},{a:2,b:1}],[0,-0,1e-7,1e21,null,true,false],['\u{10000}','\ue000','中','é','\ud800','\udfff','"\\\n'],[{nested:{z:[1,null,'🦉'],a:{'2':1,'10':2}},a:0}]])run(values);
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE t(v TEXT)');for(const v of ['\u{10000}','\ue000'])db.prepare('INSERT INTO t VALUES(?)').run(v);
 assert.notDeepEqual(db.prepare('SELECT v FROM t ORDER BY v COLLATE BINARY').all().map(r=>r.v),['\u{10000}','\ue000'].sort());
});
test('large cells and long equal prefixes continue without full-row indexed keys; surrogate split stays exact',()=>{
 const prefix='x'.repeat(REPORT_CHUNK_UNITS*20-2);const values=[{x:prefix+'🦉z'},{x:prefix+'🦉a'},{x:prefix+'🦉a'},{x:prefix+'\ud800'},{x:prefix}];
 const r=run(values);assert.ok(r.calls>10);assert.ok(r.maxReads<=96);assert.ok(r.maxBytes<=16*2*100000);
 assert.ok(r.stats.maxBytes<50000);
 assert.ok(r.db.prepare('SELECT max(length(CAST(key AS BLOB))) n FROM scratch').get().n<=16);
});
test('exact dataSha256 retains table order and duplicates across cold serialized controls',()=>{
 const results=[run([{x:'b'},{x:'a'}],{table:'z'}).result,run([1,1,2],{table:'a'}).result];
 let hash=initialRecoveryReportDigest();for(const [i,result] of results.entries())hash=appendRecoveryReportDigest(hash,result,i===0);
 assert.equal(finishRecoveryReportDigest(hash),digest(results));assert.notEqual(finishRecoveryReportDigest(hash),digest([...results].reverse()));
});
test('bounded controls reject partial input, oversized chunks and missing staged records',()=>{
 const s=sqliteScratch();let p=initialRecoveryReportTable('fixture');assert.throws(()=>appendRecoveryReportChunk(s,p,'x'.repeat(REPORT_CHUNK_UNITS+1),true));
 assert.throws(()=>appendRecoveryReportChunk(s,p,'x',false));p=appendRecoveryReportChunk(s,p,'x'.repeat(REPORT_CHUNK_UNITS),false);assert.throws(()=>sealRecoveryReportTable(p));
 assert.throws(()=>initialRecoveryReportTable('bad-name'));const ready=sealRecoveryReportTable(initialRecoveryReportTable('fixture'));ready.rows=1;assert.throws(()=>advanceRecoveryReportTable(s,ready));
});
test('integration blocker: report scratch writes and admission cursor changes alter original report1 fingerprint',()=>{
 const s=sqliteScratch();s.db.exec("CREATE TABLE current_restore_admission(singleton,coverage);INSERT INTO current_restore_admission VALUES(1,'full_audit_pending')");
 const oracle=()=>digest(['scratch','current_restore_admission'].map(table=>({table,rows:s.db.prepare(`SELECT * FROM ${table}`).all().map(canonical).sort()})));
 const before=oracle();appendRecoveryReportChunk(s,initialRecoveryReportTable('fixture'),'{}',true);assert.notEqual(oracle(),before);
 const staged=oracle();s.db.prepare('UPDATE current_restore_admission SET coverage=?').run('{"report":{"part":1}}');assert.notEqual(oracle(),staged);
});
