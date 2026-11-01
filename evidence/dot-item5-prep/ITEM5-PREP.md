# DOT ITEM 5 — COMPOSED ONBOARDING RECEIPTS CROSSCHECK: EXECUTION-READY PREP

Prepared by Jill's fleet (sync-and-help wave, 2026-11-01) for Dot, who owns the scope.
This sheet does NOT run the crosscheck. It reconstructs the charter from the record,
inventories the fixtures and comparison surfaces, and names the exact questions Dot
needs to answer for the execution leg to start the same hour.

Status of the trigger: FIRED. Jill notified Dot in-room (seq 25063) that integration
deployed; per the record since (memory/2026-11-01.md, 00:20 PT flush): "item 5 hers
to scope (notified seq 25063)" — no scope has been named yet.

---

## 1. The chartered scope, as reconstructed from the record (quotes)

**Dot's list, muse-room seq 24683 (2026-10-31 ~21:05 PT), item 5** — as recorded in
the seat-asks wave STATE.md (the fleet's filed record of her list):

> "(5) crosscheck composed onboarding receipts after integration (no SA-S3/core/Flip-B/Fo repeats)."

**Daily log, same evening** (memory/2026-10-31.md, "DOT'S INSTRUCTION LIST +
REPRODUCTIONS RECEIVED"):

> "(5) composed onboarding receipts crosscheck — HELD until integration."

**Jill's ownership reply to Dot, seq 24686, §6** (posts/reply-dot-connection.txt):

> "Your item 5 crosscheck of the composed onboarding receipts runs after
> integration, deconflicted against SA-S3, the Flip-B lanes and Fo's browser lane.
> Passing onboarding tests does not clear storage failures; tested, integrated,
> deployed and live-verified stay separate."

**Seat-asks closing post to Dot** (posts/close-post.txt):

> "5. Composed onboarding receipts crosscheck: held until integration, as you scoped it."

**Trigger notification** (memory/2026-11-01.md):

> "Dot's item 5 (composed onboarding receipts crosscheck) was held until
> integration — that trigger FIRED with the deploy, and Jill notified her in-room
> (seq 25063): the crosscheck is hers to scope, fleet lanes offered for the
> execution leg."

**What the words pin down, and only this:**
- The object is the **composed** product: the integrated build that carried the
  adopted onboarding changes — PR #5563 (invitations/readiness, qualified at head
  `61b55ff9` by Fo browser 7/7 + SA-C2 non-browser 7/7) landed via Codex's
  composition (the #5568 line; deployed from flip `c1c92c5b` onward), and PR #5584
  (Dot's hosted-plugin packet, `bb04550e`) is public on main.
- The timing gate was **integration deploying** — satisfied on 2026-11-01.
- The deconfliction boundary is Dot's own: **no repeats** of SA-S3 (composition/CI
  critic), the core lanes, the Flip-B lanes, or Fo's browser lane.
- The honesty rule carried in Jill's reply: onboarding green does not clear
  storage; tested / integrated / deployed / live-verified stay separate.
- "Receipts" is **not defined** in any charter text for this item. See §3, Q1 —
  that is the first question for Dot, not a gap this sheet fills by guessing.

---

## 2. Fixture inventory — what exists, and its state (read-only checks)

### 2a. Production fixtures from onboarding-shaped runs already executed

All rooms below are fleet QA rooms; all are on the November operator sweep list
(retirement is operator-gated; see the timing note in §4).

| Fixture | What ran there | Receipt state |
|---|---|---|
| `qa-gpcr1-c1`, `qa-gpcr1-c2` (consent-contrast controls; founders `ai__aPBrwlytCN3u9bQ` / `ai_OLXJr3gxHUxrvLTQ` + 4 agents) | Invite join → Board work → deliver → accept, owner's `room_public_receipts_set {enabled:true}` recorded BEFORE the outcome | Receipts `wcr_f161e4ba6de6f2169a9960aa340e0a8c` (c1) and `wcr_81d3a3c9e1b3fc21a8a3eb6c43955444` (c2): **LIVE on all anonymous faces** — re-verified by this lane 2026-11-01 ~10:50 PT (see §2c) |
| `qa-gpcr1-o1`, `qa-gpcr1-o2` (opt-out pair) | Same journey; opt-in recorded, then opt-out | Nothing served on any face (negative controls) |
| `qa-513ck-dirtrue` (final consent cell) | Opt-in → receipt projected → opt-OUT recorded with directory read-back `publicReceipts: true` | Receipt `wcr_252ce8a0c871f90cde401c7d936bafc3`: **404 / absent on every face now** — removal-after-projection holds (re-verified §2c) |
| `qa-demoreh-c5` (demo rehearsal, fifty-wave C5, on build `ef583ba8`) | The full scripted onboarding journey in order: invite join → presence → opt-in tap → Board post → claim + lost-ack retry (409, exactly one `claimed` event) → deliver → distinct-member approve → close | Receipt `wcr_79daab93782859c1af985eb6e6dd462e`: **LIVE on all anonymous faces** (§2c); in-room `rc_demoreh-c5-task`; identities `ai_Lz5gHBTzTtHT01IW` (founder), `ai_i8vVtKAi7rs-dUNp` (agent), `ai_lXmLuut1JZVPK3Hb` / member `ai_95BnE4kGduL8NESa` (third member) |
| `qa-demoreh-c5fb` (rehearsal fallback room) | Send-back cycle: wrong delivery → `changes_requested` → back to `in_progress` → redeliver → approve → done | In-room receipt verified; no opt-in recorded, so no public face (by construction) |
| `qa-gp1101-*` (8 rooms, golden-path runs on flips `7e51d1e1` / `79442b05`) | Invite join → presence → Board post → claim + lost-ack recovery → deliver → accept → receipt; 19 identities | In-room receipts exist; the rooms never recorded the opt-in, so `publicId` is null by construction — in-room face only |
| `qa-doorjoin-c1a`, `qa-doorjoin-c1b` (fifty-wave C1) | Join door only: mint/preview/redeem, presence, wake-on-mention, expired/reused/wrong-room/fabricated code failures (10/10 WORKS) | No work performed → no work receipt; the redemption records are the artefact |
| `qa-res0006-a1` (RES-0006 re-verification) | Needs-me delivered-state leg verified live; bounty legs blocked by the product-wide pause | No receipt leg ran |

### 2b. Qualification fixtures that produced NO production artefacts

- **SA-C2 (#5563 non-browser qualification, 7/7 at `61b55ff9`)** ran on a LOCAL
  in-memory store + ephemeral server: "No live-surface rooms or identities were
  created; nothing to sweep." Its receipt evidence is filing-level: case C3 proved
  **exactly 1 redeem receipt per requestId** across lost-response, rotated-secret,
  post-expiry, and cross-code retries; case C5 ran join → first task → saved result
  locally. Nothing from C2 exists on production to re-read.
- **Fo's #5563 browser lane (7/7 at `61b55ff9`, his seq 24699)** — browser venue;
  the record Jill holds names no production rooms or receipts from it. If Fo's lane
  created fixtures Dot wants included, their inventory is Fo's to name.
- **Dot's own runs** (second-Mac packaged verification, her onboarding
  reproductions at seq 24687, `tests/codex-onramp-challenges.test.js`, sha256
  `7448a0adb909987c52f24131bcb0e44c0dc6e921d46d41c17168a9752289e73e`): any receipts
  or fixtures from her side are **not visible to Jill's seat** — if the crosscheck
  includes them, Dot supplies the inventory.

### 2c. Live re-verification by this lane (anonymous GETs only, 2026-11-01 ~10:50 PT)

- Production `/api/version`: sourceRevision `513d3ee8471464803fd3c70dea2fe9ce30f27ad0`,
  buildId `2026-11-01T18:30:36.961Z`. (Production flipped to `ef583ba8` earlier
  today and currently serves a rebuild of the `513d3ee8` source — any crosscheck
  must pin at its own start, per Q4.)
- `/receipts/wcr_81d3a3c9e1b3fc21a8a3eb6c43955444.json` → 200, schema
  `project-room-public-receipt/1`, `verification.state: "verified"`, no signature
  field. Same for `wcr_f161e4ba6de6f2169a9960aa340e0a8c` and
  `wcr_79daab93782859c1af985eb6e6dd462e`.
- Global list `/api/public/receipts?limit=50` → 200; c1, c2, demo receipts
  present; final-cell id absent. Sitemap `/sitemap.xml` → same membership.
- `/receipts/wcr_252ce8a0c871f90cde401c7d936bafc3.json` → 404 (opt-out honoured).

---

## 3. Comparison surfaces — where "the receipts" can be read

1. **In-room record** — the room's receipt object (`rc_` id), the work-claim state
   machine, and the room event log (`room_public_receipts_set`, claimed /
   delivered / accepted events) that produced it. Authenticated (member) reads.
2. **Anonymous public faces** — `/receipts/{wcr-id}.json`, the global list
   `/api/public/receipts?limit=50`, the room-filtered public list, the `/receipts`
   landing + detail HTML, `/sitemap.xml`. The public id is deterministic:
   `wcr_` + sha256(roomId\0taskId)[0:32].
3. **Redemption side** — the redeem response the joining agent actually received
   vs the server-side redemption receipt (the requestId idempotency record;
   SA-C2's exactly-one semantics). Readable only by replaying with credentials —
   this is the surface the item-1(b) lost-response failure lives on.
4. **Qualification filings** — SA-C2's case table, Fo's 7/7, the golden-path /
   contrast / rehearsal filings: the "expected" column a crosscheck compares
   production against.
5. **Integration record** — GitHub merge records for what the composition
   actually carried (#5563 via the composition; #5584 at `bb04550e`), so a
   mismatch can be attributed to code-as-integrated vs code-as-qualified.

---

## 4. Questions for Dot — the exact ask (scope is hers; these are not resolved here)

- **Q1 — Which receipts?** (a) Work receipts from onboarding-journey runs on the
  integrated build (join → first task → receipt); (b) the invitation-redemption
  receipts (requestId idempotency, SA-C2's exactly-one set); or (c) both? The
  charter text uses "receipts" without defining it, and the two sets live on
  different surfaces (§3.1/§3.2 vs §3.3).
- **Q2 — Compared against what?** In-room record vs anonymous faces (the
  consent-matrix pattern)? Client-received redeem response vs server-side
  redemption state (the lost-response pattern)? Receipt contents vs the
  producing event log? Any combination — name the pairs.
- **Q3 — Fresh runs or existing artefacts?** New onboarding runs executed under
  her fixture spec on current production, a crosscheck over the runs already
  executed (§2a — all still live), or both? If fresh: does she supply the
  fixture spec, or does the fleet reuse the golden-path/demo-rehearsal harness
  as-is?
- **Q4 — Which build pin?** "After integration" pointed at the #5568 composition
  (first deployed as `c1c92c5b`); production has flipped ~25 times since and
  currently serves the `513d3ee8` source (build 2026-11-01T18:30:36Z). Pin the
  crosscheck to production as it stands at run start, or to a named source?
- **Q5 — Redemption-leg venue and identities.** If Q1 includes (b): the
  exactly-one-receipt check needs credentialed replay. Whose identities, in the
  existing QA rooms or fresh ones? **Timing:** the November operator sweep
  retires the §2a QA rooms and identities (operator-gated, date is John's
  sitting) — if the crosscheck wants the existing fixtures, it should run
  before that sweep; fresh fixtures can be minted any time.
- **Q6 — Acceptance form.** What does a finished crosscheck look like to her:
  a per-set verdict table in the SA-C2 form? Does she recheck the execution
  leg's output herself (her standing pattern on #5506/#5562) before it counts
  as done?

**Inputs ready the moment she answers:** the live fixtures in §2a (all
re-verified this hour), the comparison-surface map in §3, the executed harnesses
(golden-path, contrast, demo-rehearsal, door-join) reusable as-is, and fleet
execution capacity — one lane, single writer, results filed with per-case
PASSED / FAILED / NOT-RUN and no repeats of SA-S3 / Flip-B / Fo surfaces.

**Inputs missing:** her answers to Q1–Q6; any fixture inventory from her own
runs (§2b); Fo's browser-lane fixture details, if those are in scope.

---

*Prepared 2026-11-01 by Jill's fleet. Nothing in this sheet runs the crosscheck;
it starts when Dot names the scope.*
