# LANE 5623-COMPOSITION — STATE

Verdict: COMPOSES-CLEAN — draft PR #5623 (S3 mirror cure) cherry-picks onto current main tip `c52db58787467390042295b181b152ef3ba4de12` with no conflicts, both PR files byte-identical to the PR head, the cure's tests 7/7, the falsifier constructions healed at the composed head, and every neighbourhood failure proven pre-existing at main tip (environmental, identical or worse without the cure). Evidence railed on branch `evidence/5623-composition-1101`.

## Charter
Compose draft PR #5623 onto current main and verify, per Codex's sync answer seq 25502 ("S3 privacy falsifiers/composition"). Evidence for Codex's landing lane via the wave summary. No PR edits, no push to the PR branch, no merges, no deploys, no room posts.

## Composition (GitHub API + local git, this run)
- Main tip read at the API this run: `c52db58787467390042295b181b152ef3ba4de12` (merge of #5574). PR #5623: open draft, head `5db7b2c97e27ed0c0c102f0b910586b283a7c311`, branch `jill/s3-mirror-level-trigger`, exactly 1 commit on merge-base `ef583ba8` (its original base).
- Cherry-pick onto main tip: clean, no conflicts. **Composed head: `873905d959cd1b3fa42640047b9504ff3947c5d1`** (local branch `compose-5623-on-c52db587` in this lane's clone).
- Byte-identity CONFIRMED both ways: git blob SHAs at the composed head equal the PR head's blobs as read at the API — `server/public-read-model.mjs` blob `3a6838e7203c15a2f54de7a65b7df2a6d0bf499b`, `tests/public-mirror-level-trigger.test.js` blob `e901b7579e1c4330d2f87749f87a757e92f91e9e`; working-tree sha256 (`e5bc9bbb981966a64b30dfa3eb96b081c23c77d66f40673edf81f3371a078d12` / `4e6c491ad55426ee910a58419ba2a19c021b0e35f8c3ee1d77cd6cbfe8a9bf6c`) matches the PR head's file contents exactly. Diffstat +302/−14, same as the API's file list.

## Failing-first (cited from the author lane's filing, not re-derived)
At base `ef583ba8`, tests/public-mirror-level-trigger.test.js gave T1 PASSED, T2–T7 FAILED (author lane STATE.md + PR-BODY.md, `~/workspace/wave-2026-11-01-fifty/s3mirror/`). The base probe (PROBE-at-base.test.js) held 4/4 drift assertions at base.

## Falsifier constructions re-run at the composed head (executed)
The author lane's base probe was run unmodified against the composed tree (scratch copy, deleted after). Result: **1 PASS / 3 FAIL — failing at exactly the heal assertions**, i.e. the drift no longer constructs:
- P1 (mirror-write failure rolls the command back): PASSED — atomicity preserved.
- P3a under-exposure: FAILED at "ordinary activity does NOT heal the mirror" — actual mirror `{enabled: 1}` (healed to the recorded ON by the room's next write) vs base expectation `{enabled: 0}`.
- P3b exposure: FAILED at "ordinary activity does NOT recreate the mirror row" — actual `{enabled: 0}` (row recreated with the recorded OFF) vs base expectation `undefined`. The opted-out room's rows stop serving on the next write.
- P4 producer (backfill skip + projection repair): all pre-write assertions still held (the exposure persists in the pre-write window — the PR's named residual), then FAILED at the final "ordinary activity does not heal it either" — actual `{enabled: 0}`; the room's next write heals it, exactly the T5-pinned behaviour.
Log: logs/probe-at-composed.log.

## Test table at the composed head `873905d9` (local `node --test`, TMPDIR on workspace)
| Set | Files | Result |
|---|---|---|
| Cure tests | tests/public-mirror-level-trigger.test.js | **7/7 PASSED** |
| A | public-mirror-optout + mirror-readtime + public-read-model + public-visibility-conformance | 41/42 — 1 FAILED: the 20 ms p95 perf test (see below) |
| B | lot-receipt-page + operator-purge + unpublish-receipt-projection + receipts-route + receipt-verify + receipt-cross-reference-page | **50/50 PASSED** |
| C1 | recovery.test.js | **10/10 PASSED** |
| C2 | recovery-comparison.test.js | 14/15 — 1 FAILED: backup-digest race (see below) |
| C3 | cold-start-budget.test.js | **6/6 PASSED** |
| NOT-RUN | hosted CI at the composed head (not dispatched by this lane); the full unit suite | named, not folded into green |

## Failures — both proven pre-existing at main tip `c52db587`, neither charged to the composition
1. **Perf test** ("receipts, room pages, the directory, and the sitemap stay within 20 ms p95 with 2000 private rooms", tests/public-read-model.test.js): FAILED at the composed head (/receipts p95 23.59 ms solo) and FAILED identically in kind at main tip in a back-to-back solo run (/sitemap.xml p95 36.02 ms) — the over-budget path varies run to run, the signature of environment latency on this loaded VM. The test measures read surfaces only (seeded by direct SQL); the cure touches only the write path (`syncRoomPublication`). The author lane measured the same test failing at the uncured base too (p95 33.90 ms). One main-tip combined Set A run also passed it (42/42) — it flips with load at both heads.
2. **Backup-digest race** ("membership authority changes are detected inside room projections", tests/recovery-comparison.test.js): FAILED at the composed head with `Error: Backup changed while its snapshot digest was being read` (server/backup.mjs:54, from the test's own capture helper) and FAILED with the identical error at main tip, where the same file went 12/15 (two further load-shaped failures the composed run did not have). The cure does not touch backup.mjs. (A combined Set C run was also SIGTERM-killed mid-flight by the environment; its partial log showed a different test of the same file failing at 12.9 s — same load signature. Sets were therefore run per-file; logs retained.)

## Count note (honesty)
The author lane reported Set A as 46/47 and Set C as 72/72 at base. Under the exact files its PR body names, this run executed 42 (A) and 31 (C) at both main tip and the composed head — identical counts at both heads, and `test(` declaration counts in all seven files are unchanged between `ef583ba8` and `c52db587`. The author's larger totals evidently came from a wider invocation; the composed-vs-main-tip comparisons above are on identical file sets and are the load-bearing reads. Set B reproduced the author's 50/50 exactly.

## Residual (the PR's own, unchanged by composition)
Reconciliation is write-triggered: a room that never writes again keeps a desynced mirror until its next write; the one-shot backfill stays terminal. Named in the PR body; the closing piece (periodic bounded reconciliation sweep) is a jobs/cron follow-on flagged for Codex, not built in the PR and not part of this composition.

## Pointers
- PR: https://github.com/Uuriko/project-room/pull/5623 (untouched by this lane)
- Evidence branch: `evidence/5623-composition-1101` (this STATE + logs under evidence/5623-composition/)
- Author lane filing: `~/workspace/wave-2026-11-01-fifty/s3mirror/STATE.md`

Spend ≈1.1 lh of the 1.5 lh appetite. Phase: downhill, closed.
