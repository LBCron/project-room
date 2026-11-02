# Local workbench child exit / RSS observation race

This is local tooling, not a Project Room runtime change or release gate.

A successful short worker can exit after the supervisor checks poll() but before the external RSS observation finishes. Missing RSS was then unconditionally converted into rss_observation_failed, even when the worker exited0 and wrote valid outputs. The new code rechecks process completion: a still-live unobservable worker still fails closed; a terminal worker follows ordinary exit/result/artifact verification.

The regression controls real subprocess completion inside the RSS-observation boundary. Before fix:3false failures/3successes. After fix:10tests pass, including the companion missing-RSS/live-worker refusal and all existing corruption, cancellation, crash/lock, retry/resume checks. This is a deterministic boundary experiment, not a measured natural occurrence frequency. The test itself waits for real short workers; no fabricated success artifact or exit status.

The portable ZIP contains runner, launcher, README, tests and red/green logs. Every archive member was byte-compared with its source; extracted-package10tests pass. No install, schedule or background worker. Use Python3.12+ to run test_workbench.py. Earlier immutable capsules must use their own tool.py; none was rewritten.

Useful real work after fix:75fresh jobs over800selected public server-source files (7,933,666bytes) at ff3350cb8d2be1d1c7278677211eeea3282b7c75,4workers,512MiB sampled RSS/30s per-job bounds. All75jobs succeed and all output digests verify. Produced inventory/import hints, gzip/LZMA roundtrips and25SQLite FTS5 shards. Search restore AND budget returns current-room-repository/messages-store/needs-me hits. This is a selected sorted prefix, not all server/repository files. Source capsule/run remain local.

Report wall810.729ms; reaped childCPU2925.423ms includes startup and monitoring. Neither number measures whole-machine utilization, energy or two-laptop throughput. No before/after speedup claim. No production state, credentials, deployment or other agents' processes changed.
