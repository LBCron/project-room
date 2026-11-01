# Persistence overhaul acceptance matrix

Prepared against exact integration source `cce5850e770a0d0497af768720f546c0c1a2a879` on 2026-10-31. This is an executable qualification design and source inventory, not a claim that a future writer cutover has been implemented or passed. The peer owns the cutover. Existing tests run as part of the distributed unit shards; additional candidate-specific falsifiers should be selected after the candidate exists.

## Verified source boundaries

| Boundary | Exact source location | Consequence for a cutover |
| --- | --- | --- |
| Message admission and archived references | `server/message-command-service.mjs:39`, `:62` | Preserve private-message non-disclosure, duplicate-ID refusal, and archived-reference error precedence. |
| Carrier and canonical-row preparation | `server/message-command-service.mjs:100` | Compactness depends on certification and supported transitions; unsupported transitions need an explicit policy. |
| Entity persistence and certification advancement | `server/message-command-service.mjs:138` | Row updates and certificate transitions must share the command transaction. |
| Command event, receipt and projection writes | `server/store.mjs:6760`, `:6785` | The current command still serializes and writes a room carrier. Removing message bodies is not the same as removing unrelated room rewrites. |
| Message-row synchronization | `server/messages-store.mjs:267` | Audit every event admitted by `affectedMessageIds`, including mirror messages and references. |
| Certification capture/advance | `server/messages-store.mjs:332`, `:347` | Bind to sequence and event identity; absence must not be silently recertified. |
| Room initialization | `server/store.mjs:3881` | Seed authority and integrity state atomically with creation; avoid inferring newness later from rowids. |
| Event import | `server/store.mjs:5624` | Preserve visibility, replay semantics and all derived-state invariants on import. |
| Privacy redaction | `server/message-redaction.mjs:63`, `:134`, `:179` | Redaction changes log, canonical rows and carrier; no old wording may survive in an alternative store. |
| Operator purge integrity snapshot | `server/operator-purge.mjs:261` | Purging one room must not bless unrelated corruption or obsolete integrity proof. |
| NDJSON replay | `server/restore-ndjson.mjs:174` | Verify inside the restore transaction; failure leaves a retryable empty store, not half-restored authority. |
| Current checksum and baseline publication | `server/store.mjs:2755`, `:2770`, `:2907` | Counts/length are not content proof. Snapshot and per-room state publication need one coherent outcome. |

Line references describe this pinned source only. Search symbols again before applying the matrix to a new candidate.

## Qualification cases

| ID | Trigger / fixture | Required observable result | Existing coverage or next action |
| --- | --- | --- | --- |
| P01 | Post a public message in a fresh room | One event, command receipt, canonical record and sequence; replay returns the same visible message. | Run current message/store tests through the shards; add cutover-specific byte assertions when code exists. |
| P02 | Edit text to a different string of identical length | Content proof changes or corruption is rejected; length equality never proves integrity. | Peer reproduced current blind spot; retain as a mandatory future falsifier, not a closed defect. |
| P03 | Unicode edit with equal code-unit count but different byte length | Correct text and byte accounting; no UTF-16/UTF-8 confusion. | Use both ASCII and multibyte fixtures on the candidate. |
| P04 | Edit one of 5,000 messages | Authoritative update is correct; measure affected canonical bytes, carrier bytes, WAL delta and elapsed time separately. | Peer baseline reports full carrier/WAL rewrite; compare exact future candidate on on-disk SQLite. |
| P05 | A supported message-neutral transition | Unchanged entities remain canonical; certification advances only under its documented invariant. | `tests/message-neutral-certification.test.js`, `tests/message-certification-continuity.test.js`. |
| P06 | An unsupported message-neutral transition | No silent false certificate; intentional fallback is explicit and measurable; compact entities do not accidentally reinflate unnoticed. | Peer current falsifier; enumerate transition set before claiming universal cutover. |
| P07 | Cancel a reply request with unchanged messages | Entity carrier remains consistent with canonical rows, including a stale hydrated cache. | `tests/cancel-entity-carrier.test.js`, `tests/message-entity-cache.test.js`. |
| P08 | Delete one canonical/archived message | Remove/redact its complete data while retaining unaffected canonical entities; no ancestry leak. | `tests/delete-entity-carrier.test.js`, privacy/redaction suites. |
| P09 | Private answer, private reply, cross-domain evidence/source reference | Authorized participants can act; nonparticipants learn neither content nor target existence. | Existing auth/reference tests in shards; add exact cross-domain fixtures for the cutover. |
| P10 | Command retry with the same identifier | One execution and one authoritative outcome; receipt replay does not write again. | Existing idempotency suites; collect exact failures if composition regresses them. |
| P11 | Failure after event write but before row/certificate write | Whole transaction rolls back; no event-only or row-only committed state. | Inject at the new transaction seam when supplied. |
| P12 | Crash after commit but before result delivery | Saved result remains discoverable; retry recovers it without re-executing. | Qualify independently of message queue acknowledgment. |
| P13 | Archive messages with pins, references and thread ancestry | Retained set and archive marker agree; archived reads preserve visibility and order. | `server/messages-store.mjs` archive paths; existing archive/parity suites. |
| P14 | Rebuild from events | Rows, carrier and replay result agree; inherited NULL/missing records are repaired by code-owned reconstruction. | `resyncRoomMessageRows`; existing rebuild/parity tests. |
| P15 | Import event stream twice or retry after interruption | Idempotency and ordering preserved; no duplicate entities or false completeness. | `RoomStore.importEvents`; candidate-specific interrupted-import fixture required. |
| P16 | Restore a valid export with rowid gaps | Restore verifies content and coverage independent of contiguous rowid assumptions. | NDJSON/restore suites plus candidate-specific gap fixture. |
| P17 | Restore sanitized cells or binary attachments | Verification uses the defined safe representation; placeholder bytes are never treated as user content. | `tests/restore-sanitized-cells.test.js`, `tests/restore-ndjson.test.js`. |
| P18 | Torn export or per-table digest/count mismatch | Refuse before publishing restored authority; rollback leaves empty retryable target. | `tests/restore-ndjson.test.js`, restore reconciliation suites. |
| P19 | Create room, rollback, then create again | No integrity state survives aborted creation; successful creation seeds complete state atomically. | Candidate must test explicit initialization transaction, not a scan heuristic. |
| P20 | Purge room with highest event rowid; create another room | New room verifies then matches; reused rowid does not imply old coverage. | Known unresolved #5506 acceptance input; preserve negative case. |
| P21 | Purge room A while survivor B is corrupt | Purge does not publish a fresh baseline that blesses B. | Inspect every snapshot writer; do not validate purge in isolation. |
| P22 | Missing, empty or NULL integrity baseline/state | Correct refusal/rebuild; no false healthy empty baseline. | Integrity/restore suites; candidate must distinguish absent proof from valid empty database. |
| P23 | Crash between aggregate snapshot and per-room state publication | Both become visible atomically or a recoverable incomplete state is detected. | Current publication spans separate method calls; new design needs injection proof. |
| P24 | Shard/database replacement or delete/recreate same room ID | No stale certificate, query token sidecar or cache attaches to a different generation. | Bind generations/revisions and test replacement explicitly. |
| P25 | Direct maintenance writer or repair path bypasses command service | Authority and derived state stay coherent or failure is visible; no unregistered writer. | Inventory all SQL writes before declaring canonical ownership complete. |
| P26 | Read-only pre-upgrade database | Correct fallback or explicit incompatibility; no silent missing work or fabricated health. | Schema/index absence must be distinguished from complete empty state. |
| P27 | Permission revoked between continuation pages | Old cursor refuses or restarts; later pages cannot expose now-private state. | Reuse auth-bound cursor design; do not accept bare rowid as public continuation. |
| P28 | Unrelated large room state on one-message edit | Measure serialization and WAL impact beyond message bodies; target mutation-size scaling. | Peer explicitly identifies this remaining writer cost. |

## Candidate acceptance packet

Ask the implementation owner for exact commit/tree, enabled flags, affected writers, migration mode, old-database behavior, transaction boundary and intended performance claim. Choose relevant cases from this matrix and record expected before/after outcomes before running. Include at least one failure injection, one privacy/reference case, one replay/restore case and one growth measurement for a writer cutover.

Record source revision, fixture seed/size, runtime, temporary database path, command, process exit status, test counts/skips, result digest and raw output. For performance, state warmup/repetitions, bytes vs characters, cache state, in-memory vs file-backed storage, checkpoint policy and whether WAL size includes prior uncheckpointed work. A larger WAL file alone is not a per-command byte measurement without controlling prior state.

Full qualification requires actual Node and Workers coverage where the design relies on both runtimes. A matrix or source inspection is not an executed pass. Known current defects remain open until the corresponding candidate falsifier succeeds.
