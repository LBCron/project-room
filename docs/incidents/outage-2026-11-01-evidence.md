# Prod outage 2026-11-01: evidence (read-only, Grok Bot)

All times are PT. This is evidence only. No code, deploy or storage changes.

## Serving build
- bbb8b348, build 2026-11-01T23:47:00.477Z, scriptVersion 80c8b834 (confirmed in wrangler tail).

## Runtime errors (wrangler tail, sampled for 90 s, about 5:40 to 5:42 PM)
73 events were captured:

| Outcome | Execution model | Count |
|---|---|---|
| canceled | stateless | 32 |
| ok | stateless | 28 |
| ok | durableObject | 8 |
| exceededWallTime | durableObject | 4 |
| canceled | durableObject | 1 |

Errors:
- Exception x12: `Durable Object storage operation exceeded timeout which caused object to be reset.`
- Log x5: `[room] request failed at Durable Object boundary`.
- `/api/ready`: 503 after 2500 ms (the probe budget). `/muse-room/stream`: 503 after 38 s.
- One waitUntil task was cancelled.
- Max wall time 41 s. Reported CPU time is about 0 ms (cpuMeasured false).

Error categories:
- A storage-operation timeout followed by a DO reset (a reset loop).
- Exceeded wall time.
- No CPU-limit or memory-limit exceptions were seen.

Cold starts still succeed quickly: schema rowsRead 885 and plugin rowsRead 1263. Some muse-room GETs return 200, so the object comes up and then gets reset when a storage operation hangs.

## Onset window, 3:46 to 4:39 PM
- 3:46 PM: deploy-prod run 41363708931 deployed bbb8b348. Its smoke passed.
- 4:39 PM: deploy-prod run 41368304589 redeployed the same source. Its stated reason was "DO RPC/account/consent timeouts".
  - At 4:41 PM, ready was 200 (DO ok in 273 ms) but health was degraded with jobs_stale. Strict smoke failed, and the recovery step rolled back to 80c8b834.
- The per-request runtime logs from the onset window are not retrievable read-only. wrangler tail is live only, and the workflows capture smoke JSON, not runtime logs. Workers Observability in the dashboard would have them.

## Application regression vs storage/platform failure
- Cloudflare status page: the only incident since Oct 31 was a CDN cache purge in China, resolved Oct 31. There was no Workers, DO or D1 incident on Nov 1.
- The 4:39 PM redeploy recovered only briefly. ready was green at 4:41 PM, and the DO times out again later.
- The failure type is storage-operation timeouts, not CPU or memory. Either one storage operation or transaction is too large or slow, or the DO's SQLite store is too big for it.
- #5651 (6a64ad30..bbb8b348) has no storage, migration or binding changes. It does change event recovery (commit 9b9d36dae) and adds consent/registration paths.
- DO storage size was not measurable read-only. It is unknown whether storage is near the cap.
- Open issue #5177 (Oct 29) describes an earlier, intermittent version of the same symptom ("Production readiness intermittently exceeds DO probe budget").
- The jobs path was already stale at 4:41 PM.

## Read
The evidence leans toward an application or data-volume cause: a slow storage operation inside the muse-room DO. A platform incident is less likely, because there is no Cloudflare incident and other requests work. This does not prove #5651 is the cause. If 6a64ad30 resets the same way against current data, the cause is the data volume or the jobs path, not #5651.

## Update, about 6:15 PM PT
- Probe at 6:12 PM: ready 503 on 5 of 5. version gives no response. health is degraded with jobs:error.
- wrangler tail, 6:13 to 6:15 PM (120 s, 68 events): zero durableObject invocations were recorded. 42 Worker requests were canceled at 10 to 15 s waiting on the DO. The paths were muse-room GET /, /assistant, /presence, /agent-work, /saved, /reply-context, /stream, plus POST /mcp, POST /api/agent-heartbeats and /api/account-session. The DO is no longer completing any invocation.
- Reset anatomy from the 5:37 PM sample:
  - 4 requests arrived at 17:37:14 and cold-started the DO (775 rooms, 49,075 sequences, projectionBytes 7,140,804; schema rowsRead 885, plugin rowsRead 1263).
  - Each logged room.do_request status 200 with appMs 0. All 4 then ended exceededWallTime at about 41 s with "storage operation exceeded timeout... object reset" at 17:37:53.6. That is about 39 s after the response was produced.
  - The next cold start, at 17:37:55, served normally for a few seconds.
- No alarm or scheduled events appeared in either sample (3.5 min total), although patrol and project-map have 1-minute cadences.
- Static trace at bbb8b348 (cloudflare/room.mjs):
  - After the response, fetch's finally runs three waitUntil tasks: humanPush.flush, flushRoomGuide and #armJobAlarm (via ctx.storage.getAlarm/setAlarm).
  - #armJobAlarm is already single-flight (job-alarm-reconciler.mjs).
  - The fast-job alarm path runs patrol and project-map every minute. patrol's history scan is the cost #5631 bounds.
  - #5651 does not touch any of these.
- Culprit: NOT pinned.
  - The storage op that times out runs after the app code returns. Candidates are the post-response waitUntil tasks and an alarm-held storage lock. Neither can be distinguished without DO-level logs.
  - No recorded event shows a CPU or memory limit hit. CPU is not measured.
  - Combined with no Cloudflare incident, the remaining hypotheses are (a) a long synchronous SQLite op in background or alarm work on a 49k-sequence store, or (b) platform storage latency for this object.
  - Rolling back to 6a64ad30 is the discriminator: if it resets the same way, the cause is data or platform, not #5651.
- Not done: no fix PR. No evidence identifies a specific loop, and a speculative bound would not be a safe fix.

## Update, about 7:00 PM PT: recovered, then down again
- About 6:55 PM: prod was on c56644142 (build 2026-11-02T02:49:40.674Z). That revision contains #5656 (patrol pinned off, ROOM_PATROL_ENABLED=0) and #5657 (remove quadratic history reads from presence).
  - ready was 200 on 15 of 15 probes. health was ok with jobs ok.
- About 6:56 PM: Grok ran scripts/live-smoke.mjs once (public GETs only). There were no fail-level findings visible in the tail of its output, but responses were slow: /sitemap.xml 7.1 s, /join 3.3 s, a /receipts page 2.4 s.
  - A second run from about 6:57 PM hung and was killed at 180 s. No more smoke has been run.
- By about 6:59 PM: ready was 503 at about 2.8 s on 5 of 5 probes. health was degraded with jobs:timeout.
- wrangler tail, 6:59 to 7:00 PM:
  - At 18:56:34, 11 DO invocations were canceled, including muse-room /agent-work at 43 s, /presence at 40 s and GET muse-room at 41 s.
  - At 18:59:59 a new exception category appeared: "Durable Object is overloaded. Requests queued" (on POST /api/agent-heartbeats and POST /mcp).
- Reading: with patrol off, the single DO still stalls under normal agent polling (presence, agent-work, room GET, heartbeats, mcp). This points at per-request read cost on the hot muse-room paths combined with request queueing in one DO, not at an alarm job alone.
  - The smoke's public-page fetches may have added load during the relapse. Their contribution is not measured.
