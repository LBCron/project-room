# #5128 merge-up pack — wave-2600 lane Z (FILED, pack only; nothing pushed)

Verdict: **#5128 is still CONFLICTING at current main, but the merge-up is small and
mechanical: exactly 2 conflicted files (the errors-catalog mirror pair), 1 hunk each,
plus 1 silent auto-merge defect the sitting must also fix (duplicate import). The
composed result was built and tested locally by both routes; both converge on the
identical tree `44fbb11612167bce1eee1c209c3c97949579b2f0`. Consumer: Codex's landing
sitting. Built 2026-11-04 ~06:43–07:00 PT. Expiry Fri 2026-11-06 17:00 PT.**

Falsifier check: the falsifier did **not** fire — a fresh merge at current main
conflicts (evidence below). If main moves before the sitting, this pack is stale:
the sitting script refuses to run against any other main SHA.

## 1. Live re-read (GitHub API, this run — `live-read-1.txt`, `live-read-2.txt`, `live-read-3.txt`)

| Subject | Value |
|---|---|
| main tip | `8c9deff7534ed549df88b730c03af2d9d3a11db8` (= production head, flip seq 130 / PR #5918) |
| PR #5128 | OPEN, non-draft, label `ready-to-land` present, mergeable CONFLICTING, mergeStateStatus DIRTY |
| PR head | `ppr/public-proof-residuals` @ `f2cbdd4a51d6f70f2489d2b0c33cdcd10df7703a` (2 commits: `e50b56e7` + a prior main merge) |
| PR base / merge-base | `aaa749065a6451321a949ddcb923f3174504fe35` |
| Divergence | head is **2 ahead / 3,049 behind** main (API compare + local rev-list agree) |
| PR diff vs base | 7 files, +103 / −10 (stat in §4) |
| Amendment | `amend/5128-a8` @ `2c1c87641ebfaeea47fec60936234ba5cb89bb0c` = head + 2 commits (`f701e75c`, `2c1c8764`), ahead 2 / behind 0 vs head; touches `server/discoverability.mjs` +30, `tests/discoverability.test.js` +40, `tests/public-proof-404-copy.test.js` +7/−1 |

## 2. Merge attempts (fresh partial clone in this workdir; never `git stash`; nothing pushed)

Commands: `git checkout -b mergeup-head pr5128 && git merge --no-commit --no-ff mainlive`,
and the same from `amend5128` in a second worktree. Logs: `merge-attempt-head.txt`,
`merge-attempt-amend-summary.txt`, `conflicted-files-head.txt`, `conflicted-files-amend.txt`.

Result, **identical for both starting points**: auto-merge succeeds on
`server/http.mjs`, `server/public-work-claims.mjs`, `server/discoverability.mjs`,
`tests/discoverability.test.js`; **content conflicts in exactly 2 files**:

- `skills/project-room/references/errors-catalog.md`
- `plugins/project-room/skills/project-room/references/errors-catalog.md`

The two files are byte-identical mirrors at every stage (base blob `d48a7618`,
ours `ed918310`, theirs `77623b54` in both) and carry the same single hunk.
The overlaps coordinator A named in `server/http.mjs` (#5897) and
`server/public-work-claims.mjs` (#5870) are real file overlaps but **not** conflicts:
their hunks are disjoint from the PR's, and §4 proves the auto-merge preserved the
PR's intent in those files exactly.

## 3. The conflict, enumerated (one hunk per file; region at merged-file lines 920–925)

Base row (merge-base `aaa74906`, line 863):

```
| `public_receipt_not_found` | 404 | Public receipt not found | re-list | Re-list the resource and use a current id. Do not guess ids. |
```

Ours — PR side (1 line; the PR's honest-scope rewrite of that row):

```
| `public_receipt_not_found` | 404 | No public receipt with this id is available. It may never have been published, or it may have been unpublished or made private. | re-list | Re-list the resource and use a current id. Do not guess ids. A receipt that was listed can stop resolving; this response does not say whether this id was ever public. |
```

Theirs — main side (2 lines; base row unchanged + 1 inserted row):

```
| `public_receipt_not_found` | 404 | Public receipt not found | re-list | Re-list the resource and use a current id. Do not guess ids. |
| `public_lobby_unavailable` | 400 | The public lobby is unavailable or not open for guest joining | no | Open /r/project-room-lobby to check access or ask the owner to reopen guest joining. Do not keep retrying confirmation while joining is closed; the pending connection can be retried after joining reopens. |
```

Attribution of the main side: the `public_lobby_unavailable` row comes from commit
`043867b4` "Keep successful lobby admission when the public preview is unavailable",
merged by **PR #5750** (merged 2026-11-03T08:15:47Z); it is in main and not in the
merge-base (`attribution-search.txt`, `attribution-pr.txt`). The catalog's wider
main-side growth vs base (+129 lines, 19 hunks, incl. the regeneration in **PR #5879**,
merged 2026-11-04T06:11:56Z) auto-merges everywhere except this hunk, because the
lobby insertion sits immediately after the one catalog row the PR rewrote. The PR's
other catalog row (`agent_page_unavailable`, expanded scope text) auto-merged
cleanly and is present in the composed tree (line 166).

### Proposed resolution — MECHANICAL

Resolved region = PR's expanded receipt row, then main's lobby row (main's own
placement), both verbatim; the duplicated short receipt row is dropped because the
PR line supersedes it. Reasoning: each side's intent is a disjoint row-level fact —
the PR rewrites one row's copy, main adds a different row next to it; no text is
invented and no wording choice is made. Risk grade: **MECHANICAL**.
Executed by `resolve-catalog.py` (asserts the exact block shape; aborts on any
other shape). Post-resolution checks observed: mirrors byte-identical, zero
conflict markers, receipt row at line 920, lobby row at 921.

## 4. The silent defect (found by testing, not by git) — MECHANICAL fix, mandatory

Composing head + amendment onto main auto-merges `tests/discoverability.test.js`
"textually clean" but **broken**: main added the import line
`  discoverabilityErrorOverride,` (its line 30) and the amendment independently
added the identical line (its line 31); auto-merge keeps both, and the file dies
with `SyntaxError: Identifier 'discoverabilityErrorOverride' has already been
declared` — the whole suite file fails without running a test
(`test-discoverability-merged.txt`). Neither base nor PR head imports the symbol
at all; each side added it once for its own new tests.

Fix: delete one of the two identical lines (`fix-duplicate-import.patch`, 1 line).
Risk grade: **MECHANICAL** (the lines are character-identical; either deletion
yields the same file). This defect exists in **both** composition routes, and
only in the head+amendment composition — a head-only merge-up does not produce it.

No other conflict or defect was found. One item is flagged for Codex's eye, not
resolved by assertion: **JUDGEMENT (review-only)** — in `server/discoverability.mjs`
the amendment's receipt-face override block now sits ahead of `matchScope` in a
file main also changed; there is no textual conflict and the discoverability suite
passes at the composed tree, but override precedence against main's newer scopes
is a code-reading call for the sitting if it wants one. No pack action depends on it.

Faithfulness proof for the auto-merged overlaps: `git diff mainlive <composed>`
is exactly the PR+amendment intent and nothing else — 8 files, +179/−10
(`diff-main-to-final-stat.txt`, `diff-main-to-final-server.txt`,
`composed-tree-vs-main.patch`): `server/http.mjs` +10/−2 (receiptUnavailable
honest scope), `server/public-work-claims.mjs` +9/−2 (both `public_receipt_not_found`
messages), `server/routes/public-agent-page.mjs` 1 line, `server/discoverability.mjs`
+32/−1 (PR hint line + amendment's /receipts override block), catalogs 4 lines each
(the 2 PR rows; lobby already in main), `tests/discoverability.test.js` +40,
`tests/public-proof-404-copy.test.js` +88.

## 5. Two routes, one tree (the sitting picks)

- **Path 2 (recommended):** merge main into the amendment tip `2c1c8764` (same 2
  conflicts, same resolution), apply the duplicate-import fix, commit. The PR
  branch then **fast-forwards** to that commit — verified
  `git merge-base --is-ancestor f2cbdd4a HEAD` = true; push is FF, no force.
  One merge commit total. Executed end-to-end by `apply-mergeup.sh`.
- **Path 1 (equivalent fallback):** merge main into PR head (same resolution,
  local merge commit `d48d05654`), then merge `amend5128` in — that second merge
  auto-merges cleanly (0 conflicts, `merge-attempt-step2-amend.txt`), then the
  same import fix.

Both routes + fix were executed locally and produce the **identical tree
`44fbb11612167bce1eee1c209c3c97949579b2f0`** (path-1 head `31a18c47`, path-2 head
in `clone-amend`), with a 0-line diff between them.

## 6. Post-merge-up test plan (what the sitting runs, what PASS means)

Local evidence already obtained at the composed tree (this lane, commands in the
transcript and `test-run-*.txt`):

| Check | Result at composed tree |
|---|---|
| `node --check` on all 6 changed .mjs/.js files | PASSED (all) |
| `node --test tests/errors-catalog-drift.test.js tests/public-proof-404-copy.test.js tests/discoverability.test.js` | **32/32 PASSED, 0 failed** (before the import fix: 15 pass / 1 file failed at parse — the §4 defect) |
| Mirrors byte-identical (`cmp` on both catalog files) | PASSED |
| FF ancestry + tree convergence (both paths) | PASSED |

The errors-catalog-drift suite is the decisive check on §3: it re-derives the
catalog from the server sources, so a wrong hand-resolution fails it.

At the sitting, after the FF push, CI must run at the **new exact head**. Job
names observed on the PR's old head (`check-runs-pr-head.txt`): `changes`,
`schema-gate`, `gates`, `unit`, `test`, `contract`, `cloudflare`, `lint`,
`coverage`, `safety-net`, `quarantined-tests`, `visual-refresh-guard`, `browser`,
`browser shard 1/6`…`6/6`. PASS = each required job `completed/success` at that
head; anything `skipped` or absent is **NOT-RUN**, never green (heavy jobs are
label-gated; `ready-to-land` is already on the PR and it is non-draft, so they
should dispatch). Until that CI run exists, every CI job for the merged head is
NOT-RUN — this pack's local suites are lane evidence, not a CI verdict.
Deploy + production version check after merge remain Codex's acts under the
sitting's journal, as chartered.

## 7. Artefacts in this directory

- `PACK.md` — this pack.
- `apply-mergeup.sh` — Path 2, end to end, with hard stops (main moved / heads
  moved / unexpected conflict set / clean merge = falsifier). Performs **no push**;
  prints the journalled FF push for the sitting.
- `resolve-catalog.py` — the §3 resolution, shape-asserted.
- `fix-duplicate-import.patch` — the §4 one-line fix (applies clean; verified in both worktrees).
- `composed-tree-vs-main.patch` — full diff main `8c9deff7` → composed tree `44fbb116` (310 lines).
- Evidence: `live-read-1.txt` … `live-read-3.txt`, `merge-attempt-head.txt`,
  `merge-attempt-amend-summary.txt`, `merge-attempt-step2-amend.txt`,
  `conflicted-files-head.txt`, `conflicted-files-amend.txt`, `conflicted-files-step2.txt` (empty = clean),
  `ls-files-u-amend.txt`, `conflict-hunks.txt`, `diff-base-ours-catalog.txt`,
  `diff-main-to-final-stat.txt`, `diff-main-to-final-server.txt`,
  `attribution-search.txt`, `attribution-pr.txt`, `check-runs-pr-head.txt`,
  `test-run-merged-tree.txt`, `test-run-merged-tree-fixed.txt`, `test-discoverability-merged.txt`,
  `SHA256SUMS.txt`; local clones `clone/` (path 1) and `clone-amend/` (path 2) hold the composed commits.
- `STATE.md` — lane state file.

## 8. What this lane did not do

No pushes, no PR edits, no comments, no merges on any shared branch, no deploys,
no sends. All merges and commits exist only in the two local clones in this
workdir. Journal entry, FF push, CI-at-head verification, merge and deploy are
the sitting's (Codex's) acts.
