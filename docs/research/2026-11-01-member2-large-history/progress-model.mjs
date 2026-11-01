// Conditional capacity model, never a production scheduler or throughput claim.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
const load=path=>readFile(new URL('../../../'+path,import.meta.url),'utf8');
const [store,messages,jobs]=await Promise.all([load('server/store.mjs'),load('server/messages-store.mjs'),load('server/jobs.mjs')]);
const section=store.slice(store.indexOf('async runDeferredIntegrityBatch('));
const list=section.slice(section.indexOf('const steps = ['),section.indexOf('];'));
const steps=[...list.matchAll(/\["([a-z_]+)",/g)].map(x=>x[1]);
const stepBudget=Number(section.match(/while \(ran < (\d+)\)/)?.[1]);
const batch=Number(messages.match(/MESSAGES_BACKFILL_BATCH = (\d+)/)?.[1]);
assert.equal(steps.length,11);assert.equal(stepBudget,2);assert.equal(batch,200);
assert.match(jobs,/name: "integrity",\s*cadenceMs: HOUR_MS/);
function simulate(arrivalsPerHour,hours,allocation=1){
 let cursor=0,lag=1799,services=0,processed=0,firstCaughtUpHour=null,maxLag=lag;const samples=[];
 for(let hour=1;hour<=hours;hour++){
  lag+=arrivalsPerHour;maxLag=Math.max(maxLag,lag);let service=0;
  for(let i=0;i<stepBudget;i++){
   if(steps[cursor]==='messages_backfill'){service=Math.floor(batch*allocation);const n=Math.min(lag,service);processed+=n;lag-=n;services++;}
   cursor=(cursor+1)%steps.length;
  }
  if(lag===0&&firstCaughtUpHour===null)firstCaughtUpHour=hour;
  if(hour<=12||hour%24===0)samples.push({hour,lag,capacityThisVisit:service});
 }
 return {arrivalsPerHour,hours,allocation,initialLag:1799,services,processed,finalLag:lag,maxLag,firstCaughtUpHour,samples};
}
const scenarios=[0,20,36,40,100,1000].map(rate=>simulate(rate,72));
assert.ok(scenarios.find(x=>x.arrivalsPerHour===0).finalLag<1799);
assert.ok(scenarios.find(x=>x.arrivalsPerHour===40).finalLag>1799);
// Proposed consumer sensitivity only. This does not install or implement one.
const consumerSensitivity=[];
for(const arrivalsPerHour of [100,1000,10000])for(const successfulBatchesPerHour of [1,6,60]){
 const capacityPerHour=batch*successfulBatchesPerHour,netDrainPerHour=capacityPerHour-arrivalsPerHour;
 consumerSensitivity.push({arrivalsPerHour,successfulBatchesPerHour,capacityPerHour,netDrainPerHour,canCloseLag:netDrainPerHour>0,fluidEstimateHoursToClose1799:netDrainPerHour>0?1799/netDrainPerHour:null});
}
const result={sourceRevision:'513d3ee8471464803fd3c70dea2fe9ce30f27ad0',inputs:{steps,stepsPerVisit:stepBudget,eventsPerBackfillVisit:batch,cadenceHours:1,initialLag:1799,sourceHashes:Object.fromEntries([['store',store],['messages',messages],['jobs',jobs]].map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]))},optimisticLongRunEventsPerHour:batch*stepBudget/steps.length,scenarios,finiteCatchup:[0,20,36].map(rate=>simulate(rate,11000)),twoEqualRoomShare:simulate(20,72,0.5),consumerSensitivity,limitations:['Conditional model: hourly integrity is the only effective driver','Every visit finishes both steps; no deadlines, failures, other work or starvation','Real global backfill room selection does not promise equal share','Other callers or continuations may change actual throughput; measure rather than infer','Consumer sensitivity uses full 200-event batches; byte caps can reduce actual service','No timers, jobs, schedules or production changes are created']};
// Keep long-horizon output compact while preserving first-catch-up calculation.
for(const x of result.finiteCatchup)x.samples=x.samples.filter(s=>s.hour<=12||s.hour===x.hours);
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));
