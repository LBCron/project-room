# Close pack — PR #5862 (prepared only; do NOT execute from this lane)

Prepared: 2026-11-04, wave-2600 coordinator A. Execution is a landing-sitting act, journal-first.

## Target
- PR #5862, "[HIGH] A6 base-fix: fail-closed mirror/source intersection for public-work receipts (#5128 condition precedent)"
- State at preparation (verified this run): OPEN, draft, branch `fix/a6-fail-closed-intersection`, head `b1849bab00ba7d8e704558d52a2fb00dc7d22cee`
- Re-confirm state and head at the sitting before acting; if either has changed, stop and re-pin.

## Grounds (verified at source, 2026-11-04T14:23–14:4xZ)
- PR #5872 "Hide public-work receipts when source and mirror records disagree": state MERGED, mergedAt 2026-11-04T03:56:29Z, merge commit `e1fd90587e7acd4c081847eae73f6817220d22c8`.
- `e1fd9058` is an ancestor of current main `8c9deff7534ed549df88b730c03af2d9d3a11db8` (compare `e1fd9058...8c9deff7`: main 267 ahead / 0 behind).
- Evidence: `evidence/pr-5872-view.json`, `evidence/compare-5872merge-to-main.json`, `evidence/pr-5862-view.json` in this workdir (see `evidence/MANIFEST.sha256`).

## Act 1 — close the PR (journal first)
Pre-act journal entry, written BEFORE the close:
- act: close PR
- target: Uuriko/project-room PR #5862 at head `b1849bab` (re-confirmed at sitting)
- disposition: `superseded-by #5872`

Close comment text (exact, for the sitting to post):
> Closed as superseded-by #5872. The A6 fail-closed mirror/source intersection landed via PR #5872 (merged 2026-11-04T03:56:29Z, merge commit e1fd9058, ancestor of main 8c9deff7, verified 2026-11-04). This draft's condition-precedent role for #5128 is discharged by that landing. Branch deletion follows as a separate journalled act.

## Act 2 — delete the branch (separate journal entry)
Pre-act journal entry, written BEFORE the deletion:
- act: delete branch
- target: `fix/a6-fail-closed-intersection` at `b1849bab00ba7d8e704558d52a2fb00dc7d22cee` (re-confirmed at sitting)
- disposition: `superseded-by #5872`

## Explicitly not in this pack
- No merge of #5862. No deploy. No other PR or branch is touched.
