import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {buildOrient} from '../server/orient.mjs';
import {buildActivationPack} from '../server/room-activation-pack.mjs';
import {buildRoomContext} from '../server/room-context.mjs';
import {thinWorkForContext} from '../server/current-work-summary.mjs';

test('actual default context and Begin enumerate bounded work summaries with honest continuation',t=>{
 const store=new RoomStore(':memory:');t.after(()=>store.close());store.initialize(initialRoom(),{representation:'normalized-current-v1'});
 const token=store.issueAccessKey('commons','owner');store.room=()=>{throw Error('whole room hydration');};
 for(let i=0;i<19;i++)store.command(token,'commons',{id:'propose-'+i,type:'work.proposed',data:{workItemId:'task-'+String(i).padStart(2,'0'),title:'Useful '+i,definitionOfDone:'Heavy omitted prose '.repeat(50),accountableMemberId:'owner'}});
 const original=store.db.prepare.bind(store.db),sql=[];store.db.prepare=query=>{sql.push(query);return original(query);};
 let after='',ids=[],pages=0;
 do {const context=store.roomContext(token,'commons',{workAfter:after});assert.equal(context.workWindow.total,19);assert.ok(context.workWindow.shown<=8);assert.equal(context.workScope,'workWindow');ids.push(...context.focusWork.map(item=>item.id));after=context.workWindow.nextAfter;pages++;}while(after);
 assert.equal(ids.length,19);assert.equal(new Set(ids).size,19);assert.equal(pages,3);
 const orient=buildOrient(store,'commons','owner');assert.equal(orient.workTotal,null);assert.equal(orient.workWindow.complete,false);
 assert.equal(buildActivationPack(store,'commons','owner').openWork.length,8);
 assert.throws(()=>buildOrient(store,'commons','owner',{q:'Useful'}),/indexed query/);
 assert.ok(!sql.some(query=>/SELECT.*(?:payload|record_json|projection).*FROM work_entities/i.test(query)),'overview must never load work bodies');
 assert.ok(!sql.some(query=>/^SELECT projection FROM rooms/i.test(query)),'overview must not load room blob');
});

test('thin context preserves shared selector semantics including independent verifier identity',()=>{
 const receipt={eventId:'done',evidenceVersion:'v',producerAttribution:'reported',producerId:'owner',evidenceUrl:'https://example.test/evidence'};
 const base={id:'work',title:'Task',state:'completed',revision:4,accountableMemberId:'owner',verifierMemberId:'verifier',humanDecisionMakerId:'human',independentVerificationRequired:true,ownerDecisionRequired:true,receipt,
 verification:{eventId:'verify',verifierId:'verifier',actorId:'verifier',result:'pass',completionEventId:'done',evidenceVersion:'v',independenceConfirmed:true}};
 for(const change of [{},{verification:{...base.verification,verifierId:'owner'}},{decision:{decision:'approve',completionEventId:'done',evidenceVersion:'v',actorId:'human'}},{state:'working',status:'running',worker_member_id:'owner',heartbeat_at:'2026-11-01T00:00:00Z'},{claim:{holderId:'owner',expiresAt:'2027-01-01T00:00:00Z',repository:'repo',paths:['src'],status:'active'}}]) {
 const item={...base,...change},state={room:{id:'room',ownerId:'owner'},members:{},workItems:{work:item}};
 const args={sequence:2,viewerId:'owner',caughtUp:0,now:1793491200000};
 assert.deepEqual(buildRoomContext({...args,state:{...state,workItems:{work:thinWorkForContext(item)}}}),buildRoomContext({...args,state}));
 }
});

import {createHostedRoomMcp} from '../server/mcp-room-profile.mjs';
test('actual hosted MCP get_room_context composes current Orient through identity authentication',async t=>{
 const store=new RoomStore(':memory:');t.after(()=>store.close());
 const identity=store.identities.create('Current agent'),events=initialRoom();events[1].data.identityId=identity.identityId;events[1].data.kind='agent';
 store.initialize(events,{representation:'normalized-current-v1'});
 // Synthetic auth fixture registers its existing seat; no onboarding claim.
 store.db.prepare('INSERT INTO identity_links(room_id,identity_id,member_id,linked_at) VALUES(?,?,?,?)').run('commons',identity.identityId,'owner',new Date(store.now()).toISOString());
 store.room=()=>{throw Error('MCP full room hydration');};
 const mcp=createHostedRoomMcp(store);
 const result=await mcp({jsonrpc:'2.0',id:'context',method:'tools/call',params:{name:'get_room_context',arguments:{roomId:'commons'}}},{authorization:`Bearer ${identity.secret}`});
 assert.equal(result.error,undefined,JSON.stringify(result));
 const value=result.result.structuredContent??JSON.parse(result.result.content[0].text);
 assert.ok(value.workWindow,JSON.stringify(value));assert.equal(value.workWindow.total,0,JSON.stringify(value));assert.equal(value.orient.workWindow.complete,true);
});
