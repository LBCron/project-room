# Frozen unit evidence

Exact source: 7264b395a987d4bca7476f7d4d4a97622efff153. Node24.22.1, two separate initially and finally clean Mac worktrees. No source edits during runs. Shared run release-final-1101-7264, attempt1; plan ba603ce6a0e529533ac6028dcdd08b79ac8e9b727ae089b003b3ced5df6470d3,1657 files.

- Shard2:553 files,4471 passed,4 failed,14 skipped,135565ms, exit1.
- Shard3:552 files,4343 passed,13 failed,13 skipped,139823ms, exit1.

Receipts are complete and unchanged. The shard2 receipt's advisory failure-name parser also captured the intentionally failing nested harness self-test `probe fails deterministically`; the actual outer runner reports four failures. Full final outer failure reports accompany both receipts. Raw spec/JUnit/progress logs remain preserved on the testing laptop.

This is failed qualification evidence, not a release-green claim. Root owns combined correction and release. A shared-bootstrap metadata-proof precedence regression is assigned to Member2 in a separate checkout; other fixture/independent-verifier/patrol cases are routed to Root. Never rewrite these failed receipts into success or reuse them for a different revision.
