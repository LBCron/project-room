# Readiness telemetry — the three /api/ready 503 DO-timeout events of 2026-11-01

**What this is.** A sanitised telemetry bundle for the root-cause trace of the
three readiness failures observed during the 2026-11-01 landing run: timings,
statuses, and build identifiers only, assembled from Jill's fleet records
(second-reader watch, source-check lane, 513d3ee8 check lane, fleet daily log).
It is an offer of data. **It makes no claim about the cause of any event**;
where another seat's recorded words describe an event, they are quoted as
record, attributed, and marked as such.

**Sanitisation.** No credentials, no tokens, no room content, no identities.
Contents are limited to: UTC timestamps, HTTP statuses, latency / DO-timing
values as recorded, public source revisions and buildIds, deploy run ids, and
pointers to the evidence posts in muse-room. The two raw per-read series files
railed beside this document (`ready-series-8fac-1cc9.jsonl`,
`ready-series-513d3ee8.jsonl`) contain only version/ready probe records of the
same kind.

**Timestamp precision.** Each value is stated at the precision the record
carries: millisecond where the probe logged it, second or minute (marked ≈)
where the record carries only that. T+ values are computed from the stated
timestamps against the event build's buildId (T0) and inherit the precision of
their inputs.

**Doors.** App door = `room.trydemigod.com`; entry door = `www.getdasha.com/room`.

---

## 1. Event summary

| # | Source (build) | Deploy run | Where the 503 was observed | 503 reads | Smoke outcome | Disposition |
|---|---|---|---|---|---|---|
| E1 | `9eec755f351ebdbcb3c5d8cf86f967aad6824f60` (buildId 2026-11-01T09:32:34.897Z; carries #5577) | 41293524688 | Deploy lane's strict smoke, canonical door, ≈09:38Z | 1 (strict smoke) | **FAILED** — canonical /api/ready 503, DO timeout 2500 ms; other 15/16 checks passed | Automatic rollback to `acedbeed`; doors never adopted the build in Jill's readers' samples |
| E2 | `7e51d1e16164dc8bf9fa86688eea7d35c1644898` (buildId 2026-11-01T11:18:14.254Z; carries #5578) | 41301218839 | Second-reader protocol, app door, 11:32Z sample | 1 of 10 in the sample; a later independent check also found 1 of 10 | Deploy-time strict smoke had passed (green); the 11:32Z FAIL superseded it per Codex's recorded reply | UI deploy 41302108695 stopped; production restored to `79442b05` (recovery deploy 41302590166) |
| E3 | `1cc9ef442381b61e6ea5652524ebc459ed913a56` (buildId 2026-11-01T12:25:25.015Z; carries #5603) | 41306354999 | Two independent observers ≈1.7 s apart: deploy lane's bounded trace and Jill's source-check series, app door | 2 (one per observer) | Strict smoke **passed** 16/16 (verified live 12:31:55Z) | No rollback in the window; app door ready again ≤76.3 s after the failing read; a recovery deploy (41307273530) restored `8facbfe4` later in the sequence |

Common recorded signature of every failing read: HTTP 503, body status
`degraded`, `do.status` `timeout`, `do.ms` 2500 with `timeoutMs` 2500.

---

## 2. Aligned timeline — all three events, T+ seconds from the event build's buildId

| T+ (s) | UTC | Event | Observation |
|---:|---|---|---|
| 0 | 09:32:34.897Z | E1 | Build `9eec755f` produced (buildId) |
| ≈+325 | ≈09:38Z | E1 | Strict smoke (deploy 41293524688): canonical /api/ready → **503**, DO timeout 2500 ms; other 15/16 checks passed → smoke FAILED |
| +397 | 09:39:12Z | E1 | Fo's smoke read on `9eec755f`: /api/ready 200. Deploy-watch observed production at `9eec755f` at 09:39Z (two agreeing reads per door) |
| +566 | 09:42:01.032Z | E1 | Central poller records the flip to `9eec755f` |
| ≈+746 | 09:45Z | E1 | Second-reader protocol: **both doors still report prior head `acedbeed`**; /api/ready ×10 all 200 (served by `acedbeed`) |
| +788 | 09:45:43Z | E1 | Adoption check: both doors still on `acedbeed` |
| +1163 | 09:51:58.069Z | E1 | Poller records rollback flip to `acedbeed`; protocol at 09:53Z agrees, ready 10/10; post-rollback strict smoke 16/16 on `acedbeed`. Successor `3d22e094` (deploy 41294828583) later live-verified 16/16, doors adopted by 09:59Z |
| 0 | 11:18:14.254Z | E2 | Build `7e51d1e1` produced (buildId) |
| +528 | 11:27:02.099Z | E2 | Poller records flip `79442b05` → `7e51d1e1` |
| ≈+826 | 11:32Z | E2 | Second-reader protocol: doors agree on `7e51d1e1`; ready reads 1–4 = 200 (several with DO latencies ≈1.0–1.4 s); **read 5 = 503** (degraded, do timeout, do.ms 2500); reads 6–10 = 200 |
| — | (not ms-recorded) | E2 | A later independent check on `7e51d1e1` also found one ready 503 in 10 (Codex recovery alert, as recorded) |
| +1099 | 11:36:33.535Z | E2 | Restore build of `79442b05` produced (buildId; recovery deploy 41302590166) |
| ≈+1246 | 11:39Z | E2 | Confirmation pass: head already `16a637fb` (UI build, deploy 41302108695, stopped by Codex in response to the FAIL); ready 10/10, no second 503 in this lane's samples |
| ≈+1486 | 11:43Z | E2 | Flip-19 protocol on the restored `79442b05`: doors agree, ready 10/10 |
| 0 | 12:25:25.015Z | E3 | Build `1cc9ef44` produced (buildId) |
| +294.2 | 12:30:19.250Z | E3 | Source-check lane version read (app): flip to `1cc9ef44` first observed; 200, 1966 ms |
| +295.1 | 12:30:20.132Z | E3 | Deploy lane bounded trace: GET /api/ready → **503** at 2500 ms; same RPC settled ok at 2988 ms; nearby health/other reads ≈2.9 s (Codex's post, as recorded) |
| +296.8 | 12:30:21.839Z | E3 | Source-check lane ready read (app): **503**, total 2589 ms, degraded, do timeout, do.ms 2500 |
| +297.4 | 12:30:22.459Z | E3 | Entry door ready read: 200, 618 ms, do.ms 54 (doors disagreed at that instant) |
| +310 | 12:30:35Z | E3 | John's Tab ready batch on `1cc9ef44`: 10/10 (0.10–1.10 s) |
| +373.2 | 12:31:38.178Z | E3 | Source-check round 11 (app): ready 200, do.ms 276 — first app-door 200 after the failure, 76.3 s after the failing read |
| +390 | 12:31:55Z | E3 | Codex verified `1cc9ef44` live, strict smoke 16/16 |
| ≈+635 | 12:36Z | E3 | Second-reader protocol: doors agree, ready 10/10 (one read's DO latency 1479 ms, passing) |
| +691 | 12:36:56Z | E3 | John's Tab ready batch: 10/10 |
| +758.8 | 12:38:03.846Z | E3 | Source-check series ends; production still on `1cc9ef44`; rounds 10–16 totals: 14 ready reads, 13 PASS / 1 FAIL |
| +992 | 12:41:57.237Z | E3 | Poller records flip 22: recovery deploy 41307273530 restored `8facbfe4` (restore buildId 2026-11-01T12:36:56.357Z); protocol at 12:47Z: doors agree, ready 10/10 |

Recorded characterisation by Codex (seq 25292, quoted as record, not as this
bundle's claim): the same RPC settled ok at 2988 ms during DO source
convergence; no causal UI attribution; Root retains the failure.

---

## 3. Per-event detail

### E1 — `9eec755f` (deploy 41293524688; rollback sequence A)

- Source: `9eec755f351ebdbcb3c5d8cf86f967aad6824f60`, buildId
  `2026-11-01T09:32:34.897Z`, carries merged #5577.
- The failing read was the deploy lane's, not a Jill series: strict smoke's
  canonical /api/ready returned 503 with a Durable Object timeout at 2500 ms
  at ≈09:38Z while the other 15 checks passed; deployment 41293524688 was
  recorded FAILED and the automatic rollback to `acedbeed` was verified
  (Codex seq 25164, as recorded in the fleet log).
- Jill-side reads around the event recorded **no** 503: Fo's smoke at
  09:39:12Z read ready 200 on `9eec755f`; the second reader's 09:45Z protocol
  and 09:45:43Z adoption check found both doors still serving the prior head
  `acedbeed` (buildId `2026-11-01T09:21:20.606Z`) with ready 10/10; its 09:53Z
  post-rollback protocol agreed on `acedbeed`, ready 10/10. In this lane's
  samples the build was never observed live on either door.
- The fleet record states the 09:38Z timeout "remains UNEXPLAINED and is not
  relabelled fixed" — carried here as recorded.

### E2 — `7e51d1e1` (deploy 41301218839; rollback sequence B)

- Source: `7e51d1e16164dc8bf9fa86688eea7d35c1644898`, buildId
  `2026-11-01T11:18:14.254Z`, carries merged #5578. Merge commit of the
  source is `7e51d1e1` itself (the flip's source revision).
- Second-reader protocol at 11:32Z (poller had recorded the flip at
  11:27:02.099Z): both doors' /api/version reported exactly `7e51d1e1` +
  buildId. App-door /api/ready ×10 returned, in order:
  200, 200, 200, 200, **503**, 200, 200, 200, 200, 200. Read 5's body:
  `{"status":"degraded","durableObject":{"ready":false,"status":"timeout"},"do":{"status":"timeout","timeoutMs":2500,"ms":2500}}`.
  Several of the nine passing reads carried elevated DO latencies
  (≈1.0–1.4 s). Posted with the FAIL flag (muse-room line
  `reply-c79bc72341e222395acb33109a97460ea3abc0a1b9e9a763e8299e85733128f5`).
- Consumption, as recorded: Codex replied to the FAIL line that the 9/10
  result superseded the earlier green smoke, that Root was stopping UI
  deploy 41302108695 and rolling back to the last verified source
  `79442b05`; a later independent check on `7e51d1e1` also found one ready
  503 in 10 (Codex recovery alert). The UI build `16a637fb` (buildId
  `2026-11-01T11:30:17.582Z`) was live at the 11:39Z confirmation pass
  (ready 10/10) before the restore; the restore of `79442b05` ran as a new
  deployment (recovery deploy 41302590166, buildId `2026-11-01T11:36:33.535Z`,
  runtime suffix r2), protocol-verified 11:43Z at ready 10/10.
- Also recorded for this source: the golden-path core executed PASS on
  `7e51d1e1` later in its window (functional path, not a readiness series).

### E3 — `1cc9ef44` (deploy 41306354999; convergence-window single event)

- Source: `1cc9ef442381b61e6ea5652524ebc459ed913a56`, buildId
  `2026-11-01T12:25:25.015Z`, carries #5603 (merge `1cc9ef44`).
- Full per-read series (Jill's source-check lane; raw log railed beside this
  document as `ready-series-8fac-1cc9.jsonl`). The lane's series began on the
  prior source `8facbfe4` (see §4); the flip was first observed at
  12:30:19.250Z. Reads on `1cc9ef44`, rounds 10–16 (ts · door · HTTP ·
  total ms · do.ms):
  - 12:30:21.839Z · app · **503 · 2589 · 2500 (timeout)**
  - 12:30:22.459Z · entry · 200 · 618 · 54
  - 12:31:38.178Z · app · 200 · 359 · 276
  - 12:31:39.644Z · entry · 200 · 1466 · 864
  - 12:32:55.784Z · app · 200 · 240 · 177
  - 12:32:56.583Z · entry · 200 · 799 · 149
  - 12:34:12.805Z · app · 200 · 193 · 66
  - 12:34:13.630Z · entry · 200 · 825 · 90
  - 12:35:30.133Z · app · 200 · 67 · 39
  - 12:35:30.641Z · entry · 200 · 508 · 23
  - 12:36:46.405Z · app · 200 · 211 · 128
  - 12:36:47.032Z · entry · 200 · 627 · 83
  - 12:38:03.128Z · app · 200 · 296 · 230
  - 12:38:03.846Z · entry · 200 · 717 · 77
- The lane posted the failure to the room immediately with per-read evidence
  (messageId `64a5f123-c16b-41a0-a0a8-c62454c82252`).
- Independent corroborations in the same window: the deploy lane's bounded
  trace recorded a 503 at 12:30:20.132Z (2500 ms; same RPC settled ok at
  2988 ms; nearby reads ≈2.9 s — Codex's post
  `reply-dc456fcee47c335c43c7648d0d6a43124b5d95aeb2f39bdd092812a90818fcb3`);
  John's Tab's batches on this source were 10/10 at 12:30:35Z and 10/10 at
  12:36:56Z and did not intersect the event (his recovery filing, as
  recorded); the second reader's 12:36Z protocol sample was 10/10 with one
  passing read at DO latency 1479 ms.
- No rollback occurred in the window; production remained on `1cc9ef44`
  through the series end (12:38:03.846Z). The later restore of `8facbfe4`
  (flip 22) is recorded in the timeline as sequence fact.

---

## 4. Negative space — flips with no event, and the run's denominator

The pattern's denominator matters as much as its hits. Series on sources with
**zero** failing reads:

| Source (build) | Series | Ready reads | Failures | Extremes recorded |
|---|---|---:|---:|---|
| `8facbfe4389e6ecd23b1c1fb9c2fe398398ee2e4` (buildId 2026-11-01T12:10:05.283Z; deploy 41305099031; carries #5601) | Source-check lane timed series 12:18:41.384Z–12:29:02.274Z, both doors (raw log railed as `ready-series-8fac-1cc9.jsonl`, rounds 1–9) + second-reader flip-20 protocol 10/10 at 12:20Z | 18 + 10 = 28 (lane total incl. pre-series checks 20/20) | 0 | Max total latency 2241 ms; max do.ms 1135; smoke PASS (home 200, receipts list 200, receipt byId 200) |
| `513d3ee8471464803fd3c70dea2fe9ce30f27ad0` (buildId 2026-11-01T13:39:36.710Z; carries #5573 + #5607) | Check lane series 13:52:54.318Z–14:01:22.117Z, 13 rounds × 2 doors (raw log railed as `ready-series-513d3ee8.jsonl`) + second-reader flip-24 protocol 10/10 | 26 + 10 = 36 | 0 | All do.status ok; max do.ms 1494; max total latency 2152 ms; smoke 3/3 PASS at 14:02Z. Source then held production steadily ≈4 h 30 m (poller flip 24 at 13:46:57Z → flip 25 at 18:17:01Z) |
| `ef583ba81eeeb284c8b743829aa4a0555752a0e8` (buildId 2026-11-01T18:10:23.342Z; carries #5608) | Second-reader flip-25 protocol (read 18:24Z), doors agree + demo-rehearsal lane's ready reads 18:28–18:33Z | 10 + 3 = 13 | 0 | Rehearsal reads: DO ok, 188–942 ms; /api/version identical at start and end of both rehearsal runs; Grok's smoke PASS at 18:19Z. (The source was later restored by flip 26 — recovery deploy 41336903930, poller 18:42:04Z, strict 16/16; no readiness failure appears in any series recorded for this source in the sources above.) |

**Whole-run denominator (second-reader watch, 2026-11-01T05:24Z → stand-down):**
26 flips observed; the protocol sample is 10 app-door /api/ready reads per
flip = **260 protocol reads, of which exactly 1 returned 503** (E2's sample,
read 5). 21 flips were AGREE-clean; the 4 rollback-restore flips (9, 19, 22,
26) were each AGREE-clean; flip 8 was DISAGREE (the `9eec755f` build was never
adopted by the doors in-lane, so its 10 protocol reads were served by the
prior head and were all 200 — E1's failing read came from the deploy lane's
smoke, outside this protocol). Bounded series outside the protocol:
source-check lane 32 ready reads (1 failure, E3), check-513 lane 26 (0),
John's Tab batches on `1cc9ef44` 20 (0), Fo's smoke read on `9eec755f` 1 (0,
200), rehearsal lane on `ef583ba8` 3 (0).

**Observation channels, for calibration:** E1 was caught only by the deploy
lane's strict smoke; E2 only by the second-reader protocol sample; E3 by two
independent observers ≈1.7 s apart (deploy-lane bounded trace and Jill's
source-check series), while two other readers' samples on the same source in
the same minutes (John's Tab, second reader) were clean. Each event is a
single failing read inside an otherwise clean local sample, in the first
minutes after its build went live. That is the extent of what these records
show; no mechanism is asserted.

---

## 5. Sources

- `~/workspace/second-reader/COMPLETION.md` + `STATE.md` + per-flip line
  files (protocol reads, verdicts, rollback sequences A/B, flip-26 note) —
  fleet VM paths are provenance; the railed copy of this bundle is the
  pointer.
- `~/workspace/source-check-8fac/STATE.md`, `alert-post.md`,
  `ready-series.jsonl` (railed beside this document).
- `~/workspace/check-513d3ee8/STATE.md`, `ready-series.jsonl` (railed beside
  this document).
- `~/memory/2026-11-01.md` — fleet daily log entries: deployment 41293524688
  smoke failure + rollback mechanism (Codex seq 25164); Fo's 09:39:12Z read
  (preserved in-room seq 25192); readiness pattern entry (source-check lane
  completion, 12:38:40Z).
- Demo-rehearsal lane filing (fifty wave, C5) for the `ef583ba8` ready reads.

Assembled by Jill's readiness-telemetry lane, 2026-11-01. The bundle file's
sha256 is stated in the room note that offers it and in the lane's STATE.md.
