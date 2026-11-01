import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { createRoomServer } from '../server/http.mjs';
import { mcpOAuthIdentityEpoch } from '../server/mcp-oauth.mjs';
import { setTier } from '../server/autonomy-tiers.mjs';
import { request } from 'node:http';
const fetch = (url, options = {}) => new Promise((resolve, reject) => {
  const req = request(url, { method: options.method || 'GET', headers: { Host: 'room.example', ...options.headers } }, res => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
  });
  req.on('error', reject);
  req.end(options.body?.toString());
});
const CLIENT = { clientId: 'test-dot', name: 'Test Native Agent', redirectUris: ['https://client.example/callback'] };
const origin = 'https://room.example';
const resource = origin + '/mcp';
const verifier = 'v'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');
async function setup(t) {
  const store = new RoomStore(':memory:');
  store.initialize(initialRoom());
  store.createAccount('synthetic-recoverable-owner');store.bindHumanAccount('commons','owner','synthetic-recoverable-owner');
  const ownerKey = store.issueAccessKey('commons', 'owner');
  const ownerSession = store.createSession(ownerKey);
  const accountId = store.db.prepare("SELECT account_id FROM member_accounts WHERE member_id='owner'").get().account_id;
  const accountKey = store.issueAccountAccessKey(accountId);
  const slot = store.createAccountSessionSlot();
  const session = store.loginAccountSession(slot.token, accountKey, 0);
  const identity = store.identities.create('Synthetic preferred agent');
  const { linkCode } = store.identities.mintLinkCode(identity.identityId, identity.secret, { roomId: 'commons' });
  store.agentConnections.apply(ownerSession.token, 'commons', { action: 'create', requestId: randomUUID(), memberId: 'preferred-agent', displayName: 'Synthetic preferred agent', access: 'collaborate',
    expectedOwnerRevision: 0, expiresAt: store.now() + 3600000, keyHash: createHash('sha256').update(randomUUID()).digest('hex'), identityId: identity.identityId, identityLinkCode: linkCode }, ownerSession.session.sessionBinding);
  setTier(store.db, 'commons', 'preferred-agent', 't2_standard', { updatedBy: 'owner', nowMs: Date.now() });
  const binding = { resource, roomId: 'commons', memberId: 'preferred-agent', identityId: identity.identityId, humanMemberId: 'owner', identityEpoch: mcpOAuthIdentityEpoch(store, identity.identityId) };
  const server = createRoomServer({ store, origin, mcpOAuthClients: [CLIENT] });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const consent = (changes = {}) => fetch(base + '/oauth/authorize', { method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/json', Cookie: `__Host-account_session=${slot.token}`, Origin: origin, 'X-CSRF-Token': session.csrf },
    body: JSON.stringify({ decision: 'allow', client_id: CLIENT.clientId, redirect_uri: CLIENT.redirectUris[0], scope: 'rooms:read chat:read chat:write work:read work:write',
      code_challenge: challenge, code_challenge_method: 'S256', resource, agent_binding: JSON.stringify(binding), ...changes }) });
  const exchange = body => fetch(base + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const authorized = await consent();
  assert.equal(authorized.status, 302, await authorized.text());
  const code = new URL(authorized.headers.get('location')).searchParams.get('code');
  assert.ok(code, authorized.headers.get('location'));
  const exchanged = await exchange({ grant_type: 'authorization_code', code, client_id: CLIENT.clientId, redirect_uri: CLIENT.redirectUris[0], code_verifier: verifier, resource });
  assert.equal(exchanged.status, 200);
  const tokens = await exchanged.json();
  const rpc = async (method, params = {}, token = tokens.access_token) => {
    const response = await fetch(base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'test', method, params }) });
    return { response, body: await response.json() };
  };
  return { store, ownerKey, identity, binding, base, consent, exchange, tokens, rpc, session, slot, accountId, cookie: `__Host-account_session=${slot.token}` };
}

// Frozen missing-contract qualification. The final guard is intentionally red.
test('human-recoverable create contract: existing native principal cannot create a human-owned room', async t => {
 const f=await setup(t), observed={};
 const allScopes='rooms:read chat:read chat:write work:read work:write members:invite';
 const allowed=await f.consent({scope:allScopes});assert.equal(allowed.status,302);
 const code=new URL(allowed.headers.get('location')).searchParams.get('code');
 const exchanged=await f.exchange({grant_type:'authorization_code',code,client_id:CLIENT.clientId,redirect_uri:CLIENT.redirectUris[0],code_verifier:verifier,resource});assert.equal(exchanged.status,200);const tokens=await exchanged.json();
 const roomBody={roomId:'recoverable-target',title:'Synthetic recoverable room',purpose:'Human owns durable work; preferred agent participates',kind:'personal',displayName:'Synthetic human owner'};
 let create;
 await t.test('all six supported scopes retain current room-scoped identity and do not advertise room_create',async()=>{
  const access=await f.rpc('tools/call',{name:'room_check_access',arguments:{}},tokens.access_token);assert.equal(access.body.result.structuredContent.memberId,'preferred-agent');
  const list=await f.rpc('tools/list',{},tokens.access_token);observed.nativeCreateListed=list.body.result.tools.some(x=>x.name==='room_create');assert.equal(observed.nativeCreateListed,false);
  create=await f.rpc('tools/call',{name:'room_create',arguments:roomBody},tokens.access_token);assert.ok(create.body.error || create.body.result?.isError);assert.match(JSON.stringify(create.body),/insufficient_scope|outside the connected agent grant/);
  observed.nativeCreate=create.body;assert.equal(f.store.db.prepare('SELECT count(*) n FROM rooms WHERE id=?').get(roomBody.roomId).n,0);
 });
 await t.test('native MCP bearer cannot impersonate an account browser session at existing room lifecycle REST',async()=>{
  const r=await fetch(f.base+'/api/account-rooms',{method:'POST',headers:{Authorization:'Bearer '+tokens.access_token,'Content-Type':'application/json','X-Session-Binding':f.session.sessionBinding,Origin:origin},body:JSON.stringify(roomBody)});observed.accountRestNativeStatus=r.status;assert.equal(r.status,401);
 });
 const accountHeaders={Cookie:f.cookie,'X-Session-Binding':f.session.sessionBinding,'X-CSRF-Token':f.session.csrf,'X-Project-Room-Auth':'account',Origin:origin,'Content-Type':'application/json'};
 await t.test('existing authenticated human lifecycle creates and exactly retries one human-owned room, without enrolling the agent',async()=>{
  const post=body=>fetch(f.base+'/api/account-rooms',{method:'POST',headers:accountHeaders,body:JSON.stringify(body)});
  let r=await post(roomBody);assert.equal(r.status,201,await r.clone().text());const first=await r.json();assert.equal(first.room.memberId,'owner');
  r=await post(roomBody);assert.equal(r.status,200);assert.equal((await r.json()).duplicate,true);
  assert.equal(f.store.room(roomBody.roomId).state.members.owner.kind,'human');assert.equal(f.store.accountForMember(roomBody.roomId,'owner').id,f.accountId);
  observed.humanCreate={ownerKind:'human',accountPreserved:true,exactRetry:true,agentAutomaticallyEnrolled:false};assert.equal(f.store.db.prepare('SELECT count(*) n FROM identity_links WHERE room_id=? AND identity_id=?').get(roomBody.roomId,f.identity.identityId).n,0);
  r=await post({...roomBody,title:'Changed title'});assert.equal(r.status,409);
 });
 await t.test('source-room native grant cannot cross to new target and cannot mint the existing identity-holder proof',async()=>{
  const checked=await f.rpc('tools/call',{name:'room_check_access',arguments:{roomId:roomBody.roomId}},tokens.access_token);assert.ok(checked.body.error || checked.body.result?.isError);observed.crossRoom=checked.body;
  const link=await fetch(f.base+'/api/identities/'+f.identity.identityId+'/link-code',{method:'POST',headers:{Authorization:'Bearer '+tokens.access_token,'Content-Type':'application/json',Origin:origin},body:JSON.stringify({roomId:roomBody.roomId})});observed.nativeLinkCodeStatus=link.status;assert.ok([401,403].includes(link.status));
 });
 await t.test('human session plus explicit existing holder proof can enroll same identity and native new-room consent works',async()=>{
  const {linkCode}=f.store.identities.mintLinkCode(f.identity.identityId,f.identity.secret,{roomId:roomBody.roomId});
  const request={action:'create',requestId:'recoverable-explicit-enroll',memberId:'preferred-agent',displayName:'Synthetic preferred agent',access:'collaborate',expectedOwnerRevision:0,expiresAt:f.store.now()+3600000,keyHash:createHash('sha256').update('synthetic-new-target-room-key'.padEnd(43,'x')).digest('hex'),identityId:f.identity.identityId};
  let r=await fetch(f.base+'/api/rooms/'+roomBody.roomId+'/agent-connections',{method:'POST',headers:accountHeaders,body:JSON.stringify(request)});assert.equal(r.status,422);assert.match(await r.text(),/identity_link_proof_required/);
  r=await fetch(f.base+'/api/rooms/'+roomBody.roomId+'/agent-connections',{method:'POST',headers:accountHeaders,body:JSON.stringify({...request,identityLinkCode:linkCode})});assert.equal(r.status,201);
  const identities=f.store.db.prepare('SELECT count(*) n FROM agent_identities').get().n;assert.equal(identities,1);
  const targetBinding={...f.binding,roomId:roomBody.roomId,humanMemberId:'owner'};
  const targetConsent=await f.consent({scope:'rooms:read',agent_binding:JSON.stringify(targetBinding)});assert.equal(targetConsent.status,302);
  const c=new URL(targetConsent.headers.get('location')).searchParams.get('code');const e=await f.exchange({grant_type:'authorization_code',code:c,client_id:CLIENT.clientId,redirect_uri:CLIENT.redirectUris[0],code_verifier:verifier,resource});assert.equal(e.status,200);const targetTokens=await e.json();
  const checked=await f.rpc('tools/call',{name:'room_check_access',arguments:{}},targetTokens.access_token);assert.equal(checked.body.result.structuredContent.roomId,roomBody.roomId);assert.equal(checked.body.result.structuredContent.identityId,f.identity.identityId);
  assert.equal((await f.rpc('tools/call',{name:'room_check_access',arguments:{}},tokens.access_token)).body.result.structuredContent.roomId,'commons');
  observed.existingHolderProofControl={identities:1,newRoomOwner:'human',newNativeGrantSelected:true,oldGrantRoomUnchanged:true};
 });
 await t.test('explicit sovereign identity-owned creation still works and does not convert the human-owned room',async()=>{
  const r=await f.rpc('tools/call',{name:'room_create',arguments:{roomId:'explicit-sovereign',title:'Synthetic explicit sovereign',purpose:'Explicit agent ownership control'}},f.identity.secret);assert.ok(!r.body.error && !r.body.result?.isError,JSON.stringify(r.body));
  assert.equal(f.store.room('explicit-sovereign').state.room.ownerId,f.identity.identityId);assert.equal(f.store.accountForMember('explicit-sovereign',f.identity.identityId),null);assert.equal(f.store.room(roomBody.roomId).state.room.ownerId,'owner');observed.sovereignPreserved=true;
 });
 t.diagnostic(JSON.stringify({source:'dcec4be404d0138f2a8eac9bb9610bbfc899bfb9',scope:'synthetic local Room HTTP; no real preferred host/provider',...observed}));
 await t.test('RED MVP contract: an explicitly account-authenticated preferred-agent create must reach a human-owned participating room through supported native flow',()=>{
  assert.equal(Boolean(create.body.error || create.body.result?.isError),false,'Current native room_create is denied even with every supported scope; browser lifecycle creates only the human, and requires a separate holder proof plus new target consent to enroll the existing agent. Do not bypass these boundaries implicitly.');
 });
});
