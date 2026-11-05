// A-10 sitemap + robots hygiene. Prod sitemap listed the QA lab as the
// product's public face: 29 /r/ rooms of which 22 were test-pattern by name,
// robots.txt disallowed nothing, and every dateless entry (statics, legal,
// templates) was stamped with the serving build's date as <lastmod>, so each
// deploy claimed every static page had changed that day.
// Invariants: test-pattern slugs are never sitemap-listed (the lobby and
// ordinary rooms stay listed); a test room's /proof entry goes with it;
// <lastmod> is real-or-omitted; robots.txt disallows the same families.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RoomStore } from "../server/store.mjs";
import { initialRoom } from "../server/bootstrap.mjs";
import { isTestPatternRoomSlug, listPublicRoomSitemap } from "../server/public-read-model.mjs";
import { publicSitemapEntries } from "../server/public-rooms.mjs";
import { publicSearchSitemap } from "../server/public-search.mjs";
import { robotsTxt } from "../server/agent-discovery.mjs";

const KEEPERS = ["project-room-lobby", "room-ok", "contest-room-1", "qatar-nights", "latest-news-room"];
const TESTISH = ["qa-test-room-1", "qa2700-l01-abc123", "qr-l01-w4-t1857", "lane-g-disposable-room-a",
  "lanee-schema-probe-room-1", "harbour-notes-test-room-1", "ut26-owner-test-2026-10-26-dbd4"];

test("isTestPatternRoomSlug matches segments and QA namespaces, never substrings", () => {
  for (const slug of [...TESTISH, "test-room-x", "a-test", "qa", "my-disposable-room"]) {
    assert.equal(isTestPatternRoomSlug(slug), true, slug);
  }
  for (const slug of [...KEEPERS, "garden-notes-final", "sofia-maple-client-project", "kenji-collaboration-receipts-lab"]) {
    assert.equal(isTestPatternRoomSlug(slug), false, slug);
  }
  assert.equal(isTestPatternRoomSlug(undefined), false);
  assert.equal(isTestPatternRoomSlug(null), false);
  assert.equal(isTestPatternRoomSlug(42), false);
});

function seedStore(t) {
  const directory = mkdtempSync(join(tmpdir(), "room-sitemap-hygiene-"));
  const store = new RoomStore(join(directory, "room.sqlite"));
  store.initialize(initialRoom("commons"));
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const now = "2026-11-01T00:00:00.000Z";
  const insert = store.db.prepare(`INSERT INTO public_rooms
    (slug, title, purpose, humans, agents, names_json, tasks_json, members_json,
     receipts_enabled, join_mode, join_token, owner_member_id, set_at, updated_at)
    VALUES (?, 'Room', 'Purpose', 0, 0, '[]', '[]', '[]', ?, 'request', NULL, NULL, ?, ?)`);
  for (const slug of KEEPERS) insert.run(slug, slug === "room-ok" ? 1 : 0, now, now);
  for (const slug of TESTISH) insert.run(slug, slug === "qa-test-room-1" ? 1 : 0, now, now);
  return store;
}

test("sitemap room list excludes test-pattern slugs and keeps real rooms", t => {
  const store = seedStore(t);
  const listed = new Set(listPublicRoomSitemap(store).map(row => row.slug));
  for (const slug of KEEPERS) assert.ok(listed.has(slug), `${slug} stays listed`);
  for (const slug of TESTISH) assert.ok(!listed.has(slug), `${slug} is not listed`);
});

test("sitemap entries drop test rooms and their proof pages, and stamp real dates only", t => {
  const store = seedStore(t);
  const entries = publicSitemapEntries(store);
  const paths = entries.map(entry => entry.path);
  assert.ok(paths.includes("/r/project-room-lobby"), "the lobby stays listed");
  assert.ok(paths.includes("/r/room-ok/proof"), "a listed room keeps its proof entry");
  for (const slug of TESTISH) {
    assert.ok(!paths.includes(`/r/${slug}`), `${slug} has no sitemap entry`);
    assert.ok(!paths.includes(`/r/${slug}/proof`), `${slug} has no proof entry`);
  }
  const lobby = entries.find(entry => entry.path === "/r/project-room-lobby");
  assert.equal(lobby.lastmod, "2026-11-01", "a room keeps its own stored date");
  for (const entry of entries.filter(e => !e.path.startsWith("/r/"))) {
    assert.equal(entry.lastmod, null, `${entry.path} carries no date of its own and omits lastmod`);
  }
  const xml = publicSearchSitemap("https://room.trydemigod.com", entries);
  assert.match(xml, /<loc>https:\/\/room\.trydemigod\.com\/r\/project-room-lobby<\/loc><lastmod>2026-11-01<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/room\.trydemigod\.com\/templates<\/loc><\/url>/, "dateless entries render with no <lastmod>");
  assert.doesNotMatch(xml, /qa-test-room-1|qa2700|qr-l01|disposable|schema-probe/, "no test-pattern slug reaches the XML");
});

test("robots.txt disallows the test-pattern room families", () => {
  const robots = robotsTxt();
  assert.match(robots, /User-agent: \*\nAllow: \/llms\.txt\nDisallow:\n/, "the general group header is unchanged");
  for (const pattern of ["/r/qa-", "/r/qa2700-", "/r/qr-l01-", "/r/test-", "/r/*-test-", "/r/*-disposable-", "/r/*-probe-"]) {
    assert.ok(robots.includes(`Disallow: ${pattern}\n`), `robots disallows ${pattern}`);
  }
  assert.match(robots, /Sitemap: https:\/\/room\.trydemigod\.com\/sitemap\.xml/, "the sitemap pointer survives");
});
