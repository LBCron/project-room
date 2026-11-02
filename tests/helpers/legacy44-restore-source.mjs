// A genuine frozen schema44 producer for the still-supported synchronous
// historical restore path. Never relabel a current snapshot's watermark.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,symlinkSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
let saved;
export function legacy44RestoreSource(){return saved??=produce();}
async function produce(){const root=mkdtempSync(join(tmpdir(),'restore-source44-'));let store;try{execFileSync('tar',['-xf','-','-C',root],{input:execFileSync('git',['archive','6a64ad303','server','src','client','strings','package.json','cloudflare/room-backup.mjs'],{maxBuffer:64*1024*1024})});symlinkSync(realpathSync('node_modules'),join(root,'node_modules'));const {RoomStore}=await import(pathToFileURL(join(root,'server/store.mjs'))),{initialRoom}=await import(pathToFileURL(join(root,'server/bootstrap.mjs'))),{exportNdjsonText}=await import(pathToFileURL(join(root,'server/room-export.mjs')));store=new RoomStore(':memory:');assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,44);store.initialize(initialRoom());const key=store.issueAccessKey('commons','owner');store.command(key,'commons',{id:'historical-cleanup-message',type:'message.posted',data:{messageId:'historical-cleanup-message',body:'Synthetic historical restore cleanup qualification'}});const text=exportNdjsonText(store.db);assert.equal(JSON.parse(text.split('\n')[0]).sourceSchemaVersion,44);return text;}finally{store?.close();rmSync(root,{recursive:true,force:true});}}
