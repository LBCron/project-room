// Disposable algorithm qualification. NOT the production restore endpoint.
import {DurableObject} from 'cloudflare:workers';
import {initialRecoveryReportTable,appendRecoveryReportChunk,sealRecoveryReportTable,advanceRecoveryReportTable,recoveryReportTableResult,REPORT_CHUNK_UNITS} from '../server/recovery-report-continuation.mjs';
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
export class ReportFixture extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS scratch(lane TEXT,room TEXT,domain TEXT,key TEXT,part INTEGER,payload_bytes INTEGER,payload TEXT,PRIMARY KEY(lane,room,domain,key,part))');this.sql.exec('CREATE TABLE IF NOT EXISTS control(id INTEGER PRIMARY KEY,payload TEXT)');}
 async fetch(request){
  const url=new URL(request.url),records=[];let writes=0;
  const query=(sql,...params)=>{const c=this.sql.exec(sql,...params),rows=c.toArray();records.push({statements:1,rowsRead:c.rowsRead,rowsWritten:c.rowsWritten,bytes:new TextEncoder().encode(JSON.stringify(rows)).length});return rows;};
  const scratch={get remaining(){return 128-writes;},get:(l,r,d,k,p=0)=>{const size=query('SELECT payload_bytes,length(CAST(payload AS BLOB)) bytes FROM scratch WHERE lane=? AND room=? AND domain=? AND key=? AND part=?',l,r,d,k,p)[0];if(!size)return undefined;if(size.bytes!==size.payload_bytes||size.bytes>133120)throw Error('bad size');return JSON.parse(query('SELECT payload FROM scratch WHERE lane=? AND room=? AND domain=? AND key=? AND part=?',l,r,d,k,p)[0].payload);},set:(l,r,d,k,v,p=0)=>{const payload=JSON.stringify(v);writes++;query('INSERT INTO scratch VALUES(?,?,?,?,?,?,?) ON CONFLICT(lane,room,domain,key,part) DO UPDATE SET payload_bytes=excluded.payload_bytes,payload=excluded.payload',l,r,d,k,p,new TextEncoder().encode(payload).length,payload);}};
  if(url.pathname==='/init'){
   this.sql.exec('DELETE FROM scratch');const n=Number(url.searchParams.get('n'));let state=initialRecoveryReportTable('fixture');
   // Source fixture setup intentionally materializes one row; this does NOT
   // qualify the as-yet-unimplemented production source encoder.
   for(let i=0;i<n;i++){const row={id:n-i,body:i<2?'x'.repeat(160000)+'🦉':'item'+String(i%17),value:i%3};const text=canonical(row);for(let offset=0;offset<text.length;offset+=REPORT_CHUNK_UNITS){writes=0;state=appendRecoveryReportChunk(scratch,state,text.slice(offset,offset+REPORT_CHUNK_UNITS),offset+REPORT_CHUNK_UNITS>=text.length);}}
   state=sealRecoveryReportTable(state);this.sql.exec('INSERT OR REPLACE INTO control VALUES(1,?)',JSON.stringify(state));return Response.json({ready:true});
  }
  let state=JSON.parse(this.sql.exec('SELECT payload FROM control WHERE id=1').one().payload);const step=advanceRecoveryReportTable(scratch,state);state=step.state;this.sql.exec('UPDATE control SET payload=? WHERE id=1',JSON.stringify(state));
  const cost=records.reduce((a,r)=>{for(const k of Object.keys(a))a[k]+=r[k];return a;},{statements:0,rowsRead:0,rowsWritten:0,bytes:0});
  return Response.json({state:state.stage,units:step.units,cost,result:state.stage==='complete'?recoveryReportTableResult(state):null});
 }
}
export default {fetch(request,env){return env.ROOM.get(env.ROOM.idFromName('fixture')).fetch(request);}};
