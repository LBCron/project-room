# Normalized current event reader checkpoint

Runtime source: `16bf23220e26815738afecb2820365e19222202e`. Original failing source/control: `64d7a3e89` (a75 source plus writer f9 budget hook). This is an offline implementation and qualification checkpoint, not deployment or live activation.

`server/current-room-events.mjs` reads at most 16 unfiltered primary-key event candidates before actor/time/type/mention and audience filters. Scalar lengths are admitted before JSON envelopes are fetched; an individual envelope above 128KiB refuses without returning an advanced page. Authentication, metadata proofs, event payloads, addressed current message proofs and mention facts share the established current-context 256KiB/200-record budget. No table/index/format token or write path was added.

Reusable API: `readCurrentEventWindow(store, roomId, viewerId, {after, limit, actor, since, until, types, mentions, compact})`. The caller must authenticate and own a read transaction. The function checks the active member, applies existing DM/follow-up/consent/peer audiences and since-join floor, and returns current-body redacted `{events,next,hasMore}`. `next` is the last examined source sequence. A filtered or private-only window can return zero events with `hasMore:true`. Existing numeric scan cursors disclose excluded activity through progression; preserving that compatibility is an explicit limitation, not a privacy improvement. No room-head or evaluatedThrough field was added.

The selected page retains only its addressed message context in a WeakMap. `redactSelectedEventPage` and `Store.redactionMessages(roomId,page)` reuse that context; normalized redaction without a selected page refuses. HTTP GET events, bounded tail, SSE, hosted MCP events and full-profile per-page message redaction use it. The normalized tail now returns one admitted source window with honest continuation; callers must follow `next/hasMore`. Full-profile message aggregation still has its own multi-page policy and is not claimed to have one-window total cost. Mention timeout chips use the existing pure effective-state function without writing or running the legacy room-wide timeout sweep; persisted lifecycle transitions remain owned by their existing writer.

Actual Worker comparison uses identical new fixture files on the isolated original-source tree and the runtime tree, with legally initialized synthetic normalized rooms containing 1,000 or 5,000 private messages plus a public post and edit. The before mode deliberately records existing 409 refusal; a passing measurement harness is not a passing original endpoint.

| Operation | Original 1k / 5k SQL rows | Replacement 1k / 5k SQL rows |
| --- | --- | --- |
| Warm unmatched type filter | 1,379 / 5,379 | 215 / 215 |
| Cold restart unmatched filter | 2,965 / 6,965 | 1,801 / 1,801 |
| Hidden source window | 472 / 472 | 215 / 215 |
| Addressed late post/edit | 385 / 385, HTTP 409 | 194 / 194, succeeds |
| Actual HTTP late event read | 3,282 / 3,282, 409 | 566 / 566, 200 |

The replacement fetches 4,899 source event bytes for the first filtered window at both scales. Whole returned SQL text varies (57,257 / 49,675 bytes for that operation), because initialization receipt envelopes vary by batch layout; it is not asserted identical. SQLite internal bytes inspected by the old JSON predicate are not measured by returned-string instrumentation. The original fixture's addressed-source-byte counter is zero because its old query differs; that does not mean it processed zero bytes. Query plans show the `(room_id,sequence)` primary-key range search. Measured calls have zero adapter writes and zero raw native runtime permit flips. Constructor accounting is separate: 4,225 adapter rows / four adapter writes at both scales; those fields do not include raw constructor maintenance.

The initial assertion of identical whole returned SQL text failed and its full log is retained. The final assertion compares the source-envelope bytes and physical rows actually governed by this change. The original whole-room hydration failure and original late 409 are retained too.

Validation on the runtime checkpoint: 33 affected tests passed, including ten new controls for empty-more traversal, residual filtering, current post/edit bodies, DM follow-ups and owner exclusion, HTTP/MCP, SSE drain, since-join old timestamp/new sequence, malformed/oversized source refusal, mention timeout presentation without mutation, peer identity namespace versus member-name collision, consent owner moderation and a late formal request. One actual Worker test passed at both sizes and after cold restart. ESLint of the six affected server files plus the three new test/fixture files passed with zero errors and 36 existing warnings.

The first package/manifest run was 9 pass / 7 fail. It exposed inherited schema45 metadata rejection, ten missing normalized/restore module allowlist entries, and a stale candidate manifest. Those failures are recorded separately; packaging reconciliation follows in a separate commit. No package readiness claim is based on this runtime checkpoint.

Machine-readable receipts, exact source hashes and logs: `audit/evidence/current-events-reader-20261101.json`.
