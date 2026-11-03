import test from 'node:test';import assert from 'node:assert/strict';
import {messageRowForWrite} from '../server/messages-store.mjs';import {messageProofHash} from '../server/write-integrity.mjs';
import {makeRoutingWitnessResearch,checkRoutingWitnessResearch,routingMatchesCertifiedRowResearch} from '../server/message-routing-witness-research.mjs';
function row(message){const r=messageRowForWrite(message,{sequence:7,pinned:false,threadMessages:new Map([[message.id,message]])});return {...r,entity_hash:messageProofHash(r)};}
test('compact routing preserves certified metadata and rejects mismatch',()=>{
 const message={id:'one',authorId:'owner',channelId:'general',replyToId:null,toMemberId:'peer',workItemId:'work',createdAt:'2026-11-03T00:00:00Z',body:'界'.repeat(65536)};
 const r=row(message),w=makeRoutingWitnessResearch(r);assert.equal(JSON.stringify(w).length<700,true);assert.deepEqual(checkRoutingWitnessResearch(w,'one'),Object.fromEntries(Object.entries(message).filter(([k])=>k!=='body')));assert.equal(routingMatchesCertifiedRowResearch(w,r),true);
 assert.throws(()=>checkRoutingWitnessResearch(w,'wrong'));assert.throws(()=>makeRoutingWitnessResearch({...r,reply_to_id:'forged'}));
 const different={...r,author_id:'other'};different.entity_hash=messageProofHash(different);assert.throws(()=>makeRoutingWitnessResearch(different));assert.equal(routingMatchesCertifiedRowResearch({...w,routing:{...w.routing,toMemberId:'other'}},r),false);
});
