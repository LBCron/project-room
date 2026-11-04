# D3 disposition — PR #5063 cure head `69ab79b0`: the 9 failing tests, classified

**Verdict: FALSIFIER NOT MET — the cure is NOT exonerated. 7 of 9 are CURE-CAUSED; 2 of 9 are PRE-EXISTING-AT-MAIN (CI-time main skew, since fixed on main, no cure act). The predicted "2 pins" are real but are only 2 of the 9; the other 7 were invisible from the cure branch alone because CI tests the PR merge commit, not the branch head.**

Consumer: Codex, for the D3 disposition. Diagnosis only — nothing edited, pushed, commented, merged, or deployed. Local merged tree `22c55fc1` (cure `69ab79b0` merged into main `8c9deff7` in a fresh scratch clone) was never pushed; the clone has been deleted.

## Why 9, when 2 were predicted (the whole mystery, in one paragraph)

The cure was measured locally against its own branch, where exactly 2 tests fail (rows 5–6 below — the predicted pre-cure-model pins). CI's `unit` job checks out the PR **merge commit** (cure × then-current main, 2026-11-04T07:55Z, run 41795608763) and runs `scripts/unit-ci.mjs --affected`. On main since the cure branched at `aaa74906`, two things happened: (a) main landed new tests that pin behaviour the cure's routes change breaks — DC1-A1 ×4 (`tests/work-claim-conflict-hint.test.js`, absent at base and at cure head) and the needs-me legacy audit sequence (file absent at base) — 5 more failures, all cure-interaction; (b) main moved two content surfaces (offers page, staging workflow) away from the regexes of two older tests still riding in the merge — 2 failures that are main-side skew, and which current main has since reconciled itself. 2 + 5 + 2 = 9.

## Evidence matrix (same command, same machine, node v24.22.1)

Command per tree: `node --test tests/work-claim-conflict-hint.test.js tests/work-claim-events.test.js tests/work-claim-leases.test.js tests/front-door-batch.test.js tests/needs-me-delivered-review.test.js tests/staging-config.test.js` (+ cure's own `work-claim-permission-falsifier`, `work-claim-permission-granularity`, `work-claim-guards` on the merged tree). Raw outputs in `evidence/`, hashed in `evidence/MANIFEST.sha256`. CI's own junit + spec log for run 41795608763 were downloaded and are in `evidence/ci-artifact/` — the 7 cure-caused failures carry **identical error signatures in CI and in the local merged run**.

| Tree | Result |
|---|---|
| Main `8c9deff7` alone | 62/62 PASS — all 9 named tests pass (B-9 under its current name, "precedes") |
| Merge-base `aaa74906` (events+leases+conflict-hint files) | 36/36 PASS |
| Cure head `69ab79b0` alone | 47/49 PASS — fails rows 5, 6 only (DC1 tests and needs-me file do not exist on this branch; B-9 passes in its old form) |
| Merged cure→main `22c55fc1`, attempt 1 | 110/117 PASS — fails rows 1–7 |
| Merged cure→main `22c55fc1`, attempt 2 (rerun) | 110/117 PASS — identical 7 failures (deterministic, not flake) |
| CI run 41795608763 (merge vs main @ 2026-11-04T07:55Z) | fails all 9; rows 1–7 signatures identical to local merged run |

Cure's own suites (falsifier, granularity, guards) PASS on the merged tree — the cure does what it intends; it breaks neighbouring pinned behaviour in `server/work-claim-routes.mjs`, the only product file it touches.

## The table Codex can adopt line by line

| # | Test (file) | Classification | Evidence (one line) | D3 disposition proposed |
|---|---|---|---|---|
| 1 | DC1-A1: room owner claiming a member-held item gets the owner-release copy (409) — `work-claim-conflict-hint.test.js` | **CURE-CAUSED** (merge interaction) | Passes at main; fails merged ×2 and CI identically: actual 200, expected 409 | Cure update: restore DC1 owner-release conflict semantics under the permission model. Do not edit main's test. |
| 2 | DC1-A1: room owner updating a member-held item gets the owner-release copy (403) — same file | **CURE-CAUSED** | Actual copy "Work \"a1u\" is owned by nobody — only the owner can change it" vs expected /held by quill until/; identical in CI | Cure update, as row 1. |
| 3 | DC1-A1: a non-owner claimant keeps the previous copy — same file | **CURE-CAUSED** | Actual 200, expected 409; merged ×2 + CI | Cure update, as row 1. |
| 4 | DC1-A1: room owner claiming an in_progress item (409, A2 sub-case) — same file | **CURE-CAUSED** | Throws `work_not_owner` "owned by nobody" from `handleWorkClaimsCore` (`work-claim-routes.mjs`); merged ×2 + CI | Cure update, as row 1. |
| 5 | each claim change appends one event naming the member, the action, the owner and the files — `work-claim-events.test.js` | **CURE-CAUSED** vs own base — candidate pre-cure-model pin | FAILS at cure head alone; PASSES at base `aaa74906` and at main; error is the cure's own assign gate: 403 `work_claims_not_permitted`, "assignee to hold the accept_work permission" | Codex rules pin vs regression: if pin, the cure update seeds `accept_work` in this test as part of the cure; if regression, fix the assign path in routes. Either way the act is on the cure side. |
| 6 | handler: review attestations are caller-bound and cleared on handoff — `work-claim-leases.test.js` | **CURE-CAUSED** vs own base — candidate pre-cure-model pin | FAILS at cure head alone; PASSES at base and main; attestation by vera survives handoff (actual [vera…], expected []) | Codex rules pin vs regression, as row 5. |
| 7 | [legacy compatibility] audit sequence over the real HTTP and MCP faces — `needs-me-delivered-review.test.js:132` | **CURE-CAUSED** (merge interaction) | File absent at base; PASSES at main; fails merged ×2 + CI identically: completion step actual 403, expected 200 — the queue-suggested `done` action is refused because the reviewer holds no `complete_work` under the cure model | Cure update: the legacy reviewer completion path must work under the permission model (seed/grant in the route logic, not by editing this main-side test), or Codex explicitly re-decides the legacy-compat contract in writing. |
| 8 | B-9: the matcher sits below the offers workspace, and the copy assumes no agent — `front-door-batch.test.js` | **PRE-EXISTING-AT-MAIN** (CI-time skew), NOT cure-caused; **resolved at current main** | PASSES at cure head (old form), at current main (renamed "the matcher precedes…"), and on the current merged tree ×2. CI failure text: old test regex `($('.workspace') ?? $('.intro')).after(matching)` not found in main's newer offers-page source in the CI merge tree. Cure touches neither the test nor the offers source. | No cure act. Merge-up to current main carries main's reconciled test. Do not chase. |
| 9 | persistent staging deploys only an explicitly dispatched candidate — `staging-config.test.js` | **PRE-EXISTING-AT-MAIN** (CI-time skew), NOT cure-caused; **resolved at current main** | Test absent at base and cure head; PASSES at current main and on current merged tree ×2. CI failure text: test regex /wrangler deploy --env staging --keep-vars/ vs main's staging workflow, which had gained `--durable-objects-code-update-mode 'deferred 60s'` before `--env`. Cure touches nothing staging-related. | No cure act, as row 8. |

## Bonus finding — the `gates` failure is also explained (not a test)

`gates` in `pr-gates.yml` runs `scripts/pr-diff-size-check.mjs`. Reproduced locally at base `aaa74906` → head `69ab79b0` with the live PR body (coordinator A evidence): **1101 changed lines exceed the 300-line threshold; justification missing** (exit 1, output in `evidence/gates-diff-size-check.txt`). D3 line: file a large-diff justification in the #5063 body (1101 lines: 102 routes + 973 lines of new falsifier/granularity tests + small test edits) or split the PR. The `test` job failure is downstream of the same unit failures above; no separate diagnosis was run for its non-unit suites — NOT-RUN here, not folded into any verdict.

## Caveats

- Local runs used node v24.22.1 without `npm ci` (the suites run on repo modules + stdlib) and without CI's bubblewrap/host-isolation setup. The 7 cure-caused failures reproduce byte-identically across local merged runs and CI, so isolation differences do not explain them; rows 8–9 rest on CI's own failure texts plus passes in three local trees.
- CI's merge base was main as of 2026-11-04T07:55Z, not `8c9deff7`; rows 8–9 are classified against that CI-time main from CI's failure texts, and against current main by direct runs.
- Pin-vs-regression for rows 5–6 is Codex's ruling to make; this diagnosis establishes only that the behaviour change is the cure's, which is what D3 needed.
