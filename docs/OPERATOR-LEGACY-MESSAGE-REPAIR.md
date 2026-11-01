# Bounded legacy message repair

This Operator-only action repairs indexed message records whose fresh, complete
parity diagnostic proves that their only differences are retired `reactions` or
missing/null receipt IDs. It is not a general projection repair or an integrity
sweep. Never select a room whose diagnosis is `unknown`.

Use the existing Operator authentication scheme, without room/account cookies.
Do not paste the Operator credential into logs, transcripts, or saved requests.

1. Read `GET /api/operator/status`. Review `messageParityDiagnostics` and select
   at most three explicit outstanding `messages_parity` rooms. Every selected
   entry must be complete and `exactLegacyShapeOnly: true`.
2. Send `POST /api/operator/messages/legacy-repair/plan` with this shape:
   ```json
   {"rooms":[{"roomId":"reviewed-room","expectedHead":23}],"reason":"Reviewed legacy record-shape mismatch"}
   ```
   The response contains only room IDs, heads, counts, and a `planHash`. Planning
   records an Operator audit entry; it does not repair messages.
3. After reviewing those counts, send the same rooms and reason to
   `POST /api/operator/messages/legacy-repair/execute`, adding the returned
   `planHash` and a unique `requestId` (1–64 letters, digits, underscores, or
   hyphens). A retry must use exactly the same input and request ID. A completed
   duplicate returns the saved result without another repair or audit row.
4. Read fresh Operator status and `/api/health/jobs`. Successful execution
   verifies each target with the canonical checker and clears only its matching
   failure record. It does not run the whole integrity job or reset its failure
   streak. Confirm a later normal integrity tick has a new successful timestamp
   and no remaining fatal failure; do not call a targeted repair a full sweep.

The plan is bound to current source evidence and heads. Execute rechecks it in
one writer transaction. Only `messages.record_json` changes; when that record's
retired reactions are removed, `reactions_json` also becomes NULL to match the
canonical writer and incremental certificate checks. Bodies, indexes, events,
projections, checkpoints, and other rooms are preserved. Each proposed record
must equal the complete canonical expected record before writing, and the
canonical room parity check must pass afterward. A late failure rolls content,
failure-ledger changes, and completion audit back, then invalidates certificates
only for the validated targets in that attempted write.

Limits remain explicit: up to 2,000 message rows and 2,000 events per room,
4 MiB per bounded source class, and a 150 ms cooperative preflight budget.
Canonical work-entity hydration additionally requires no more than 2,000 rows
and 4 MiB. The clock budget is checked between synchronous operations; the row
and byte limits bound individual reads. Limit exhaustion is refusal, never
partial repair. No automatic fleet migration is added.

## Explicit historical session backfill mode

The same plan/execute endpoints accept `repairKind: "pre749-session-backfill"`
with exactly one selected room and `expectedHead` (1–64). This separate mode
reconciles only a recorded `work.accepted` quarantine caused by the three
session-to-work state effects introduced in PR749. Dates alone confer no
eligibility. Ordinary command validation and the original message repair mode
remain unchanged.

The complete target input and proposed output must fit 256 KiB: source events,
serving projection and entities, existing replay snapshot/anchor, variable
controls, and audit envelope are admitted before payload hydration. Each row
family has a 64-row cap. Archives and canonical message-authority rooms refuse.
Malformed controls, missing proofs, or any historical replay difference from
independently verified current serving state refuse. This mode performs no
shape/default normalization and creates no serving proof baseline.

A qualified execution preserves every serving row and proof byte, event and
grant. It rewrites only the derived target replay snapshot/cursor, removes its
obsolete quarantine/anchor and passes target parity in the same transaction as
its phase-namespaced receipt. The result includes `derivedOnly`, the prior
cursor hash, exact head and new snapshot hash. Audit or storage failure rolls
back the entire operation. Persist the complete execute input before sending;
a retry uses exactly that input and returns the original receipt even after
later room writes. Planning records its standard operator audit only. A plan
must establish actual current eligibility; historical backup comparisons are
not current serving authority.
