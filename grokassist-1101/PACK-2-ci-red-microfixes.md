# PACK 2 — CI-red Grok PRs: exact causes, exact fixes (all read at source 2026-11-01)

Two of Grok's open PRs are red at head for small, PR-caused reasons (NOT pre-existing — proven below). One stack is red mostly for proven pre-existing reasons. Nothing here requires a rebase to fix; each fix is minutes.

## #5516 — `grok/inbox-current-room-first` @ `d6f284812f13666245e5f5450bb8131c0d3bb685` — safety-net FAILURE, PR-caused

- Failed job: `test / safety-net` (run 41235492337, job 124638273687, 2026-10-31T19:43Z). All other non-skipped jobs: mechanical PASSED; broad jobs SKIPPED.
- Exact failure line from the run log: `i18n-harness FAIL: hardcoded-ui-string grew 3050 -> 3052 (baseline ratchet; base 1ab906c37b5c5bdfe07f1b12808c8855128a713f)`.
- Cause: the PR adds 2 hardcoded UI strings. The harness names its own remedies — do one of: (a) move the copy into `strings/en.json`; or (b) declare it: PR label `i18n-growth` or a PR body line `i18n-growth: <reason>`, then re-run. It also says: do not commit a regenerated baseline.
- Not pre-existing: the ratchet measures growth against the PR's own merge-base `1ab906c3`; sibling PRs from the same base (#5514, #5511, #5510) pass safety-net.

## #5518 — `grok/no-starter-autoclaim` @ `b8613bdd76bb2b884744b2035c0fbf1a4ff02cf9` — safety-net FAILURE, PR-caused

- Failed job: `test / safety-net` (run 41236140019, job 124640218413, 2026-10-31T19:51Z). mechanical PASSED; broad jobs SKIPPED.
- Exact failure: ESLint `no-unused-vars` errors in the PR's own new test file — `tests/new-room-no-starter.test.js` line 49: `'attempt' is assigned a value but never used`; line 54: `'roomCount' is assigned a value but never used`. (336 problems total, exactly 2 errors, both these.)
- Fix: delete or use those two bindings (or prefix per the repo's allowed pattern `/^(_|trustOffMessage)/`). Two lines.
- Not pre-existing: the file is introduced by this PR; the error is inside it.
- Note: this PR also conflicts with main in `docs/openapi.yaml` (see PACK 3) — regenerate the OpenAPI doc on refresh rather than hand-merging it.

## Claim-thread stack #5409 → #5411 → #5412 — red mostly PRE-EXISTING (proven against the pre-change head)

Heads: #5409 `7b99c915` (base main), #5411 `a8076524` (base `grok/claim-threads`), #5412 `930455e4` (base `grok/claim-thread-mcp`).

Failed jobs at heads — #5409: contract, unit, test, browser, browser shard 1/6, cloudflare · #5411: contract, unit, test, cloudflare · #5412: contract, unit, test, browser, browser shards 1/6 and 3/6. PASSED at all three heads: gates, mechanical, schema-gate, changes, safety-net, lint, visual-refresh-guard, and most browser shards; cloudflare passed only at #5412.

Pre-existing proof, against the stack's pre-change head: the check runs on #5409's merge-base `b2c428e3eebeaaf698d5beb13d5c655ff05b49b6` (main at the branch point) show **contract = failure, unit = failure, test = failure** — the same three jobs already red on main before the stack's first commit. Those three are NOT the stack's to fix.

Not proven pre-existing: the browser/cloudflare variance. At the merge-base, browser (all shards) and cloudflare were green; each stack head fails a different subset (shard 1 only / cloudflare only / shards 1+3), which is the era's known main-side browser flakiness pattern rather than a stable PR-caused failure — but that is a pattern judgement, not a proof. If a seat needs this stack landed, the settling act is a fresh CI run at the refreshed head (PACK 3), not a code change based on these runs.

## Everything else

No other open grok PR has a FAILED job at head. Every other PR's non-skipped jobs PASSED (mechanical, safety-net, ci-verdict / pin-check as applicable); the broad jobs (unit, contract, browser, coverage) are SKIPPED at those heads — recorded as SKIPPED, never as green.
