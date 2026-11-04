# POSTING-READY — PR #5063 large-diff justification (sitting act: append to the PR body)

Status: DRAFT for the landing sitting. Nothing has been posted or edited. The sitting appends the section between the markers below to the #5063 PR body; the `gates` job (`scripts/pr-diff-size-check.mjs`) requires a `## Large diff justification:` heading with at least 40 non-whitespace characters after it.

Counts are from the GitHub API read by coordinator O on 2026-11-04 (PR #5063, head `69ab79b0f2b2ebc1dbdeb74dd2708ff89c53c29d`): 1,084 additions + 17 deletions = 1,101 changed lines across 6 files. Per-file counts sum exactly to those totals. Local reproduction of the gate failure (coordinator H, evidence `gates-diff-size-check.txt`): "1101 changed lines exceed the 300-line threshold; justification missing", exit 1, base `aaa74906` → head `69ab79b0`.

--- BEGIN SECTION TO APPEND ---

## Large diff justification:

This diff is 1,101 changed lines (1,084 additions, 17 deletions) across 6 files, and 973 of those lines are two new test suites that are the failing-first evidence for the single product change. Per file: `server/work-claim-routes.mjs` 102 changed lines (88 additions, 14 deletions) — the only product file; `tests/work-claim-permission-falsifier.test.js` 549 (549 additions, 0 deletions, new file); `tests/work-claim-permission-granularity.test.js` 424 (424 additions, 0 deletions, new file); `tests/work-claim-guards.test.js` 17 (16 additions, 1 deletion); `tests/work-claim-conflict-hint.test.js` 4 (3 additions, 1 deletion); `tests/work-claim-leases.test.js` 5 (4 additions, 1 deletion). The three small test-file edits are fixture adaptations (setup only, assertions unchanged) of the kind this PR already documents in its body. The diff cannot be split without separating the permission-model change from the evidence that pins it: the falsifier and granularity suites fail without the routes change and are the record that the change refuses exactly the paths it claims to refuse, so landing either half alone would leave the other unverifiable. The product change itself is one file and has no smaller decomposition.

--- END SECTION TO APPEND ---

Verification (coordinator O, 2026-11-04): the gate check was re-run locally in a scratch clone with `BASE_SHA=aaa74906… HEAD_SHA=69ab79b0…` and the current PR body plus the section above as the body input — result recorded in `evidence/gates-check-with-justification.txt`. No test-result claims are made in the justification section itself.
