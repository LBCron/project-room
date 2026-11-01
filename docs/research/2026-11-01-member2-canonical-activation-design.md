# Bounded canonical message activation: independent design review

Reviewed source: `c1c92c5b65fb6c4fbe87e78cddced8496f0ab51c`.
This is a source review and proposed acceptance matrix, not implementation,
benchmark evidence, production authorization, or a conversion receipt.

Root owns `server/operator-message-authority.mjs`, minimal wiring in
`server/operator-routes.mjs`, and dedicated Node/Workers tests. Member 2 owns
this research handoff only. No runtime files were edited for this review.

## Recommendation

Expose an explicit, single-room operator plan/execute boundary around the
existing `RoomStore.migrateMessageAuthority`. Keep the rolling message flags
unchanged. Initially admit only small, caught-up, unarchived rooms whose current
metadata and message source can be checked within fixed row and byte budgets.
Refuse larger rooms before hydration, parity, or conversion. This safely proves
the serving format without pretending the existing synchronous engine is a
resumable migration for the largest rooms.

The persisted `messageAuthority` marker, not `messageEntityProjection`, selects
canonical authority. `cloudflare/room.mjs` currently passes neither rolling
option. `server/store.mjs:4139` disables the canonical targeted edit context
when `messageProjectionWindow` is non-null. Turning that flag on would change
another behavior and remove the existing bounded edit path.

## What the existing engine does

`server/store.mjs:2399` converts inside a store transaction. It hydrates the
room, verifies projection write admission, requires targeted exact-head parity
for forward conversion, resynchronizes message records and their write proofs,
stores metadata with the authority marker, and hydrates the new format before
commit. Reverse conversion removes the marker and serializes the current
hydrated state. Neither operation adds a room event or advances its sequence.

The engine already refuses missing canonical proof repair without a strong
verified exact-head historical baseline. Preserve this refusal. A normal current
metadata write proof can be newer than the historical verification baseline;
do not reject legitimate writes merely because that historical baseline is old,
and do not manufacture a fresh historical baseline to make activation pass.

Targeted parity is not cheap merely because it names one room. In
`server/messages-store.mjs:1457` it hydrates the projection, scans posting-event
bodies, materializes current rows, and includes archived thread stubs. Migration
also calls `resyncRoomMessageRows`, materializes all message ids, and can hash
all canonical/work content. Body references and work references can expand a
small raw projection substantially. A bound on raw projection bytes alone is
insufficient.

## Boundary and work bounds

Use the existing configured operator secret, rate limiting, no-store responses,
and hidden unauthenticated behavior in `server/operator-routes.mjs`; no member
or public MCP activation capability is needed. Accept strict fields: room id,
direction, reason, then plan hash and stable request id for execution. Reject
arrays of rooms, unknown keys, invalid ids, and nonboolean direction aliases.

Before fetching or parsing full values, inspect raw projection UTF-8 size and
bounded row/byte inventories for messages, events, projection bodies, and work
entities. Use indexed room filters and `LIMIT cap + 1` inside aggregate
subqueries; do not first load all bodies into JavaScript. Count every message
row, including archived rows, and bound all serialized payload columns involved
in proofs, not only the display body. Count all room events before invoking
existing parity, whose JSON predicate itself reads event bodies.

Existing `server/operator-parity-diagnostics.mjs` demonstrates cap-plus-one SQL
inventories, but its work-entity exemption cannot be copied: this migration
uses full work hydration/content hashing. Do not call its global failure-room
sweep as the activation preflight.

Suggested starting policy for qualification: at most 500 message rows, 2,000
events, 500 body rows, 500 work rows, 1 MiB raw projection, and 4 MiB aggregate
source payload across those tables. These are deliberately conservative
proposal values, not measured safe limits. Qualify their combined worst case
in real Workers before shipping; reduce them if necessary. Include a bound on
hydrated reverse serialization, since stored body/work references may expand.
An inexpensive upper bound must precede hydration; a post-serialization check
alone is too late to protect the expensive path.

Date.now deadlines do not bound synchronous Durable Object work: the existing
operator archive explicitly documents its clock behavior. Performance timings
can supply evidence and additional abort points, but structural row/byte caps
are the admission control. Do not infer a request's CPU cost from HTTP wall
time alone. Inspect query plans for the preflight inventories; a small returned
result does not by itself imply a bounded scan.

## Plan, source proof, and execution

1. Plan performs bounded source reads and writes only an operator audit row.
   Do not call `store.room()` in the pure inventory: it has recovery paths.
   Do not replay, refresh proofs, run parity certification, or clear failures in
   order to produce an apparently read-only plan. Report eligibility and
   explicit refusal reasons. Treat unverified eligibility as unverified.
2. Bind a versioned plan hash to room id, direction, limits/policy version,
   room sequence and head event id, raw projection bytes/digest, backfill cursor
   anchors, bounded message payload/proof fields, body/work content digests,
   and relevant room integrity/block records. Deterministic ordering matters.
   Head/count equality alone does not detect same-head edits. A hash records
   what was inspected; it does not establish the inspected data's correctness.
3. Require `messagesBackfillCaughtUp`, including applied event id, for forward
   execution. Require no unresolved target-specific parity/content corruption,
   active backfill block, or ambiguous source shape. Refuse competing inline
   messages and canonical marker. Existing healthy metadata/current entity
   proof checks remain mandatory. Never mint evidence from suspect payloads.
4. Execute checks a prior saved request receipt first. Same stable request id
   and identical semantic input returns the original committed result even
   after subsequent room activity; changed input is an idempotency conflict.
5. Within one writer transaction, recheck limits, inventory and plan hash, run
   current proof admission and targeted parity, require `ok && checked === 1`,
   then call the existing migration. Nested store transactions must preserve
   the outer atomicity. No await or external work belongs inside this boundary.
6. Persist the successful audit/idempotency receipt in the same transaction as
   conversion. Return before/after format, sequence, counts and bytes, plan
   hash, and audit id; return no bodies or tokens. A failed transaction must
   leave projection, messages, proofs, room sequence, and success receipt
   untouched. An optional refusal audit belongs outside the rolled-back
   conversion and must not be represented as success.

If parity mismatch invalidation occurs inside an outer transaction which then
rolls back, its nested invalidation may also roll back. Do not claim the outer
door durably invalidated an old certificate unless a separate committed path
and test establish that behavior. Every actual conversion still rechecks
parity; no prior certificate alone grants execution.

The existing migration's no-op return is not proof of a new conversion. A
matching canonical room should report already-active only after current proof
checks, or return a prior saved successful receipt. Distinguish repair of
missing proofs from a harmless retry; do not broaden the engine's repair gate.

## Continuation and archived rooms

An unfinished backfill returns not-ready with cursor/head metadata. It must not
start the existing global `runMessagesBackfill` loop from the activation door:
that loop can spend the request on unrelated rooms. Use separately owned,
already bounded preparation; re-plan after progress. An oversized room returns
bound-exceeded and remains on its current serving format. Repeating activation
must not consume another unbounded slice or silently increase limits.

Initially refuse rooms with an archive marker. Existing parity validates
archived payloads by count and thread stubs, whereas migration visits every
archived row to record proof. That warrants an explicit archived-source proof
contract before extending activation to those rooms. Refusal is preferable to
claiming exact archived-history verification that the comparator does not do.

A genuinely large-room path would require staged, cursor-bound source/proof
work and an exact-head final atomic cutover; the current synchronous engine
does not provide it. Keep that separate from this narrow MVP door. Do not
archive a room, replay all history, or change rolling flags merely to force
eligibility.

## Reverse and release operation

Reverse is a fresh explicit plan against the *current* canonical room and its
proofs, with the same structural budgets and an output projection size bound.
Use `migrateMessageAuthority(..., {reverse:true})`, not restoration of pre-cutover
projection bytes, so post-cutover legitimate writes are retained. Preserve
archive semantics if archive support is later qualified: reverse does not mean
unarchive. Refuse canonical corruption before reverse can turn it into inline
authority. Restoring a private backup is a separate recovery action.

Keep a qualified backup available with the existing operator, without copying
private corpus to the other laptop. Canary one eligible synthetic or designated
small room, record the plan/execute receipt, then read the room and relevant
health through both public doors. Observe a write and a restart using the
qualified fixture before touching real data. A format-aware build remains
necessary until all canonical rooms have been deliberately reversed; simply
turning a flag off does not reverse persisted markers. Never combine reverse
with a destructive historical restore or blanket rebaseline.

## Required focused qualification

- Route: configured/unconfigured secret, invalid bearer/cookie-only admission,
  method, rate/no-store behavior, malformed/unknown fields and reason limits.
- Bounds: each table's cap-plus-one, aggregate bytes, multibyte text, tiny
  projection with large body/work references, archived rows counted, and
  reverse expansion. Spies must prove hydrate/parity/migrate were not called
  for oversized sources. Qualify combined worst-case caps under real workerd.
- Source races: room event/head move, same-head projection/payload mutation,
  cursor anchor change, work/body drift, proof disappearance or corruption,
  and quarantine/block change between plan and execute all refuse atomically.
- Proof precedence: a healthy current metadata proof plus older historical
  baseline remains valid; metadata tamper still refuses. Existing canonical
  missing-proof strong-baseline refusal remains intact. Archive initially
  refuses, including a poisoned archived row without a proof.
- Transactions: fault after row rewrite, marker write, and receipt write rolls
  everything back. Preserve sequence/event count, integrity history, and known
  unrelated quarantines. Explicitly test certificate invalidation semantics.
- Retry: simulate lost acknowledgement by repeating identical request id and
  input, assert exact saved receipt and no additional mutation; changed input
  conflicts; retry still works after a later legitimate room command.
- Real restart: use `durableObjectsPersist` in a temporary directory, dispose
  Miniflare/workerd, construct a new Miniflare instance with the same directory,
  and issue separate stage-specific HTTP requests. Convert, restart, read,
  perform targeted top-level edit, restart again, retry original conversion,
  reverse with a fresh plan, restart, and verify all legitimate messages and
  metadata survive. Keep production flags off throughout. Ensure fixture
  initialization does not recreate or reconvert the room on every request.
- Compatibility: post/reply/edit/delete/redact/pin/react/work references and
  published-room fallback preserve existing admission and privacy contracts;
  the top-level canonical edit still uses its bounded context. Confirm raw
  canonical projection has no messages array and count remains correct.

The existing `cloudflare/message-authority.check.mjs` is valuable local engine
coverage, but its "cold reopen" is another `RoomStore` on the same database in
one running fixture. It does not dispose/restart workerd. Existing real-restart
patterns are in `cloudflare/project-offers.check.mjs` and
`cloudflare/agent-wake.check.mjs`.

This assignment does not change the release's original failed deploy-run
record or convert its one observed successful hourly integrity run into
sustained-recovery evidence. The next real hourly success is a separate check.
