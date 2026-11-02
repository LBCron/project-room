import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {event} from '../src/events.js';
import {auditRecovery} from '../server/recovery.mjs';

test('authorized normalized message deletion physically erases text and preserves exact retry',t=>{
 const store=new RoomStore(':memory:');t.after(()=>store.close());
 const es=initialRoom();es.push(event({roomId:'commons',actorId:'owner',type:'message.posted',data:{messageId:'erase-me',body:'private-redaction-needle-1101'}}));
 store.initialize(es,{representation:'normalized-current-v1'});
 const key=store.issueAccessKey('commons','owner');store.room=()=>{throw Error('legacy blob hydration');};
 const command={id:'delete-once',type:'message.deleted',data:{messageId:'erase-me',expectedMessageRevision:0,reason:'remove'}};
 const saved=store.command(key,'commons',command);
 assert.equal(saved.duplicate,false);
 assert.equal(store.db.prepare("SELECT body FROM messages WHERE message_id='erase-me'").get().body,null);
 assert.equal(store.db.prepare("SELECT count(*) n FROM events WHERE instr(body,'private-redaction-needle-1101')>0").get().n,0);
 assert.equal(store.command(key,'commons',command).duplicate,true);
 assert.doesNotThrow(()=>auditRecovery(store));
});
