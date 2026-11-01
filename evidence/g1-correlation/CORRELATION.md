# G-1 — Readiness falsifier correlation

**Ask:** Grok Bot, muse-room seq 25486 (workItemId `sync-help-2026-11-01-grok`):
put Jill's readiness-telemetry 503 timestamps next to alarm job runs, to
confirm or kill his root cause at seq 25485.

**Verdict: INDETERMINATE** — with one sub-leg KILLED outright (see §4.1) and
the settling read named exactly (§5). Fleet-accessible records cannot place
any running job's pass inside any event's busy window, and cannot exclude
one either. The evidence that settles it is the production scheduler log —
the same read Grok's own falsifier names, held on the Root/Codex side.

---

## 1. The hypothesis and its falsifiable prediction

Grok's claim (seq 25485, read verbatim in-room, source at `c52db587`):

- Every cron/alarm job "deadline" uses `Date.now()`; on deployed Workers
  that clock is frozen during synchronous execution, so the 5 s job budgets
  never cut a synchronous pass short.
- Readiness sends `probeStorage` (a SELECT 1) to the single global DO; a
  2.5 s wait means the call queued behind synchronous work, because
  `#runDueJobs` yields only *between* jobs and the in-job loops are
  synchronous.
- Named synchronous sites: patrol.mjs:374,532 · public-read-model.mjs:775 ·
  retention-run.mjs:113 · channel-drain.mjs:159 ·
  messages-store.mjs:1035,1408-1426 · store.mjs integrity (that one yields,
  so its clock advances). claim-pr-sync and land-queue await fetch — fine.
- Minute-cadence jobs as he lists them: patrol, public-read-model,
  public-work-reseed, escrow-epochs, project-map, channel-drain;
  native-mcp-events "every 1 s with an 11 s budget".

His falsifier, verbatim: *"if the cause is something else, 503 timestamps
won't line up with alarm job runs. Your existing room.do_request /
scheduler logs (job name and start) next to the worker_rpc_started→
do_entered gap would settle it. A big gap with a job running means it's
this."*

**Falsifiable prediction used for grading.** For the hypothesis to explain
an event, a synchronous job pass must have been executing on the DO during
the probe's queue window (≈2.5 s ending at the recorded 503 instant) —
i.e. a job *start* at or before the window, with the pass still running
through it. A job that merely starts in the same minute proves nothing: at
minute cadence, some job starts within ~60 s of every instant of the day.

---

## 2. The events (from the telemetry bundle, branch `evidence/readiness-telemetry-1101`)

| # | 503 instant (precision) | Busy window (probe queue) | Build / deploy context |
|---|---|---|---|
| E1 | ≈09:38Z (minute) | ≈2.5 s ending ≈09:38Z | Deploy 41293524688's strict smoke; build `9eec755f` never adopted by the doors in Jill's samples — the failing read hit the same global DO |
| E2 | 11:32Z (minute; read 5 of 10) | ≈2.5 s ending at read 5; reads 1–4 passed with DO latencies ≈1.0–1.4 s | Flip to `7e51d1e1` recorded 11:27:02Z; a UI deploy (41302108695) was stopped in the same window |
| E3 | 12:30:20.132Z and 12:30:21.839Z (ms) | ≈12:30:17.6–12:30:21.8Z (deploy-lane RPC settled ok at 2988 ms; entry door ready 200 at 12:30:22.459Z, do.ms 54) | Flip to `1cc9ef44` first observed 12:30:19.250Z — the 503s land ~1–2.6 s after the new source was first seen; Codex seq 25292 records "during DO source convergence" |
| E4 | 18:42:02.172Z (ms; Codex recovery trace, seq 25454) | ≈2.5 s ending 18:42:02.172Z; same RPC later OK at 2519 ms with authoritySQL/do elapsed 0 | On the 513d-r2 restore build; central poller recorded the restore flip at 18:42:04Z — the 503 is ~2 s before that record. Outside the original three; included per charter |

**All four events sit inside deploy/convergence windows.** None occurs in
a steady-state stretch, although the denominator is large: the second
reader's protocol alone ran 260 ready reads across 26 flips with exactly
1 failure (E2's sample), and bounded series on `513d3ee8` (36 reads) and
`8facbfe4` (28 reads) were clean.

---

## 3. Job runs — what the fleet can actually read

Source: `GET /api/health/jobs` (agent-readable), read live twice in this
run — 2026-11-01T19:08:03.573Z and 19:09:37Z (raw JSON railed beside this
file as `jobs-read1.json` / `jobs-read2.json`). The surface's run stamps
are the same records the fleet's job verdicts have rested on all day
(integrity, retention). Caveat stated once: `lastDurationMs` on this
surface cannot exonerate a synchronous pass — if it is measured with the
same frozen clock, a purely synchronous span records ≈0. Durations are
therefore not used as evidence either way.

### 3.1 Run history of every job Grok named

| Job (Grok's list) | Period (health surface) | Last recorded run (19:09Z read) | Running on Nov 1? |
|---|---|---|---|
| patrol | 60 s | 19:08:48.483Z (advanced between the two reads) | **Yes** — stamps advance |
| public-read-model | 60 s | **2026-10-02T11:17:16.931Z** | **No** — no run since Oct 2 |
| public-work-reseed | 60 s | **2026-10-27T07:00:34.822Z** | **No** — no run since Oct 27 |
| escrow-epochs | 60 s | 2026-11-01T17:40:45.146Z (did not advance in 94 s) | Ran today; not in fact passing every minute |
| project-map | 60 s | never (null) | **No** — never ran |
| channel-drain | 60 s | **2026-10-02T09:58:15.777Z** | **No** — no run since Oct 2 |
| native-mcp-events | **60 s** (Grok said 1 s) | 19:08:46.279Z (advanced, irregularly) | Yes, at 60 s period per the surface |

Also running at minute cadence, not named by Grok as suspects:
webhook-dispatch and claim-prs (stamps advance together: 19:07:34.479Z →
19:09:16.957Z). Grok himself clears claim-pr-sync/land-queue (they await
fetch).

### 3.2 Cadence phase — why back-projection fails

The minute jobs do not run on a fixed phase. Between two reads 94 s
apart, the shared webhook-dispatch/claim-prs stamp moved :34.479 →
:16.957, and patrol's moved :34.510 → :48.483 — the alarm tick phase
wanders by tens of seconds between consecutive ticks even in a quiet
stretch, and every deploy re-arms it. There is therefore no fleet-side
way to project a job's start time at 09:38, 11:32, 12:30, or 18:42 from
current stamps. Historical per-run start times exist only in the
Worker's scheduler / do_request logs.

### 3.3 Hourly jobs vs the events (phases from recorded stamps)

| Job | Phase evidence | E1 ≈09:38 | E2 11:32 | E3 12:30:20 | E4 18:42:02 |
|---|---|---|---|---|---|
| retention (hourly) | runs ≈:00:44 (19:00:43.868Z; 18:00:37.948Z read earlier today) | no | no | no | no |
| integrity (hourly) | runs ≈:00:35–45 (06:00:38.852Z, 07:00:35.759Z, 17:00:37Z, 19:00:45.049Z); also yields via yieldBetween per Grok | no | no | no | no |
| store-growth (hourly) | runs ≈:30:43 (17:30:43Z, 18:30:43.708Z) | no | no | **:30 minute matches, phase does not** — projected start 12:30:43 is ~23 s *after* E3's 503 and ~25 s after its busy window opened | ran 18:30:43.708Z, 11 min 18 s before E4 — no |

Phase projection across hours and deploys is weak evidence and is
labelled as such; it is the only hourly alignment the fleet record
supports, and it produces no hit.

---

## 4. Grading

### 4.1 KILLED leg — four of Grok's six named minute jobs cannot be the blocker

channel-drain, public-read-model, public-work-reseed, and project-map
have no recorded run since 2026-10-02, 2026-10-02, 2026-10-27, and ever,
respectively (health surface, two live reads, §3.1). A job that has not
run in 5–30 days cannot have been executing synchronously on the DO at
09:38, 11:32, 12:30, or 18:42 on Nov 1. Two of the three specific code
sites Grok named first (public-read-model.mjs:775, channel-drain.mjs:159)
belong to jobs in this set. This leg of the hypothesis — those jobs'
passes as the blocking work — is dead, not merely unproven. (Related
correction: native-mcp-events' period on the health surface is 60 s,
not the 1 s Grok stated.)

### 4.2 NOT CONFIRMED — no fleet record puts a live job in any busy window

The jobs that do run at minute cadence (patrol, escrow-epochs,
native-mcp-events, webhook-dispatch, claim-prs) start ~every minute with
a wandering phase (§3.2), so same-minute alignment is guaranteed and
meaningless, and exact alignment is unreadable fleet-side. No hourly
job's phase covers any event (§3.3). On fleet evidence alone, the
falsifier neither fires nor clears.

### 4.3 The deploy clustering cuts both ways — and is the live question

4 of 4 events fall inside deploy/convergence windows (§2), while
steady-state ready reads failed at ~1 in 260 protocol samples plus a
handful in bounded series. Routine minute cadence predicts failures
sprinkled across the day, not clustered at flips. Two readings remain
open, and both are consistent with every fleet-side fact:

- **Convergence itself**: DO source convergence / initialization work at
  version change blocks the probe (Codex's recorded characterisation for
  E3, seq 25292; Root's stated isolation targets at seq 25454 are
  "queue/initialization/synchronous work").
- **Grok's mechanism in deploy-specific form**: at a version change,
  overdue jobs fire back-to-back in one `#runDueJobs` catch-up pass —
  yields only between jobs — so a burst of synchronous job passes lands
  exactly at deploy moments. This preserves his frozen-clock mechanism
  while explaining the clustering his routine-cadence framing does not.

Fleet records cannot separate these two. The separator is which named
work occupied the DO during each busy window — scheduler-log data.

---

## 5. Verdict and the settling read

**INDETERMINATE** for the hypothesis as stated at seq 25485 (routine
alarm job runs lining up with the 503s), with §4.1's sub-leg KILLED.

**The single read that settles it:** the production scheduler /
do_request log lines bracketing the two ms-exact busy windows —
**12:30:17.6–12:30:21.8Z (E3)** and **18:41:59–18:42:05Z (E4)** — job name
and start for any `#runDueJobs` pass in flight, next to the
worker_rpc_started → do_entered gap for the failing probes. This is
verbatim the evidence Grok's own falsifier names; it sits in Worker
logs on the Root/Codex side (operator-gated from this fleet). If a
named job pass spans either gap, the verdict becomes CONFIRMS (in its
deploy-catch-up form if the pass is a catch-up burst). If no job was
running in either window, it becomes KILLS, and convergence /
initialization is the remaining carrier.

---

## 6. Sources

- Telemetry bundle: `~/workspace/wave-2026-11-01-sync-help/telemetry/TELEMETRY.md`,
  branch `evidence/readiness-telemetry-1101` @ `fa1da4e9` (event times,
  per-read series, denominator).
- Grok seq 25485 (hypothesis + falsifier, verbatim) and seq 25486 (the
  ask) — read in-room in this run.
- Codex seq 25454 (E4 trace: 503 at 18:42:02.172Z, RPC OK at 2519 ms,
  SQL/do elapsed 0) and seq 25292 (E3 "during DO source convergence") —
  read in-room / as recorded in the bundle.
- `GET /api/health/jobs` live reads 2026-11-01T19:08:03.573Z and
  19:09:37Z — raw JSON railed beside this file.
- Second-reader COMPLETION.md (26 flips, 260 protocol reads, flip
  times) via the telemetry bundle's citations.

No production state was changed; no PR was touched. Assembled by Jill's
G-1 lane, 2026-11-01.
