// C43 — presence-under-claim-load soak (wave-2200 cohort 01, lane 05 build;
// reproduction/assertion half: lane 04, lane-04-c43-repro.md).
//
// Record (QUEUE Q62 / C43): source John, anchor 2026-11-03; supporting fact:
// "a deployed presence fix does not hold in production under claim load".
// Consumer: Codex at the landing gate. Falsifier: the soak cannot reproduce
// the flip on the current head — the defect model is wrong and the job
// would certify nothing.
//
// Defect model (parameterised from the Q62 child record; every parameter
// below is PROVISIONAL-ON-LANE-04 until lane 04's reproduction lands):
// with ~20 simultaneous claims, a member's presence row FLIPS — a member
// who is connected (open event stream) and holding live claims reads back
// as not-watching / not-listening, or a confirmed live claim vanishes from
// the holder's workingOn while the claim is still live.
//
// The soak drives the real HTTP surface of an in-process server (never
// production): ACTORS agent members each hold an open /stream connection
// and fire claim bursts (create + claim) round by round, while a sampler
// polls GET /api/rooms/{roomId}/presence for the whole run. Every sample
// taken after the baseline is checked against the invariants; a single
// violation fails the test loudly with the sample number and the full
// offending row.
//
// Invariants (per sample, once baseline is established):
//   1. presence answers HTTP 200;
//   2. every stream-holding member's row is present in the roster;
//   3. watching === true for every stream holder (no flip to not-watching);
//   4. state === "listening" for every stream holder (watching derives
//      listening in src/presence-state.js; a flip to idle/unknown/working
//      is a violation — holding a claim is not execution);
//   5. for every claim whose claim POST already returned 200 before the
//      sample started, the holder's workingOn lists that work item
//      (a confirmed live claim never disappears);
//   6. the control member (streams, never claims) keeps watching/listening
//      and an empty workingOn — load alone must not flip a bystander.
//
// Runtime budget: the default shape (20 actors × 3 rounds, 150 ms sample
// interval) completes in well under 60 s locally; the test hard-fails at
// C43_BUDGET_MS (default 120 s) so a soak that cannot finish in CI is
// worthless by construction. The CI job (.github/workflows/presence-soak.yml)
// caps the job at 10 minutes including npm ci.
//
// Knobs (env): C43_ACTORS, C43_ROUNDS, C43_SAMPLE_MS, C43_BUDGET_MS.
import test from "node:test";
import assert from "node:assert/strict";
import { createAcceptanceFixture } from "../scripts/acceptance-fixture.mjs";
import { createRoomServer } from "../server/http.mjs";
import { linkWithProof } from "./helpers/link-with-proof.mjs";

const ACTORS = Math.max(2, Number.parseInt(process.env.C43_ACTORS ?? "20", 10) || 20);
const ROUNDS = Math.max(1, Number.parseInt(process.env.C43_ROUNDS ?? "3", 10) || 3);
const SAMPLE_MS = Math.max(25, Number.parseInt(process.env.C43_SAMPLE_MS ?? "150", 10) || 150);
const BUDGET_MS = Math.max(10_000, Number.parseInt(process.env.C43_BUDGET_MS ?? "120000", 10) || 120_000);
const ROOM = "commons";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function startServer(t, fixture) {
  const server = createRoomServer({ store: fixture.store });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeStreams(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fixture.store.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

const post = (origin, path, body, secret) => fetch(`${origin}${path}`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
  body: JSON.stringify(body),
});
const get = (origin, path, secret, signal = null) => fetch(`${origin}${path}`, {
  headers: { authorization: `Bearer ${secret}` },
  ...(signal ? { signal } : {}),
});

test("C43 soak: presence does not flip under simultaneous claim load", { timeout: BUDGET_MS + 60_000 }, async t => {
  const startedAt = Date.now();
  const fixture = createAcceptanceFixture();
  const origin = await startServer(t, fixture);
  const ownerKey = fixture.keys.owner;

  // --- cast: ACTORS claimants + one streaming control who never claims ---
  const members = [];
  for (let i = 0; i < ACTORS; i++) {
    const identity = fixture.store.identities.create(`c43-soak-actor-${i}`);
    const memberId = `soak-a${i}`;
    linkWithProof(fixture.store, ownerKey, ROOM, identity, {
      memberId, displayName: `Soak Actor ${i}`, permissions: ["accept_work", "complete_work"],
    });
    members.push({ memberId, secret: identity.secret, claims: [] });
  }
  const controlIdentity = fixture.store.identities.create("c43-soak-control");
  linkWithProof(fixture.store, ownerKey, ROOM, controlIdentity, {
    memberId: "soak-control", displayName: "Soak Control", permissions: ["accept_work", "complete_work"],
  });
  const control = { memberId: "soak-control", secret: controlIdentity.secret, claims: [] };
  const everyone = [...members, control];

  // --- every member holds an open event stream for the whole run ---------
  const streams = everyone.map(m => {
    const controller = new AbortController();
    const done = get(origin, `/api/rooms/${ROOM}/stream`, m.secret, controller.signal).catch(() => {});
    return { controller, done };
  });
  t.after(async () => {
    for (const s of streams) s.controller.abort();
    await Promise.allSettled(streams.map(s => s.done));
  });

  const readPresence = async () => {
    const res = await get(origin, `/api/rooms/${ROOM}/presence`, ownerKey);
    return { status: res.status, body: res.status === 200 ? await res.json() : null };
  };

  // Baseline: wait until every stream holder reads watching=true. A member
  // who never reaches the baseline is a setup failure, not a flip.
  let baseline = null;
  for (let attempt = 0; attempt < 50 && !baseline; attempt++) {
    const { status, body } = await readPresence();
    if (status === 200 && everyone.every(m => body.members.find(r => r.memberId === m.memberId)?.watching === true)) {
      baseline = body;
    } else await sleep(200);
  }
  assert.ok(baseline, "setup: every stream holder must read watching=true before load starts");

  // --- sampler: poll presence for the whole load; record every flip ------
  const violations = [];
  const confirmed = []; // { workItemId, memberId, confirmedAt }
  let samples = 0;
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      const sampleAt = Date.now();
      const n = ++samples;
      let status, body;
      try { ({ status, body } = await readPresence()); } catch (error) {
        violations.push({ sample: n, at: sampleAt, kind: "presence-fetch-threw", error: String(error) });
        await sleep(SAMPLE_MS); continue;
      }
      if (status !== 200) {
        violations.push({ sample: n, at: sampleAt, kind: "presence-not-200", status });
        await sleep(SAMPLE_MS); continue;
      }
      const rows = new Map(body.members.map(r => [r.memberId, r]));
      for (const m of everyone) {
        const row = rows.get(m.memberId);
        if (!row) { violations.push({ sample: n, at: sampleAt, kind: "row-missing", memberId: m.memberId }); continue; }
        if (row.watching !== true) violations.push({ sample: n, at: sampleAt, kind: "flip-not-watching", memberId: m.memberId, row });
        if (row.state !== "listening") violations.push({ sample: n, at: sampleAt, kind: "flip-state", memberId: m.memberId, state: row.state, row });
        // Invariant 5: only claims confirmed BEFORE this sample started.
        const mine = confirmed.filter(c => c.memberId === m.memberId && c.confirmedAt <= sampleAt);
        if (mine.length) {
          const held = new Set((row.workingOn ?? []).map(w => w.workItemId));
          for (const c of mine) {
            if (!held.has(c.workItemId)) {
              violations.push({ sample: n, at: sampleAt, kind: "flip-claim-vanished", memberId: m.memberId, workItemId: c.workItemId, row });
            }
          }
        }
      }
      const controlRow = rows.get(control.memberId);
      if (controlRow && (controlRow.workingOn ?? []).length !== 0) {
        violations.push({ sample: n, at: sampleAt, kind: "control-gained-work", memberId: control.memberId, row: controlRow });
      }
      await sleep(SAMPLE_MS);
    }
  })();

  // --- load: ROUNDS bursts of ACTORS simultaneous create+claim -----------
  let claimPosts = 0;
  for (let round = 0; round < ROUNDS; round++) {
    await Promise.all(members.map(async (m, i) => {
      const workItemId = `soak-r${round}-a${i}`;
      const created = await post(origin, `/api/rooms/${ROOM}/work-claims`, { id: workItemId, title: `C43 soak r${round} a${i}` }, m.secret);
      assert.equal(created.status, 201, `create ${workItemId}: HTTP ${created.status}`);
      const claimed = await post(origin, `/api/rooms/${ROOM}/work-claims/${workItemId}/claim`, {}, m.secret);
      assert.equal(claimed.status, 200, `claim ${workItemId}: HTTP ${claimed.status} ${await claimed.clone().text().catch(() => "")}`);
      claimPosts += 2;
      confirmed.push({ workItemId, memberId: m.memberId, confirmedAt: Date.now() });
      m.claims.push(workItemId);
    }));
    // Let the sampler observe the settled burst before the next one.
    await sleep(SAMPLE_MS * 3);
    assert.ok(Date.now() - startedAt < BUDGET_MS, `soak exceeded its runtime budget of ${BUDGET_MS} ms at round ${round}`);
  }

  // Settle: a few final samples with no load in flight, then stop.
  await sleep(SAMPLE_MS * 4);
  sampling = false;
  await sampler;

  const elapsedMs = Date.now() - startedAt;
  console.log(`[c43-soak] actors=${ACTORS} rounds=${ROUNDS} claims=${confirmed.length} claimPosts=${claimPosts} samples=${samples} violations=${violations.length} elapsedMs=${elapsedMs}`);
  assert.equal(violations.length, 0,
    `presence flipped under claim load — ${violations.length} violation(s); first 5:\n${JSON.stringify(violations.slice(0, 5), null, 1)}`);

  // Final readback: every confirmed claim is still listed for its holder.
  const { status, body } = await readPresence();
  assert.equal(status, 200);
  for (const m of members) {
    const row = body.members.find(r => r.memberId === m.memberId);
    assert.ok(row, `final readback lists ${m.memberId}`);
    assert.deepEqual(new Set((row.workingOn ?? []).map(w => w.workItemId)), new Set(m.claims),
      `final readback: ${m.memberId} workingOn must equal its live claims`);
  }
});
