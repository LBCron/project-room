import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {initialRecoveryReportRow,recoveryReportRowReader} from '../server/recovery-report-source.mjs';
import {recoveryReportRequestBudget} from '../server/recovery-report-stage.mjs';
const hash=text=>createHash('sha256').update(text).digest('hex');
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
test('four original1MiB binary cells preserve exact Node report1 bytes with bounded cold batches',{timeout:120000},()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE input(bytes)');const size=1024*1024;
 for(let n=0;n<4;n++)db.prepare('INSERT INTO input VALUES(?)').run(Uint8Array.from({length:size},(_,i)=>(i*31+n)%256));
 const prepare=db.prepare.bind(db);let blockReads=0;db.prepare=sql=>{if(/hex\(substr\("bytes",\?,\?\)\)/.test(sql))blockReads++;return prepare(sql);};
 let requests=0,maxWork=0,maxBytes=0;
 try{for(let id=1;id<=4;id++){
  const original=canonical(prepare('SELECT * FROM input WHERE rowid=?').get(id)),digest=createHash('sha256');let current=initialRecoveryReportRow(db,'input',id,size),done=false;
  while(!done){const budget=recoveryReportRequestBudget(),read=recoveryReportRowReader(db,{snapshot:null,scratch:null,budget});let calls=0,prior=JSON.stringify(current);
   while(calls++<128&&budget.canSourceUnit()){
    const r=read(current,{maxUnits:16384});current=r.state;
    if(r.chunk!==null){budget.charge(Buffer.byteLength(JSON.stringify({text:r.chunk,last:r.last}))+512);digest.update(r.chunk);}
    if(r.last){done=true;break;}if(r.units===0&&r.chunk===null)break;
   }
   requests++;maxWork=Math.max(maxWork,budget.usedWork);maxBytes=Math.max(maxBytes,4*1024*1024-budget.remainingBytes);assert.ok(budget.usedWork<=16384);assert.ok(budget.remainingBytes>=0);assert.notEqual(JSON.stringify(current),prior);current=JSON.parse(JSON.stringify(current));assert.ok(requests<1024,'four legal1MiB cells must not require the old131072continuations');
  }
  assert.equal(digest.digest('hex'),hash(original),'original byte-for-byte canonical digest, including numeric key lexical order');
 }}finally{db.close();}
 assert.ok(blockReads<4*size/32,'cached block reads replace per-byte SQL');tDiagnostic({requests,oldOneByteUnitLowerBound:4*size/32,blockReads,maxWork,maxLogicalBytes:maxBytes});
 function tDiagnostic(value){console.log('REPORT_BINARY_BATCHING '+JSON.stringify(value));}
});
test('request budgets reserve a largest legal unit, refuse excess and stop before exhaustion',()=>{
 const budget=recoveryReportRequestBudget();assert.equal(budget.canSourceUnit(),true);assert.equal(budget.canSortUnit(),true);assert.throws(()=>budget.charge(4*1024*1024+1),/budget exceeded/);assert.equal(budget.remainingBytes,4*1024*1024);budget.charge(4*1024*1024-1);assert.equal(budget.canSourceUnit(),false);assert.equal(budget.canSortUnit(),false);assert.equal(recoveryReportRequestBudget().canSortUnit(),true);
});
