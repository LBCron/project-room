# Explicit message authority activation

The deployed canonical engine has no automatic production conversion. This change connects it to the existing token-protected operator surface:

- POST `/api/operator/messages/authority/plan`: `roomId`, `reason`, optional boolean `reverse`.
- POST `/api/operator/messages/authority/execute`: the same fields, the returned `planHash`, and an explicit stable `requestId`.

Keep the exact execution input and request ID on an unknown result. The original saved response is returned on an identical retry, including after later room writes; it is a receipt of the original change, not current room state. Changed input under that ID conflicts. Read the room again to establish current state.

Planning reads capped inventories and records an operator audit. It does not hydrate, replay or certify the room, and does not claim the room is qualified merely because inventory succeeded. Execution re-inventories in its transaction, compares the exact source/proof fingerprint, requires caught-up message backfill and exact-head parity, validates serving proofs, invokes the existing migration, and commits its saved response in the same append-only audit transaction. There is no new table, schema version, automatic global backfill, rolling-storage flag or agent permission.

The fingerprint binds direction, room/head/event data, projection bytes, all bounded message payload/proof fields, work/body rows, current metadata/content proof, and replay/certification anchors. A parked backfill or applicable recorded integrity failure refuses. A changed cursor can require a fresh plan even without a new room event; this is deliberate reconciliation.

## Bounds and exclusions

Admission precedes hydration, parity, migration and payload fingerprinting. Indexed per-room inventories stop at cap plus one. Current conservative limits are 512 KiB of raw projection, head/event rows at most 2048, 1024 message rows, 128 work rows, 1024 body rows, and 1 MiB per domain. The conservative hydrated bound also must fit 1 MiB; repeated body references count repeatedly. Hash and cursor anchor strings have separate small caps. These are source-size limits, not a production CPU SLA; SQL sizing of a pre-existing oversized record is not claimed to be a constant-cost operation.

Archived rooms with a message archive prefix refuse. The existing parity implementation compares archived payloads by count and migration uses a reconstruction scope; this first operator path must not convert those unqualified histories. Oversized/archived rooms require the separate bounded continuation design. Do not enlarge caps, archive data or replay globally merely to force eligibility. In particular this initial path cannot remove muse-room's large history blob yet.

Reverse requires a fresh plan against current data and preserves intervening legitimate writes. A reproduced engine defect is fixed here: matching `body` and `record_json` could previously be converted back inline despite a mismatched independent message proof. The direct regression fails before the new reverse guard and passes afterward. The guard validates canonical serving proofs before removing authority. It does not manufacture a historical baseline, clear quarantine or use old projection bytes as a restore.

Parity's nested certificate invalidation is rolled back with a failed outer execution transaction. The operator always performs fresh verification on the next attempt and never treats the old certificate alone as sufficient. Failure after representation change but before saved audit publication rolls back both; a retry can then complete once.

## Qualification

Focused Node tests cover actual HTTP operator access, inventory-only planning, direction/source/intent conflicts, saved-response retry after later writes, audit-failure rollback, archive refusal, cap-plus-one in every normalized domain, UTF-8 payload sizes, same-head drift and reverse proof refusal. Existing engine tests cover post/edit/reply/delete, archived engine semantics, export/restore, missing rows and bounded selected edits.

A separate local workerd fixture is disposed and recreated with a persistent SQLite directory between stages. It converts, restarts, reads, edits, restarts, retries the original conversion, reverses current state, restarts and reads the edited result. Another real restart preserves corrupted canonical rows and proves a fresh reverse plan cannot authorize them. This is actual workerd restart evidence, unlike constructing another RoomStore within one running isolate.

The 1000-message workerd sample retains 1002 events, 257608 bytes of projection and 461780 message-row payload bytes. Conversion leaves 751 bytes of metadata with no messages array. One observed plan/execute pair took about 14/81 ms local wall time. These measurements do not establish production latency or Worker CPU/billing. A larger-body sample correctly exceeded the hydrated bound; its refusal is retained, and limits were not raised.

The prior release c1c92 remains live while this change is reviewed. No production room is converted by these tests, no public Dot plugin route is qualified, and the next real hourly integrity success remains a separate requirement.
