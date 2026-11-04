import test from 'node:test';
import assert from 'node:assert/strict';
import { oneClickEnabled, oneClickInstalls, oneClickSectionHtml, ONE_LINE_PROMPT } from '../server/one-click-connect.mjs';
import { downloadPageHtml } from '../server/download-page.mjs';

test('flag is off by default and only "1" turns it on', () => {
  assert.equal(oneClickEnabled({}), false);
  assert.equal(oneClickEnabled({ ROOM_ONE_CLICK_CONNECT: 'true' }), false);
  assert.equal(oneClickEnabled({ ROOM_ONE_CLICK_CONNECT: '1' }), true);
  assert.doesNotMatch(downloadPageHtml({ oneClick: false }), /id="one-click"/);
});

test('install links are OAuth-only: hosted URL, no header, no secret', () => {
  const byId = Object.fromEntries(oneClickInstalls().map(i => [i.id, i.value]));
  const cursorCfg = JSON.parse(Buffer.from(new URL(byId.cursor).searchParams.get('config'), 'base64url').toString());
  assert.deepEqual(cursorCfg, { url: 'https://room.trydemigod.com/mcp' });
  assert.ok(byId.cursor.startsWith('cursor://anysphere.cursor-deeplink/mcp/install?name=project-room&'));
  const vs = JSON.parse(decodeURIComponent(byId.vscode.slice('vscode:mcp/install?'.length)));
  assert.deepEqual(vs, { name: 'project-room', type: 'http', url: 'https://room.trydemigod.com/mcp' });
  assert.equal(byId['claude-code'], 'claude mcp add --transport http project-room https://room.trydemigod.com/mcp');
  for (const v of Object.values(byId)) assert.doesNotMatch(v, /Authorization|PROJECT_ROOM_SECRET|Bearer/);
});

test('one line, two steps, rendered first on /download when on', () => {
  assert.equal(ONE_LINE_PROMPT.split(/(?<=\.)\s/).length, 1);
  assert.match(ONE_LINE_PROMPT, /https:\/\/room\.trydemigod\.com\/mcp/);
  const html = downloadPageHtml({ oneClick: true });
  assert.ok(html.indexOf('id="one-click"') > 0 && html.indexOf('id="one-click"') < html.indexOf('id="connect"'));
  assert.equal((oneClickSectionHtml().match(/<li>/g) || []).length, 7);
  assert.match(html, /href="cursor:\/\/anysphere\.cursor-deeplink/);
  assert.match(html, /href="vscode:mcp\/install\?/);
});
