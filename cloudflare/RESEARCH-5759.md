# Research checkpoint — not for merge or deployment

This branch is an incomplete experiment for large-message routing and format fencing. It is a handoff for review, not a production migration.

Format 7 changes the writer fence; rolling back to format 6 after upgrading a database will be rejected. The startup transition requires a separately reviewed and deploy-qualified recovery plan. Pending restores, mixed deployment, old backups, audit/replay compatibility, every body-sensitive consumer, untrusted routing and production failure behavior remain unqualified. The research certification path is not exposed as a production feature or scheduled process. Tests use local Miniflare and synthetic records only.

The research tests use a pinned format-6 source snapshot from parent 03ed3ead, so both versions exercise the same temporary SQLite database. They are not a substitute for the full suite, cross-platform CI, or independent review.

Pending-restore fence experiment: this branch changes startup guards for pending/loading restores through a privileged transaction. It is synthetic research only and is NOT a safe migration or release candidate. Sealed coverage/audit phases, old in-flight writers, exact backup seals, crash/retry boundaries and bounded multipart recovery require independent qualification. The multipart audit change in these fixtures is injected at bundle time and is not present in the serving source.
