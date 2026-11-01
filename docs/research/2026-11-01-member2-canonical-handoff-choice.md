# Canonical handoff: contract choice and executed controls

Pinned source: c52db58787467390042295b181b152ef3ba4de12.

The prior HTTP reproduction at 603afe7572db07fd0289193301950ddf5fd5d9bb
proved the generated successor can be claimed and started but cannot submit a
result: its canonical work-context destination does not exist. This follow-up
tests the intended alternative against the actual existing lifecycle.

## Existing authority

`src/work-reducers.js` recordHandoff accepts only the accountable member with
accept_work. It requires partial-progress text, not a new definition of done,
accountable member, verifier, mode or proposal authority. Its comment explicitly
says handoff never advances or closes work. The public skill reference likewise
says handoff does not close or reassign the item. An open handoff is triage for
the room owner.

`proposeWork` separately requires steer, validates assignment trust, named
members, mandatory room review/decision policy, verifier independence and write
mode. A proposed item does not become board-claimable until acceptance. An
implicit canonical proposal from handoff would have to invent these inputs or
bypass those checks. Nulling the phantom workItemId instead would silently
convert a canonical continuation into a new board-native contract.

Recommendation sent to Root at Room 25500: preserve the original canonical
task as the resume target; do not manufacture a second task from nextAction.
A genuinely new follow-up uses an explicit authorized work.proposed and its
normal acceptance. Root owns the final semantics choice before runtime edits.

## Executed evidence

`tests/handoff-canonical-continuation.test.mjs` runs an actual file-backed store:
propose, accept, start, record partial handoff, close/reopen, retry the exact
handoff command, complete the original work with signed evidence and verify
that exact receipt. The original contract, accountable member, partial progress,
revision and receipt identity survive. This is a local store restart, not real
provider replacement or cross-owner authorization.

The test then fails on the extraneous unclaimed `<source>-next` row. No canonical
aggregate exists for that row. The separate explicit-follow-up acceptance
control passes: no board card before acceptance; a real linked card afterward.
Result: 1 pass / 1 fail, at the intended no-invented-task assertion. Runtime is
untouched. Raw log is `/Users/potter/Documents/ChatGPT/project room/handoff-canonical-c52-red.log`.

## Existing records and remaining work

Do not delete, relink, or null all ids ending in `-next`: a separately proposed
real task or unrelated board-native row can use that id. Old generated rows can
also have real ownership, scope, delivery and review history by now. The thin
work_claim.updated event does not record whether creation came from the mapper;
shape and a matching suffix alone are not sufficient authority for destructive
repair. Preserve those records and surface unresolved origin truthfully until
a provenance-qualified recovery is defined.

Removing new phantom production alone does not satisfy recovery of old rows or
the complete cross-owner interruption/provider-replacement journey. Need final
design for existing records, a real authorized transfer or replacement path,
exact result/review preservation, conflict/rollback tests and restart coverage.
Do not present this red test branch as land-ready or the full MVP as complete.

## Draft cure after those controls

The subsequent draft implements the existing handoff semantics: no new -next
card, handoff chain points to the real original task, and an unrelated row with
that suffix stays untouched. Historical rows remain stored byte for byte until
an authorized cleanup action. Missing canonical work or a merely proposed
canonical item refuses new board execution with an existing work_claim_conflict
409. The refusal distinguishes unavailable from awaiting_acceptance, gives a
valid board or canonical context read, and retains close/release/cancel paths.
No unsigned board delivery can become a canonical result through this change.
Supersession generation remains unchanged in this draft.

Added real HTTP controls for unclaimed and already-claimed historical rows:
claim/start/deliver refuse without altering history or scope, every advertised
recovery read resolves, and authorized close preserves prior history. The
baseline c52 runtime fails this new test by accepting the dangling claim (200).
Draft runtime plus affected migration and verified-route tests: 64 pass, zero
fail. Three old migration expectations initially failed because they required
phantom creation or occupied-suffix refusal; updated to the explicit contract
and unrelated-row preservation. Initial CI contract stopped for missing local
yaml dependency before completing; reused the existing ignored dependency tree.
The next contract run exposed main's unindexed legacy-wake-drain removal note;
added its normal index link, matching the earlier context-cure integration.

Remaining before calling this a complete B cure: discovery still lists an
old unclaimed dangling row, even though execution now refuses truthfully;
qualify and align discovery without adding unbounded per-card hydration or
overlapping the attention owner's active work. Supersession can still generate
a dangling or unaccepted target; retain its separate semantics for review.
Cross-owner transfer/provider replacement also remains outside the local
restart proof. This is a reviewable partial runtime draft, not landing approval.
