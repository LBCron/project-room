Member2 independent post-publication matrix on latest composition
Exact runtime6f5a3708b34fe884eff92c05e5dad08a58fedb45; Node24SQLite.
Copy runner to cloudflare/ at that pin. No runtime modifications. Each of16
cases uses a fresh persisted restored target. Expected exit1 on this source.

Cold AFTER publication controls7/7 pass. Cold WHILE pending cases0/7 meet
proof acceptance. Edit remains unsupported;2/2 expected409 refusals preserve
projection/eventcount/proofs and remain readable/auditable. Delete is now
supported (unlike earlier62f935 evidence), hence explicitly covered as success
and no longer accepted as an unsupported-command refusal.

NEW finding: delete-existing succeeds and exactretry returns duplicate, and
synthetic original text is absent from selected live event/message/carrier/work
storage, BUT pending-open instance leaves seed message entity proof stale.
Warm/cold addressed reads and offline audits all throw message field proof
changed. Paired cold-after control keeps valid message/metadata proofs and reads
and audits cleanly. Text erasure succeeds in this narrow synthetic check; do not
misreport retained text, failed privacy erasure, or filesystem/WAL forensic proof.

Existing publicpost/threadreply/privatepost also fail warm/cold reads/audits.
Work propose/accept/start leave stale legacy metadata_hash but still read/audit
successfully; no business-loss or unreadable-work inference from those3 cases.

This binds the prior pending-constructor registration issue to the current
protocol/normalized-erasure composition. Store pending return still precedes
configureWriteIntegrity. Runtime implementation/release remains Root-owned.
Root must qualify the same-code registration cure with full sealed-target
safeguards. No production deploy, CPU bounds or full release qualification.
