// Templates, a template page, a public room page, and the agent directory
// at a phone width: each document fits 390px and exposes main and footer.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { RoomStore } from "../../../server/store.mjs";
import { createRoomServer } from "../../../server/http.mjs";
import { initialRoom } from "../../../server/bootstrap.mjs";

test("acquisition pages fit a 390px viewport", { timeout: 60000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), "acquisition-browser-"));
  const store = new RoomStore(join(directory, "room.sqlite"));
  store.initialize(initialRoom("alpha"));
  const ownerKey = store.issueAccessKey("alpha", "owner");
  store.command(ownerKey, "alpha", { id: "publish-page", type: "room.public_page_set", data: { enabled: true } });
  store.command(ownerKey, "alpha", {
    id: "public-work", type: "work.proposed",
    data: { workItemId: "public-work", title: "A very long public task title that should wrap inside a narrow phone viewport without stretching the page", definitionOfDone: "It wraps.", accountableMemberId: "owner", mode: "read" },
  });
  store.command(ownerKey, "alpha", { id: "publish-task", type: "work.public_set", data: { workItemId: "public-work", enabled: true } });
  const server = createRoomServer({ store });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.ROOM_TEST_CHROMIUM_PATH ? { executablePath: process.env.ROOM_TEST_CHROMIUM_PATH } : {}) });
  t.after(async () => {
    await browser.close();
    server.closeStreams(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    store.close(); rmSync(directory, { recursive: true, force: true });
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${origin}/r/alpha`, { waitUntil: "domcontentloaded" });
  await page.getByText("Join with your AI", { exact: true }).click();
  const copy = page.getByRole("button", { name: "Copy setup prompt" });
  assert.equal(await copy.isVisible(), true);
  assert.ok((await copy.boundingBox()).height >= 44, "copy action should be easy to tap");

  const terms=page.getByRole('link',{name:'Terms',exact:true});
  for(const moved of [false,true]){
    await page.reload();await page.getByText('Join with your AI',{exact:true}).click();
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise(resolve=>{window.resolveCopy=resolve;})}}));
    await copy.click();if(moved)await terms.focus();
    const expected=moved?'Copy the prompt under View setup prompt, then paste it into your agent.':'Copy the selected prompt, then paste it into your agent.';
    await page.locator('#room-setup-copy-status').getByText(expected,{exact:true}).waitFor();
    assert.equal(await copy.isEnabled(),true);
    assert.equal(await (moved?terms:page.locator('#room-setup-prompt')).evaluate(el=>el===document.activeElement),true);
    await page.evaluate(()=>window.resolveCopy());
    assert.equal(await page.locator('#room-setup-copy-status').textContent(),expected,'late completion must not replace fallback');
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}}));
    await copy.click();await page.locator('#room-setup-copy-status').getByText('Copy the selected prompt, then paste it into your agent.',{exact:true}).waitFor();
    assert.equal(await page.locator('#room-setup-prompt').evaluate(el=>el===document.activeElement&&el.selectionEnd>el.selectionStart),true,'next attempt resets focus tracking');
    console.log(JSON.stringify({moved,timeoutFocusPreserved:true,buttonReenabled:true,lateResolutionIgnored:true,retrySelects:true,browser:browser.version()}));
  }
});
