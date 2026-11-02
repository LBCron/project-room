// Disposable source-bound counterexample; no runtime patch or proof bypass.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {RoomStore} from '../server/store.mjs';
import {initialRoom} from '../server/bootstrap.mjs';
import {exportNdjsonText} from '../server/room-export.mjs';
import {operatorRestoreResponse} from '../server/restore-ndjson.mjs';
import {readConversation} from '../server/conversation-sync.mjs';
import {messageProofMatches} from '../server/write-integrity.mjs';
const token='synthetic-publication-repro-0000000000000';
const control=process.argv[2]==='--cold-after-publication-control';
if(process.argv.length>3||process.argv[2]&&!control)throw Error('Unknown reproduction option');
async function post(store,body){const r=await operatorRestoreResponse(new Request('https://room.example/api/operator/restore',{method:'POST',headers:{Authorization:'Bearer '+token,...(typeof body==='string'?{}:{'Content-Type':'application/json'})},body:typeof body==='string'?body:JSON.stringify(body)}),token,store);return{status:r.status,body:await r.json()};}
const input=(v,id)=>({restoreId:v.restoreId,sourceSeal:v.sourceSeal,expectedRevision:v.revision,requestId:id});
const dir=mkdtempSync(join(tmpdir(),'member2-pending-proof-')),source=new RoomStore(':memory:');let target;
try {
 source.initialize(initialRoom(),{representation:'normalized-current-v1'});const key=source.issueAccessKey('commons','owner'),filename=join(dir,'target.sqlite');
 target=new RoomStore(filename);let result=await post(target,exportNdjsonText(source.db)),n=0;
 while(result.body.auditProgress?.stage!=='full_audit_pending'){assert.equal(result.status,202);assert.ok(++n<400);result=await post(target,input(result.body,'repro-prep-'+n));}
 // The production Native constructor opens this persisted PENDING state.
 if(!control){target.close();target=new RoomStore(filename,{integrity:'deferred'});assert.equal(target.restoreStatus().pending,true);}
 const final=await post(target,input(result.body,'repro-publish'));assert.equal(final.status,200);assert.equal(final.body.verified,true);
 if(control){target.close();target=new RoomStore(filename,{integrity:'deferred'});assert.equal(target.restoreStatus().pending,false);}
 const command=target.command(key,'commons',{id:'repro-new-message',type:'message.posted',data:{messageId:'repro-new-message',body:'Useful synthetic result after recovery'}});
 const row=target.db.prepare("SELECT * FROM messages WHERE room_id='commons' AND message_id='repro-new-message'").get();
 let readError=null;try{readConversation(target,key,'commons',{channelId:'general',limit:1});}catch(e){readError={name:e.name,message:e.message};}
 const report={variant:control?'cold-after-publication-control':'cold-while-pending-reproduction',publicationVerified:final.body.verified,commandRecorded:Boolean(command.event),messageHasEntityHash:typeof row.entity_hash==='string'&&row.entity_hash.length>0,messageProofMatches:messageProofMatches(row),readError};
 console.log(JSON.stringify({event:'pending-publication-proof-repro',...report}));
 assert.equal(report.messageProofMatches,true,'A successful post-publication message must carry its registered write proof');assert.equal(readError,null);
} finally {target?.close();source.close();rmSync(dir,{recursive:true,force:true});}
