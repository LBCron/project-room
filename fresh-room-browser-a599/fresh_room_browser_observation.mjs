import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const lab=fileURLToPath(new URL('.',import.meta.url)),repo='/Users/potter/Documents/Codex/2026-10-22/you-x20/work/member2-mcp-qa2-adapter-1102',pin='a599faa29ff65567e5c080609cb2d000acd33666',git='/Users/potter/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git';assert.equal(execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);process.chdir(repo);
const load=p=>import(pathToFileURL(repo+'/'+p)),[{RoomStore},{createRoomServer},{openSettings,closeSettings}]=await Promise.all(['server/store.mjs','server/http.mjs','scripts/room-chrome.mjs'].map(load));const require=createRequire(repo+'/package.json'),{chromium}=require('playwright');
const store=new RoomStore(':memory:'),server=createRoomServer({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,out=lab+'fresh-room-browser';await mkdir(out,{recursive:true});let browser;const observations=[];
try{
 browser=await chromium.launch({headless:true});
 for(const [label,options]of [['desktop',{viewport:{width:1280,height:860}}],['phone',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}]]){
  const context=await browser.newContext({...options,reducedMotion:'reduce'});let blockedExternalRequests=0;
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin&&!['data:','blob:','about:'].includes(url.protocol)){blockedExternalRequests++;return route.abort();}return route.continue();});
  const page=await context.newPage();page.setDefaultTimeout(10000);const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  let resolveWindow;const windowSeen=new Promise(r=>resolveWindow=r);
  page.on('response',async r=>{if(new URL(r.url()).pathname.startsWith('/api/rooms/')&&r.status()===200){try{const b=await r.json();if(b.representation==='normalized-current-v1'&&b.sections?.assistant)resolveWindow(b.sections);}catch{}}});
  await page.goto(origin);await page.getByRole('button',{name:'Create account',exact:true}).click();const form=page.locator('#auth-signin-ui [data-signin-form="password"]');await form.locator('[name=email]').fill('fresh-'+label+'@example.invalid');await form.locator('[name=password]').fill('Synthetic-local-password-1102!');const signed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/password/signup'&&r.request().method()==='POST');await form.locator('button[type=submit]').click();assert.equal((await signed).status(),202);await page.locator('#main').waitFor({state:'visible'});
  let timer;const sections=await Promise.race([windowSeen,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('No actual normalized snapshot observed')),15000);})]);clearTimeout(timer);
  const message='@Room what can you help with?';await page.locator('#message-input').fill(message);const messageReply=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/commands')&&r.request().method()==='POST');await page.locator('#message-form button[type=submit]').click();const messageResponse=await messageReply;assert.equal(messageResponse.status(),201,'Actual message post');await page.locator('[data-message-record-id]').filter({hasText:'what can you help with?'}).waitFor({state:'visible'});
  await openSettings(page);const setupVisible=await page.locator('#assistant-setup').isVisible(),assistantRowVisible=await page.locator('#room-assistant').isVisible(),settingsText=await page.locator('#settings-dialog').innerText();
  const explanationMatched=/assistant[^\n]{0,100}(unavailable|not supported|not available)|(unavailable|not supported|not available)[^\n]{0,100}assistant/i.test(settingsText);
  await page.screenshot({path:out+'/'+label+'-settings.png',fullPage:true});await closeSettings(page);
  await page.locator('#topbar-updates').click();await page.locator('#updates-dialog').waitFor({state:'visible'});const updatesText=await page.locator('#updates-dialog').innerText();await page.screenshot({path:out+'/'+label+'-updates.png',fullPage:true});
  assert.equal(sections.assistant.available,false);assert.equal(sections.updates.available,false);assert.equal(setupVisible,false);assert.equal(assistantRowVisible,false);assert.match(updatesText,/Updates are unavailable/);assert.deepEqual(pageErrors,[]);
  observations.push({viewport:label,width:options.viewport.width,signupStatus:202,actualNormalizedSnapshot:true,assistantAvailable:sections.assistant.available,assistantSetupVisible:setupVisible,assistantRowVisible,assistantUnavailableExplanationPatternMatchedInSettings:explanationMatched,plainRoomAddressedMessageVisible:true,updatesUnavailableNoticeVisible:true,pageErrors:[],blockedExternalRequests,screenshots:[label+'-settings.png',label+'-updates.png']});await context.close();
 }
 const result={source:pin,node:process.version,browser:'Installed Chromium via Playwright',observations,scope:'Rendered local default self-host signup without configured mailer/provider, disposable data, outside network blocked. Observes current gap; not a passing assistant-readiness gate, production mail/signup replication, real assistant execution, release or peer-device proof.'};await writeFile(out+'/receipt.json',JSON.stringify(result,null,2)+'\n');console.log('FRESH_ROOM_BROWSER '+JSON.stringify(result));
}finally{await browser?.close();server.closeStreams();server.closeAllConnections();await new Promise(r=>server.close(r));store.close();}
execFileSync(git,['-C',repo,'diff','--exit-code','HEAD','--']);
