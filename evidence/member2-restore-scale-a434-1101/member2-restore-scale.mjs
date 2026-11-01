import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const source='a434c65358fcd1b538070c105225f21d784f8ad2';
const restoreCredential='synthetic-durable-restore-00000000000000',exporter='synthetic-durable-export-000000000000000';
const output=process.argv[2];if(!output)throw Error('Expected new output JSON path');
const bundles={};for(const name of ['ScaleSeedRoom','ScaleNativeRoom']) bundles[name]=(await build({stdin:{contents:`export {default, ${name} as ScaleRoom} from './member2-restore-scale.test-fixture.mjs';`,resolveDir:fileURLToPath(new URL('.',import.meta.url))},bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*']})).outputFiles[0].text;
const root=await mkdtemp(join(tmpdir(),'member2-restore-scale-')),results=[];
const config=(dir,className)=>({modules:true,script:bundles[className],compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],durableObjectsPersist:dir,
  durableObjects:{ROOM:{className:'ScaleRoom',useSQLite:true}},bindings:{ROOM_ORIGIN:'https://room.example.test',ROOM_RESTORE_TOKEN:restoreCredential,ROOM_EXPORT_TOKEN:exporter},
  serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});
console.log(JSON.stringify({event:'scale_started',source,pid:process.pid,counts:[1000,5000],at:new Date().toISOString()}));
try {
  for(const count of [1000,5000]) {
    const record={count,source,steps:[],startedAt:new Date().toISOString()};let mf;
    const call=async(surface,path,options={})=>{
      const started=performance.now(),response=await mf.dispatchFetch('https://room.example.test'+path+(path.includes('?')?'&':'?')+'surface='+surface,
        {...options,signal:AbortSignal.timeout(120000),headers:{Host:'room.example.test',...Object.fromEntries(new Headers(options.headers))}});
      const text=await response.text(),meter=response.headers.get('x-member2-sql-meter');let body;
      try{body=JSON.parse(text);}catch{body=null;}
      return {status:response.status,hostWallMs:performance.now()-started,meter:meter?JSON.parse(meter):null,body,text};
    };
    const compact=r=>({status:r.status,hostWallMs:r.hostWallMs,meter:r.meter});
    try {
      const dir=join(root,String(count));mf=new Miniflare(config(dir,'ScaleSeedRoom'));
      const seed=await call('source','/seed?count='+count);assert.equal(seed.status,200,seed.text);record.seed={...compact(seed),runtime:seed.body.runtime};
      console.log(JSON.stringify({event:'seeded',count,hostWallMs:seed.hostWallMs,runtime:seed.body.runtime}));
      const work=await call('source','/__work');assert.equal(work.status,200,work.text);
      const backup=await call('source','/__export');assert.equal(backup.status,200,backup.text);
      record.export={...compact(backup),bytes:Buffer.byteLength(backup.text),sha256:createHash('sha256').update(backup.text).digest('hex')};
      const partial=await call('target','/__partial',{method:'POST',body:backup.text});assert.equal(partial.status,200,partial.text);assert.equal(partial.body.pending,true);
      record.partial={...compact(partial),events:partial.body.events};
      await mf.dispose();mf=new Miniflare(config(dir,'ScaleNativeRoom'));
      const ready=await call('target','/api/ready');assert.equal(ready.status,503,ready.text);record.pendingReady=compact(ready);
      const resume=await call('target','/api/operator/restore?resume=1',{method:'POST',headers:{Authorization:'Bearer '+restoreCredential},body:backup.text});
      assert.equal(resume.status,202,resume.text);assert.equal(resume.body.verified,false);record.resume=compact(resume);
      const refused=await call('target','/__prepared-write');assert.equal(refused.status,200,refused.text);assert.equal(refused.body.refused,true);record.preparedWriterRefusal={...compact(refused),refused:refused.body.refused,error:refused.body.error};
      let result=resume.body,n=0;
      while(result.pending) {
        const phase=result.phase,stage=result.auditProgress?.stage??null,final=phase==='audit_pending'&&stage==='full_audit_pending';
        if(final) {const census=await call('target','/__scale-census');assert.equal(census.status,200,census.text);record.targetBeforeFinal=census.body;}
        const input={restoreId:result.restoreId,sourceSeal:result.sourceSeal,expectedRevision:result.revision,requestId:'member2_scale_'+count+'_'+n};
        const next=await call('target','/api/operator/restore',{method:'POST',headers:{Authorization:'Bearer '+restoreCredential,'Content-Type':'application/json'},body:JSON.stringify(input)});
        const sample={index:n,inputPhase:phase,inputStage:stage,...compact(next),outputPhase:next.body?.phase??null,outputStage:next.body?.auditProgress?.stage??null,
          pending:next.body?.pending??null,verified:next.body?.verified??null,logicalRows:next.body?.progress?.rows??null};
        record.steps.push(sample);if(final)record.finalization={...sample,result:next.body};
        if(n%25===0||final)console.log(JSON.stringify({event:final?'finalization':'progress',count,...sample}));
        assert.equal(next.status,final?200:202,next.text);if(!final)assert.equal(next.body.verified,false);
        result=next.body;if(++n>1200)throw Error('Measured operation did not terminate within existing finite harness budget');
      }
      assert.equal(result.verified,true);record.completed=true;record.finalAuditOk=result.audit?.ok??null;
    } catch(error) {record.completed=false;record.failure={name:error.name,code:error.code??null,message:String(error.message).slice(0,1500)};console.log(JSON.stringify({event:'case_failed',count,failure:record.failure}));}
    finally {if(mf)await mf.dispose();record.finishedAt=new Date().toISOString();results.push(record);await writeFile(output,JSON.stringify({source,inProgress:results.length<2,results},null,2)+'\n');}
  }
} finally {await rm(root,{recursive:true,force:true});}
const report={source,node:process.version,at:new Date().toISOString(),inProgress:false,results,limits:[
  'Actual local workerd SQLite DO with production restore routes, synthetic data only; no deployment/live conversion.',
  'Native constructor cost is outside per-request meter. Source export/ingestion and finalization are reported separately.',
  'Physical native SQL counters are adapter-observed through db.storage; returned bytes count UTF-8 text and BLOB values, excluding numeric encodings/column names/wire overhead.',
  'Host wall time is not production CPU usage. No source limits or checks disabled; Miniflare defaults retained.',
  'No duplicate/restart correctness campaign; existing 500-event correctness lane is separate.'
]};await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({event:'scale_finished',source,results:results.map(r=>({count:r.count,completed:r.completed,failure:r.failure,finalization:r.finalization&&{meter:r.finalization.meter,hostWallMs:r.finalization.hostWallMs,status:r.finalization.status}}))}));
if(results.some(r=>!r.completed))process.exitCode=1;
