# Normalized standalone instructions-read gap, plus opt-in checker drift

Source baseline00888c52110d36250d3e07629036701b72926d09 and support candidatea599faa29ff65567e5c080609cb2d000acd33666 exhibit identical behavior over real local Node HTTP. Legacy rooms: GET/charter200 before and after owner room.charter_updated; historical revision0 also200. Normalized-current-v1 rooms: update succeeds, but all three standalone reads409 current_room_context_required. Both representations' activation-pack200 contains the new exact synthetic purpose. Unauthenticated/charter401, no read adds an event. This is a standalone documented API/client read gap, not total loss of instructions or a deployed-account finding.

Run with Node24:

```
node normalized_charter_read_repro.mjs /absolute/clean/checkout EXACT_SHA
node normalized_charter_read_repro.mjs /absolute/clean/fixed-checkout EXACT_FIXED_SHA --assert-fixed
```

The first mode verifies the current failure. The second requires normalized initial/current/history reads200 and is intentionally RED (exit1) on a599. Receipts are written before the fixed-contract assertion. No source/runtime edits, Native/hosted qualification, other-laptop execution or release claim.

Source cause: server/store.mjs RoomStore.charter authenticates then unconditionally calls this.room(roomId); normalized representation refuses ambient hydration. HTTP route server/http.mjs validates revision and delegates directly; the public client/room-agent.mjs charter and src/client.js instructions read still use that route. Existing normalized charter command tests cover updates, ownership/stale revision/archival, but not this standalone reader. A fix belongs to Root's runtime lane and must preserve bounded historical version selection, authorization, exact containing horizon/viewer binding, unavailable-version refusal and no writes.

How found: existing opt-in scripts/qa2/abuse-guards.mjs was skipped by the default unit suite. Actual run on disposable loopback server, minimal environment with no ambient service credentials, failed after H1 webhook and D1 name checks passed: its held-work fixture uses retired legacy work create (409 legacy_work_retired). That setup prevents subsequent R1 instructions and T1 content-trust checks. An independent local copy moved the exact unchanged R1/T1 block before the held-work block and changed only its client import path; this then fails at R1's GET/charter with409. T1 and all work-cap/lease guards remain UNEXECUTED. Do not call the abuse suite green or weaken it by skipping current refusals. The stale legacy work fixture requires a separate intentional checker modernization; current instructions read needs its own runtime assessment.

Original checker invocation is included. Both checkers exit1 with no signal; raw output/recovery credentials are excluded. Reordered observation is attribution only, not a source change proposed for merge. Existing seven-tip offline bundle predates this packet and is not regenerated for every finding.
