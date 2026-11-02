import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {RoomStore} from '../server/store.mjs';
import {createRoomServer} from '../server/http.mjs';
import {seedAccessQueue} from '../tests/helpers/access-request-queue-source.mjs';
import {linkWithProof} from '../tests/helpers/link-with-proof.mjs';
import {signInFixture} from './auth-signin.mjs';
async function setup(t,count,representation='normalized-current-v1'){
 const store=new RoomStore(':memory:'),f=seedAccessQueue(store,count,{representation});let browser;
 const server=createRoomServer({store,streamInterval:50});const errors=[];
 t.after(async()=>{await browser?.close();server.closeStreams();server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));store.close();assert.deepEqual(errors,[]);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.ROOM_TEST_CHROMIUM_PATH?{executablePath:process.env.ROOM_TEST_CHROMIUM_PATH}:{})});
 const login=async role=>{const account=store.accountForMember(f.room,role)??store.bindHumanAccount(f.room,role);store.completeOnboarding(account.id);const key=store.issueAccountAccessKey(account.id),context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/?account=1&room='+f.room);await signInFixture(page,key);await page.locator('#main').waitFor({state:'visible'});await page.locator('#topbar-updates').click();return page;};
 return{...f,store,login};
}
const rows=page=>page.locator('#attention-list > li[data-access-request-id^="pending-"]');
async function move(page,button){
 const before=await rows(page).first().getAttribute('data-access-request-id');
 await button.focus();await page.keyboard.press('Enter');
 await page.waitForFunction(id=>document.querySelector('#attention-list > li[data-access-request-id^="pending-"]')?.dataset.accessRequestId!==id,before);
}
async function partialFocus(page,role){
 const row=rows(page).last(),button=row.locator('.attention-partial');await row.scrollIntoViewIfNeeded();await button.focus();await page.keyboard.press('Enter');await row.locator('fieldset').waitFor();
 if(role==='admin'){assert.equal(await row.locator('input[value="complete_work"]').isDisabled(),true);assert.equal(await row.locator('input[value="accept_work"]').isDisabled(),false);assert.equal(await row.locator('.attention-decide[data-action-index="0"]').isDisabled(),true);}
 await page.keyboard.press('Escape');await row.locator('fieldset').waitFor({state:'detached'});assert.equal(await button.evaluate(n=>n===document.activeElement),true);
}
for(const role of ['owner','admin'])test(`1000 pending requests stay reachable and bounded for ${role}`,{timeout:120000},async t=>{
 const f=await setup(t,1000);
 if(role==='owner')for(let i=0;i<7;i++)f.store.command(f.owner,f.room,{id:'work-'+i,type:'work.proposed',data:{workItemId:'work-'+i,title:'Selected native work '+i,definitionOfDone:'Saved',accountableMemberId:'owner',mode:'read'}});
 const page=await f.login(role);await rows(page).last().waitFor();assert.equal(await rows(page).count(),25);
 const workTitles=()=>page.locator('#attention-list > li[data-access-request-id=""] .attention-title').allTextContents();let selectedWork=[];
 if(role==='owner'){const workNext=page.locator('#attention-next');assert.equal(await workNext.isEnabled(),true);const first=await workTitles();await workNext.click();await page.waitForFunction(before=>JSON.stringify([...document.querySelectorAll('#attention-list > li[data-access-request-id=""] .attention-title')].map(n=>n.textContent))!==before,JSON.stringify(first));selectedWork=await workTitles();assert.ok(selectedWork.length>0);}
 const seen=new Set(await rows(page).evaluateAll(nodes=>nodes.map(n=>n.dataset.accessRequestId))),next=page.locator('#attention-access-next');let pages=1;
 while(await next.isVisible()&&await next.isEnabled()){
  // Pace the exhaustive reader within the unchanged credential burst/refill.
  await page.waitForTimeout(400);await move(page,next);const ids=await rows(page).evaluateAll(nodes=>nodes.map(n=>n.dataset.accessRequestId));assert.ok(ids.length<=25);ids.forEach(id=>seen.add(id));assert.ok(++pages<=40);assert.deepEqual(await workTitles(),selectedWork);
 }
 assert.equal(pages,40);assert.equal(seen.size,1000);assert.equal(await page.locator('#attention-list button').count()<=75,true);await partialFocus(page,role);
 // Denial changes the keyset anchor without a room-head write. Reset only the
 // queue while preserving the independently selected native work page.
 f.access.decide(f.owner,f.room,'pending-0949',{decision:'deny'});
 await move(page,page.locator('#attention-access-previous'));
 await page.waitForFunction(()=>document.querySelector('#attention-list > li[data-access-request-id^="pending-"]')?.dataset.accessRequestId==='pending-0000');
 assert.deepEqual(await workTitles(),selectedWork);assert.equal(await page.locator('#attention-access-previous').isDisabled(),true);assert.equal(await page.locator('#attention-access-next').evaluate(n=>n===document.activeElement),true);assert.match(await page.locator('#attention-status').textContent(),/first page/);
});
test('legacy owner pages retain selected request controls beyond the first queue page',{timeout:60000},async t=>{
 const f=await setup(t,30,null),page=await f.login('owner');await rows(page).last().waitFor();assert.equal(await rows(page).count(),25);assert.equal(await page.locator('#attention-access-pages').isVisible(),false);
 const seen=new Set(await rows(page).evaluateAll(nodes=>nodes.map(n=>n.dataset.accessRequestId)));await move(page,page.locator('#attention-next'));assert.equal(await rows(page).count(),5);for(const id of await rows(page).evaluateAll(nodes=>nodes.map(n=>n.dataset.accessRequestId)))seen.add(id);assert.equal(seen.size,30);await partialFocus(page,'owner');assert.equal(await page.locator('#attention-previous').isEnabled(),true);
});
test('a sponsorship request reached through queue paging submits no permissions field',{timeout:60000},async t=>{
 const f=await setup(t,30);f.store.command(f.owner,f.room,{id:'recipient',type:'member.added',data:{memberId:'recipient',displayName:'Recipient',kind:'human',permissions:[]}});
 const account=f.store.accountForMember(f.room,'recipient')??f.store.bindHumanAccount(f.room,'recipient'),key=f.store.issueAccountAccessKey(account.id),slot=f.store.createAccountSessionSlot(),auth=f.store.loginAccountSession(slot.token,key,0);
 const identity=f.store.identities.create('Existing seat');linkWithProof(f.store,f.owner,f.room,identity,{permissions:['accept_work']});
 f.access.sponsorTransfers.request(slot.token,f.room,{memberId:identity.identityId,requestId:'sponsor-seat'},auth.sessionBinding);
 const before=f.store.roomAuthority(f.room).members[identity.identityId],identityCount=f.store.db.prepare('SELECT count(*) n FROM agent_identities').get().n;
 const page=await f.login('owner');await rows(page).last().waitFor();await move(page,page.locator('#attention-access-next'));
 const row=page.locator('[data-access-request-id="sponsor-seat"]');await row.waitFor();
 const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/sponsor-seat/decide'));
 await row.getByRole('button',{name:/^Approve —/}).click();const saved=await response;assert.equal(saved.status(),200);assert.deepEqual(saved.request().postDataJSON(),{decision:'approve'});
 const after=f.store.roomAuthority(f.room).members[identity.identityId];assert.equal(after.identityId,before.identityId);assert.deepEqual(after.permissions,before.permissions);assert.equal(after.accountableHumanId,'recipient');assert.equal(f.store.db.prepare('SELECT count(*) n FROM agent_identities').get().n,identityCount);
});
