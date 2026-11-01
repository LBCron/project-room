import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {RoomStore} from '../server/store.mjs';import {initialRoom} from '../server/bootstrap.mjs';import {event} from '../src/events.js';
function events({count=100,large=false,purposeBytes=0}={}){
 const list=initialRoom();if(purposeBytes)list[0].data.purpose='p'.repeat(purposeBytes);
 for(let i=1;i<count;i++){const memberId=`member-${String(i).padStart(3,'0')}`;list.push(event({roomId:'commons',actorId:'owner',type:'member.added',data:{memberId,displayName:memberId,kind:'agent',permissions:[]}}));
  if(large&&i!==1)list.push(event({roomId:'commons',actorId:memberId,type:'capabilities.advertised',data:{capabilities:Array.from({length:30},(_,j)=>String(j).padStart(2,'0')+'x'.repeat(78))}}));}
 return list;
}
function fixture(t,options={}){
 const list=events(options),legacy=new RoomStore(':memory:');legacy.initialize(structuredClone(list));
 const token=legacy.issueAccessKey('commons','member-001'),row=legacy.db.prepare('SELECT * FROM credentials WHERE hash=?').get(createHash('sha256').update(token).digest('hex'));legacy.close();
 const store=new RoomStore(':memory:');t.after(()=>store.close());store.initialize(list,{representation:'normalized-current-v1'});
 // A credential legitimately issued before migration; credentials remain their
 // existing authority table and are unchanged by normalized conversion.
 const fields=Object.keys(row);store.transaction(()=>store.db.prepare(`INSERT INTO credentials(${fields.join(',')}) VALUES(${fields.map(()=>'?').join(',')})`).run(...fields.map(key=>row[key])));
 return {store,token};
}
test('existing short-profile access credential authenticates in a legal100-member normalized room',t=>{
 const {store,token}=fixture(t);assert.equal(store.authenticate(token,'commons').member.id,'member-001');
});
test('issuing a selected member key in a legal100-member room does not require full roster hydration',t=>{
 const {store}=fixture(t),token=store.issueAccessKey('commons','member-001');assert.equal(store.authenticate(token,'commons').member.id,'member-001');
});
test('selected principal authority ignores large unrelated advertised profiles',t=>{
 const {store,token}=fixture(t,{large:true}),authority=store.roomAuthority('commons',{memberId:'member-001',includeHistory:true});
 assert.equal(authority.members['member-001'].id,'member-001');assert.equal(authority.ownerId,'owner');assert.deepEqual(Object.keys(authority.members).sort(),['member-001','owner']);
 assert.equal(store.authenticate(token,'commons').member.id,'member-001');
});
