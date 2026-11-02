import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
const repo='/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-mcp-qa2-adapter-1102',pin='a599faa29ff65567e5c080609cb2d000acd33666',git='/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git';
assert.equal(execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
const load=p=>import(pathToFileURL(repo+'/'+p));const [{RoomStore},{initialRoom},{createRoomServer},{event},{auditRecovery},{AgentRooms}]=await Promise.all(['server/store.mjs','server/bootstrap.mjs','server/http.mjs','src/events.js','server/recovery.mjs','server/agent-rooms.mjs'].map(load));
const s=new RoomStore(':memory:'),identity=s.identities.create('Synthetic Matrix Owner');
const room=new AgentRooms(s).create(identity.secret,{title:'Disposable canonical roles',purpose:'Finite local HTTP qualification'}).roomId;
const keys={owner:identity.secret},permissions={},server=createRoomServer({store:s});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
async function publicRequest(path,token,body){const r=await fetch(origin+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
const tables=['rooms','events','commands','work_entities','work_claims','current_room_records','current_room_record_proofs','current_room_head','operator_actions','work_claim_config'];
const snapshot=()=>createHash('sha256').update(JSON.stringify(Object.fromEntries(tables.map(t=>[t,s.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()])))).digest('hex');
let serial=0;const model=(who,type,data)=>s.command(keys[who],room,{id:'seed-'+(++serial),type,data});
const proposal=(id,accountable=actors.contributor)=>({workItemId:id,title:'PRIVATE-TASK-MARKER '+id,definitionOfDone:'Saved synthetic result',mode:'write',accountableMemberId:accountable});
const scope=(id,revision=1)=>({workItemId:id,expectedRevision:revision,repository:'synthetic/project',ref:'main',paths:[id+'.txt'],expiresAt:new Date(Date.now()+3600000).toISOString()});
async function request(role,path,body){const r=await fetch(origin+'/api/rooms/'+room+path,{method:body===undefined?'GET':'POST',headers:{...(keys[role]?{Authorization:'Bearer '+keys[role]}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};}
const roles=['owner','collaborator','contributor','reviewer','chat','guest','outsider','anonymous','revoked'],actions=['propose','accept-own','acquire-contributor','renew-contributor','release-contributor','configure'];
// Explicit current-policy expectations; no KNOWN failures, skips, or fallback allow classes.
const permitted={propose:['owner','collaborator'],'accept-own':['owner','collaborator','contributor'],'acquire-contributor':['contributor'],'renew-contributor':['contributor'],'release-contributor':['owner','contributor'],configure:['owner']};
function denied(role,action){if(role==='outsider')return [403,'no_access'];if(role==='anonymous'||role==='revoked')return [401,'unauthenticated'];if(action==='configure')return [403,'work_claims_not_permitted'];if(['chat','guest'].includes(role)&&['acquire-contributor','renew-contributor','release-contributor'].includes(action))return [403,'work_claims_not_permitted'];return [422,'command_rejected'];}
const cells=[],actors={owner:identity.identityId};
try{
 for(const [role,profile]of Object.entries({collaborator:'collaborate',contributor:'contribute',reviewer:'review',chat:'chat',revoked:'collaborate'})){
  const who=s.identities.create('Synthetic '+role);keys[role]=who.secret;
  const invite=await request('owner','/agent-invites',{profile});assert.equal(invite.status,201,'Invite '+role);
  const joined=await publicRequest('/api/agent-invites/redeem',who.secret,{code:invite.body.code,displayName:'Matrix '+role});assert.ok(joined.status===200||joined.status===201,'Redeem '+role);actors[role]=joined.body.memberId;assert.equal(typeof actors[role],'string');permissions[role]=s.roomAuthority(room,{memberId:actors[role]}).members[actors[role]].permissions;
 }
 const revoked=await publicRequest('/api/agent-identities/'+actors.revoked+'/revoke',keys.revoked,{confirm:true});assert.equal(revoked.status,200,'Revoke global identity');
 keys.outsider=s.identities.create('Synthetic unlinked outsider').secret;keys.anonymous=null;
 const linkToken=randomBytes(32).toString('base64url'),ownerRevision=s.roomAuthority(room,{memberId:actors.owner}).members[actors.owner].revision;
 const link=await request('owner','/share-links',{requestId:'matrix-share-link',linkToken,expiresAt:Date.now()+3600000,maxJoins:1,expectedMemberRevision:ownerRevision});assert.ok(link.status===200||link.status===201,'Share-link fixture must be admitted');
 const guest=s.identities.create('Synthetic actual share-link guest');keys.guest=guest.secret;
 const joined=await publicRequest('/api/share-links/join-agent',guest.secret,{linkToken,displayName:'Matrix Guest'});assert.ok(joined.status===200||joined.status===201,'Actual join-agent must succeed');actors.guest=joined.body.memberId;assert.equal(typeof actors.guest,'string');permissions.guest=s.roomAuthority(room,{memberId:actors.guest}).members[actors.guest].permissions;
 for(const action of actions)for(const role of roles){
  const id=action+'-'+role,accountable=action==='accept-own'&&['owner','collaborator','contributor','reviewer','chat','guest'].includes(role)?actors[role]:actors.contributor;
  let type,data,path='/commands';
  if(action==='propose'){type='work.proposed';data=proposal(id);}
  else if(action==='configure'){path='/work-claims/config';data={maxOpenClaims:1000};}
  else{
   model('owner','work.proposed',proposal(id,accountable));
   if(action!=='accept-own')model('contributor','work.accepted',{workItemId:id,expectedRevision:0});
   if(action==='renew-contributor'||action==='release-contributor')model('contributor','claim.acquired',scope(id));
   if(action==='accept-own'){type='work.accepted';data={workItemId:id,expectedRevision:0};}
   if(action==='acquire-contributor'){type='claim.acquired';data=scope(id);}
   if(action==='renew-contributor'){type='claim.renewed';data={workItemId:id,expectedRevision:2,expiresAt:new Date(Date.now()+7200000).toISOString()};}
   if(action==='release-contributor'){type='claim.released';data={workItemId:id,expectedRevision:2};}
  }
  const before=snapshot(),head=s.headSequence(room),r=await request(role,path,path==='/commands'?{id:'cell-'+id,type,data}:data),allow=permitted[action].includes(role);
  if(allow){assert.ok(r.status===200||r.status===201,action+'/'+role+' expected allow got '+r.status+' '+r.body.error?.code);if(path==='/commands'){assert.equal(r.body.event.actorId,actors[role]);assert.equal(s.headSequence(room),head+1);}}
  else{const [status,code]=denied(role,action);assert.equal(r.status,status,action+'/'+role+' unexpected status '+r.body.error?.code);assert.equal(r.body.error?.code,code,action+'/'+role);assert.equal(snapshot(),before,action+'/'+role+' mutated authoritative tables');}
  const foreign=['outsider','anonymous','revoked'].includes(role);if(foreign)assert.equal(JSON.stringify(r.body).includes('PRIVATE-TASK-MARKER'),false);
  cells.push({action,role,expected:allow?'allow':'deny',status:r.status,code:r.body.error?.code??null,matched:true,...(!allow?{authoritativeTablesUnchanged:true}:{}),...(foreign?{taskMarkerAbsent:true}:{})});
 }
 auditRecovery(s);assert.equal(s.db.prepare('SELECT count(*) n FROM work_claims').get().n,0);
 const result={source:pin,node:process.version,roles,rolePermissions:permissions,actualShareLinkGuest:true,actions,cells,total:cells.length,pass:cells.length,allowed:cells.filter(x=>x.expected==='allow').length,refused:cells.filter(x=>x.expected==='deny').length,finalRecoveryAudit:true,noLegacyMirrorRows:true,refusalSnapshotTables:tables,scope:'Actual local Node HTTP role/action boundaries on normalized work with model-seeded isolated lifecycle fixtures. Actual agent-room owner, invitation profile joins, identity revocation and share-link join; no full autonomy/delegation matrix, Native, hosted, release or peer-device execution claim.'};writeFileSync(fileURLToPath(new URL('./canonical-work-roles-http-receipt.json',import.meta.url)),JSON.stringify(result,null,2)+'\n');console.log('CANONICAL_WORK_ROLES_HTTP '+JSON.stringify({...result,cells:undefined}));
}finally{server.closeStreams();server.closeAllConnections();await new Promise(r=>server.close(r));s.close();}
execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
