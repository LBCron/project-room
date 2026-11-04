# Census Ridealong — Wave-2700 Cohort C05 Open-PR Census (2026-11-04)

Source: `~/workspace/wave-2700-2026-11-04/coordinator-c05-pr-census/CENSUS.md` (refreshed 2026-11-04), repo Uuriko/project-room. Extraction only — all figures copied from CENSUS.md as written; no new GitHub reads. This section rides with the supplement to the wave-2600 Codex landing packet so the sitting sees the whole board, not just the spine.

## 1. Population and method

The census read **655 of 655** open PRs fresh (one `gh pr list` call for the population; one `gh pr view` per PR across 10 lanes, in priority order: labelled → non-draft → drafts). Composition at pull: 396 labelled `ready-to-land`, 531 non-draft, 124 drafts. Unread remainder: none. Mergeable UNKNOWN after detailed views: **0 of 655**. Strict bar (as chartered): LANDABLE requires non-draft, MERGEABLE/CLEAN at the exact head, zero FAILED jobs, zero NOT-RUN jobs among those present, activity within 14 days; NOT-RUN is never green.

Grades under that bar:

| Grade | Count |
|---|---|
| LANDABLE | **0** |
| NEEDS-WORK | **655** |
| STALE-CLOSE-CANDIDATE | **0** |

STALE-CLOSE-CANDIDATE = 0 is vacuous, not a finding of freshness: the staleness rule needs 30+ days without activity, but **every** PR in the backlog has an `updatedAt` within ~12 days of the census, including the oldest tail — an artefact of the October `ready-to-land` label batch (and similar bulk touches) refreshing `updatedAt` across the backlog. The census therefore graded none stale rather than pretend `updatedAt` separates abandoned from touched-but-idle; a future staleness pass needs a different signal (last commit date on the head branch, or last non-bot comment). [CENSUS.md §1, §2, §4]

## 2. Structural counts — why the shutout is structural

- **373 of 655** PRs are CONFLICTING (mergeStateStatus DIRTY) against current main.
- Only **127** are MERGEABLE at all — **98 CLEAN**, 29 UNSTABLE; 0 UNKNOWN.
- **170** PRs carry at least one FAILED CI job (most often `test` and `unit`). Aggregate rollup entries as present: 8,312 PASSED / 524 FAILED / 8,765 NOT-RUN.
- **Every one of the 655 rollups contains NOT-RUN jobs.** The universal floor is the same four: `quarantined-tests` SKIPPED, `full` SKIPPED, `coverage` SKIPPED, and the Cursor Approval check at NEUTRAL. Zero-NOT-RUN is unattained anywhere in the backlog, so even the 98 clean PRs cannot clear the strict bar.
- Consequence: the `ready-to-land` label is evidence-supported for **none** of its **396** PRs.

[CENSUS.md §1, §2]

## 3. Actionable output — the 98-PR re-check set and the ruling question

The census's actionable output is a **98-PR re-check set**: MERGEABLE + CLEAN + zero FAILED jobs at the exact head read 2026-11-04, blocked **solely** by NOT-RUN (skipped/neutral) jobs. It was computed mechanically from all 655 graded rows, not summed from lane prose.

**Where the full list lives:** CENSUS.md **§3, "The re-check set — 98 PRs (the sitting's working list)"** — the 98 PR numbers in full, ordered highest PR number first (5898, 5877, 5858, … 4066). Note carried in §3: #5492 sits in this set on census evidence; it is a wave-2600 spine item and remains governed by the wave-2600 packet, not by this set.

**The ruling question, in the census's own framing** — CENSUS.md §3, verbatim:

> "If a sitting rules the standing SKIPPED set (quarantined-tests / full / coverage) plus the NEUTRAL approver as non-gates — that ruling was NOT applied in this census — these 98 are the PRs that flip first"

*Lane-07 summary (not census wording):* the sitting must decide whether that standing skipped/neutral set gates landing. If it rules the set non-gating, these 98 flip first; defining the required-checks set is the landing-phase decision the census leaves to the sitting (its named consumer is Codex's landing sittings). The census itself applied no such ruling — under the strict bar as chartered, all 98 remain NEEDS-WORK.

## 4. Flagged anomalies (sitting's awareness)

- **#5032 / #5007** — outsized diffs, both CONFLICTING with FAILED jobs: #5032 (+36,325/−1,562, 878 files) and #5007 (+36,638/−2,005, 870 files).
- **#4810** — +40,663/−0 across 5 files under a test-infra title; **in the re-check set** on CI state, but its diff shape deserves a human read before any landing.
- **#4960** — 0 additions / 0 deletions / 0 changed files at its head, yet MERGEABLE/CLEAN — an empty-diff PR **in the re-check set**; verify it still has a purpose before landing.
- **#3399** — updated on census day itself and still carries 2 FAILED jobs with UNSTABLE state.

[CENSUS.md §6; #3641's near-empty rollup (0/0/1) despite the `ready-to-land` label is also noted there.]

## 5. Consistency with the wave-2600 packet

Spine items graded on census evidence agree with the wave-2600 packet's own account; landing order stays with the packet: #5128 NEEDS-WORK (CONFLICTING/DIRTY, CI 18/0/32), #5063 NEEDS-WORK (UNSTABLE, 3 FAILED incl. gates/unit/test), #5861 NEEDS-WORK (draft, conflicting), #5862, #5805, #5919 NEEDS-WORK (drafts). Standing records also consistent: **#4900** NEEDS-WORK (MERGEABLE/UNSTABLE, 15/2/4) — consistent with the standing keep-OUT posture; **#4951** NEEDS-WORK (CONFLICTING, 10/2/5) — consistent with its parked standing record. [CENSUS.md §5]

## 6. Tooling caveat (methods note)

No real GitHub 429 occurred at any point (core rate limit 4900/5000 at pull, 4895/5000 mid-run); three lanes (01, 04, 10) independently false-triggered a "429 stop" by substring-matching `429` inside check-run IDs in successful JSON payloads, self-corrected to stderr/rate-limit-phrase detection, and disclosed it — fetch tooling fleet-wide should never substring-match payloads for rate-limit detection. [CENSUS.md §1, §7]

---
*Lane-07, wave-2700 coordinator LANDING-SUPPLEMENT. Falsifier for this extraction: any number or claim above differing from CENSUS.md as written. None found — the brief's figures match the file in every particular checked.*
