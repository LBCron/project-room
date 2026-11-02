import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ProjectRoom} from './room.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {createMcpInviteOAuth} from '../server/mcp-invite-oauth.mjs';
const resource='https://room.example/mcp',client={clientId:'native-sdk-local',name:'Native SDK local',redirectUris:['https://client.example/callback']};
const oauth=s=>createMcpInviteOAuth({store:s,clients:[client],resource});
export class OfficialSdkRoom extends ProjectRoom{
 async fetch(request){const path=new URL(request.url).pathname,s=this.store;
 if(path==='/__seed'){
  const fixtures=[];
  for(const roomId of ['isolation-alpha','isolation-beta']){
   s.initialize(initialRoom(roomId),{representation:'normalized-current-v1'});
   const owner=s.issueAccessKey(roomId,'owner'),invite=s.invites.create(owner,roomId,{profile:'member'}),native=oauth(s),verifier='a'.repeat(43);
   const {nonce}=native.begin(new URLSearchParams({client_id:client.clientId,redirect_uri:client.redirectUris[0],scope:'rooms:read chat:read chat:write work:read work:write',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',resource}));
   const code=new URL(native.approve(nonce,invite.code,'Agent '+roomId)).searchParams.get('code');
   const tokens=native.provider.exchangeCode({code,clientId:client.clientId,redirectUri:client.redirectUris[0],codeVerifier:verifier,resource});
   const grant=s.db.prepare('SELECT * FROM oauth_invite_grants WHERE room_id=?').get(roomId);
   const canary='PRIVATE-CANARY-'+roomId;
   s.command(owner,roomId,{id:'seed-'+roomId,type:'message.posted',data:{messageId:'seed-'+roomId,body:canary}});
   fixtures.push({roomId,tokens,memberId:grant.member_id,canary});
  }
  await this.ctx.storage.put('fixture',fixtures);return Response.json(fixtures);
 }
 if(path==='/__facts'){
  const f=await this.ctx.storage.get('fixture');return Response.json(f.map(x=>{
   const events=s.db.prepare("SELECT body FROM events WHERE room_id=? AND json_extract(body,'$.type')='message.posted'").all(x.roomId).map(r=>JSON.parse(r.body));
   const posts=events.filter(e=>e.data.body.startsWith('sdk-isolation-'));
   assert.ok(posts.every(e=>e.actorId===x.memberId&&e.data.body.includes(x.roomId)));
   return {roomId:x.roomId,posts:posts.length,allAttributed:true,head:s.headSequence(x.roomId)};
  }));
 }
 if(path==='/__revoke-alpha'){const f=await this.ctx.storage.get('fixture');oauth(s).provider.revoke(f[0].tokens.refreshToken);return Response.json({revoked:true});}
 return super.fetch(request);
 }
}
export default {fetch(request,env){const headers=new Headers(request.headers);headers.set('Host','room.example');headers.set('x-room-visitor-ip','192.0.2.23');return env.ROOM.getByName('sdk').fetch(new Request(request,{headers}));}};
