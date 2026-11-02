import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
import {parseNeedsMeBody} from '../client/grok-host.mjs';
import {RoomStore} from '../server/store.mjs';import {AgentRooms} from '../server/agent-rooms.mjs';import {collectNeedsMe} from '../server/needs-me.mjs';import {readCurrentNeedsMePage} from '../server/current-needs-me.mjs';
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'native-needs-')),path=join(dir,'room.sqlite');let s=new RoomStore(path);t.after(()=>{s.close();rmSync(dir,{recursive:true,force:true});});const owner=s.identities.create('Olive'),peer=s.identities.create('Parker'),other=s.identities.create('Vega'),room='native-attention';new AgentRooms(s).create(owner.secret,{roomId:room,title:'Native attention',purpose:'Useful coordination',starter:false});for(const identity of[peer,other])s.invites.redeem(s.invites.create(owner.secret,room,{profile:'member'}).code,{identitySecret:identity.secret,displayName:identity===peer?'Parker':'Vega'});const send=(who,id,type,data)=>s.command(who.secret,room,{id,type,data});return{get s(){return s;},owner,peer,other,room,send,reopen(){s.close();s=new RoomStore(path);}};}
test('normalized needs-me discovers recent replies and late standing obligations without blob or board reads',t=>{
 const f=fixture(t),{s,owner,peer,room,send}=f;for(let i=0;i<30;i++)send(owner,'post'+i,'message.posted',{messageId:'post'+i,body:'Earlier message '+i});
 for(let i=0;i<3;i++)send(owner,'work'+i,'work.proposed',{workItemId:'work'+i,title:'Late useful work '+i,definitionOfDone:'Saved',accountableMemberId:owner.identityId,mode:'read'});
 s.dmConsents.request(room,peer.identityId,owner.identityId,'Reply coordination');s.dmConsents.decide(room,owner.identityId,peer.identityId,'approve');
 send(peer,'request','message.posted',{messageId:'request',toMemberId:owner.identityId,requestKind:'reply',body:'Please save a useful reply'});send(peer,'reply','message.posted',{messageId:'reply',replyToId:'post29',body:'Recent answer'});
 s.room=()=>{throw Error('unexpected needs-me blob read');};s.workClaims.list=()=>{throw Error('unexpected legacy board read');};
 let page=collectNeedsMe(s,owner.secret),n=1;const items=[...page.items];assert.ok(page.items.some(x=>x.id==='reply'));assert.ok(page.items.some(x=>x.kind==='work'));assert.ok(page.items.some(x=>x.kind==='direct_ask'&&x.id==='request'));assert.equal(page.nativeCoverage[0].available,true);assert.ok(page.hasMore);
 while(page.hasMore){assert.ok(n++<50);page=collectNeedsMe(s,owner.secret,{since:page.cursor});items.push(...page.items);}
 assert.deepEqual([...new Set(items.filter(x=>x.kind==='work').map(x=>x.id))].sort(),['work0','work1','work2']);assert.equal(page.nativeCoverage[0].standingWorkAndRequests.complete,true);assert.equal(page.nativeCoverage[0].conversation.complete,true);assert.equal(page.nativeCoverage[0].globalAttentionComplete,false);
 assert.ok(readCurrentNeedsMePage(s,owner.secret,room).items.some(x=>x.kind==='work'));
 const parsed=parseNeedsMeBody(page);assert.deepEqual(parsed.nativeCoverage,page.nativeCoverage);
 assert.throws(()=>parseNeedsMeBody({...page,nativeCoverage:[{...page.nativeCoverage[0],globalAttentionComplete:true}]}),e=>e.code==='invalid_needs_me');
 assert.throws(()=>parseNeedsMeBody({...page,contractVersion:1}),e=>e.code==='invalid_needs_me');
});
test('normalized catch-up carries empty private windows without exposing excluded IDs or acknowledging them',t=>{
 const {s,owner,peer,other,room,send}=fixture(t);s.dmConsents.request(room,peer.identityId,other.identityId,'Private');s.dmConsents.decide(room,other.identityId,peer.identityId,'approve');
 for(let i=0;i<15;i++)send(peer,'hidden'+i,'message.posted',{messageId:'hidden'+i,toMemberId:other.identityId,body:'EXCLUDED_PRIVATE_'+i});send(peer,'visible','message.posted',{messageId:'visible',body:'@Olive Visible'});
 s.room=()=>{throw Error('unexpected private blob read');};let page=collectNeedsMe(s,owner.secret,{since:0}),empty=false,n=0;const items=[];
 while(true){assert.ok(n++<50);assert.ok(!JSON.stringify(page).includes('EXCLUDED_PRIVATE_'));assert.ok(!JSON.stringify(page.cursor).includes('hidden'));empty||=page.items.length===0&&page.hasMore;items.push(...page.items);if(!page.hasMore)break;page=collectNeedsMe(s,owner.secret,{since:page.cursor});}
 assert.ok(empty);assert.ok(items.some(x=>x.id==='visible'));
});
test('native attention source cursor is viewer-bound, tamper-refusing and restart-on-change',t=>{
 const {s,owner,peer,room,send}=fixture(t);for(let i=0;i<12;i++)send(owner,'post'+i,'message.posted',{messageId:'post'+i,body:'Earlier '+i});const first=collectNeedsMe(s,owner.secret);assert.ok(first.cursor.native?.[room]);
 const token=first.cursor.native[room];assert.throws(()=>collectNeedsMe(s,peer.secret,{since:first.cursor}),e=>e.status===409);assert.throws(()=>collectNeedsMe(s,owner.secret,{since:{...first.cursor,native:{[room]:token+'x'}}}),e=>e.status===409);
 send(owner,'changed','message.posted',{messageId:'changed',body:'Source changed'});assert.throws(()=>collectNeedsMe(s,owner.secret,{since:first.cursor}),e=>e.status===409);
});

test('cold attention continuation refuses and a fresh read remains available',t=>{
 const f=fixture(t);for(let i=0;i<8;i++)f.send(f.owner,'post'+i,'message.posted',{messageId:'post'+i,body:'Recent '+i});const first=collectNeedsMe(f.s,f.owner.secret);assert.ok(first.cursor.native?.[f.room]);f.reopen();
 assert.throws(()=>collectNeedsMe(f.s,f.owner.secret,{since:first.cursor}),e=>e.status===409);assert.equal(collectNeedsMe(f.s,f.owner.secret).contractVersion,2);
 assert.throws(()=>collectNeedsMe(f.s,f.owner.secret,{since:{rooms:{},land:{},native:{[f.room]:42}}}),e=>e.status===422);
});
