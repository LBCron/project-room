FILED — RD-R23: Tab's five RECHECK lines posted (muse-room seq 24829, messageId 4c164a1e-f2e7-4b33-8fc0-ce5b2e76a1fc, read back verified); CI-gap table for the 58-PR slate filed (CI-GAPS.md, this dir + branch evidence/rd-r23-rechecks). Record t-20261101-157-rd-r23-ci-gap-table-rechecks-tab-s-five-.

# RD-R23 FILING

- Source: John's Tab seq 24728, accepted seq 24736; programme
  t-20261101-152-merge-deploy-readiness-programme-stage-a. Claim seq
  24804; claim released inside the seq 24829 post.
- Amended classes applied per coordinator note (Root DM seq 24801,
  Jill seq 24821, READINESS.md Slate amendment 2): #5517/#5537
  HELD-BY-ROOT, #5524 COMPOSITION-REVIEW — see CI-GAPS.md.

## Part A — the five: determination walk (LANDING-PACKS order)

Walked LANDING-PACKS.md (branch evidence/hw-p1-landing-packs) from the
top, reconciled with Codex's composition per the slate packet:

1. #5494 — EXCLUDED: struck by the composition (inside #5560 exactly
   once; slate packet §3). Not landable independently.
2. #5442 — EXCLUDED from Tab's five: Flip-B settlement leg, money
   class, lands singly under its own class (pack class "singly").
3. #5441 — INCLUDED (1st): the Flip-B needs-me leg; non-money on its
   face (needs-me review queue), singly after #5442 in pack order,
   independently verdicted (LNR in pack/slate §4.1).
4. #5557 — INCLUDED (2nd): stacked carrier on #5441, non-money
   (redelivery review edge), independently verdicted (LNR, slate
   §4.1); lands only after Flip-B, which the RECHECK line names.
5. #5499 — INCLUDED (3rd): first HELP PR in pack order; batchable,
   non-money, LC in pack/slate batch A.
6. #5498, #5500 — PASSED OVER: money-adjacent deadline singles (pack
   class "singly", slate §4.2 money/security singles) — outside the
   non-money five.
7. #5501 — INCLUDED (4th): batchable, non-money (EA-011 mint-bypass
   leg of the invite family; pack class batchable).
8. #5503 — INCLUDED (5th): batchable, non-money (closeWhenLive),
   LNR-low in pack.
- The freeze-conditional family behind #5502 was never reached (the
  five filled before it); #5502/#5504 are Dot's rechecks and were not
  re-executed; the composed stack #5560–#5568 is Codex/SA-S3/Dot
  territory and was not rechecked. #5517/#5537 (money/security,
  order-bound) and #5524 (security single) sit after #5503 in pack
  order and were already outside the five; the coordinator note now
  additionally marks #5517/#5537 HELD-BY-ROOT and #5524
  COMPOSITION-REVIEW as the governing dispositions (recorded here and
  in CI-GAPS.md; #5524's flag, not merely its class, governs).

## Part A — executed suites (fresh, this run, direct checkout of the exact head; TMPDIR on workspace)

Method: local clone of the fleet checkout in lane scratch; each PR
head checked out byte-identical (git status clean at the head), its
own falsifier file + directly-affected suites run with node --test;
each falsifier also run against the pre-change head (main 1ab906c3,
or #5441's head as #5557's base) with the head's test file in place.
Heads re-verified at the GitHub API in this run: all five open,
mergeable=true, unchanged from pack/slate pins.

- #5441 @ f7e18e21e891ebd4b842b8dc1267d0e9950d9fe5 (draft=true):
  needs-me-delivered-review 4/4 PASS at head, 0/4 on main; full
  needs-me family (needs-me*.test.js) 35/35 PASS at head.
  RECHECK: LANDS-WITH-NAMED-RISK (draft=true, Codex readies).
- #5557 @ 573bcf431ce6c7eece96646c85b409c19082c188 (draft=true):
  needs-me-redelivery-review 1/1 PASS at head, 0/1 at base #5441;
  needs-me family incl. board-needs-me 43/43 PASS at head.
  RECHECK: LANDS-WITH-NAMED-RISK (dedicated CI all SKIPPED at head,
  PR run 41254344435; lands only after #5441).
- #5499 @ 5fb39fb7af8cf7392f33ebd52bc95f19447dc2b2:
  work-item-session 21/21 PASS at head, 20/21 on main (only the new
  L02-C2 resumeApproved test fails on main).
  RECHECK: LANDS-CLEAN.
- #5501 @ d237d22e1ba3360b1e88e8b731f13ba03b46d87e:
  invite-redemption-mint-budget 4/4 PASS at head, 1/4 on main (the 3
  EA-011 tests fail); affected invite suites (agent-invites,
  agent-invite-redeem-routes, agent-invite-link) 53/53 PASS at head.
  RECHECK: LANDS-WITH-NAMED-RISK (pack-named residue Q03-F3: #admit
  pairing still mints uncharged).
- #5503 @ ba3b314cbca8a009d1cb66741c805a106c870bff:
  work-claim-live-close 7/7 PASS at head, 3/7 on main (the 4 new
  closeWhenLive guards fail); all six PR-changed test files 66/66
  PASS at head (58 across live-close + claim-pr-sync-housekeeping-
  budget + claim-pr-sync-public-namespace + work-claim-board +
  work-claim-http-poison, plus f12-board-mcp 8/8).
  RECHECK: LANDS-WITH-NAMED-RISK (pack-named F2: merged pull not
  bound to the live revision).

Falsifier check: NOT fired — every RECHECK number above was executed
at the head it names in this run; every gap row in CI-GAPS.md is from
API reads in this run, and the one slate PR whose head moved during
the run (#5568, twice) is flagged HEAD-MOVED with all heads named.

## Part B — headline (full table: CI-GAPS.md)

58 slate PRs (spine 9 + independent 40 + conditional 9; struck 2
excluded). Lack a terminal heavy-job table at current head: 22, all
LABEL-SKIPPED (only the label-gated PR run exists; heavy jobs 0/9
terminal). IN-FLIGHT: 1 (#5568's workflow_dispatch run 41276361957,
queued at its newest head 7264b395). NEVER-RUN: 0. HEAD-MOVED: 1
(#5568: 9909bf8b → 5f6d38fc83 → 7264b395). Terminal table present: 36
(all via workflow_dispatch runs; conclusions mostly failure on the
main pair/coverage — a terminal table is not green). No CI dispatched
by this lane. No merges, deploys, closes or cancellations. Untouched:
#4951, #4900, #5125, #4561, #4352. No GitHub 429.

## Spend

~1.6 lh of 12 (see STATE.md / record).
