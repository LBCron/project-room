// Synthetic local-only measurement doors, never part of the deployed worker.
import {createHash} from 'node:crypto';
import {NormalizationAuthRoom} from './operator-normalization-auth.test-fixture.mjs';
import {seedNormalizationAuth} from '../tests/helpers/operator-normalization-auth-source.mjs';
export class RecoveryAgentConnectionsRoom extends NormalizationAuthRoom {
 async fetch(request){
  const u=new URL(request.url),s=this.store,db=s.db;
  if(u.pathname==='/__managed-seed'){
   const {events,rotations}=await request.json();
   if(!Number.isInteger(events)||events<0||events>512||!Number.isInteger(rotations)||rotations<0||rotations>16)throw Error('Invalid synthetic fixture size');
   const f=seedNormalizationAuth(s);await this.ctx.storage.put('auth-fixture',f);s.now=()=>f.baseNow+2000;
   for(let i=0;i<events;i++){s.now=()=>f.baseNow+2000+(i+1)*2100;s.command(f.owner,'commons',{id:'baseline-message-'+i,type:'message.posted',data:{messageId:'baseline-message-'+i,body:'Retained unrelated event '+i}});}
   for(let i=0;i<rotations;i++)s.agentConnections.apply(f.human.token,'commons',{action:'rotate',requestId:'baseline-rotate-'+i,memberId:'active-friend',expectedOwnerRevision:0,expectedGeneration:i+1,expectedMemberRevision:0,keyHash:createHash('sha256').update('synthetic-local-rotation-'+i).digest('hex'),expiresAt:s.now()+3600000},f.human.binding);
   f.baseNow=s.now()-2000;await this.ctx.storage.put('auth-fixture',f);
   return Response.json({events:db.prepare('SELECT count(*) n FROM events').get().n,connections:db.prepare('SELECT count(*) n FROM agent_connections').get().n,operations:db.prepare('SELECT count(*) n FROM agent_connection_operations').get().n});
  }
  if(u.pathname==='/__managed-verify'){
   const prepare=db.prepare.bind(db),observe=db.observeStatement,cost={statements:0,rowsRead:0,rowsWritten:0,unknown:0,prefixQueries:0,prefixRows:0,prefixBytes:0};
   db.observeStatement=()=>sample=>{cost.statements++;for(const key of ['rowsRead','rowsWritten'])if(sample[key]===null)cost.unknown++;else cost[key]+=sample[key];};
   db.prepare=sql=>{const statement=prepare(sql);if(!sql.includes('SELECT body FROM events WHERE room_id=? AND sequence<=?'))return statement;const all=statement.all.bind(statement);statement.all=(...args)=>{const rows=all(...args);cost.prefixQueries++;cost.prefixRows+=rows.length;for(const row of rows)cost.prefixBytes+=new TextEncoder().encode(row.body).length;return rows;};return statement;};
   const started=performance.now();try{s.readTransaction(()=>s.agentConnections.verifyHistory());return Response.json({verified:true,actualNative:true,cost,elapsedMs:performance.now()-started,clockOnly:true});}finally{db.prepare=prepare;db.observeStatement=observe;}
  }
  return super.fetch(request);
 }
}
export default {fetch(request,env){const headers=new Headers(request.headers);headers.set('Host','room.example');headers.set('x-room-visitor-ip','192.0.2.1');return env.ROOM.getByName('managed').fetch(new Request(request,{headers}));}};
