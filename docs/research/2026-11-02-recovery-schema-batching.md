# Fresh schema batching: measured physical-work reduction

Runtime27aa6a4ba after equality source534632258. Each verification performs a fresh catalog query; no verdict/epoch/progress cache exists.64name batches preserve original first rowid match across table/trigger namespaces and original exact/normalized DDL checks. Four existing service verifier paths share the helper. Missing/changed definitions still refuse; rollback restores exact guards. Live channel original predicate correction is534632258.

Causal328baseline query-control fails0batches vs4; after controls and affected oracle42/42 pass. Queryplan shows one catalog scan/no temp sort. Matched actualNative before/after128full and1kcost cases pass2/2each;1k remains comparison-only, pending503, not full recovery qualified.

| Actual128 publication HTTP request | Before | After |
|---|---:|---:|
|SQL statements|2380|2366|
|Physical rows read|124248|102618|
|Physical writes|6|6|
|Returned UTF8 bytes|3463266|3463939|
|Bound parameter bytes|2350246|2350265|
|SQL text bytes|567869|567389|
|Total transfer bytes|6381381|6381593|

Actual publication includes every existing nested final consumption/report scope and cleanup initialization. It reduces physical reads17.4% but adds212bytes total transfer: no byte or blanket speedup claim. Same-instant wholeaudit comparison with only central equality consumed reduces1k reads109852→88222 and128reads72821→51191; total transfer remains essentially flat (+184B). These comparison scopes are distinct from actual finalpublication scopes. No production CPU claim.

The earlier exact-bind progress parsing cache was rejected: it reduced returned bytes while increasing whole1k input+output transfer1.66%. That unwired experiment is preserved separately at44e930679, never integrated into operator. Broad recovery remains follow-up and does not block existing room normalization activation.

All logs including failed-before, exact perarm counters and hashes are in audit/evidence/recovery-schema-batching-20261102/receipt.json. Remaining semantic closure is described in the equality research note; common membership closure and global connection/delegation journals are separately owned. No broader recovery expansion is part of this checkpoint.
