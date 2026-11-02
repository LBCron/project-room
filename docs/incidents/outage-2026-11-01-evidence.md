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
