import test from 'node:test';
import assert from 'node:assert/strict';
import {initialRecoveryCensus,validateRecoveryCensus} from '../server/recovery-census-continuation.mjs';

test('durable independent-census cursor rejects unknown protocol, claimed admission and malformed progress',()=>{
 const initial=initialRecoveryCensus();assert.doesNotThrow(()=>validateRecoveryCensus(initial));
 for(const invalid of [
  {...initial,version:initial.version-1},
  {...initial,verified:true},
  {...initial,stage:'verified'},
  {...initial,units:NaN},
  {...initial,proofs:-1},
  {...initial,roomId:{}},
  {...initial,keyAfter:'x'.repeat(201)},
  {...initial,privacyValue:{version:1,requests:1,parties:{}}}
 ])assert.throws(()=>validateRecoveryCensus(invalid),/reconciliation|corrupt/);
});

// Import-order regression: recovery must load without initializing Store first.
import {boardStateForWorkItem,liveClaim} from '../server/work-item-state.mjs';
import * as board from '../server/work-item-board.mjs';
test('repository-free work selectors remain the canonical board exports',()=>{
 assert.equal(board.boardStateForWorkItem,boardStateForWorkItem);
 assert.equal(board.liveClaim,liveClaim);
});
