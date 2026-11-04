# Coordinator AC — flip-stub reconstruction: report

**Verdict: FILED — falsifier triggered on all three legs. No deploy records
appended; dispositions filed in an annex beside the ledger.**

Annex: `~/workspace/fleet-tools/state/flip-stub-dispositions-2026-11-04.md`
Store after work: `deploy-records.jsonl` unchanged at 249 lines,
`validate-store` PASS, 0 defective.

## What the task assumed vs what the records show

The task record described 5409cbe9, f70d042e, 39b59de6 as "production
flips observed during earlier waves [that] were never persisted as deploy
records". Checked at the source, none of the three was ever a production
flip. Each is a merge commit to main (PRs #5900, #5902, #5905, merged
2026-11-03 23:06–23:40 PT) that production never served as its head.
Writing `DEPLOY_RECORD` reconstructions for them would have falsified
the store, so the falsifier path was taken instead: prove it, close the
legs, file the proof.

## Proof (per leg, three independent sources)

1. **Flip ledger** (`fleet-tools/state/flip-ledger.json`, regenerated
   2026-11-04T14:47:44Z by the poller): all three SHAs appear only under
   `subsumedMerges`, each annotated "merged to main but never a
   production head; carried into production by a later flip", with PR
   numbers 5900 / 5902 / 5905. None appears as any flip's
   `sourceRevision` or `priorRevision` across all 130 flips.
2. **Observation record**: zero occurrences of any of the three SHAs in
   `deploy-watch.log`, `deploy-watch-state.json`, or
   `deploy-records.jsonl`. deploy-watch reads both doors twice per poll;
   production was never observed serving these revisions.
3. **Clone ancestry** (`~/workspace/project-room` at
   `refs/remotes/origin/main` = 8c9deff7, read-only, no fetch):
   `git merge-base --is-ancestor <stub> <flip-source>` is false for
   flip 118 (source b4dfa57c) and true for flip 119 (source 9b7eee36),
   for all three stubs — flip 119 is the first production revision
   containing them.

## The carrying flip

All three merges rode into production in **flip seq 119**:
b4dfa57c → 9b7eee36 (head merge PR #5906, committed
2026-11-04T07:45:05Z), buildId 2026-11-04T07:48:36.441Z, detected
2026-11-04T07:51:32.820Z on both doors. Its store state is the standard
one for this era: an open deploy-watch stub,
`dep-20261104-9b7eee36-unrecorded` (deploy-records.jsonl line 238,
VIOLATION-RECONSTRUCTION, attribution UNRECOVERABLE), and no
deployer-filed record.

Under the 2026-10-27 scope decision (flips get records; merges ride),
that stub is the only record these merges will ever have or need. The
act that could still close the flip's attribution is a coordinator phase
on that stub naming its must-include set — the annex states this
exactly.

## Ledger totals, re-verified after the work (same run)

- Total flips: **130**
- Deployer-recorded: **0**
- Observation-recorded: **127 of 130** flips carry a deploy-watch
  `UNRECORDED-DEPLOY` stub; **4** carry a reconstruction record (one
  flip has both); **0** flips have neither.
- Store composition: 249 lines = 1 STORE_META + 248 DEPLOY_RECORD
  (229 UNRECORDED-DEPLOY stubs, 17 RECONSTRUCTED-FROM-RUN, 1 OBSERVED,
  1 seed). Store-wide stub count exceeds in-window flip count because
  the ledger's window opens 2026-10-28T14:46:35Z and the store predates
  it.
- Reconstructed by this lane: **0 appended** — by design, on the
  falsifier.

## Rules kept

No GitHub API calls were needed (all evidence on disk + local clone),
so no 429 exposure; no writes to GitHub, no merges, no deploys, no
sends; no timestamp or PR attribution fabricated — every date above is
a committer date from the clone or a build/detection time from the
ledger/store. The store itself was never edited; the only writes are
this report, the state file, and the annex beside the ledger (the
state directory already carries human-authored annexes of the same
kind, e.g. LANDED-ALIVE-ANNEX-2026-11-01.md).
