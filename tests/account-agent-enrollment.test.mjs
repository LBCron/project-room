import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {createAccountAgentEnrollment} from '../server/account-agent-enrollment.mjs';
import {listMcpOAuthAgents,validateMcpOAuthBinding} from '../server/mcp-oauth.mjs';
import {auditRecovery} from '../server/recovery.mjs';
const resource='https://room.example/mcp';
const hash=value=>createHash('sha256').update(value).digest('hex');
function fixture(t){
 const s=new RoomStore(':memory:');t.after(()=>s.close());
 s.initialize(initialRoom('source'),{representation:'normalized-current-v1'});
 s.initialize(initialRoom('target'),{representation:'normalized-current-v1'});
 s.createAccount('john');s.bindHumanAccount('source','owner','john');s.bindHumanAccount('target','owner','john');
 const key=s.issueAccountAccessKey('john'),slot=s.createAccountSessionSlot(),session=s.loginAccountSession(slot.token,key,0),binding=session.sessionBinding;
 const identity=s.identities.create('Existing Claude'),code=s.identities.mintLinkCode(identity.identityId,identity.secret,{roomId:'source'});
 const source=s.agentConnections.apply(slot.token,'source',{action:'create',requestId:'source-managed',memberId:'claude',displayName:'Existing Claude',access:'collaborate',expectedOwnerRevision:0,keyHash:hash(randomUUID()),expiresAt:s.now()+3600000,identityId:identity.identityId,identityLinkCode:code.linkCode},binding);
 const service=createAccountAgentEnrollment({store:s,resource,enabled:true});
 const choice=service.list(slot.token,'target',binding).choices[0];
 const request={action:'enroll-existing',requestId:'enroll-claude',choiceId:choice.choiceId,sourceRoomId:'source',sourceMemberId:'claude',identityId:identity.identityId,memberId:'claude',access:'collaborate',expectedOwnerRevision:0};
 return {s,slot,binding,identity,source,service,request,apply:input=>service.apply(slot.token,'target',input??request,binding)};
}

test('explicit account-controlled enrollment preserves identity and original source; target works after source archive',t=>{
 const f=fixture(t),before=f.s.db.prepare('SELECT * FROM agent_identities').all(),old=f.s.db.prepare("SELECT * FROM agent_connections WHERE room_id='source'").all();
 const result=f.apply();assert.equal(result.enrolledExisting,true);assert.equal(result.mcpToken,undefined);assert.equal(result.duplicate,false);
 assert.equal(f.s.db.prepare("SELECT member_id FROM identity_links WHERE room_id='target' AND identity_id=?").get(f.identity.identityId).member_id,'claude');
 assert.deepEqual(f.s.db.prepare('SELECT * FROM agent_identities').all(),before);assert.deepEqual(f.s.db.prepare("SELECT * FROM agent_connections WHERE room_id='source'").all(),old);
 assert.deepEqual(f.s.roomAuthority('target',{memberId:'claude'}).members.claude.permissions,['steer','accept_work','complete_work','verify']);
 assert.equal(f.apply().duplicate,true);assert.throws(()=>f.apply({...f.request,access:'review'}),{code:'idempotency_conflict'});
 f.s.command(f.slot.token,'source',{id:'archive-old',type:'room.archived',data:{reason:'Synthetic cutover'}},f.binding);
 const choice=listMcpOAuthAgents(f.s,'john',resource).find(value=>value.binding.roomId==='target');assert.ok(choice);
 assert.ok(validateMcpOAuthBinding(f.s,'john',choice.binding));assert.doesNotThrow(()=>auditRecovery(f.s));
});

test('writer and choices are disabled by default while strict proof reader remains installed',t=>{
 const f=fixture(t),disabled=createAccountAgentEnrollment({store:f.s,resource});
 assert.deepEqual(disabled.list(f.slot.token,'target',f.binding),{available:false,choices:[]});
 assert.throws(()=>disabled.apply(f.slot.token,'target',f.request,f.binding),{status:403,code:'access_denied'});
});

test('no holder-proof exemption is granted to callers who copy an enrollment reference',t=>{
 const f=fixture(t);f.apply();const raw=JSON.parse(f.s.db.prepare("SELECT request_json FROM agent_connection_operations WHERE room_id='target'").get().request_json);
 assert.throws(()=>f.s.agentConnections.apply(f.slot.token,'source',{...raw,requestId:'forged',memberId:'forged'},f.binding),{code:'connection_integrity_error'});
});

for(const [name,change] of [
 ['source revocation',f=>f.s.command(f.slot.token,'source',{id:'revoke-source',type:'member.access_changed',data:{memberId:'claude',expectedMemberRevision:0,active:false,permissions:['steer','accept_work','complete_work','verify']}},f.binding)],
 ['source identity rotation',f=>f.s.identities.rotate(f.identity.identityId,f.identity.secret)],
 ['target owner revision',f=>f.s.command(f.slot.token,'target',{id:'owner-change',type:'member.access_changed',data:{memberId:'owner',expectedMemberRevision:0,active:true,permissions:f.s.roomAuthority('target',{memberId:'owner'}).members.owner.permissions}},f.binding)]
])test(`stale ${name} refuses before enrollment`,t=>{
 const f=fixture(t);change(f);assert.throws(()=>f.apply());assert.equal(f.s.db.prepare("SELECT count(*) n FROM identity_links WHERE room_id='target'").get().n,0);
});
