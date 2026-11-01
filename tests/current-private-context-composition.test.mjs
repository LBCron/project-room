import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event} from '../src/events.js';
import {buildOrient,readComposedRoomContext} from '../server/orient.mjs';

test('normalized context preserves private brief titles only for parties and role holders',t=>{
 const store=new RoomStore(':memory:');t.after(()=>store.close());const events=initialRoom();
 const add=(type,data,actorId='owner')=>events.push(event({id:'fixture-'+events.length,roomId:'commons',actorId,type,data}));
 for(const memberId of ['producer','observer'])add('member.added',{memberId,displayName:memberId,kind:'agent',permissions:[]});
 add('work.proposed',{workItemId:'private-brief',title:'PRIVATE-NORMALIZED-TITLE',definitionOfDone:'PRIVATE-NORMALIZED-DONE',accountableMemberId:'producer'});
 add('work.proposed',{workItemId:'public-brief',title:'PUBLIC-NORMALIZED-TITLE',definitionOfDone:'Public done',accountableMemberId:'producer'});
 add('message.posted',{messageId:'private-question',toMemberId:'producer',workItemId:'private-brief',requestKind:'reply',body:'PRIVATE-NORMALIZED-BODY'});
 // Synthetic journal fixture: no onboarding or consent-approval claim.
 store.initialize(events,{representation:'normalized-current-v1'});store.room=()=>{throw Error('whole-room hydration');};
 for(const viewer of ['owner','producer'])assert.ok(JSON.stringify(buildOrient(store,'commons',viewer)).includes('PRIVATE-NORMALIZED-TITLE'));
 const token=store.issueAccessKey('commons','observer');
 for(const value of [buildOrient(store,'commons','observer'),readComposedRoomContext(store,token,'commons')]){
  const text=JSON.stringify(value);assert.equal(text.includes('PRIVATE-NORMALIZED-TITLE'),false);assert.ok(text.includes('PUBLIC-NORMALIZED-TITLE'));assert.equal(text.includes('PRIVATE-NORMALIZED-DONE'),false);assert.equal(text.includes('PRIVATE-NORMALIZED-BODY'),false);
 }
});
