# Recovery replay equality: offline draft21

Source bb429d29c (runtime07567eaa7), based on channel draft889525da4. No deployed behavior changed. This does not block existing-room direct normalization activation.

The durable phase compares independently staged actual records against the original reducer replay before scratch cleanup. Shared original projection/backfill/general-channel rules preserve optional-map presence, arbitrary metadata, work fallback fields, private message bodies, retained message order and archive compaction. Only all-current rooms with zero deferred closures can consume the final whole-room rebuild comparison. Ordinary auditRecovery remains literal; the final operator audit still runs every other original check. WholeRecoveryBounded remains false.

Two baseline tests fail because final publication invokes a deliberately denied original rebuild. After the patch, 18 new Node controls pass; affected oracle42 and replay/codec/channel17 pass (overlapping tests). Corruption, scope expiry, checkpoint-after-write rollback, cold retry and unsupported-tail deferral remain explicit.

## Actual production Native evidence

The original combined128+1000 full-restore test timed out at120seconds (0pass,0fail,1cancelled;123135ms). Its exact test and log are retained compressed. Splitting semantics from measurement does not turn that failed full1k attempt into a pass.

The isolated tests pass2/2:128-message archived+pinned checkpoint source completes publication, cleanup, cold ready, private read and useful post/exact retry;1000-message source proves only equality and same-instant final audit comparison, remains pending503 and is not full-recovery qualified. Native elapsed is local wall clock, not CPU.

| Case | Original final rows | Consumed final rows | Original returned UTF8 bytes | Consumed bytes | Rebuild calls |
|---|---:|---:|---:|---:|---|
|128 archive+checkpoint|70827|72821|871578|1379525|1→0|
|1000 no checkpoint, cost only|110276|109852|6186736|6375239|1→0|

The same audit report is exact in each comparison. The extra scope/control/freeze reads make128 cost materially worse and1k returned bytes3% worse. This is semantic closure evidence, not an overall speedup. Equality pages at1k max17616physical rows/1022970returned bytes,34pages; fixed admission SQL overhead is separate from4MiB logical value-work accounting.128full uses159operator calls;1k uses516calls only to pre-report final-audit stage.

Repeated name probes dominate catalog rows:24 SELECTsql/name calls read37080physical rows in the128audit; additional service schema probes repeat the same catalog. Newly introduced scope reads copy about276621bytes of control payload plus228177freezeDDL bytes. A bounded transaction-local exact catalog snapshot is the next optimization proposal; no persistent cache or old-schema trust is justified by this evidence.

## Remaining final oracle

- Central rebuild/backfill/archive equality is consumed only for all-current complete closures. Unsupported/deferred replay still invokes the original oracle. Common stamped member joins remain deferred pending the separate exact staged-name-census port.
- readCurrentRoomForAudit still materializes actual state for text, charter, reply and help oracle checks; their existing completed phases are not yet consumed. Invitation verification is also repeated.
- Full history/checkpoint structural scans remain, despite existing history/codec phases. Exact final closure must be consumed before removing them.
- Engine quick/FK checks remain: report processing mutates operational state after earlier engine checks, and SQLite atoms are not hard CPU bounded.
- Share links, reminders, report fingerprint and channel validation have consumption scopes. Managed connections and live delegation journal work are owned in parallel. Private inbox, email, handoffs and optional replay-capture remain global closures.
- No populated managed/inbox/email/delegation/handoff benchmark exists in these fixtures; source complexity alone cannot rank their measured costs.

Source correction: Store imports live ChannelUpdateJournal and MembershipDelegationJournal from server/journal.mjs, not their similarly named legacy modules. The channel row validator was initially extracted only from the legacy class; predicates currently match, but the live class must call the same leaf in a separate correction. Earlier channel70 fixture was legacy (low-level initializer default), not normalized; its global journal measurements remain valid only with that corrected source description.

Commands and compressed logs, including the timeout, are in audit/evidence/recovery-replay-equality-20261102/receipt.json.
