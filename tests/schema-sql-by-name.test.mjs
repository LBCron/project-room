import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {schemaSqlByName} from '../server/schema-sql-by-name.mjs';

test('fresh bounded catalog batches preserve original first name match across namespaces',()=>{
 const db=new DatabaseSync(':memory:');
 try {
  db.exec('CREATE TABLE same_name(id); CREATE TABLE target(id); CREATE TRIGGER same_name BEFORE INSERT ON target BEGIN SELECT 1; END;');
  const names=['same_name','target','absent','same_name'],expected=name=>db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name)?.sql;
  let actual=schemaSqlByName(db,names);for(const name of names)assert.equal(actual.get(name),expected(name));
  db.exec('DROP TABLE same_name; CREATE TABLE same_name(changed);');
  actual=schemaSqlByName(db,names);for(const name of names)assert.equal(actual.get(name),expected(name));
  assert.match(actual.get('same_name'),/^CREATE TRIGGER/);
  const plan=db.prepare('EXPLAIN QUERY PLAN SELECT name,sql FROM sqlite_master WHERE name IN (?,?) ORDER BY rowid').all('same_name','target');
  assert.equal(plan.filter(r=>/SCAN sqlite_master/.test(r.detail)).length,1,JSON.stringify(plan));assert.ok(!plan.some(r=>/TEMP B-TREE/.test(r.detail)),JSON.stringify(plan));
 } finally {db.close();}
});
test('more than64 names remain exact with at most64 bindings per fresh query',()=>{
 const db=new DatabaseSync(':memory:');try{
  const names=Array.from({length:130},(_,i)=>'table_'+i);for(const name of names)db.exec('CREATE TABLE '+name+'(id)');
  const prepare=db.prepare.bind(db),batches=[];db.prepare=sql=>{const stmt=prepare(sql),all=stmt.all.bind(stmt);stmt.all=(...args)=>{batches.push(args.length);return all(...args);};return stmt;};
  assert.equal(schemaSqlByName(db,names).size,130);assert.deepEqual(batches,[64,64,2]);
 }finally{db.close();}
});
