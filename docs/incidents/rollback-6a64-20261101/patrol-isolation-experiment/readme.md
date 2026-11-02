# Scheduled patrol isolation experiment

PR5656 landed7ee5ad65a6628cd2b959c4561889e5741b3561e7. Exact main schema-gate41377501259 passed; serialized deploy41377563934 failed strict smoke and restored prior allocations. Canonical build2026-11-02T02:25:11.836Z, entry2026-11-02T02:25:20.713Z. Both Worker and Durable Object versions converged to7ee5 in the recorded smoke.

The deployment explicitly disabled scheduled patrol on both doors, with zero-scan local scheduler/RPC controls. Canonical readiness still503/2500ms, jobs stale; entry readiness503 and jobs timeout. Several legal pages timed out. Both signed-card checks passed10 consecutive fetches. This weakens the hypothesis that disabling patrol alone restores service, without proving every asynchronous predecessor had drained or establishing the underlying cause.

Recovery restored exact prod65e553f4-f96f-4f7f-a4d4-ac8e18c209a5 and entryebd621f5-fc73-43af-bc41-374df1b22e20, both6a64ad3039600de2b382a16faead57f33dd304e3. Allocation/source/DO readback passed; product recovery did not. An independent readiness and health read after rollback still reported storage timeout. Older code ignores ROOM_PATROL_ENABLED, so the isolation is no longer active. Main is7ee5; live is6a64.

A separate passive-tail attempt failed during startup with exit1 and zero captured events; it is not a45-second traffic sample and supplies no evidence about post-isolation traffic. No production writes, database replacement or load generation accompanied the independent checks.

Research: production timers advance after I/O, so synchronous elapsed-time checks do not bound work (https://developers.cloudflare.com/workers/runtime-apis/performance/). Thrown alarms retry automatically (https://developers.cloudflare.com/durable-objects/api/alarms/). Storage timeouts reset in-memory state without deleting persisted storage; absence of a public incident does not rule out an object-specific service problem (https://developers.cloudflare.com/durable-objects/observability/troubleshooting/).
