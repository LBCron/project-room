import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {linkWithProof} from './helpers/link-with-proof.mjs';
function fixture(t){
 const legacy=new RoomStore(':memory:');t.after(()=>legacy.close());
 legacy.initialize(initialRoom('commons','owner'));legacy.initialize(initialRoom('friend-home','friend'));
 const owner=legacy.issueAccessKey('commons','owner'),friend=legacy.issueAccessKey('friend-home','friend');
 const inviter=legacy.identities.create('Inviting agent'),peer=legacy.identities.create('Friend existing agent');
 linkWithProof(legacy,owner,'commons',inviter,{permissions:['invite_member'],memberId:inviter.identityId});
 linkWithProof(legacy,friend,'friend-home',peer,{permissions:['accept_work','complete_work'],memberId:peer.identityId});
 const issued=legacy.invites.create(inviter.secret,'commons',{profile:'contribute',displayName:'Friend existing agent'});
 const s=new RoomStore(':memory:');t.after(()=>s.close());
 for(const roomId of ['commons','friend-home'])s.initialize(legacy.db.prepare('SELECT body FROM events WHERE room_id=? ORDER BY sequence').all(roomId).map(row=>JSON.parse(row.body)),{representation:'normalized-current-v1'});
 // Reproduce the existing durable identity/link/invite snapshot without
 // invoking the currently unported normalized identity-link admission.
 for(const table of ['agent_identities','identity_links','agent_invite_codes'])for(const row of legacy.db.prepare('SELECT * FROM '+table).all()){
  const columns=Object.keys(row);s.db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).run(...columns.map(key=>row[key]));
 }
 s.issueAccessKey('commons','owner');s.issueAccessKey('friend-home','friend');
 const accountFor=(room,id)=>s.db.prepare('SELECT account_id FROM member_accounts WHERE room_id=? AND member_id=?').get(room,id).account_id;
 assert.notEqual(accountFor('commons','owner'),accountFor('friend-home','friend'));
 assert.equal(s.identities.resolveGlobalIdentitySecret(inviter.secret).identityId,inviter.identityId);
 assert.equal(s.identities.resolveGlobalIdentitySecret(peer.secret).identityId,peer.identityId);
 return{s,inviter,peer,issued};
}
test('normalized authorized existing agent creates its ordinary scoped invitation',t=>{
 const{s,inviter}=fixture(t);
 const issued=s.invites.create(inviter.secret,'commons',{profile:'contribute',displayName:'Friend existing agent'});
 assert.deepEqual(issued.permissions,['accept_work','complete_work']);
});
test('separately owned existing agent redeems into normalized room without another identity',t=>{
 const{s,peer,issued}=fixture(t),before=s.db.prepare('SELECT count(*) n FROM agent_identities').get().n;
 const joined=s.invites.redeem(issued.code,{displayName:'Friend existing agent',identitySecret:peer.secret,requestId:'existing-peer-join'});
 assert.equal(joined.identityId,peer.identityId);assert.equal(joined.memberId,peer.identityId);
 assert.equal(s.db.prepare('SELECT count(*) n FROM agent_identities').get().n,before);
});
