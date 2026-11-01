// Finite synthetic codec experiment. Not a production/Worker benchmark.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MESSAGE_REPLAY_SNAPSHOT_SCHEMA, writeMessageReplaySnapshot,
  readMessageReplaySnapshot, decodeMessageReplaySnapshot } from '../../../server/message-replay-snapshot.mjs';

const sourceUrl=new URL('../../../server/message-replay-snapshot.mjs',import.meta.url);
const source=await readFile(sourceUrl,'utf8');
const directory=await mkdtemp(join(tmpdir(),'member2-codec-'));
const bytes=value=>typeof value==='string'?Buffer.byteLength(value):0;
const measurements=[];
try {
 for(const count of [1000,10000,50000]) {
  const path=join(directory,`synthetic-${count}.sqlite`);
  let sql=new DatabaseSync(path),meter={readBytes:0,readRows:0,writeBytes:0,writeCalls:0};
  sql.exec('CREATE TABLE rooms(id TEXT PRIMARY KEY); INSERT INTO rooms VALUES (\'synthetic\')');
  sql.exec(MESSAGE_REPLAY_SNAPSHOT_SCHEMA);
  const adapter={prepare(query){const statement=sql.prepare(query);return {
   run(...args){meter.writeBytes+=args.reduce((sum,v)=>sum+bytes(v),0);meter.writeCalls++;return statement.run(...args);},
   get(...args){const row=statement.get(...args);if(row){meter.readRows++;meter.readBytes+=Object.values(row).reduce((sum,v)=>sum+bytes(v),0);}return row;},
   all(...args){const rows=statement.all(...args);meter.readRows+=rows.length;for(const row of rows)meter.readBytes+=Object.values(row).reduce((sum,v)=>sum+bytes(v),0);return rows;}
  };}};
  const state={room:{id:'synthetic'},messages:Array.from({length:count},(_,i)=>({id:`m${i}`,authorId:'owner',body:'Synthetic text 🧪 漢字 '.repeat(8),createdAt:'2026-11-01T00:00:00Z'})),eventLog:[],seenEvents:{}};
  const json=JSON.stringify(state),start=performance.now();
  sql.exec('BEGIN');writeMessageReplaySnapshot(adapter,'synthetic',json);sql.exec('COMMIT');
  const writeMs=performance.now()-start,initialWrite={...meter};
  const parts=sql.prepare('SELECT count(*) AS n,max(length(CAST(json AS BLOB))) AS largest FROM messages_backfill_state').get();
  sql.close();sql=new DatabaseSync(path);meter={readBytes:0,readRows:0,writeBytes:0,writeCalls:0};
  const readStart=performance.now(),saved=readMessageReplaySnapshot(adapter,'synthetic');
  const decoded=decodeMessageReplaySnapshot(adapter,'synthetic',saved.state_json);
  const readMs=performance.now()-readStart,read={...meter};assert.deepEqual(decoded,state);
  let corruptionRefused=null,missingRefused=null;
  if(parts.n) {
   const original=sql.prepare('SELECT json FROM messages_backfill_state WHERE part=0').get().json;
   sql.prepare('UPDATE messages_backfill_state SET json=? WHERE part=0').run('X'+original.slice(1));
   assert.throws(()=>decodeMessageReplaySnapshot(adapter,'synthetic',saved.state_json),/torn/);corruptionRefused=true;
   sql.prepare('UPDATE messages_backfill_state SET json=? WHERE part=0').run(original);
   sql.exec('DELETE FROM messages_backfill_state WHERE part=0');
   assert.throws(()=>decodeMessageReplaySnapshot(adapter,'synthetic',saved.state_json),/torn/);missingRefused=true;
   sql.prepare('INSERT INTO messages_backfill_state VALUES (?,?,?)').run('synthetic',0,original);
  }
  // A single newly replayed message changes the full serialized snapshot.
  state.messages.push({id:`m${count}`,authorId:'owner',body:'One extra event',createdAt:'2026-11-01T00:00:01Z'});
  meter={readBytes:0,readRows:0,writeBytes:0,writeCalls:0};
  sql.exec('BEGIN');writeMessageReplaySnapshot(adapter,'synthetic',JSON.stringify(state));sql.exec('COMMIT');
  measurements.push({messages:count,encodedBytes:Buffer.byteLength(json),parts:parts.n,largestPartBytes:parts.largest??0,initialWrite,readAfterSqliteReopen:read,oneMessageAppendWrite:{...meter},corruptionRefused,missingPartRefused:missingRefused,writeWallMs:writeMs,readWallMs:readMs});
  sql.close();
 }
} finally {await rm(directory,{recursive:true,force:true});}
const result={sourceRevision:'513d3ee8471464803fd3c70dea2fe9ce30f27ad0',codecSha256:createHash('sha256').update(source).digest('hex'),node:process.version,measuredAt:new Date().toISOString(),limitations:['Synthetic codec calls with real local SQLite; not the complete backfill or workerd','SQL bytes returned/bound count application payload only, not engine page reads or WAL','Connection reopen is not a Worker/process restart','Wall time is local observation, not production CPU admission'],measurements};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));
