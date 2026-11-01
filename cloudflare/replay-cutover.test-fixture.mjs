// Local synthetic qualification only. DDL activation is confined to this fixture.
import {ReplayWitnessRoom} from './replay-projection-witness.test-fixture.mjs';
import {replayCutoverSchema,captureReplayWitness,advanceReplayWitness,partitionReplayWitness} from '../server/replay-cutover.mjs';
import {applyEvent,event} from '../src/events.js';
import {initialRoom} from '../server/bootstrap.mjs';
import {createHash} from 'node:crypto';
export class ReplayCutoverRoom extends ReplayWitnessRoom {
  constructor(ctx,env){
    super(ctx,env);
    if(!this.db.prepare("SELECT 1 FROM sqlite_master WHERE name='message_replay_units'").get())this.db.exec(replayCutoverSchema({durable:true}));
  }
  async fetch(request){
    const url=new URL(request.url);
    try{
      if(url.pathname==='/seed-codec'){
        this.s.initialize(initialRoom());const state=structuredClone(this.s.room('commons').state);
        const sample=applyEvent(state,event({id:'template',roomId:'commons',actorId:'owner',type:'message.posted',at:'2026-01-01T00:00:00.000Z',data:{messageId:'template',body:'Synthetic Muse-sized body'}})).messages[0];
        state.messages=Array.from({length:17405},(_,i)=>({...sample,id:'m'+i}));
        this.s.transaction(()=>this.db.prepare("UPDATE rooms SET projection=? WHERE id='commons'").run(this.s.storedProjection('commons',state)));
        return Response.json(this.db.prepare("SELECT octet_length(projection) AS bytes FROM rooms WHERE id='commons'").get());
      }
      if(url.pathname==='/durable-codec')return Response.json(partitionReplayWitness(this.s,{roomId:'commons',generation:url.searchParams.get('generation'),requestId:'codec-'+url.searchParams.get('step'),expectedBytes:Number(url.searchParams.get('bytes'))}));
      if(url.pathname==='/codec-census')return Response.json(this.db.prepare("SELECT count(*) AS messages,MAX(payload_bytes) AS maxLeafBytes FROM message_replay_units WHERE domain='message'").get());
      if(url.pathname==='/durable-capture')return Response.json(captureReplayWitness(this.s,{roomId:'commons',requestId:'durable-capture',expectedHead:2,reason:'Synthetic durable capture'}));
      if(url.pathname==='/durable-step')return Response.json(advanceReplayWitness(this.s,{roomId:'commons',generation:url.searchParams.get('generation'),requestId:'step-'+url.searchParams.get('step'),expectedBytes:Number(url.searchParams.get('bytes'))}));
      if(url.pathname==='/seed-derived'){
        const count=Number(url.searchParams.get('count')),generation=url.searchParams.get('generation');
        if(![0,17405].includes(count)||!/^[a-f0-9]{64}$/.test(generation))throw Error('invalid synthetic unit count');
        this.s.transaction(()=>{const insert=this.db.prepare("INSERT INTO message_replay_units VALUES(?,?,'message',?,1,2,?,?)");
          const digest=createHash('sha256').update('{}').digest('hex');
          for(let i=0;i<count;i++)insert.run('commons',generation,'synthetic-'+i,digest,new Uint8Array([123,125]));});
        return Response.json({count});
      }
      if(url.pathname==='/append-cost'){
        const i=url.searchParams.get('i');if(!/^[0-9]{1,3}$/.test(i))throw Error('invalid synthetic append');
        const original=this.db.prepare.bind(this.db),samples=[];
        this.db.prepare=sql=>{
          const statement=original(sql);if(!sql.startsWith('INSERT INTO events'))return statement;
          return new Proxy(statement,{get:(target,key)=>{
            const value=Reflect.get(target,key,target);if(key!=='run')return typeof value==='function'?value.bind(target):value;
            return(...args)=>{const before={...this.stats};const result=value.apply(target,args);
              samples.push(Object.fromEntries(Object.keys(before).map(k=>[k,this.stats[k]-before[k]])));return result;};
          }});
        };
        try{const key=this.s.issueAccessKey('commons','owner');
          const write=()=>this.s.command(key,'commons',{id:'cost-'+i,type:'message.posted',data:{messageId:'cost-'+i,body:'Synthetic ongoing append'}});
          if(url.searchParams.get('baseline')==='1')this.s.transaction(()=>{
            const trigger=this.db.prepare("SELECT sql FROM sqlite_master WHERE name='replay_source_prefix_insert'").get().sql;
            this.db.exec('DROP TRIGGER replay_source_prefix_insert');write();this.db.exec(trigger);
          });else write();
        }
        finally{this.db.prepare=original;}
        return Response.json({head:this.s.headSequence('commons'),eventStatementCosts:samples});
      }
      return super.fetch(request);
    }catch(error){return Response.json({error:error.code??'internal',message:String(error.message).slice(0,180)},{status:error.status??500});}
  }
}
export default {fetch(request,env){return env.ROOM.getByName('cutover').fetch(request);}};
