import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../server/store.mjs';
import { initialRoom } from '../server/bootstrap.mjs';
import { applyEvent, emptyRoomState, event } from '../src/events.js';
import { syncMessageRows } from '../server/messages-store.mjs';
import { repairLegacyMessages } from '../server/operator-legacy-message-repair.mjs';

// Entirely synthetic reproduction of the pre749 contract: session events
// changed the session/revision, while explicit lifecycle events changed state.
export function historicalSequence(roomId='legacy-room') {
  const base=initialRoom(roomId,'owner').map((e,i)=>({...e,at:new Date(Date.UTC(2026,8,1,0,0,i)).toISOString()}));
  const definitions=[
    ['work.proposed',{workItemId:'task',title:'Synthetic historical task',definitionOfDone:'A synthetic result',accountableMemberId:'owner',mode:'read'}],
    ['session.started',{workItemId:'task',expectedRevision:0}],
    ['session.status_changed',{workItemId:'task',status:'active',expectedRevision:1}],
    ['session.stopped',{workItemId:'task',status:'done',expectedRevision:2}],
    ['work.accepted',{workItemId:'task',expectedRevision:3}],
    ['work.started',{workItemId:'task',expectedRevision:4}],
    ['message.posted',{messageId:'message',body:'Synthetic historical message'}]
  ];
  return [...base,...definitions.map(([type,data],i)=>event({id:'synthetic-'+i,idempotencyKey:'synthetic-key-'+i,roomId,actorId:'owner',at:new Date(Date.UTC(2026,8,1,0,1,i)).toISOString(),type,data}))];
}
function fixtureLegacyApply(state,incoming) {
  const previous=state.workItems?.[incoming.data?.workItemId]?.state;
  const next=applyEvent(state,incoming);
  if(['session.started','session.status_changed','session.stopped'].includes(incoming.type)&&previous)
    next.workItems[incoming.data.workItemId].state=previous;
  return next;
}
export function legacyFixture(t) {
  const s=new RoomStore(':memory:'),events=historicalSequence();t.after(()=>s.close());
  const initial=events.slice(0,initialRoom().length);s.initialize(initial);
  let state=emptyRoomState();
  // Trusted historical-writer fixture. These proofs pre-exist every repair
  // invocation; production repair may neither establish nor replace them.
  s.transaction(()=>{
    for(const [index,incoming]of events.entries()){
      state=fixtureLegacyApply(state,incoming);
      if(index>=initial.length){s.db.prepare('INSERT INTO events VALUES(?,?,?,?)').run('legacy-room',index+1,incoming.id,JSON.stringify(incoming));syncMessageRows(s.db,{roomId:'legacy-room',sequence:index+1,event:incoming,state});}
    }
    const compact={...state,eventLog:[],seenEvents:{},seenIdempotencyKeys:{}};
    s.db.prepare('UPDATE rooms SET sequence=?,projection=? WHERE id=?').run(events.length,s.storedProjection('legacy-room',compact),'legacy-room');
    s.rememberReconstructedRoomProof('legacy-room');
  });
  const backfill=s.backfillMessages({limit:64});
  assert.equal(backfill.quarantined.length,1);
  const request={repairKind:'pre749-session-backfill',rooms:[{roomId:'legacy-room',expectedHead:events.length}],reason:'Synthetic historical backfill reconciliation'};
  return{s,events,request};
}
const authority=s=>Object.fromEntries(['rooms','messages','work_entities','integrity_room_state'].map(table=>[table,s.db.prepare(`SELECT * FROM ${table} WHERE ${table==='rooms'?'id':'room_id'}=?`).all('legacy-room')]));

test('explicit legacy repair reconciles synthetic pre749 quarantine without rewriting independently proved serving rows',t=>{
  const f=legacyFixture(t),before=authority(f.s);
  const plan=repairLegacyMessages(f.s,f.request);
  const completed=repairLegacyMessages(f.s,{...f.request,planHash:plan.planHash,requestId:'legacy-repair-1'},true);
  assert.equal(completed.derivedOnly,true);
  assert.equal(f.s.db.prepare('SELECT 1 FROM messages_backfill_blocks WHERE room_id=?').get('legacy-room'),undefined);
  assert.deepEqual(authority(f.s),before);
  assert.deepEqual(repairLegacyMessages(f.s,{...f.request,planHash:plan.planHash,requestId:'legacy-repair-1'},true),{...completed,duplicate:true});
});

test('modern direct commands still reject work.accepted after session processing/active/done',t=>{
  const s=new RoomStore(':memory:');t.after(()=>s.close());const events=historicalSequence();
  const firstAccept=events.findIndex(e=>e.type==='work.accepted');s.initialize(events.slice(0,firstAccept));
  const key=s.issueAccessKey('legacy-room','owner'),head=s.headSequence('legacy-room');
  assert.equal(s.room('legacy-room').state.workItems.task.state,'working');
  assert.throws(()=>s.command(key,'legacy-room',{id:'modern-repeat-accept',type:'work.accepted',data:{workItemId:'task',expectedRevision:3}}),/Invalid transition from working/);
  assert.equal(s.headSequence('legacy-room'),head);
});
