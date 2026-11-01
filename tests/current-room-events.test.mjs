import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event} from '../src/events.js';

function fixture(t,count=36){
 const store=new RoomStore(':memory:');t.after(()=>store.close());const events=initialRoom();
 const add=(type,data,actorId='owner')=>events.push(event({roomId:'commons',actorId,type,data}));
 for(const memberId of ['alice','bob','reader'])add('member.added',{memberId,displayName:memberId,kind:'agent',permissions:[]});
 for(let i=0;i<count;i++)add('message.posted',{messageId:'private-'+i,body:'PRIVATE-'+i,toMemberId:'bob'},'alice');
 add('message.posted',{messageId:'public',body:'OLD-PUBLIC'});
 add('message.edited',{messageId:'public',body:'CURRENT-PUBLIC',expectedMessageRevision:0});
 add('message.edited',{messageId:'private-0',body:'EDITED-PRIVATE',expectedMessageRevision:0},'alice');
 store.initialize(events,{representation:'normalized-current-v1'});
 const keys=Object.fromEntries(['owner','alice','bob','reader'].map(id=>[id,store.issueAccessKey('commons',id)]));
 store.room=()=>{throw Error('whole-room hydration');};
 return {store,keys,events};
}
test('normalized events traverse excluded source windows and redact current bodies without room hydration',t=>{
 const {store,keys}=fixture(t);let after=0,all=[],emptyMore=false;
 for(let n=0;n<30;n++){
  const page=store.eventsAfter(keys.reader,'commons',after,100);
  assert.ok(page.next>=after);emptyMore ||= page.events.length===0&&page.hasMore;
  assert.doesNotThrow(()=>store.redactionMessages('commons',page));
  all.push(...page.events);if(!page.hasMore)break;assert.ok(page.next>after);after=page.next;
 }
 assert.ok(emptyMore,'private backlog must yield an honest empty-more source window');
 assert.equal(all.filter(x=>x.event.type==='message.posted').length,1);
 assert.equal(all.find(x=>x.event.data?.messageId==='public').event.data.body,'CURRENT-PUBLIC');
 assert.equal(JSON.stringify(all).includes('PRIVATE-'),false);
});
