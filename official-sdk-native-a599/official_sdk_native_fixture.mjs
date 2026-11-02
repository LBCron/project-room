import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ProjectRoom } from './room.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { createMcpInviteOAuth } from '../server/mcp-invite-oauth.mjs';
const resource='https://room.example/mcp', client={clientId:'native-sdk-local',name:'Native SDK local',redirectUris:['https://client.example/callback']};
const oauth=s=>createMcpInviteOAuth({store:s,clients:[client],resource});
export class OfficialSdkRoom extends ProjectRoom {
 async fetch(request){
  const path=new URL(request.url).pathname,s=this.store;
  if(path==='/__seed'){
   s.initialize(initialRoom('commons'),{representation:'normalized-current-v1'});
   const owner=s.issueAccessKey('commons','owner'),invite=s.invites.create(owner,'commons',{profile:'member'}),native=oauth(s),verifier='a'.repeat(43);
   const {nonce}=native.begin(new URLSearchParams({client_id:client.clientId,redirect_uri:client.redirectUris[0],scope:'rooms:read chat:read chat:write work:read work:write',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',resource}));
   const code=new URL(native.approve(nonce,invite.code,'Native SDK seat')).searchParams.get('code');
   const tokens=native.provider.exchangeCode({code,clientId:client.clientId,redirectUri:client.redirectUris[0],codeVerifier:verifier,resource});
   const grant=s.db.prepare('SELECT * FROM oauth_invite_grants').get();await this.ctx.storage.put('fixture',{tokens,memberId:grant.member_id});return Response.json({tokens});
  }
  if(path==='/__facts'){
   const f=await this.ctx.storage.get('fixture');
   const events=s.db.prepare("SELECT body FROM events WHERE room_id='commons' AND json_extract(body,'$.type')='message.posted'").all().map(r=>JSON.parse(r.body));
   const posted=events.filter(e=>e.data.body==='Synthetic official SDK Native message');
   assert.equal(posted.length,1);assert.equal(posted[0].actorId,f.memberId);
   return Response.json({singlePost:true,correctAuthor:true,head:s.headSequence('commons')});
  }
  if(path==='/__revoke'){const f=await this.ctx.storage.get('fixture');oauth(s).provider.revoke(f.tokens.refreshToken);return Response.json({revoked:true});}
  return super.fetch(request);
 }
}
export default {fetch(request,env){const headers=new Headers(request.headers);headers.set('Host','room.example');headers.set('x-room-visitor-ip','192.0.2.22');return env.ROOM.getByName('sdk').fetch(new Request(request,{headers}));}};
