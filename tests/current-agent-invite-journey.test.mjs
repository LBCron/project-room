import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {createLegacyInviteJourney,initializeCurrentInviteJourney} from './helpers/current-agent-invite-journey.mjs';
function fixture(t){
 const legacy=new RoomStore(':memory:');t.after(()=>legacy.close());
 const snapshot=createLegacyInviteJourney(legacy);
 const s=new RoomStore(':memory:');t.after(()=>s.close());
 const {inviter,peer,issued,ownerKey,friendKey}=initializeCurrentInviteJourney(s,snapshot);
 const accountFor=(room,id)=>s.db.prepare('SELECT account_id FROM member_accounts WHERE room_id=? AND member_id=?').get(room,id).account_id;
 assert.notEqual(accountFor('commons','owner'),accountFor('friend-home','friend'));
 assert.equal(s.identities.resolveGlobalIdentitySecret(inviter.secret).identityId,inviter.identityId);
 assert.equal(s.identities.resolveGlobalIdentitySecret(peer.secret).identityId,peer.identityId);
 return{s,inviter,peer,issued,ownerKey,friendKey};
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
test('invitation replay cannot rotate a friend existing global identity without its credential',t=>{
 const{s,peer,issued}=fixture(t),requestId='existing-peer-replay';
 s.invites.redeem(issued.code,{displayName:'Friend existing agent',identitySecret:peer.secret,requestId});
 assert.throws(()=>s.invites.redeem(issued.code,{displayName:'Friend existing agent',requestId}),e=>e.status===401||e.status===403);
 assert.equal(Boolean(s.identities.resolveGlobalIdentitySecret(peer.secret)),true);
});
