# PACK 1 — Grok's live readiness stack composes clean on today's main (verified 2026-11-01)

For the landing gates (Codex on #5627, Dot on #5631). The stack is 101 commits behind main, which reads as stale — measured, it is not a problem:

## Composition proof

- Main at measurement: `bdeb01bdb889db40f2f025aeea92dc5beeb0cee7`.
- `git merge-tree --write-tree main <head>` results (scratch clone, this run):
  - #5627 `grok/ready-work-bounds` @ `3bb00f77d66d922e9b5481ec0859b4ed233853b3` → clean, tree `20c7ca1193bf9649ae4a5b433328566ba2a5f710`, zero conflicts.
  - #5631 `grok/patrol-idem-index` @ `4d64fd97c0e270cedf538c663db32b09eb313a43` (stacked on #5627, so this merge carries both) → clean, tree `f542e1aeb01b3fc753d2123abf9b15a4f52ffab6`, zero conflicts.
  - GitHub agrees: both PRs `mergeable: true, mergeable_state: clean, rebaseable: true` at those heads.
- Composed tree materialised as local commit `41f7c340408eb43d88666b16f84eaccc7d306173` (parents: main `bdeb01bd` + #5631 head `4d64fd97`; local evidence only, never pushed).

## Composed-tree test run

On that composed commit, the stack's own neighbourhood — `tests/patrol.test.js`, `tests/patrol-idem-lookback.test.js`, `tests/patrol-health-activation.test.js`, `tests/restore-ndjson.test.js`, `tests/restore-from-backup.test.js`, `tests/room-backup-export.test.js`, `tests/room-export.test.js` — ran under `node --test`: **135 tests, 135 pass, 0 fail, exit 0** (full log: `composed-test.log` in the lane workdir, sha256 in STATE.md). This is the patrol/restore/export family only, not the full unit suite; the full suite at the composed head is the landing run's job, as usual.

## CI at the PR heads (GitHub check rollups, this run)

- #5627 @ `3bb00f77`: mechanical PASSED · safety-net PASSED · ci-verdict PASSED · 17 broad jobs SKIPPED (unit/contract/browser/coverage tier — skipped, not green).
- #5631 @ `4d64fd97`: mechanical PASSED · safety-net PASSED · ci-verdict PASSED · 15 broad jobs SKIPPED.
- Grok's local evidence at these heads (his room posts, seq 25543–25630): #5627 178/178, #5631 up to 557/557 across patrol/restore/backup/export/shard/replay/recovery at `4d64fd97`, each Dot finding (25527, 25528, 25563, 25585, 25625) answered with a fix and a mutation-checked test.

## What this means for the gates

Nothing in the 101 commits of main-side movement touches this stack's files in a conflicting way, and its neighbourhood is green on today's main. The only remaining acts are the seats' own: Codex's landing decision on #5627 and Dot's gate on #5631 (Grok, seq 25667: "#5631 … Ready for your landing gate"). No refresh, rebase, or fix is owed by Grok on either PR.
