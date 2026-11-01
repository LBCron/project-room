// Local-only synthetic bootstrap measurement. Never deployed.
import {DurableObject} from 'cloudflare:workers';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {DurableDatabase,durableStorage} from './storage.mjs';
import {WITNESS_SCHEMA,captureProjectionWitness,witnessChunk} from '../scripts/prototypes/replay-projection-witness.mjs';
export class ReplayWitnessRoom extends DurableObject{
  constructor(ctx,env){super(ctx,env);this.stats={statements:0,rowsRead:0,rowsWritten:0,unknown:0};this.db=new DurableDatabase(ctx.storage,{observeStatement:()=>sample=>{this.stats.statements++;this.stats.rowsRead+=sample.rowsRead??0;this.stats.rowsWritten+=sample.rowsWritten??0;if(sample.rowsRead===null||sample.rowsWritten===null)this.stats.unknown++;}});this.s=new RoomStore(null,{database:this.db,storagePlatform:durableStorage,integrity:"deferred"});this.db.exec(WITNESS_SCHEMA);}
  async fetch(request){const u=new URL(request.url),s=this.s,db=this.db;try{
    if(u.pathname==='/seed'){
      s.initialize(initialRoom());const state=structuredClone(s.room('commons').state);state.room.syntheticPadding='';
      const count=Number(u.searchParams.get('bytes'))-Buffer.byteLength(JSON.stringify(state));if(count<0)throw Error('invalid size');state.room.syntheticPadding='p'.repeat(count);
      s.transaction(()=>{const text=s.storedProjection('commons',state);db.prepare("UPDATE rooms SET projection=? WHERE id='commons'").run(text);});
      return Response.json({seeded:true,...db.prepare("SELECT length(CAST(projection AS BLOB)) AS bytes,sequence AS head FROM rooms WHERE id='commons'").get()});
    }
    if(u.pathname==='/capture'){
      const before={...this.stats},result=s.transaction(()=>captureProjectionWitness(db,{captureId:'one-capture',roomId:'commons',expectedHead:2}));
      const cost=Object.fromEntries(Object.keys(before).map(key=>[key,this.stats[key]-before[key]]));return Response.json({result,cost});
    }
    if(u.pathname==='/slice'){const chunk=witnessChunk(db,'one-capture',Number(u.searchParams.get('offset')));return Response.json({bytes:chunk?.byteLength??0,base64:chunk?Buffer.from(chunk).toString('base64'):''});}
    if(u.pathname==='/append'){
      const key=s.issueAccessKey('commons','owner');for(let i=0;i<4;i++)s.command(key,'commons',{id:'later-'+i,type:'message.posted',data:{messageId:'later-'+i,body:'Synthetic later '+i}});
      s.command(key,'commons',{id:'edit-later',type:'message.edited',data:{messageId:'later-0',body:'Edited synthetic append',expectedMessageRevision:0}});
      return Response.json({head:s.headSequence('commons')});
    }
    if(u.pathname==='/state')return Response.json({capture:db.prepare('SELECT head,metadata_hash,byte_length FROM replay_projection_witness').get(),live:db.prepare("SELECT sequence,metadata_hash FROM integrity_room_state WHERE room_id='commons'").get()});
    return new Response('Not found',{status:404});
  }catch(error){return Response.json({error:{code:error.code??'internal',message:String(error.message).slice(0,160)}},{status:error.status??500});}}
}
export default{fetch(request,env){return env.ROOM.getByName('witness').fetch(request);}};
