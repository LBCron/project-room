import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {seedAccessStore} from './access_request_seed.mjs';
const [root]=process.argv.slice(2);assert.equal(process.argv.length,3);
const git=process.env.LOCAL_LAB_GIT??'git';const pin=execFileSync(git,['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(pin,'f02132a1c921af7953368a7340f6d03b87a78d28');execFileSync(git,['-C',root,'diff','--quiet','HEAD','--']);
const imp=p=>import(pathToFileURL(root+'/'+p));
const [{RoomStore},{initialRoom},{AccessRequests},{createRoomServer},{signInFixture}]=await Promise.all(['server/store.mjs','server/bootstrap.mjs','server/access-requests.mjs','server/http.mjs','scripts/auth-signin.mjs'].map(imp));
const require=createRequire(root+'/package.json');const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true});const samples=[];
try{
 for(const count of [25,1000]){
  const store=new RoomStore(':memory:');const f=seedAccessStore(store,count,{initialRoom,AccessRequests});
  const accounts={};
  for(const role of ['owner','admin']){const account=store.accountForMember(f.room,role)??store.bindHumanAccount(f.room,role,'scale-'+role);store.completeOnboarding(account.id);accounts[role]=store.issueAccountAccessKey(account.id);}
  const server=createRoomServer({store,streamInterval:50});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  try{
   for(const role of ['owner','admin']){
    const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(15000);
    const errors=[],responses=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('response',response=>{
     const u=new URL(response.url());if(response.request().method()==='GET'&&u.pathname==='/api/rooms/'+f.room+'/access-requests')responses.push((async()=>{const data=await response.body(),body=JSON.parse(data.toString());return{status:response.status(),bytes:data.length,returnedRequests:body.requests?.length??null,hasQueueContinuation:Boolean(body.nextCursor||body.page?.hasMore)};})());
    });
    try{
     await page.goto(origin+'/?account=1&room='+f.room);await signInFixture(page,accounts[role]);await page.locator('#main').waitFor({state:'visible'});await page.locator('#topbar-updates').click();
     const rows=page.locator('#attention-list > li[data-access-request-id^="pending-"]');await rows.last().waitFor();await page.waitForFunction(n=>document.querySelectorAll('#attention-list > li[data-access-request-id^="pending-"]').length===n,count);
     const last=rows.last();await last.scrollIntoViewIfNeeded();const partial=last.locator('.attention-partial');await partial.focus();await page.keyboard.press('Enter');await last.locator('fieldset').waitFor();
     const selected=await last.locator('fieldset input').evaluateAll(nodes=>nodes.map(n=>({permission:n.value,disabled:n.disabled,checked:n.checked})));
     if(role==='admin'){assert.equal(selected.find(x=>x.permission==='complete_work').disabled,true);assert.equal(selected.find(x=>x.permission==='accept_work').disabled,false);assert.equal(await last.locator('.attention-decide[data-action-index="0"]').isDisabled(),true);}
     await page.keyboard.press('Escape');await last.locator('fieldset').waitFor({state:'detached'});assert.equal(await partial.evaluate(n=>n===document.activeElement),true);
     const dom=await page.locator('#attention-list').evaluate(n=>({rows:n.children.length,nodes:n.querySelectorAll('*').length,buttons:n.querySelectorAll('button').length,height:n.scrollHeight}));
     const pagesVisible=await page.locator('#attention-pages').isVisible();const queueResponses=await Promise.all(responses);assert.ok(queueResponses.length>0);assert.ok(queueResponses.every(x=>x.status===200&&x.returnedRequests===count));assert.deepEqual(errors,[]);
     assert.equal(store.db.prepare("SELECT count(*) n FROM access_requests WHERE room_id=? AND status='pending'").get(f.room).n,count);
     samples.push({count,role,dom,queueResponses,pagesVisible,keyboardPartialAndEscapeFocus:true,exactAdminGrantControls:role==='admin'?true:null,noDecisionsSubmitted:true,browserErrors:errors});
    }finally{await context.close();}
   }
  }finally{server.closeStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();}
 }
}finally{await browser.close();}
execFileSync(git,['-C',root,'diff','--quiet','HEAD','--']);
console.log(JSON.stringify({schema:'member2-access-request-browser-baseline-v1',pin,node:process.version,samples,scope:'Actual local Chromium full app, real account-session signin and HTTP/SQLite producer APIs. Node SQLite backend; Native physical cost is separately measured. No fake API replies, production load, decisions or runtime source edits.'},null,2));
