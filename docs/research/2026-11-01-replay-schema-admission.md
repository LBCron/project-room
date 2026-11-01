# Supported schema admission investigation

The repeated eight sqlite_master scans were measured in the actual October Worker. The proposed connection-scoped schema_version cache passes the five Node controls but cannot be used in Durable SQLite: `PRAGMA schema_version` returns `not authorized: SQLITE_AUTH`.

The preserved statement sequence is synthetic `/seed?bytes=2376000` followed by `/durable-capture`; capture enters exact schema admission and fails on the first schema_version PRAGMA, before witness copy, progress or receipt writes. There is no fallback. `/tmp/replay-source-schema-cost-first.log` preserves the error. This attempt is not a usable Worker candidate.

The supported replacement under review discovers exact object rowids at cold/explicit admission and revalidates rowid, type, name, tbl_name and exact byte-admitted SQL through indexed catalog lookups. Replacement at another rowid must refuse until explicit rediscovery. Exact same-rowid reuse after identical DROP/recreate is an explicit qualification question: final tuple equality cannot establish that no intervening DDL window occurred. It must not be claimed without a causal control. No new persistent authority or schema/default activation is introduced.
