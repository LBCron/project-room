import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {seedHistoricalRedactionSource} from './helpers/historical-redaction-source.mjs';
import {auditRecovery} from '../server/recovery.mjs';
const command=(id='current-instructions',revision=0)=>({id,type:'room.charter_updated',data:{expectedRevision:revision,purpose:'Keep agents focused on useful work',outputs:'Save evidence',boundaries:null,escalation:'Ask the owner'}});
test('existing owner can edit room instructions after normalized activation and retry exactly',t=>{
 const store=new RoomStore(':memory:');t.after(()=>store.close());const f=seedHistoricalRedactionSource(store),before=store.headSequence('legacy-room');
 const input=command(),result=store.command(f.key,'legacy-room',input);
 assert.equal(result.event.type,'room.charter_updated');assert.equal(store.headSequence('legacy-room'),before+1);assert.deepEqual(store.command(f.key,'legacy-room',input),result);assert.equal(store.headSequence('legacy-room'),before+1);assert.doesNotThrow(()=>auditRecovery(store));
});
