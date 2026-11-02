import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {seedNormalizationAuth} from './helpers/operator-normalization-auth-source.mjs';
import {emptyRoomState,replayEvents} from '../src/events.js';
import {initialRecoveryReplay,advanceRecoveryReplay} from '../server/recovery-replay-continuation.mjs';
import {planRecoveryReplayValue,writeRecoveryReplayValue,readRecoveryReplayValue} from '../server/recovery-replay-value.mjs';

test('one source-zero fold pauses exactly at historical authority and resumes through stamped joins',()=>{
  const store=new RoomStore(':memory:');
  try {
    seedNormalizationAuth(store);
    const events=store.db.prepare("SELECT body FROM events WHERE room_id='commons' ORDER BY sequence").all().map(r=>JSON.parse(r.body));
    const maximum=Math.max(...events.map(e=>Buffer.byteLength(JSON.stringify(e))));
    const seal={tables:[{name:'events',maxRowBytes:maximum,expected:{rows:events.length}},{name:'projection_checkpoints',maxRowBytes:0,expected:{rows:0}}]};
    const budget=4096+9*maximum*events.length,cells=new Map();let touched=new Set();
    const key=(...parts)=>JSON.stringify(parts);
    const scratch={get remaining(){return 128-touched.size;},get(...parts){return structuredClone(cells.get(key(...parts)));},set(lane,room,domain,id,value,part=0){const k=key(lane,room,domain,id,part);touched.add(k);cells.set(k,structuredClone(value));}};
    for(const domain of ['members','workItems','channels'])writeRecoveryReplayValue(scratch,'commons','shape',domain,planRecoveryReplayValue('object',budget));
    let cursor={...initialRecoveryReplay(),stage:'events'},calls=0,nameBoundaries=0;
    for(const throughSequence of [2,events.length-1,events.length]) {
      let result;
      do {
        touched=new Set();
        result=advanceRecoveryReplay(store.db,scratch,'commons',structuredClone(cursor),seal,{throughSequence,maxUnits:1});
        cursor=structuredClone(result.cursor);calls++;
        if(cursor.names&&!cursor.names.complete)nameBoundaries++;
        assert.ok(result.units<=1);assert.ok(cursor.sequence<=throughSequence);assert.notEqual(cursor.stage,'deferred',cursor.reason);assert.ok(calls<500);
      }while(!result.paused&&!result.done);
      assert.equal(cursor.sequence,throughSequence);
      const original=replayEvents(emptyRoomState(),structuredClone(events.slice(0,throughSequence)));
      assert.equal(cursor.counts.members,Object.keys(original.members).length);
      for(const [id,member]of Object.entries(original.members))assert.deepEqual(readRecoveryReplayValue(scratch,'commons','members',id,budget),member);
      assert.deepEqual(readRecoveryReplayValue(scratch,'commons','metadata','room',budget),original.room);
      assert.equal(result.done,throughSequence===events.length);
    }
    assert.ok(nameBoundaries>0);
    for(const options of [{throughSequence:-1},{throughSequence:events.length+1},{throughSequence:1},{maxUnits:0},{maxUnits:129}])assert.throws(()=>advanceRecoveryReplay(store.db,scratch,'commons',cursor,seal,options),/stop differs/);
    assert.throws(()=>advanceRecoveryReplay(store.db,scratch,'commons',initialRecoveryReplay(),seal,{throughSequence:2}),/source-zero/);
    assert.throws(()=>advanceRecoveryReplay(store.db,scratch,'commons',initialRecoveryReplay(),seal,{maxUnits:1}),/explicit source-zero target/);
  } finally {store.close();}
});
