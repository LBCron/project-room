import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {resolve,dirname} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const {values}=parseArgs({options:{repo:{type:'string'},source:{type:'string'},output:{type:'string'},git:{type:'string',default:'git'},viewport:{type:'string',default:'both'},'second-room-format':{type:'string',default:'normalized-current-v1'},'observe-only':{type:'boolean',default:false}}});
if(!values.repo||!values.source||!values.output||!['desktop','phone','both'].includes(values.viewport)||!['legacy','normalized-current-v1'].includes(values['second-room-format'])||!/^([0-9a-f]{40})$/.test(values.source))throw Error('Required: --repo PATH --source FULL_SHA --output NEW_DIRECTORY [--git PATH] [--viewport both|desktop|phone] [--second-room-format normalized-current-v1|legacy] [--observe-only]');
const repo=resolve(values.repo),pin=values.source,git=values.git,out=resolve(values.output),secondRoomFormat=values['second-room-format'];
assert.equal(execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
await mkdir(dirname(out),{recursive:true});await mkdir(out);process.chdir(repo);
const load=p=>import(pathToFileURL(repo+'/'+p)),[{RoomStore},{createRoomServer},{openSettings,closeSettings,clickChrome}]=await Promise.all(['server/store.mjs','server/http.mjs','scripts/room-chrome.mjs'].map(load));const require=createRequire(repo+'/package.json'),{chromium}=require('playwright');
const store=new RoomStore(':memory:'),initialize=store.initialize.bind(store),interventions=[];let forceLegacy=false;
store.initialize=(events,options={})=>{if(forceLegacy){interventions.push({requested:options.representation??'legacy',used:'legacy'});const {representation,...rest}=options;return initialize(events,rest);}return initialize(events,options);};
const server=createRoomServer({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;const observations=[];
try{
 browser=await chromium.launch({headless:true});
 for(const [label,options]of [['desktop',{viewport:{width:1280,height:860}}],['phone',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}]].filter(([label])=>values.viewport==='both'||values.viewport===label)){
  const context=await browser.newContext({...options,reducedMotion:'reduce'});let blockedExternalRequests=0;
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin&&!['data:','blob:','about:'].includes(url.protocol)){blockedExternalRequests++;return route.abort();}return route.continue();});
  const page=await context.newPage();page.setDefaultTimeout(10000);const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));page.on('dialog',d=>d.accept());
  const password='Synthetic-local-password-1102!',accounts={};const stages=[];
  async function auth(name,signup){
   if(signup)await page.getByRole('button',{name:'Create account',exact:true}).click();
   const form=page.locator('#auth-signin-ui [data-signin-form="password"]');await form.locator('[name=email]').fill(name+'-'+label+'@example.invalid');await form.locator('[name=password]').fill(password);
   const reply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/password/'+(signup?'signup':'login')&&r.request().method()==='POST');await form.locator('button[type=submit]').click();const response=await reply;assert.equal(response.status(),signup?202:200);
   return response.status();
  }
  async function observe(name,representation,first){
   await page.locator('#main').waitFor({state:'visible'});const roomId=new URL(page.url()).searchParams.get('room');assert.ok(roomId);
   const session=await(await context.request.get(origin+'/api/account-session')).json();assert.equal(session.authenticated,true);const headers={Origin:origin,'X-Session-Binding':session.sessionBinding,'X-CSRF-Token':session.csrf};
   if(first)accounts[name]={roomId,headers,sessionRevision:session.sessionRevision};else assert.equal(roomId,accounts[name].roomId);
   const response=await context.request.get(origin+'/api/rooms/'+roomId+'?auth=account',{headers});assert.equal(response.status(),200);assert.equal((await response.json()).representation??'legacy',representation);
   await openSettings(page);const connect=await page.locator('#assistant-setup').isVisible();assert.equal(connect,representation==='legacy');await closeSettings(page);
   const marker='PRIVATE SYNTHETIC '+name+' '+label;
   if(first){await page.locator('#message-input').fill(marker);const posted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/rooms/'+roomId+'/commands'&&r.request().method()==='POST');await page.locator('#message-form button[type=submit]').click();assert.equal((await posted).status(),201);}
   await page.locator('[data-message-record-id]').filter({hasText:marker}).waitFor({state:'visible'});assert.equal((await page.locator('#message-list').innerText()).includes('PRIVATE SYNTHETIC '+(name==='account-a'?'account-b':'account-a')+' '+label),false);
   await page.locator('#topbar-updates').click();await page.locator('#updates-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#updates-status').textContent.startsWith('Loading updates'));const updates=await page.locator('#updates-dialog').innerText();assert.equal(/Updates are unavailable/.test(updates),representation==='normalized-current-v1');assert.equal(/Loading updates|Could not|Couldn.t/.test(updates),false);const screenshot=label+'-'+stages.length+'-'+name+'.png';await page.screenshot({path:out+'/'+screenshot,fullPage:true});await page.keyboard.press('Escape');
   const accountStatus={visible:await page.locator('#account-status').isVisible(),text:await page.locator('#account-status').textContent()};stages.push({accountStatus,account:name,representation,sessionRevision:session.sessionRevision,assistantConnectVisible:connect,settledUpdatesText:updates,ownMessageVisible:true,otherAccountMessageAbsent:true,screenshot});return {roomId,headers};
  }
  async function logout(){const reply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/account-session'&&r.request().method()==='DELETE');await clickChrome(page,'#signout-button');assert.equal((await reply).status(),200);await page.locator('#auth-panel').waitFor({state:'visible'});assert.equal(await page.locator('#main').isVisible(),false);assert.equal((await(await context.request.get(origin+'/api/account-session')).json()).authenticated,false);}
  await page.goto(origin);forceLegacy=true;await auth('account-a',true);await page.locator('#main').waitFor({state:'visible'});forceLegacy=false;await observe('account-a','legacy',true);await logout();
  await auth('account-b',true);await page.locator('#account-room-create > summary').click();await page.locator('#account-room-title').fill('Account B private room');await page.locator('#account-room-purpose').fill('Disposable session-isolation check');await page.locator('#account-room-name').fill('Account B owner');const created=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/account-rooms'&&r.request().method()==='POST');await page.locator('#account-room-submit').click();assert.equal((await created).status(),201);const b=await observe('account-b',secondRoomFormat,true);
  const foreign=await context.request.get(origin+'/api/rooms/'+accounts['account-a'].roomId+'?auth=account',{headers:b.headers});const foreignBody=await foreign.json();assert.equal(foreign.status(),403);assert.equal(JSON.stringify(foreignBody).includes('PRIVATE SYNTHETIC'),false);
  const stale=await context.request.get(origin+'/api/rooms/'+b.roomId+'?auth=account',{headers:accounts['account-a'].headers});const staleBody=await stale.json();assert.equal(stale.status(),409);assert.equal(staleBody.error?.code,'session_binding_changed');assert.equal(JSON.stringify(staleBody).includes('PRIVATE SYNTHETIC'),false);
  await logout();await auth('account-a',false);await page.locator('#auth-panel').waitFor({state:'hidden'});if(!await page.locator('#main').isVisible())await page.locator('[data-account-room="'+accounts['account-a'].roomId+'"]').click();await observe('account-a','legacy',false);
  assert.deepEqual(pageErrors,[]);observations.push({viewport:label,width:options.viewport.width,stages,foreignAccountRoom:{status:foreign.status(),code:foreignBody.error?.code,privateMarkerAbsent:true},staleSessionBinding:{status:stale.status(),code:staleBody.error?.code,privateMarkerAbsent:true},pageErrors,blockedExternalRequests});await context.close();
 }
 assert.equal(interventions.length,observations.length);const staleAccessNotices=observations.flatMap(o=>o.stages.filter(stage=>stage.accountStatus.visible&&stage.accountStatus.text.includes("You're not in that room yet")).map(stage=>({viewport:o.viewport,account:stage.account})));const result={source:pin,node:process.version,secondRoomFormat,observeOnly:values['observe-only'],staleAccessNotices,interventions,observations,scope:'Actual local browser account signout/new signup/relogin in one context, fixture-only initial legacy creation for accountA. No product patch, concurrent delayed-response race, configured provider, Native, hosted, fullsuite or physical peer-device proof.'};await writeFile(out+'/receipt.json',JSON.stringify(result,null,2)+'\n');console.log('ACCOUNT_SWITCH_BROWSER '+JSON.stringify(result));
}finally{await browser?.close();server.closeStreams();server.closeAllConnections();await new Promise(r=>server.close(r));store.close();}
execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);

if(!values['observe-only']){const {readFile}=await import('node:fs/promises');const receipt=JSON.parse(await readFile(out+'/receipt.json','utf8'));assert.deepEqual(receipt.staleAccessNotices,[],'Stale room-access notice remains after opening an authorized room');}
