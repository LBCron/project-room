import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore} from '../server/store.mjs';
import {AgentRooms} from '../server/agent-rooms.mjs';
import {auditRecovery} from '../server/recovery.mjs';
import {PAIR_POLL_INTERVAL_MS} from '../server/pairing.mjs';

function fixture(t) {
 const directory=mkdtempSync(join(tmpdir(),'native-pair-')),filename=join(directory,'room.sqlite');
 let now=1800000000000,store=new RoomStore(filename,{now:()=>now});
 const owner=store.identities.create('Rowan Hale');
 new AgentRooms(store).create(owner.secret,{roomId:'native-pair',title:'Pairing',purpose:'Existing identity continuity',starter:false});
 const forbid=s=>{s.room=()=>{throw Error('pairing must not hydrate room');};};forbid(store);
 t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
 return {owner,get store(){return store;},advance(){now+=PAIR_POLL_INTERVAL_MS;},cold(){store.close();store=new RoomStore(filename,{now:()=>now});forbid(store);return store;}};
}
function durableRows(store) {
 return Object.fromEntries(store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,store.db.prepare(`SELECT * FROM "${name}"`).all().map(row=>{
  if(name==='agent_identities'){const {last_used_at,last_used_ua,mcp_legacy_uses,...authority}=row;return authority;}return row;
 })]));
}

test('native pairing retains held identity, scoped grants, denied approval and exact cold poll delivery',t=>{
 const f=fixture(t),s=f.store,identity=s.identities.create('Kit Arden');
 const pending=s.pairing.start({roomId:'native-pair',displayName:'Kit Arden',holdFor:identity.identityId});
 assert.throws(()=>s.pairing.pollHeld(pending.pairId,f.owner.identityId),e=>e.status===404);
 assert.throws(()=>s.pairing.decide(identity.secret,'native-pair',{pairId:pending.pairId,decision:'approve'}),e=>e.status===403);
 const approved=s.pairing.decide(f.owner.secret,'native-pair',{pairId:pending.pairId,decision:'approve',profile:'chat'});
 assert.equal(approved.memberId,identity.identityId);assert.equal(approved.connection.identitySecret,undefined);
 const member=s.roomAuthority('native-pair',{memberId:identity.identityId}).members[identity.identityId];
 const permissions=[...member.permissions];
 assert.equal(s.authenticate(identity.secret,'native-pair').member.id,identity.identityId);
 f.advance();const first=f.cold().pairing.pollHeld(pending.pairId,identity.identityId);
 assert.equal(first.token,approved.connection.token);assert.equal(first.memberId,identity.identityId);
 f.advance();const retry=f.cold().pairing.pollHeld(pending.pairId,identity.identityId);
 assert.equal(retry.token,first.token);assert.equal(retry.identityId,identity.identityId);
 const reconnect=f.store.pairing.start({roomId:'native-pair',displayName:'Kit Arden',credential:first.token});
 assert.equal(reconnect.connection.memberId,identity.identityId);assert.equal(reconnect.reconnected,true);
 assert.deepEqual(f.store.roomAuthority('native-pair',{memberId:identity.identityId}).members[identity.identityId].permissions,permissions);
 assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM identity_links WHERE room_id=? AND identity_id=?').get('native-pair',identity.identityId).n,1);
 assert.doesNotThrow(()=>auditRecovery(f.store));
});

test('native approval rolls identity, key and journal writes back on failed delivery save, then cold retries',t=>{
 const f=fixture(t),s=f.store;
 const pending=s.pairing.start({roomId:'native-pair',displayName:'Cleo Park'}),before=durableRows(s),prepare=s.db.prepare.bind(s.db);
 let fired=0;
 s.db.prepare=sql=>{
  const statement=prepare(sql);
  if(sql.includes("UPDATE pairs SET status='approved'"))return new Proxy(statement,{get(target,key){if(key==='run')return (...args)=>{target.run(...args);fired++;throw Error('injected delivery save');};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  return statement;
 };
 assert.throws(()=>s.pairing.decide(f.owner.secret,'native-pair',{pairId:pending.pairId,decision:'approve',profile:'review'}),/injected delivery save/);
 s.db.prepare=prepare;assert.equal(fired,1);assert.deepEqual(durableRows(s),before);
 const approved=f.cold().pairing.decide(f.owner.secret,'native-pair',{pairId:pending.pairId,decision:'approve',profile:'review'});
 f.advance();const receipt=f.cold().pairing.poll(pending.pairId,pending.deviceSecret);
 assert.equal(receipt.token,approved.connection.token);assert.equal(receipt.identitySecret,approved.connection.identitySecret);
 assert.equal(f.store.authenticate(receipt.token,'native-pair').member.id,approved.memberId);
 assert.doesNotThrow(()=>auditRecovery(f.store));
});
