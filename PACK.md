# PR #5502 — landing evidence pack for Codex's disposition

One read. Everything below was verified this run (2026-11-01, lane PACK5502):
GitHub API for PR state and CI, local execution for composition, attribution,
and the one-bad-row case. Branch `evidence/5502-pack-1101` carries this file,
the probe script, and both probe outputs.

## What it is

"Freeze archived rooms at the registry/write choke point (EA-001, EA2-002,
L05-C3)." One new shared guard, `server/archived-guard.mjs`, reads the
`rooms.archived_at` SQL mirror and refuses with the standing 409
`room_archived` shape. It is called at the write-entry choke point of each
in-scope store module: work-claim registry (set/configure/delete), bounty
escrow intake (post/fund only — transitions of pre-existing bounties stay
open, including the keeper timeout refund), store credential/session mint
(`insertCredential`), `setMentionTimeout`, `markCaughtUp`, the collab
`#transact` funnel, project-map push/pull-record, and both invite modules'
mint/create. The board lease-expiry sweep is patched to skip a frozen room
instead of failing board reads. Deliberately left: reads/export, the archive
action itself, revocations, collab replay. Named residuals NOT covered
(feedback, matchmaking, spend-grants, capability grants, attachments,
pairing, dm-consents, web-fetch, wants-work DELETE, public-work apply) are
listed in the PR body — the freeze is partial by its own design statement.

## Exact-head state (API, this run)

- PR #5502: **OPEN, non-draft, mergeable=true, mergeable_state=clean**.
- Head: `3ee2e4dfa37f3403129fd6806f1b5f1cc90ba11a` (branch
  `jill/help-f2-archived-room-freeze`) — unchanged from the standing record.
- Base: main at `1ab906c37b5c5bdfe07f1b12808c8855128a713f` (PR-era main).
  Current main at verification time: `bdeb01bdb889db40f2f025aeea92dc5beeb0cee7`.
- 14 files: +`server/archived-guard.mjs` (51 lines), guard call sites in 10
  server modules, the runtime-package registration line, new
  `tests/archived-room-freeze.test.js` (214 lines), `tests/work-claim-events.test.js` updated.
- CI at the exact head (test run 41258016838; pr-gates run 41258019107):
  - PASSED: contract · lint · browser (all 6 shards) · cloudflare ·
    visual-refresh-guard · friend-agent-e2e · gates · quarantined-tests ·
    safety-net (PR-triggered generation; skipped on workflow_dispatch by design)
  - FAILED: **unit** — exactly 2 tests of 12,964, both
    `tests/rollback-readback.test.js` (:220 "workflow publishes verified
    allocations and both revisions in the receipt", :250 "workflow with no
    entry rollback says unchanged…"). The "probe fails deterministically"
    entry in the log is a nested fixture meta-run, not a counted failure
    (final tally 12,950 pass / 2 fail). **coverage** — derivative: "test
    suite failed (exit 1); not evaluating thresholds", same pair. **test**
    (aggregator) — fails because unit and coverage failed.
  - NOT-RUN: schema-gate · relay · changes (all skipped).

## Composition onto current main — CLEAN, and the red pair is main-cured

- Composed head: **`9a0919dd2db789590818f0404b113fd24c066b64`**
  (merge of `3ee2e4df` onto `bdeb01bd`). **Zero conflicts**; 14 files,
  +355/−8.
- Tests at the composed head (node --test, this VM, TMPDIR on workspace):
  - PR's own: archived-room-freeze 9 + work-claim-events 12 → **21/21**
  - Registry / batch / cron neighbourhood (17 files: claim-autolink ×2,
    claim-pr-sync ×7, land-queue ×3, work-claim registry & sweeps ×5) → **139/139**
  - Guard-family spot batch (9 files: escrow ×2, guest invites ×2, agent
    invites ×2, collab http, project-map ×2) → **182/182**
  - rollback-readback → **41/41**
  - **Total: 383/383 across 29 files.**
- Attribution of the exact-head red pair, executed at four trees:
  PR base `1ab906c3` = 39/41 (same 2 fail) · PR head `3ee2e4df` = 39/41
  (same 2) · current main `bdeb01bd` = **41/41** · composed = **41/41**.
  The pair was red at the PR's base, #5502 neither caused nor cured it, and
  main has since cured it — landing onto current main does not carry it.

## The named finding — Q03-F1 is live at the composed head (EXECUTED)

The accepted repair shape — **archived filtering BEFORE the candidate
LIMIT** — is **not present**: not in #5502's head, not in #5559's diff, and
not on current main (grep `archived` = 0 hits in `server/claim-pr-sync.mjs`,
`server/claim-autolink.mjs`, `server/land-queue.mjs` at both head and main).
The codebase already carries this exact shape for the sibling hazard:
`publicNamespaceSqlExclusion` (claim-pr-sync) excludes public-work
namespace rows in SQL before the LIMIT-32 candidate cap in
`loadDueClaims`/`loadVerificationClaims`, with a per-row JS backstop, and
`holdDue`'s comment names why: an uncaught set inside the batch transaction
rolls back every settlement in the batch. There is no archived equivalent.

Executed one-bad-row case (probe on this branch,
`probe-one-bad-row.mjs`; outputs `probe-composed-output.json` /
`probe-base-output.json`): two real rooms in one store, both with settled
land claims stamped with the same deploy revision, the archived room's
claim inserted first, then the room archived:

- **Composed head:** `linkDeployToSettledClaims` **throws**
  `room_archived` (409) — and the **live room's claim is left unlinked**.
  One archived room rolls back deploy linking for every room.
- **Control at PR base:** no throw, `linked: 2`, both rooms linked.

By code reading, the same uncaught shape holds in claim-pr-sync (batch
transactions call `registry.set` per due claim; the candidate loaders have
no archived exclusion, so archived rows also consume the 32-row candidate
cap — the starvation leg) and in land-queue (`store.workClaims.set` at
lines 534/560 of the head's file, no `room_archived` catch). Only the board
sweep was patched in this PR.

## The #5559 dependency

PR #5559 ("Freeze guard calls: talk-policy, moderation, reminders") is
OPEN, draft, head `f34538d5ada3a2bea87128ad635d32375be25093`, based on
#5502's branch at exactly `3ee2e4df`. Jill's side is fully verified; it is
CONDITIONAL on #5502 landing. Any new commit on #5502 (including an in-PR
F1 fix) moves #5559's base and re-opens its verification.

## Freeze-boundary note

The PR's exemption screen stands: the guard reuses the standing policy
shape from `server/room-lifecycle.mjs` (409 `room_archived`, reads/export
open, pre-existing escrow settlement and revocations open); no policy text
or exemption semantics changed. Freeze-class release boundary remains
John's. The F1 disposition — land with F1 as a fast-follow, or patch the
callers first — is Codex's call (Q03's framing, still open).

## Named risks

1. **F1 fires at runtime, not at merge.** The guard arms on landing for
   every room already archived in production. The first claim-autolink or
   claim-pr-sync tick that touches a settled/due claim in an archived room
   throws inside its batch transaction: deploy linking or settlement for
   ALL rooms in that batch rolls back, repeatedly, until the callers are
   patched. Nothing in the composed tree's 383 passing tests covers this —
   no existing test puts an archived room in front of these batch callers.
2. **Candidate-cap starvation (claim-pr-sync):** archived rows are not
   excluded before the LIMIT-32 candidate selection, so enough due claims
   in archived rooms can starve live settlements tick after tick even
   where no throw occurs first.
3. **#5559 base pin:** any #5502 head movement (including the F1 fix, if
   taken in-PR) forces #5559 rebase + re-verification.
4. **Exact-head CI can never show green unit/coverage** (base-era red
   pair). Grade this PR on the composed tree (383/383, rollback pair
   41/41) or accept the pair as main-cured; schema-gate is NOT-RUN at the
   head.
5. **Partial freeze by design:** the residual families in the PR body
   remain writable in archived rooms after this lands; the pack does not
   re-grade them.

## Repair shape, if patched (in-PR or fast-follow)

Mirror `publicNamespaceSqlExclusion`: an `archived_at` SQL exclusion in
the candidate loaders of claim-pr-sync before the LIMIT, a per-row
archived skip as backstop, and a `room_archived` catch around the
`registry.set` loops in claim-autolink's `linkDeployToSettledClaims` and
land-qu
...[truncated 474 chars]