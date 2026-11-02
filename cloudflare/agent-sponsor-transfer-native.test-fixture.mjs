// Synthetic local qualification doors; production entrypoint does not expose them.
import {ProjectRoom} from './room.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event} from '../src/events.js';
import {AccessRequests} from '../server/access-requests.mjs';
import {linkWithProof} from '../tests/helpers/link-with-proof.mjs';
import {auditRecovery} from '../server/recovery.mjs';
export class AgentAdoptionRoom extends ProjectRoom {
 async fetch(request){
  const path=new URL(request.url).pathname,store=this.store;
  if(path==='/__seed'){
   const identity=store.identities.create('Existing Claude'),events=initialRoom('commons');events[1].data.kind='agent';
   events.push(event({roomId:'commons',actorId:'owner',type:'member.added',data:{memberId:'john',displayName:'John',kind:'human',permissions:[]}}));
   events.push(event({roomId:'commons',actorId:'owner',type:'member.added',data:{memberId:'claude',identityId:identity.identityId,displayName:'Existing Claude',kind:'agent',permissions:['accept_work']}}));
   store.initialize(events,{representation:'normalized-current-v1'});const owner=store.issueAccessKey('commons','owner');linkWithProof(store,owner,'commons',identity,{memberId:'claude',permissions:['accept_work']});
   const account=store.bindHumanAccount('commons','john'),slot=store.createAccountSessionSlot(),auth=store.loginAccountSession(slot.token,store.issueAccountAccessKey(account.id),0);
   await this.ctx.storage.put('test-owner',owner);
   return Response.json({slot:slot.token,csrf:auth.csrf,identityId:identity.identityId});
  }
  if(path==='/__approve'){
   const row=store.db.prepare("SELECT request_id FROM access_requests WHERE room_id='commons' AND status='pending_upgrade'").get();
   try{
    if(new URL(request.url).searchParams.has('fault'))store.db.exec("CREATE TRIGGER fail_adoption_save BEFORE UPDATE OF status ON access_requests WHEN NEW.status='approved' BEGIN SELECT RAISE(ABORT,'injected save failure');END");
    const result=new AccessRequests(store).decide(await this.ctx.storage.get('test-owner'),'commons',row.request_id,{decision:'approve'});return Response.json(result);
   }catch(error){return Response.json({error:error.code??'fault',message:error.message},{status:422});}
   finally{if(new URL(request.url).searchParams.has('fault'))store.db.exec('DROP TRIGGER fail_adoption_save');}
  }
  if(path==='/__facts'){
   const state=store.agentSponsorAuthority('commons',['john','claude']);auditRecovery(store);
   return Response.json({ownerId:state.ownerId,agent:state.members.claude,requests:store.db.prepare('SELECT request_id,status FROM access_requests').all(),identityCount:store.db.prepare('SELECT count(*) n FROM agent_identities').get().n});
  }
  return super.fetch(request);
 }
}
export default {fetch(request,env){const headers=new Headers(request.headers);headers.set('Host','room.example');headers.set('x-room-visitor-ip','192.0.2.1');return env.ROOM.getByName('adoption').fetch(new Request(request,{headers}));}};
