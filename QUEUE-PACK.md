# Landing-queue freshness pack — for Codex's sitting

Generated 2026-11-01, direct GitHub API reads between 18:41Z and 18:58Z.
Main moved twice during the read window: `ef583ba8` (the fifty-wave lanes'
pin) → `0a90ea40ab2fa51a5a32ecf9f6cd86e23a9ae82` → **`c52db58787467390042295b181b152ef3ba4de12`**
(tip at pack close = the #5574 merge, 18:48:17Z). "Behind" below = main
commits since the PR's branch point, compared against `0a90ea40`; add the
#5574 merge for current distance. Mergeable/CI are as read at the exact
heads named. CI is latest-per-check-name at the head: PASSED / FAILED /
NOT-RUN (skipped, neutral, and in-progress all count as NOT-RUN — never
folded into green). Mechanical green is not qualification; recheck
states are stated per item.

## Count summary (named queue)

- **Singly, landable at your gate: 1** — #5579 (money, named risks).
- **Singly, conditional: 1** — #5502 (shared-core; gates the freeze stack).
- **Stacked behind it: 1** — #5559 (verified, conditional only on #5502).
- **Batchable today: 1** — #5572 (recheck still pending; CI red at head).
- **Gated on John, not on you: 1** — #5621 (key-custody authorization).
- **Held: 1** — #5582 (your Worker/digest blockers; head moved mid-run).
- **Incoming, no PR yet: 2** — #5571 part-2 build; S3 mirror cure.
- **Left the queue during this run: 2** — #5574 MERGED; #5614 merged per
  API **but its content is not in main's tree** (flag, §5).

## §1 — Singly first

### #5579 — money, LANDS-WITH-NAMED-RISK (rechecked today)
`fix(bounties): warn on create/fund/claim when a bounty can never be disputed (RES-0003, RES-0005)`
- Head `e4c98ef8110fd3cc2d49fc749aa3d867b8bbb3a6` (draft, branch
  `jill/res-0003-dispute-openability`), mergeable true/clean, 207 main
  commits since branch point, 2 own commits.
- Recheck: fifty-wave rc5579 lane (non-author), at this head, composed
  onto `ef583ba8` clean (composed `53934ffdb7d318bc5a3bad324100594f3481e919`);
  targeted 21/21 + money neighbourhood 449/449 PASSED locally; full
  adversarial pass executed (read-error / unknown-value / one-bad-row).
- Named risks (both bounded, neither moves money): (1) exactly one added
  `roomAuthority` read inside each act transaction — a failure there is
  an atomic refused act, full rollback, conservation exact; (2) the
  two-member warning is silently suppressed if the members map carries
  a junk counted lane (corrupt string row, string-"false" active,
  `__proto__` row) — silence only, on an advisory warning.
- CI at head: PASSED ci-verdict, mechanical, safety-net · FAILED none ·
  NOT-RUN everything else (skipped by path filters). Hosted CI at the
  composed head: NOT-RUN — your landing-head re-run is the green that
  counts.
- Files: `server/bounty-disputability.mjs` (new), `server/bounty-escrow.mjs`,
  `server/bounty-escrow-routes.mjs`, `server/mcp-full-profile.mjs`,
  `tests/bounty-dispute-openability-warnings.test.js` (new).
  **Collision: the two escrow files are also in #5502's diff (§6).**

### #5502 — shared-core, the freeze-stack gate (your call, as recorded)
`Freeze archived rooms at the registry/write choke point (EA-001, EA2-002, L05-C3)`
- Head `3ee2e4dfa37f3403129fd6806f1b5f1cc90ba11a` (open, NOT draft, branch
  `jill/help-f2-archived-room-freeze`), mergeable true/clean, 514 main
  commits since branch point, 3 own commits.
- Recheck at this head: **still owed** (per the rc5559 lane's filing and
  the resolution record), together with the wave-7 Q03-F1 disposition
  (registry guard propagating into unpatched batch/cron callers) —
  both yours.
- CI at head: PASSED browser (shards 1–6), cloudflare, contract,
  friend-agent-e2e, lint, mechanical, safety-net, visual-refresh-guard ·
  **FAILED coverage, test, unit** · NOT-RUN changes, full, gates,
  quarantined-tests, relay, schema-gate, Cursor approver (neutral).
  The red trio is named, not waived: no composed hosted run exists for
  this head.
- Files (14): incl. `server/store.mjs`, `server/archived-guard.mjs`
  (new), `server/work-claim-routes.mjs`, `server/work-claim-sqlite.mjs`,
  `server/agent-invites.mjs`, `server/guest-invites.mjs`,
  `server/bounty-escrow.mjs`, `server/bounty-escrow-routes.mjs`,
  `server/inbox-collab-store.mjs`, `server/mcp-room-profile.mjs`,
  `server/project-map-store.mjs`, `scripts/runtime-package.mjs`,
  `tests/archived-room-freeze.test.js`, `tests/work-claim-events.test.js`.
- Stacked family behind it (sweep listing this run; not individually
  re-read): **#5559** (§2), **#5540** (tests-only freeze probes, draft,
  `jill/f1-freeze-tests-remaining-surfaces`), **#5530** (spend grants),
  **#5534** (attachments), **#5535** (request-runs) — all drafts stacked
  on or following #5502.

### #5621 — gated on John (key custody), not landable until he rules
`claim-pr-sync: resolve the tick credential through the GitHub App (LANDING GATED on John's key-custody authorization)`
- Head `e453a55b5129a8579304462f3c73373c20829e9f` (draft, created today
  18:41:56Z), mergeable not yet computed at read time (unknown), 12 main
  commits since branch point, 1 own commit.
- Evidence: local only — new suite 9/9, neighbourhood 95/95 + 33/33
  PASSED on fixture credentials; no real credential read or used.
  Non-author recheck: NOT-RUN.
- CI at head: PASSED ci-verdict, mechanical, safety-net · FAILED none ·
  NOT-RUN the rest (draft-skipped).
- Files: `server/claim-pr-sync.mjs`, `server/github-app/auth.mjs`,
  `server/github-app/index.mjs`,
  `tests/claim-pr-sync-github-app-auth.test.js`. Disjoint from every
  other item in this pack. Lands singly when authorized (credential
  surface).

### Incoming — #5571 part-2 build (no PR yet)
Branch `fix/5571-part2-parity-bounds` off `ef583ba8`; lane in progress,
failing-first evidence captured (design tests 1/2/7 fail on pre-change
main for the stated reasons). Touches `server/messages-store.mjs` +
`server/store.mjs` and adds the `integrity_parity_checkpoint` table —
**shared-core + schema: lands singly, and the schema addition is
flagged for your classification** when the PR opens. Acceptance tests
are being authored in parallel (branch `tests/integrity-part2-acceptance`,
not yet pushed at pack time).

## §2 — The freeze stack (after #5502)

### #5559 — verified; condition is #5502 only
`Freeze guard calls: talk-policy, moderation, reminders (stacked on #5502)`
- Head `f34538d5ada3a2bea87128ad635d32375be25093` (draft), base =
  #5502's branch at its current head (stack integrity verified by the
  rc5559 lane: merge-base `3ee2e4df…`, ahead 2 / behind 0 over #5502).
- Recheck: fifty-wave rc5559 lane (non-author) — STILL CONDITIONAL,
  its own side fully discharged: stack composed onto `ef583ba8` clean
  (composed `447c1e20bb962aa5c1635523632919cf142f0011`); falsifiers
  fail without it (3 archived legs), 119 PASS / 0 FAIL / 1 NOT-RUN
  with it (the NOT-RUN is `mcp-events-http`'s reference-client gate,
  by design).
- CI at head: PASSED browser (shards 1–6), cloudflare, contract,
  friend-agent-e2e, lint, mechanical, visual-refresh-guard ·
  **FAILED coverage, test, unit** · NOT-RUN safety-net + changes,
  full, gates, quarantined-tests, schema-gate.
- Files: `server/agent-talk-policy.mjs`, `server/moderation.mjs`,
  `server/reminders.mjs`, `scripts/runtime-package.mjs`,
  `tests/action-classes.test.js`. **Collision with #5502:
  `scripts/runtime-package.mjs`** (auto-merged clean in the lane's
  composition; they land in stack order, never as a batch).

## §3 — Batchable

### Batch A (today): #5572 alone
`WakeQueue: reclaim expired leases on the runtime drain path (RES-0124)`
- Head `cdb20aa548de38f33b4d5123f8ad2ca4d6a6424d` (draft, branch
  `jill/res-0124-wake-lease-reclaim`), mergeable true/clean, 438 main
  commits since branch point, 1 own commit.
- Files: `server/wake-queue.mjs`, `tests/wake-queue.test.js` —
  **disjoint from every other item in this pack** (verified from the
  API file lists).
- Recheck: fifty-wave rc5572 lane still IN PROGRESS at pack time (its
  STATE records the composition step as next; no verdict filed). Do
  not treat as rechecked.
- CI at head: PASSED ci-verdict, cloudflare, contract,
  friend-agent-e2e, lint, mechanical, visual-refresh-guard, browser
  shards 1/3/4/5/6 · **FAILED browser (aggregate; shard 2/6),
  coverage, test, unit** · NOT-RUN safety-net + changes, full, gates,
  quarantined-tests, schema-gate.
- It sits alone in Batch A because everything else in the queue is
  singly, stacked, held, gated, or not yet a PR — not padded to five.

### Joining Batch A when opened: S3 mirror cure (no PR yet)
Branch `jill/s3-mirror-level-trigger`, workdir changes uncommitted at
pack time (`server/public-read-model.mjs` + new tests
`public-mirror-level-trigger`, `s3-mirror-drift`) — disjoint from
#5572. Privacy-adjacent (receipts opt-out mirror); its PR will carry
the executed adversarial pass per the fleet rule.

### Not found: S1 (needs-me UI)
No S1 workdir or PR exists at pack time; nothing to queue.

## §4 — Held / not queue work

### #5582 — HELD (your blockers stand); head moved during this run
`RES-1538 reply-alert: needs-me conversation attention`
- At run start: frozen cure2 head `7de0d256db177c9cb4846f910c4e3a9ffbc845c7`.
  At pack close: head **`5598f74168711d0e42bf0768c74603bb3442ed67`**
  (PR-1 iteration lane's push; draft, mergeable true/clean as of the
  script's recount). The iteration is still running — the new head has
  NOT been presented as land-ready, and Jill's seat has already told
  you the lane continues as single writer.
- CI at `7de0d256`: FAILED coverage, test, unit (browser, cloudflare,
  contract, friend-agent-e2e, lint, mechanical, visual-refresh-guard
  PASSED; ci-verdict + safety-net NOT-RUN).
- CI at `5598f741` (read at pack close): PASSED browser (shards 1–6),
  ci-verdict, cloudflare, contract, friend-agent-e2e, gates, lint,
  mechanical, quarantined-tests, visual-refresh-guard · **FAILED
  coverage** · NOT-RUN unit (in progress), test, safety-net,
  schema-gate (skipped).
- Files incl. `server/store.mjs` (shared-core) — lands singly when it
  ever leaves hold.

## §5 — Left the queue during this run

### #5574 — MERGED 2026-11-01T18:48:17Z
Merge commit `c52db58787467390042295b181b152ef3ba4de12` — it IS the
current main tip. Final head `c0d91dc43fa2dd1b5630243f7cf2206bd72ec997`.
(The fifty-wave rc5574 recheck was overtaken by the landing; its
STATE had not filed.) Mid-run artefacts of the merge, for the record:
an interim head (`ba8f3313…`) briefly returned 422 on the check-runs
endpoint and compare showed it contained in main — both resolved by
the merge landing.

### #5614 — merged per API, **content NOT in main's tree** ⚠
`RES-0116: correct /privacy retention sentence (webhook deliveries are pruned)`
- API: state closed, merged=true, head
  `58fe041542182a2b73ec415117d52b7b47191076`, merge_commit_sha
  `b5596813f272bc9c866ba3c11fb3ab053db18b8f`. It left the landing
  queue — the sentence-probe block is moot.
- **But:** neither the head nor the merge commit is an ancestor of
  current main (compare: diverged), and `docs/legal/privacy.md` at
  main `c52db587…` (read ~18:50Z) still carries the pre-fix sentence
  verbatim at line 51: "The scheduled retention job does not delete
  room events, commands, audit rows, invitations, activity, or
  webhook deliveries." Main's line moved after the merge (the
  513d3ee8-source redeploy line). If the correction is still wanted
  — Jill's ruling was that the copy is wrong, the behaviour intended
  — #5614 needs re-landing onto current main. Flagged for your and
  Jill's disposition; nothing in this pack re-queues it silently.

## §6 — File collisions across the queue (from API file lists)

- #5502 ∩ #5579 = `server/bounty-escrow.mjs`,
  `server/bounty-escrow-routes.mjs` — both land singly anyway;
  composition order between them is yours to sequence.
- #5502 ∩ #5559 = `scripts/runtime-package.mjs` — stack order only.
- #5572, #5621, and the incoming S3 files are disjoint from all other
  queue items.

## §7 — Script divergence (queue-freshness.mjs, on-demand run)

Ran `queue-freshness.mjs --prs 5502,5559,5572,5574,5579,5582,5614,5621
--recount` at 18:51Z (detail: `qf-out/detail-2026-11-01T18-51-39-274Z-c7daa5fd.jsonl`
beside this pack's source; script verdict FAILED, exit 1, recount
mismatch on 5 items). Where the script and direct reads disagree,
**the direct reads in this pack govern**:

- Script GraphQL rollup: **SUCCESS for all 8** — contradicted by
  direct check-runs on 4: #5502, #5559, #5572, #5582 all carry
  FAILED unit/test/coverage at their exact heads. The script's own
  REST recount agreed with the direct reads (FAILURE on the same 4;
  SUCCESS on #5579/#5621, where the direct read shows the PASSED trio
  with the remainder skipped — rollup green, per-check truth is the
  NOT-RUN list in §1/§3).
- State: the script's primary read showed #5614 OPEN/merged=false
  (GraphQL lag); direct REST reads before and after show
  closed/merged=true. The script flagged #5614 `moved_during_run`.
- #5574: the script caught the merge mid-run (state MERGED, final
  head `c0d91dc4…`) ahead of this lane's first read (OPEN at the
  interim head) — timing, both true when read; the closing direct
  read confirms the merge.
- Mergeable: the script's primary returned UNKNOWN for #5502/#5572
  (async computation); direct reads + the script's recount resolve
  both MERGEABLE/CLEAN.
- This is the charter-1 divergence (REST vs GraphQL rollup) still
  live in v1.3: the script stays on-demand, its recount is the
  trustworthy half, and its headline rollup must not be quoted as
  qualification.

## Annex — other Jill-fleet drafts open (48h sweep, listing read only)

From the open-PR sweep (created-desc, 2 pages, window complete to
2026-10-30T18:45Z). Previously dispositioned; not re-read this run
beyond the listing; no state change asserted:

- #5517 `jill/w5-fix-pairs-hash` + #5537 `jill/c1-pairs-backfill-migration`
  — HELD BY ROOT (close/reopen `expired_token` regression; recovery
  design is Codex's; offline implementation approved, key custody
  John's).
- #5524 `jill/w5-fix-export-scrubber` — COMPOSITION-REVIEW (schema-44
  digest conflict), your review.
- #5554 `jill/fix-5492-first-click-replay` — stacked on #5492.
- #5522 `jill/w6-devmode-s8a-staging-preview` — dev-mode draft.
- #5504 `jill/help-f8-ea006-ea007-review-binding` — open, non-draft.
- #5446 `jill/browser-durations-s1-20261030`, #5445 `jill/mi-docs-cluster`
  — drafts from 2026-10-30.
- Not Jill-fleet (excluded): Codex's #5622, Grok's #5615–#5618 +
  #5518/#5516/#5514/#5513/#5511/#5510/#5509/#5508/#5507/#5558,
  grokbot drafts #5505/#5497/#5496, dependabot #5609–#5613.

— Jill's queue-freshness lane, sync-and-help wave, 2026-11-01.
