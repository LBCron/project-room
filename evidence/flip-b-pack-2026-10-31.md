# Flip-B landing pack (PR #5441 + PR #5442) — 2026-10-31

Prepared by Grok Bot (landing seat). No merge, no deploy. Codex is the lander.

## Subjects
- prod /api/version: sourceRevision 1ab906c37b5c5bdfe07f1b12808c8855128a713f, buildId 2026-10-31T08:29:22.284Z
- main: 1ab906c37b5c5bdfe07f1b12808c8855128a713f
- #5441 head 84eec230aea8c5171373112e5049b3e2c633af95 (DRAFT, mergeable)
- #5442 head 8b19b5f343c6d269e04f8835274540c4f15be713 (ready, mergeable)
- composed: main + #5441 + #5442 (local merge commits, not pushed), tree 7358c7373f9c4ab6a5575a7101e2917862724e08, no conflicts (auto-merged server/work-claims.mjs and both errors-catalog.md)

## Exact-head CI (required set = needs of the `test` aggregator)
| job | #5441 @84eec230 | #5442 @8b19b5f3 |
|---|---|---|
| contract | NOT-RUN (skipped) | NOT-RUN (skipped) |
| lint | NOT-RUN (skipped) | NOT-RUN (skipped) |
| unit | NOT-RUN (skipped) | NOT-RUN (skipped) |
| browser | NOT-RUN (skipped) | NOT-RUN (skipped) |
| cloudflare | NOT-RUN (skipped) | NOT-RUN (skipped) |
| visual-refresh-guard | NOT-RUN (skipped) | NOT-RUN (skipped) |
| friend-agent-e2e | NOT-RUN (no run) | NOT-RUN (skipped) |
| coverage | NOT-RUN (skipped) | NOT-RUN (skipped) |
| safety-net | PASSED | PASSED |
| test (aggregator) | NOT-RUN (skipped) | NOT-RUN (skipped) |
Safety-net green with every dedicated job skipped is NOT qualification. Dedicated jobs need the ready-to-land label run at the exact heads.

## Composed-tree local results (tree 7358c737)
- Focused suites (bounty-accept-fail-verdict, needs-me-delivered-review, bounty-rubrics, needs-me*, board-needs-me, bounty-escrow*, bounty-accept-order, route-acceptance, acceptance-*, work-claims*, mcp-bounty-escrow-errors): 201/201 pass.
- Fail-first: the two new test files on bare main 1ab906c3: 9 tests, 8 fail, 1 pass (defects reproduce on main).
- npm run lint: exit 0. ci-affected --run-stories: exit 0.
- Full unit, browser, contract, cloudflare, coverage: NOT-RUN locally.

## Production behaviour change on deploy
Accepting delivered work now refuses with verdict_not_pass when the attached reviewer attestation verdict is fail, so a failed review no longer releases full escrow payment; the caller must reject or get a passing verdict (server/bounty-escrow.mjs, errors-catalog entry added). Delivered work items now count as review asks in needs-me for the poster/decider instead of being excluded, and completing the review from the queue clears them (server/needs-me.mjs, work-claims.mjs). Class: money path, lands singly with exact-head green and a non-author second check. #5441 is still a draft and must be marked ready.
