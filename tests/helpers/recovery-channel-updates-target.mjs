import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {RoomStore} from '../../server/store.mjs';
import {exportNdjsonText} from '../../server/room-export.mjs';
import {operatorRestoreResponse} from '../../server/restore-ndjson.mjs';
import {seedRecoveryChannelUpdatesSource} from './recovery-channel-updates-source.mjs';
const token='synthetic-channel-recovery-token';
export async function post(store,body) {
 const r=await operatorRestoreResponse(new Request('https://room.example/api/operator/restore',{method:'POST',headers:{authorization:'Bearer '+token,...(typeof body==='string'?{}:{'content-type':'application/json'})},body:typeof body==='string'?body:JSON.stringify(body)}),token,store);
 return {status:r.status,body:await r.json()};
}
export const input=(r,n)=>({restoreId:r.restoreId,sourceSeal:r.sourceSeal,expectedRevision:r.revision,requestId:'channel-step-'+n});
export async function fixture(t,{rows=70,padding=0,stop='channel_updates',beforeExport}={}) {
 const dir=mkdtempSync(join(tmpdir(),'channel-recovery-')),filename=join(dir,'target.sqlite'),source=new RoomStore(':memory:');seedRecoveryChannelUpdatesSource(source,{rows,padding});beforeExport?.(source);let store=new RoomStore(filename),r=await post(store,exportNdjsonText(source.db)),n=0;
 t.after(()=>{source.close();store.close();rmSync(dir,{recursive:true,force:true});});
 while(r.body.auditProgress?.stage!==stop){assert.equal(r.status,202,JSON.stringify(r.body));assert.ok(n<2000);r=await post(store,input(r.body,n++));}
 return {source,get store(){return store;},get response(){return r;},get n(){return n;},async step(body=input(r.body,n++)){r=await post(store,body);return r;},reopen(){store.close();store=new RoomStore(filename,{integrity:'deferred'});}};
}
