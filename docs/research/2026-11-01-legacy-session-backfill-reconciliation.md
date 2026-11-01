# Explicit historical-session backfill reconciliation

Design checkpoint from main `0f83478a9d7646f8297547723b06802cedc1167b`.
This is an operator action on one admitted room, not a new global replay rule.
No production mutation or proof baseline is authorized by this document.

## Source boundary

PR749 introduced three session-to-work lifecycle assignments after the known
historical journal was written. The current exported journal is independently
captured and unchanged from the private reference. Reverting exactly those
assignments in a forensic counterfactual replays its 25 events successfully.
Production code must instead reuse public `applyEvent` and restore only those
three exact coupled state effects in an explicit historical adapter. Public
reducers, command timestamps, permissions and modern transitions remain strict.

The private older serving snapshot is not current serving authority: it lacks
independent metadata/message proofs. Its historical output differs only in
messages and known receipt/work-control shape fields. This observation does
not permit normalizing arbitrary live differences or minting new proofs.

## Existing operator boundary

Add `repairKind: pre749-session-backfill` to the existing legacy-repair
plan/execute input. Ordinary message-index repair behavior remains unchanged.
The historical mode accepts exactly one room and an expected head, plans from
current source and independent serving proofs, and uses a phase-namespaced
receipt in the existing `operator_actions` transaction. No table, flag or new
endpoint is needed.

Before parsing variable data, admit the complete selected unit: at most 64
events and 256 KiB aggregate UTF-8 bytes across event source, projection,
referenced work/message/body rows, target snapshot, detached anchor parts and
all variable headers/control/receipt input. Numeric-affinity SQLite columns
need CASE/typeof/range guards before materializing them. Every row family is
individually count-bounded. Archive markers always refuse. No fleet scan,
bootstrap, global backfill, opaque repair helper or fallback hydration runs.

Inventory must prove all of the following inside an exact-head transaction:

- Healthy independent current metadata proof and complete work/message
  membership/proofs, including missing references and canonical counts.
- Current replay's first rejection is the recorded board quarantine caused by
  the named pre749 coupling; the explicit historical adapter strictly replays
  all admitted events without weakening any other reducer check.
- Historical output equals full current hydrated metadata, work records,
  message records/index fields/posting sequences and current grants. Only
  existing individually verified deterministic legacy defaults may be
  considered; a missing proof or unexplained mismatch refuses.
- All source, serving proof, cursor, quarantine and snapshot bytes are bound in
  the plan hash. A changed head, source or current proof invalidates the plan.

If these checks pass, the action may rebuild only the derived replay snapshot
at the already-proved current head, remove the admitted obsolete detached
anchor/quarantine and reconcile the target cursor/certificate through a narrow
messages-store helper and existing parity checks. This transition is explicit
in the receipt, never a silent cursor reset. Every serving row/proof byte,
projection, event, grant and retained projection checkpoint is preserved.

Any output overflow, storage error, interruption, parity mismatch or failed
audit insert must roll back the complete slice and its receipt. Retrying an
identical request ID returns its original receipt without additional work;
changed intent conflicts. Future events use the ordinary current reducer from
the corrected exact-head snapshot. Dates alone never grant repair authority.

## First regression

`tests/legacy-session-backfill-repair.test.mjs` contains a wholly synthetic
historical session/lifecycle sequence seeded by a trusted historical-writer
fixture, then quarantined by the actual modern backfill. Existing repair
refuses the explicit mode (red); the modern direct-command rejection is green.
No private room/event/member identifiers or payloads are present.
