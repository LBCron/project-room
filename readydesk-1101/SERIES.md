# READYDESK — readiness evidence series for the Root/Codex root-cause hunt

Run window: **2026-11-01T21:03:26.052Z → 2026-11-01T21:16:20.318Z** (13:03–13:16 PT).
Method: `/api/version` pinned on both doors (app `room.trydemigod.com`, entry `www.getdasha.com/room`) ×2 at start and ×2 at end; `/api/version` re-read before every `/api/ready` read so each read is bound to the build actually served at that moment; 30 ready reads at ~25 s spacing (not a burst). A build change mid-run closed Series 1 and opened Series 2, per charter. Classification per Hoeffding R4: a read taken <20 min after its build's buildId timestamp is a **convergence** fact; ≥20 min is a **health** sample. do-time is the response body's `do.ms`; wall is client-observed fetch time. Raw log: `run-log.jsonl` in this directory; runner: `run-series.mjs`.

## Pins

| phase | at (UTC) | door | status | sourceRevision | buildId |
|---|---|---|---|---|---|
| start-r1 | 2026-11-01T21:03:26.060Z | app | 200 | 0908cbcb76797601e878ee9f1f3b93bcb4afbfa1 | 2026-11-01T20:08:00.687Z |
| start-r1 | 2026-11-01T21:03:27.942Z | entry | 200 | 0908cbcb76797601e878ee9f1f3b93bcb4afbfa1 | 2026-11-01T20:08:00.687Z |
| start-r2 | 2026-11-01T21:03:28.743Z | app | 200 | 0908cbcb76797601e878ee9f1f3b93bcb4afbfa1 | 2026-11-01T20:08:00.687Z |
| start-r2 | 2026-11-01T21:03:28.839Z | entry | 200 | 0908cbcb76797601e878ee9f1f3b93bcb4afbfa1 | 2026-11-01T20:08:00.687Z |
| flip-to-series-2 | 2026-11-01T21:06:08.528Z | entry | 200 | bdeb01bdb889db40f2f025aeea92dc5beeb0cee7 | 2026-11-01T21:00:42.832Z |
| end-r1 | 2026-11-01T21:16:16.516Z | app | 200 | bdeb01bdb889db40f2f025aeea92dc5beeb0cee7 | 2026-11-01T21:00:42.832Z |
| end-r1 | 2026-11-01T21:16:17.520Z | entry | 200 | bdeb01bdb889db40f2f025aeea92dc5beeb0cee7 | 2026-11-01T21:00:42.832Z |
| end-r2 | 2026-11-01T21:16:18.524Z | app | 200 | bdeb01bdb889db40f2f025aeea92dc5beeb0cee7 | 2026-11-01T21:00:42.832Z |
| end-r2 | 2026-11-01T21:16:19.617Z | entry | 200 | bdeb01bdb889db40f2f025aeea92dc5beeb0cee7 | 2026-11-01T21:00:42.832Z |

Doors AGREE at start and at end.

**Flip detected 2026-11-01T21:06:08.528Z**: `0908cbcb76797601e878ee9f1f3b93bcb4afbfa1` (buildId 2026-11-01T20:08:00.687Z) → `bdeb01bdb889db40f2f025aeea92dc5beeb0cee7` (buildId 2026-11-01T21:00:42.832Z). From this vantage the old build was still served at the 21:05:42.768Z read and the new build at 21:06:08.528Z, so the served-transition bracket is **21:05:42.768Z–21:06:08.528Z**; the new build's own timestamp is 21:00:42.832Z.

## Series 1 — sourceRevision 0908cbcb76797601e878ee9f1f3b93bcb4afbfa1 · buildId 2026-11-01T20:08:00.687Z

All 6 reads are health samples (build age 55.5–57.7 min).

| i | at (UTC) | status | do.ms | wall ms | do status | build age (min) | class |
|---|---|---|---|---|---|---|---|
| 1 | 2026-11-01T21:03:31.150Z | 200 | 12 | 70 | ok | 55.5 | health |
| 2 | 2026-11-01T21:03:56.723Z | 200 | 1680 | 1722 | ok | 55.9 | health |
| 3 | 2026-11-01T21:04:24.164Z | 200 | 20 | 159 | ok | 56.4 | health |
| 4 | 2026-11-01T21:04:50.240Z | 200 | 42 | 184 | ok | 56.8 | health |
| 5 | 2026-11-01T21:05:16.657Z | 200 | 250 | 305 | ok | 57.3 | health |
| 6 | 2026-11-01T21:05:42.768Z | 200 | 67 | 151 | ok | 57.7 | health |

Series 1: **6/6 × 200, zero failures.** Max do.ms 1,680 (read 2) — elevated, under the 2,500 ms timeout signature, returned 200.

## Series 2 — sourceRevision bdeb01bdb889db40f2f025aeea92dc5beeb0cee7 · buildId 2026-11-01T21:00:42.832Z

All 24 reads are convergence facts (build age 5.5–15.6 min; the build's 20-minute convergence window ends 2026-11-01T21:20:42.832Z, after this series closed).

| i | at (UTC) | status | do.ms | wall ms | do status | build age (min) | class |
|---|---|---|---|---|---|---|---|
| 1 | 2026-11-01T21:06:09.842Z | 200 | 66 | 172 | ok | 5.5 | convergence |
| 2 | 2026-11-01T21:06:35.473Z | 200 | 47 | 140 | ok | 5.9 | convergence |
| 3 | 2026-11-01T21:07:01.332Z | 200 | 20 | 76 | ok | 6.3 | convergence |
| 4 | 2026-11-01T21:07:27.315Z | 200 | 42 | 128 | ok | 6.7 | convergence |
| 5 | 2026-11-01T21:07:53.354Z | 200 | 76 | 166 | ok | 7.2 | convergence |
| 6 | 2026-11-01T21:08:18.953Z | 200 | 118 | 173 | ok | 7.6 | convergence |
| 7 | 2026-11-01T21:08:44.526Z | 200 | 44 | 491 | ok | 8.0 | convergence |
| 8 | 2026-11-01T21:09:11.193Z | 200 | 181 | 1213 | ok | 8.5 | convergence |
| 9 | 2026-11-01T21:09:38.013Z | 200 | 9 | 98 | ok | 8.9 | convergence |
| 10 | 2026-11-01T21:10:03.444Z | 200 | 44 | 96 | ok | 9.3 | convergence |
| 11 | 2026-11-01T21:10:29.740Z | 200 | 471 | 582 | ok | 9.8 | convergence |
| 12 | 2026-11-01T21:10:57.118Z | 200 | 238 | 312 | ok | 10.2 | convergence |
| 13 | 2026-11-01T21:11:23.111Z | 200 | 18 | 105 | ok | 10.7 | convergence |
| 14 | 2026-11-01T21:11:48.650Z | 200 | 1012 | 1052 | ok | 11.1 | convergence |
| 15 | 2026-11-01T21:12:15.057Z | 200 | 43 | 161 | ok | 11.5 | convergence |
| 16 | 2026-11-01T21:12:41.020Z | 200 | 501 | 597 | ok | 12.0 | convergence |
| 17 | 2026-11-01T21:13:08.527Z | 200 | 44 | 111 | ok | 12.4 | convergence |
| 18 | 2026-11-01T21:13:34.823Z | 200 | 107 | 195 | ok | 12.9 | convergence |
| 19 | 2026-11-01T21:14:00.732Z | 200 | 695 | 889 | ok | 13.3 | convergence |
| 20 | 2026-11-01T21:14:27.720Z | 200 | 80 | 208 | ok | 13.7 | convergence |
| 21 | 2026-11-01T21:14:54.218Z | 200 | 827 | 902 | ok | 14.2 | convergence |
| 22 | 2026-11-01T21:15:21.247Z | 200 | 333 | 396 | ok | 14.6 | convergence |
| 23 | 2026-11-01T21:15:47.446Z | 200 | 1563 | 1669 | ok | 15.1 | convergence |
| 24 | 2026-11-01T21:16:16.224Z | 200 | 198 | 288 | ok | 15.6 | convergence |

Series 2: **24/24 × 200, zero failures.** Slow tail: reads 11 (471 ms), 14 (1,012 ms), 16 (501 ms), 19 (695 ms), 21 (827 ms), 23 (1,563 ms) — six reads ≥471 ms, clustering 21:10:29Z–21:16:16Z, none reaching the 2,500 ms timeout.

## Totals

- **30/30 × 200, zero failures, zero 503s** across both series.
- Classification: 6 health samples (Series 1) + 24 convergence facts (Series 2).
- No window of 10 consecutive reads holds >1 failure (there are no failures), so the ready-ping rule never engaged and `ready-ping.mjs` was **not** run; no ping artefact exists.
- This run does not retire the intermittent 503 defect: it is one clean window. Notably it stayed clean through a live flip's convergence window, where the defect usually clusters — but Series 2's elevated do.ms tail shows the DO latency pressure present in that window without tripping the timeout this time.

## For the Root/Codex log hunt (correlation brackets)

- New build timestamp: **2026-11-01T21:00:42.832Z** (`bdeb01bdb889db40f2f025aeea92dc5beeb0cee7`).
- Served-transition bracket from this vantage: **21:05:42.768Z–21:06:08.528Z**.
- Slowest-read cluster in the new build's convergence window: **21:10:29.740Z–21:16:16.224Z** (do.ms 471–1,563).
- Old build's one slow health read: **21:03:56.723Z** (do.ms 1,680) on `0908cbcb` / buildId 2026-11-01T20:08:00.687Z.
- Scheduler / do_request logs bracketing 21:00:42Z through 21:16:20Z would cover the build, the transition, and the slow cluster end to end.
