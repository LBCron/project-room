import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const repo='/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-mcp-qa2-adapter-1102',pin='a599faa29ff65567e5c080609cb2d000acd33666',git='/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git';assert.equal(execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
const load=p=>import(pathToFileURL(repo+'/'+p)),[{RoomStore},{initialRoom},{createRoomServer}]=await Promise.all(['server/store.mjs','server/bootstrap.mjs','server/http.mjs'].map(load));
const store=new RoomStore(':memory:');store.initialize(initialRoom('legacy-control'));store.createAccount('synthetic-account');const account=store.bindHumanAccount('legacy-control','owner','synthetic-account'),slot=store.createAccountSessionSlot(),session=store.loginAccountSession(slot.token,store.issueAccountAccessKey(account.id),0),agent=store.identities.create('Synthetic room creator');
const server=createRoomServer({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const accountHeaders={Cookie:'account_session='+slot.token,'X-Session-Binding':session.sessionBinding,'X-CSRF-Token':session.csrf,Origin:origin};
async function request(path,headers,body){const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};}
const sections=['assistant','updates','returnBrief','notifications','requestRuns'];
try{
 const human=await request('/api/account-rooms',accountHeaders,{roomId:'new-human-room',title:'Synthetic new human room',purpose:'Finite section availability check',kind:'personal',displayName:'Synthetic owner'});assert.equal(human.status,201,human.body.error?.code);assert.equal(human.body.room.id,'new-human-room');
 const created=await request('/api/agent-rooms',{Authorization:'Bearer '+agent.secret},{title:'Synthetic new agent room',purpose:'Finite section availability check'});assert.equal(created.status,201);assert.equal(typeof created.body.roomId,'string');
 const observations=[];
 for(const [kind,id,headers]of [['legacy-control','legacy-control',accountHeaders],['fresh-account','new-human-room',accountHeaders],['fresh-agent',created.body.roomId,{Authorization:'Bearer '+agent.secret}]]){
  const before=store.headSequence(id),r=await request('/api/rooms/'+id+'?messages=recent'+(headers.Cookie?'&auth=account':''),headers);assert.equal(r.status,200);assert.equal(store.headSequence(id),before);
  const observed=Object.fromEntries(sections.map(k=>[k,r.body.sections?.[k]??null]));
  if(kind!=='legacy-control'){assert.equal(r.body.representation,'normalized-current-v1');for(const k of sections){assert.equal(observed[k]?.available,false);assert.ok(observed[k].code.startsWith('current_'));}}else assert.ok(sections.every(k=>observed[k]===null));
  observations.push({kind,createRepresentation:r.body.representation??'legacy',windowStatus:r.status,sections:observed,windowAddsNoEvents:true});
 }
 const ui=readFileSync(repo+'/src/human-experience.js','utf8');assert.ok(ui.includes("if(client.sectionAvailability?.('assistant')?.available===false){section.hidden=true;ask.hidden=true;assistantSettings.hidden=true;activity.hidden=true;return;}"));
 const sourceFiles=['server/snapshot-window.mjs','src/human-experience.js','server/room-lifecycle.mjs','server/agent-rooms.mjs'];
 const result={source:pin,node:process.version,accountCreateStatus:human.status,agentCreateStatus:created.status,observations,assistantUiHidesRowAndSettingsSourceCheck:true,uiEvidence:'Source check only, not a rendered browser test',sourceSha256:Object.fromEntries(sourceFiles.map(p=>[p,createHash('sha256').update(readFileSync(repo+'/'+p)).digest('hex')])),scope:'Disposable real local HTTP account-session and agent room creation/window reads. No production signup, email, configured assistant execution, rendered UI, Native or peer-device execution qualification. Unavailable flags are observed capability declarations, not proof of corruption.'};writeFileSync(fileURLToPath(new URL('./fresh-room-sections-http-receipt.json',import.meta.url)),JSON.stringify(result,null,2)+'\n');console.log('FRESH_ROOM_SECTIONS '+JSON.stringify(result));
}finally{server.closeStreams();server.closeAllConnections();await new Promise(r=>server.close(r));store.close();}
execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
