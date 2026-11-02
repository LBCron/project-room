import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const lab=fileURLToPath(new URL('.',import.meta.url)),repo='/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-mcp-qa2-adapter-1102',pin='a599faa29ff65567e5c080609cb2d000acd33666',git='/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git';assert.equal(execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);process.chdir(repo);
const load=p=>import(pathToFileURL(repo+'/'+p)),[{RoomStore},{createRoomServer},{openSettings,closeSettings,returnToRoom}]=await Promise.all(['server/store.mjs','server/http.mjs','scripts/room-chrome.mjs'].map(load));const require=createRequire(repo+'/package.json'),{chromium}=require('playwright');
const store=new RoomStore(':memory:'),interventions=[],initialize=store.initialize.bind(store);
let forceLegacy=false;
store.initialize=(events,options={})=>{if(forceLegacy&&options.representation==='normalized-current-v1'){interventions.push({requested:options.representation,used:'legacy'});const {representation,...rest}=options;return initialize(events,rest);}return initialize(events,options);};
const server=createRoomServer({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,out=lab+'mixed-room-browser';await mkdir(out,{recursive:true});let browser;const observations=[];
try{
 browser=await chromium.launch({headless:true});
 for(const [label,options]of [['desktop',{viewport:{width:1280,height:860}}],['phone',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}]]){
  const context=await browser.newContext({...options,reducedMotion:'reduce'});let blockedExternalRequests=0;
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin&&!['data:','blob:','about:'].includes(url.protocol)){blockedExternalRequests++;return route.abort();}return route.continue();});
  const page=await context.newPage();page.setDefaultTimeout(10000);const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  forceLegacy=true;
  await page.goto(origin);await page.getByRole('button',{name:'Create account',exact:true}).click();const form=page.locator('#auth-signin-ui [data-signin-form="password"]');await form.locator('[name=email]').fill('mixed-'+label+'@example.invalid');await form.locator('[name=password]').fill('Synthetic-local-password-1102!');const signed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/password/signup'&&r.request().method()==='POST');await form.locator('button[type=submit]').click();assert.equal((await signed).status(),202);await page.locator('#main').waitFor({state:'visible'});
  forceLegacy=false;
  const legacyId=new URL(page.url()).searchParams.get('room');assert.ok(legacyId);
  const accountSession=await(await context.request.get(origin+'/api/account-session')).json();const headers={Origin:origin,'X-Session-Binding':accountSession.sessionBinding,'X-CSRF-Token':accountSession.csrf};
  const normalizedId='mixed-normalized-'+label;
  const created=await context.request.post(origin+'/api/account-rooms',{headers,data:{roomId:normalizedId,title:'Normalized switch '+label,purpose:'Disposable mixed representation test',kind:'personal',displayName:'Mixed owner'}});assert.equal(created.status(),201,await created.text());
  const transitions=[];const markers={};
  for(const [step,representation,roomId]of [[0,'legacy',legacyId],[1,'normalized-current-v1',normalizedId],[2,'legacy',legacyId],[3,'normalized-current-v1',normalizedId]]){
   if(step>0)await returnToRoom(page,roomId);
   await page.waitForURL(url=>url.searchParams.get('room')===roomId);
   const snapshot=await context.request.get(origin+'/api/rooms/'+roomId+'?auth=account',{headers});assert.equal(snapshot.status(),200);const window=await snapshot.json();assert.equal(window.representation??'legacy',representation);
   await openSettings(page);const setupVisible=await page.locator('#assistant-setup').isVisible();assert.equal(setupVisible,representation==='legacy','Assistant state must match active room');await closeSettings(page);
   if(step<2){
    const marker='Synthetic '+representation+' conversation '+label;markers[representation]=marker;await page.locator('#message-input').fill(marker);const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/rooms/'+roomId+'/commands'&&r.request().method()==='POST');await page.locator('#message-form button[type=submit]').click();assert.equal((await response).status(),201);await page.locator('[data-message-record-id]').filter({hasText:marker}).waitFor({state:'visible'});
   }else await page.locator('[data-message-record-id]').filter({hasText:markers[representation]}).waitFor({state:'visible'});
   const other=representation==='legacy'?'normalized-current-v1':'legacy';if(markers[other])assert.equal(await page.locator('#message-list').innerText().then(s=>s.includes(markers[other])),false,'Other room text must not remain in current timeline');
   await page.locator('#topbar-updates').click();await page.locator('#updates-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#updates-status').textContent.startsWith('Loading updates'));const updatesText=await page.locator('#updates-dialog').innerText();assert.equal(/Could not|Couldn.t|Loading updates/.test(updatesText),false,'Updates must settle before observation');const unavailable=/Updates are unavailable/.test(updatesText);assert.equal(unavailable,representation==='normalized-current-v1');await page.screenshot({path:out+'/'+label+'-'+step+'-updates.png',fullPage:true});await page.keyboard.press('Escape');
   transitions.push({step,representation,assistantConnectVisible:setupVisible,updatesUnavailable:unavailable,settledUpdatesText:updatesText,correctRoomInUrl:true,ownMessageVisible:true,otherRoomMessageAbsent:true,screenshot:label+'-'+step+'-updates.png'});
  }
  assert.deepEqual(pageErrors,[]);observations.push({viewport:label,width:options.viewport.width,signupStatus:202,secondRoomCreateStatus:201,transitions,pageErrors,blockedExternalRequests});await context.close();
 }
 assert.equal(interventions.length,2);const result={source:pin,node:process.version,intervention:'Only initial signup room initializer is fixture-forced legacy; second room uses unchanged normalized product creation',interventions,observations,scope:'Local rendered same-session room switching, account HTTP and disposable synthetic data. No product patch/choice, configured provider/host, cross-account session replacement, Native, hosted, release or peer-device execution proof.'};await writeFile(out+'/receipt.json',JSON.stringify(result,null,2)+'\n');console.log('MIXED_ROOM_BROWSER '+JSON.stringify(result));
}finally{await browser?.close();server.closeStreams();server.closeAllConnections();await new Promise(r=>server.close(r));store.close();}
execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
