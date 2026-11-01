// Local synthetic codec probe only; never deployed as a Room endpoint.
import { DurableObject } from 'cloudflare:workers';
import { MESSAGE_REPLAY_SNAPSHOT_SCHEMA,writeMessageReplaySnapshot,
 readMessageReplaySnapshot,decodeMessageReplaySnapshot } from '../../../server/message-replay-snapshot.mjs';
import { createHash } from 'node:crypto';
const size=x=>typeof x==='string'?new TextEncoder().encode(x).length:0;
export class CheckpointProbe extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY)');ctx.storage.sql.exec("INSERT OR IGNORE INTO rooms VALUES ('synthetic')");ctx.storage.sql.exec(MESSAGE_REPLAY_SNAPSHOT_SCHEMA);}
 async fetch(request){
  const url=new URL(request.url),sql=this.ctx.storage.sql;
  const meter={readBytes:0,readRows:0,writeBytes:0,rowsRead:0,rowsWritten:0};
  const perform=(query,args,write)=>{const cur=sql.exec(query,...args),rows=cur.toArray();meter.rowsRead+=cur.rowsRead;meter.rowsWritten+=cur.rowsWritten;
   if(write)meter.writeBytes+=args.reduce((n,x)=>n+size(x),0);
   else{meter.readRows+=rows.length;for(const row of rows)meter.readBytes+=Object.values(row).reduce((n,x)=>n+size(x),0);}return rows;};
  const db={prepare(query){return {run(...args){return perform(query,args,true);},get(...args){return perform(query,args,false)[0];},all(...args){return perform(query,args,false);}};}};
  try {
   if(url.pathname==='/seed'){
    const count=Number(url.searchParams.get('count'));if(![1000,10000,30000].includes(count))return new Response('Invalid size',{status:400});
    const state={room:{id:'synthetic'},messages:Array.from({length:count},(_,i)=>({id:`m${i}`,body:'Synthetic text 🧪 漢字 '.repeat(8),authorId:'owner',createdAt:'2026-11-01T00:00:00Z'}))};
    const json=JSON.stringify(state);this.ctx.storage.transactionSync(()=>writeMessageReplaySnapshot(db,'synthetic',json));
    return Response.json({count,encodedBytes:size(json),digest:createHash('sha256').update(json).digest('hex'),meter});
   }
   if(url.pathname==='/read'||url.pathname==='/append'){
    const row=readMessageReplaySnapshot(db,'synthetic'),state=decodeMessageReplaySnapshot(db,'synthetic',row.state_json);
    const readMeter={...meter};
    if(url.pathname==='/append'){
     state.messages.push({id:'appended',body:'One extra event',authorId:'owner',createdAt:'2026-11-01T00:00:01Z'});
     this.ctx.storage.transactionSync(()=>writeMessageReplaySnapshot(db,'synthetic',JSON.stringify(state)));
    }
    return Response.json({count:state.messages.length,digest:createHash('sha256').update(JSON.stringify(state)).digest('hex'),readMeter,meter});
   }
   if(url.pathname==='/tamper'){sql.exec("UPDATE messages_backfill_state SET json='X'||substr(json,2) WHERE room_id='synthetic' AND part=0");return Response.json({tampered:true});}
   return new Response('Not found',{status:404});
  }catch(e){return Response.json({error:{message:String(e.message).slice(0,200)},meter},{status:500});}
 }
}
export default {fetch(request,env){return env.PROBE.getByName('codec').fetch(request);}};
