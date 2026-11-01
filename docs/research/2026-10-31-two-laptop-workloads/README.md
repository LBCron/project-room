# Finite two-laptop workload experiment

This capsule uses synthetic data only. It does not touch production Room databases, change network settings, install services, start a new agent, or create a schedule. Temporary loopback HTTP listeners close before completion. Scratch databases/files are removed; results and the transfer packet remain.

Run with Node 24 supporting node:sqlite:

```sh
node two-laptop-workloads.mjs bench OUTPUT_DIRECTORY
```

For the other laptop's reserved memory window, use one CPU child at a time:

```sh
node two-laptop-workloads.mjs bench OUTPUT_DIRECTORY --serial-only
```

Children cap V8 old-space at 32 MiB; that is not a total RSS limit. Results report actual RSS. The local full run observed approximately 153 MiB maximum per CPU child and 167 MiB maximum in the parent at different phases. Serial-only avoids two overlapping CPU children and the loaded-loopback experiment; inspect actual current host capacity before running.

The capsule measures fixed-work JSON normalization/hashing at one/two local processes, gzip roundtrip, a 32 MiB memory buffer, loopback request latency, file-backed WAL transactions and snapshot isolation, fsync/hash artifact I/O, corrupted-artifact rejection, an actual receiver-process exit before commit, and cached-result replay in a reopened SQLite journal.

Local one/two-process scaling is not a measurement of two laptops. Loopback is not a cross-laptop network test. SQLite snapshot isolation is local to a laptop and is not a recommendation to place SQLite files on a network filesystem. Process-crash tests are not power-loss, whole-laptop reboot, or exactly-once external side-effect qualification.

## Actual cross-host producer/verifier handoff

The included `transfer-packet.json` was generated on the first laptop and transferred through the exact Git source object. On the other laptop, verify the packet, then receive it twice using a new disposable journal:

```sh
node two-laptop-workloads.mjs verify transfer-packet.json
node two-laptop-workloads.mjs receive transfer-packet.json OUTPUT_DIRECTORY/cross-host-receiver.sqlite > OUTPUT_DIRECTORY/receive-first.json
node two-laptop-workloads.mjs receive transfer-packet.json OUTPUT_DIRECTORY/cross-host-receiver.sqlite > OUTPUT_DIRECTORY/receive-retry.json
```

First receipt should have `cached:false, executions:1`; retry should have `cached:true, executions:1`. Return actual hostname, capsule SHA-256, Node version, the two receipts, and source/result digests. Same ID with a different valid input must be refused. The pre-commit crash case is already exercised by `bench` in a separate scratch journal.

Expected packet SHA-256 is `10e5b4faaa3689ada201568564500d6f1d6ab49c94436dc5bcb19bceaf27450c`; expected source digest is `33f5d9125fc96d9431f93c3a7d04d1875cb7b59fe5a03944b3f64fb3b187b46d`; expected result digest is `ce841c27e6add51c5e64c0900df8f0436ff3639abd578ee017c42f9b5e285297`. Packet has 4,096 records and 17 authors. Check these values against the actual receipts, not just the script's exit status.

## Creative two-host uses this tests or enables

- Producer/verifier pipeline: one host builds/changes artifacts while another independently checks exact bytes and semantics.
- Independent durable witness: keep a result and journal on another physical host so losing one host does not remove the only copy. Actual cross-host receipt storage qualifies duplication; destructive whole-host recovery is a separate future drill.
- Compatibility matrix: run identical capsule/source on both actual Node/runtime installations and compare deterministic outputs. Current versions may match; do not claim heterogeneity unless they differ.
- Workload isolation: dedicate a background qualification/build window on one host while keeping the other interactive. Compare against using local worker processes before attributing a benefit uniquely to a second laptop.
- Client/server chaos laboratory: use separate hosts to exercise real disconnect/reconnect, restart, stale lease and retry boundaries once an authenticated route is available. The current failed SSH route is not proof of a successful partition experiment.
- Independent review roles and hardware permission boundaries: authoring and execution/review can be separated between physically distinct environments. Hardware alone does not create independent judgment or authorization; keep explicit ownership and verify the result.

No new relay deployment or permission grant is needed for this experiment: existing Room coordination and Git artifact transfer are sufficient. Benchmarks are short, synthetic samples; use them to identify worthwhile next experiments, not rank hardware or claim production throughput.
