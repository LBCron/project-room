import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore} from '../server/store.mjs';
import {AgentRooms} from '../server/agent-rooms.mjs';
import {createRoomServer} from '../server/http.mjs';
import {readConversation} from '../server/conversation-sync.mjs';

async function fixture(t) {
  const dir=mkdtempSync(join(tmpdir(),'mcp-open-join-'));
  const store=new RoomStore(join(dir,'db'));
  const owner=store.identities.create('Public founder');
  const roomId='mcp-public-join';
  new AgentRooms(store).create(owner.secret,{roomId,title:'Public project',purpose:'Useful work',starter:false,visibility:'private'});
  const command=(type,data,id=type)=>store.command(owner.secret,roomId,{id,type,data});
  command('message.posted',{messageId:'before',body:'PRIVATE BEFORE JOIN'});
  const server=createRoomServer({store});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();rmSync(dir,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(secret,name,args)=>{
    const response=await fetch(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify({jsonrpc:'2.0',id:'test',method:'tools/call',params:{name,arguments:args}})});
    const body=await response.json();
    return {value:body.result?.structuredContent,error:body.result?.isError===true,body};
  };
  return {store,owner,roomId,command,call,open(){command('room.public_page_set',{enabled:true});command('room.join_link_set',{enabled:true});}};
}

test('HTTP MCP roomId-only joins owner-open room as same identity guest, retries once, and reads activation',async t=>{
  const f=await fixture(t);f.open();const peer=f.store.identities.create('MCP collaborator');
  f.store.room=()=>{throw Error('whole room hydration forbidden');};
  const result=await f.call(peer.secret,'room_join',{roomId:f.roomId});
  assert.equal(result.error,false,JSON.stringify(result.body));
  assert.equal(result.value.status,'approved');
  assert.equal(result.value.memberId,peer.identityId);
  assert.deepEqual(result.value.grantedPermissions,[]);
  assert.equal(result.value.next[0].tool,'room_activation_pack');
  assert.deepEqual(result.value.next[0].arguments,{roomId:f.roomId});
  assert.equal(result.value.userCode,undefined);
  assert.equal(f.store.authenticate(peer.secret,f.roomId).member.historyGuest,true);
  assert.throws(()=>readConversation(f.store,peer.secret,f.roomId,{messageId:'before'}),e=>e.status===404);
  const seq=f.store.headSequence(f.roomId);
  const again=await f.call(peer.secret,'room_join',{roomId:f.roomId});
  assert.equal(again.value.status,'approved');
  assert.equal(again.value.memberId,result.value.memberId);
  assert.equal(again.value.alreadyMember,true);
  assert.equal(f.store.headSequence(f.roomId),seq);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM access_requests').get().n,1);
  const activation=await f.call(peer.secret,'room_activation_pack',{roomId:f.roomId});
  assert.equal(activation.error,false,JSON.stringify(activation.body));
});

test('private and page-only rooms retain pairing; explicit publicKey retains pairing even when open',async t=>{
  const f=await fixture(t);
  const privatePeer=f.store.identities.create('Private peer');
  const paired=await f.call(privatePeer.secret,'room_join',{roomId:f.roomId});
  assert.equal(paired.error,false);assert.equal(typeof paired.value.pairId,'string');
  f.command('room.public_page_set',{enabled:true});
  const pagePeer=f.store.identities.create('Page peer');
  const page=await f.call(pagePeer.secret,'room_join',{roomId:f.roomId});
  assert.equal(typeof page.value.pairId,'string');
  f.command('room.join_link_set',{enabled:true});
  const keyPeer=f.store.identities.create('Key peer');
  const keyed=await f.call(keyPeer.secret,'room_join',{roomId:f.roomId,publicKey:'invalid-key'});
  assert.notEqual(keyed.value?.status,'approved');
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM access_requests').get().n,0);
  assert.throws(()=>f.store.authenticate(keyPeer.secret,f.roomId));
});

test('removed public guest cannot recover an earlier approved request into membership',async t=>{
  const f=await fixture(t);f.open();const peer=f.store.identities.create('Removed collaborator');
  const joined=await f.call(peer.secret,'room_join',{roomId:f.roomId});assert.equal(joined.value.status,'approved');
  const revision=f.store.authenticate(peer.secret,f.roomId).member.revision;
  f.command('member.access_changed',{memberId:peer.identityId,active:false,permissions:[],expectedMemberRevision:revision});
  const seq=f.store.headSequence(f.roomId);
  const retry=await f.call(peer.secret,'room_join',{roomId:f.roomId});
  assert.equal(retry.error,true);assert.equal(retry.value.code,'stale_membership');
  assert.equal(f.store.headSequence(f.roomId),seq);
  assert.equal(f.store.roomAuthority(f.roomId,{memberId:peer.identityId}).members[peer.identityId].active,false);
});

test('public MCP admission failure rolls back request, membership and mirror before exact retry',async t=>{
  const f=await fixture(t);f.open();const peer=f.store.identities.create('Retry collaborator');
  const seq=f.store.headSequence(f.roomId),prepare=f.store.db.prepare.bind(f.store.db);
  f.store.db.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith("UPDATE access_requests SET status='approved',decided_at="))return statement;return new Proxy(statement,{get(target,key){const value=Reflect.get(target,key,target);if(key==='run')return(...args)=>{value.apply(target,args);throw Error('synthetic MCP admission failure');};return typeof value==='function'?value.bind(target):value;}});};
  const failed=await f.call(peer.secret,'room_join',{roomId:f.roomId});
  f.store.db.prepare=prepare;
  assert.equal(failed.error,true);
  assert.equal(f.store.headSequence(f.roomId),seq);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM access_requests').get().n,0);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM identity_links WHERE room_id=? AND identity_id=?').get(f.roomId,peer.identityId).n,0);
  const retry=await f.call(peer.secret,'room_join',{roomId:f.roomId});assert.equal(retry.value.status,'approved');
});

test('an existing active member receives current access without another request or pair',async t=>{
  const f=await fixture(t),peer=f.store.identities.create('Existing collaborator');
  const invite=f.store.invites.create(f.owner.secret,f.roomId,{profile:'chat'});
  f.store.invites.redeem(invite.code,{displayName:peer.displayName,identitySecret:peer.secret});
  f.open();const seq=f.store.headSequence(f.roomId);
  const result=await f.call(peer.secret,'room_join',{roomId:f.roomId});
  assert.equal(result.error,false,JSON.stringify(result.body));
  assert.equal(result.value.alreadyMember,true);assert.equal(result.value.memberId,peer.identityId);
  assert.deepEqual(result.value.grantedPermissions,f.store.authenticate(peer.secret,f.roomId).member.permissions);
  assert.equal(result.value.next[0].tool,'room_activation_pack');
  assert.equal(f.store.headSequence(f.roomId),seq);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM access_requests').get().n,0);
});

test('room-pinned API credentials cannot use public joining to cross their room scope',async t=>{
  const f=await fixture(t);f.open();const peer=f.store.identities.create('Scoped collaborator');
  const key=f.store.agentPlugin.issueApiKey({identityId:peer.identityId,scopes:['rooms:read','rooms:write','mcp:room:another-room']});
  const result=await f.call(`rak_${key.secret}`,'room_join',{roomId:f.roomId});
  assert.equal(result.error,true);assert.equal(result.value.code,'insufficient_scope');
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM access_requests').get().n,0);
  assert.throws(()=>f.store.authenticate(peer.secret,f.roomId));
});
