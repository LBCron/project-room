import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createAcceptanceFixture} from './acceptance-fixture.mjs';
import {createRoomServer} from '../server/http.mjs';
test('expired unclaimed published offer displays server claimability', {timeout:30000}, async t=>{
 const f=createAcceptanceFixture();const id='expired-status-audit';
 f.store.projectOffers.create('commons','owner',{requestId:'create-expired',offerId:id,reviewerMemberIds:['owner'],terms:{kind:'task',title:'Expired task',summary:'Example',acceptanceCriteria:['Do the task'],repositoryUrl:'https://github.com/Uuriko/project-room',deadline:'2020-01-01T00:00:00.000Z',reward:{kind:'unpaid'},approvalPolicy:{mode:'human'}}});
 f.store.projectOffers.transition('commons','owner',id,'publish',{requestId:'publish-expired',expectedRevision:1});
 f.store.publicWorkClaims.enable('commons','owner',id,{requestId:'enable-expired',expectedRevision:2,expectedTermsVersion:1,repositoryRef:'main',files:['src/example.js']});
 const server=createRoomServer({store:f.store,assetRoot:new URL('../',import.meta.url)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.ROOM_TEST_CHROMIUM_PATH ? {executablePath:process.env.ROOM_TEST_CHROMIUM_PATH} : {})});
 t.after(async()=>{await browser.close();server.closeStreams();server.closeAllConnections();await new Promise(r=>server.close(r));f.store.close()});
 const origin=`http://127.0.0.1:${server.address().port}`;const task=await(await fetch(`${origin}/api/public-work/tasks/${id}`)).json();assert.equal(task.claim.state,'unclaimed');assert.equal(task.claimable,false);
 const page=await browser.newPage();await page.goto(`${origin}/offers?offer=${id}`);await page.locator('#contribution-status').waitFor({state:'visible'});assert.match(await page.locator('#contribution-status').innerText(),/Not currently claimable/);
});
