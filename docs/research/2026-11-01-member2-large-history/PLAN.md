# Work plan: finish large-history storage without losing source authority

Status: executing independent research and local probes. Source pin:
`513d3ee8471464803fd3c70dea2fe9ce30f27ad0`. This plan intentionally follows
the latest work rather than repeating the completed bounded conversion review.

## Outcome and division of work

The useful MVP outcome is that a busy room can keep accepting legitimate work,
retain its saved results and privacy semantics, and move from a large JSON
projection to canonical records without a long synchronous rewrite or invented
proof. A successful conversion must survive response loss and runtime restart.
The work is complete only when source integrity, bounded work, forward progress,
compatibility and recovery are demonstrated separately.

The other laptop owns implementation, shared runtime files, integration, private
backup qualification and serialized deployment. It has already shipped the
small-room operator path and preparation, and is working on bounded copy-on-write
storage and historical replay contracts. Jill owns the attention runtime cure;
other helpers own pairing and UI lanes. This laptop owns this plan, synthetic
checkpoint/resource experiments, a progress model and independent findings.
No edits to their runtime files, copied customer histories, duplicate broad
suites, new background services or user routines are needed.

Both laptops should run useful local work concurrently. Capacity is allocated
to concrete source-pinned experiments, fixes and reviews, not perpetual CPU
usage. Keep one quiet measurement lane when timing matters, bound all temporary
data, and stop a completed workload rather than endlessly rerun it. Hosted CI
qualifies integration heads; it is not a substitute for available local checks.

## Current evidence and open questions

The source-pin main includes explicit operator plan/prepare/execute, current
entity proof protection, stable saved receipts, historical repair controls and
selected-room parity diagnostics. Large/archive conversion remains unfinished.
The original independent #5581 review was reassigned and completed; do not
duplicate it. Root's latest message reports production at this main pin with
both version/readiness doors passing. Treat that as owner-reported release
state, not an independent new deployment receipt from this laptop.

The old private backup census provided by root is useful workload context only:
17,405 normalized messages, approximately 34.8 MB of message payload and 24,153
events / 26 MB. It is neither current production state nor trustworthy source
authority for replacing current records. No raw backup should leave its laptop.

Questions to settle here:

1. Does splitting a replay snapshot into SQLite rows bound total bytes read,
   parsed or rewritten per continuation? Inspect and measure the existing codec.
2. Given the current deferred rotation and arrival rates, can replay catch up
   if hourly integrity were its only effective driver? Model capacity and lag
   honestly, then define the production observations needed to validate it.
3. What proof must a staged conversion retain to reject older-event mutation,
   changed posting provenance, checkpoint loss and concurrent privacy edits?
4. Which work can root adopt now without creating another storage architecture?

## Phase 1: reconcile ownership and research constraints

Read all new coordination pages through their current retrieval cursor, including
replies to our earlier posts. Acknowledge the reassigned review and claim only
the independent research files. Read AGENTS.md and relevant current source:
message replay snapshot codec, message backfill, operator admission, deferred
integrity rotation, durable storage adapter and existing restart fixtures.
Use source search when the advisory dependency map is unavailable; do not
claim a fresh map was consulted.

Consult primary Cloudflare documentation for current storage/CPU limits,
transaction behavior, alarm retries and runtime observations. Record the source
URLs and access date. Separate platform guarantees from local measurements.
Published maximums are ceilings, not desirable admission budgets, and observed
old values exceeding a current ceiling do not justify rewriting them through
the same failing expression. Prove the exact SQL operation that fails.

Deliverable: ownership post, source-path map, primary references and explicit
assumptions. Stop incompatible work if another owner has already claimed it.

## Phase 2: execute finite local codec and resource experiments

Build a standalone research probe using Node's real SQLite and the current
`message-replay-snapshot.mjs` functions. Use synthetic data only, in a temporary
directory removed on completion. No Room credentials or production request.

Measure 1,000, 10,000 and 50,000 synthetic messages with ordinary Unicode text.
For each size, record encoded bytes, part count, largest part, bytes bound to
snapshot write statements, bytes returned by snapshot reads, and wall time.
Close and reopen the SQLite connection before decoding. Check exact round-trip
content, then alter and remove a persisted part and require refusal. Restore
the original fixture between independent corruption controls.

This is a codec/resource experiment, not a Worker restart test and not a full
backfill benchmark. Count returned SQL bytes independently from total database
work. Time measurements on this Mac do not establish production CPU headroom.
The important falsifier is whether per-continuation I/O grows with total state
despite fixed event count; an event limit alone does not bound checkpoint I/O.

If the codec expands or rewrites the full state, hand root the measured shape
and exact call sites. Do not replace it here while root's COW lane is active.

## Phase 3: execute a source-bound progress model

Read the actual deferred step list and two-step rotation from current source;
read the 200-event default and hourly job cadence. Record these inputs in the
result. Model the conditional case where only this driver progresses replay,
with no deadline failures or competing rooms: an optimistic capacity bound,
not an observation of actual production throughput.

Run at least 72 hourly visits for arrival rates 0, 20, 36, 40, 100 and 1,000
events per hour, beginning 1,799 events behind. Record service visits, lag,
catch-up status and maximum lag. Extend no-arrival and stable-arrival cases to
their first catch-up or a finite horizon. Include competing-room service as a
strictly worse case, not a fabricated observed rate.

Model a proposed bounded continuation consumer independently of implementation:
fixed-size requests consume committed prefixes, arrival rates vary, duplicate
delivery returns saved progress, process restart resumes durable cursor, and a
source mutation invalidates staged authority. Quantify the service margin
needed to close lag. No new timers, schedules, alarms or job registrations are
created by this model.

Acceptance is not simply cursor monotonicity. Required observations are
committed replay sequence, current source head, lag delta, bytes/events processed,
oldest pending age, durable stop/refusal reason and scope actually verified.
A healthy integrity heartbeat does not prove the migration is caught up.

## Phase 4: specify the smallest safe large-history continuation

Reuse root's existing generation/COW work and replay contract. A bounded
continuation should bind room, generation, source horizon, sequence/event
anchor, input digest chain and schema/decoder version. Keep staged records
separate from serving authority until exact qualification completes. A final
small metadata pointer transaction must not hide a full row copy, proof scan,
JSON assembly or replay inside it.

For archived records, count parity is insufficient. Establish full record and
posting provenance against independently protected history/checkpoint state;
do not generate replacement entity proofs from altered replay just because a
new fold and its own parity agree. Missing proofs and present invalid proofs
have different admission paths. A source hash computed from suspect rows is
not independent source evidence.

Concurrent writes need an explicit contract: capture an immutable qualified
prefix, then consume the admitted tail while the live writer protects current
proofs. If catch-up cannot beat arrivals, report this and stop eligibility;
do not hold all room traffic while an unbounded scan runs. Any final writer
fence must be brief, bounded and measured, with a safe refusal preserving the
current format. Do not invent a generic migration platform if the current
store and operator transaction can express this contract.

Privacy operations invalidate or scrub every affected staged generation,
snapshot part and resume artifact in the same transaction that erases serving
content. A stale continuation must never resurrect deleted text. Staged data
needs explicit reclamation so failed generations do not grow without bound.

Checkpoint-loss recovery must consume the saved historical contract and prove
the same interpretation. It must not silently fall back to a different reducer
contract, trust a weak legacy snapshot, or publish a partially reconstructed
room. Restart durability and checkpoint independence are separate controls.

## Phase 5: verification and handoff

Publish the research scripts, raw machine-readable results, source pin and
readable findings on one independent branch. No production code changes are
implied. Send root one compact post with the concrete finding, artifact and
next useful implementation decision. Update the local ongoing handoff.

If root supplies a finite candidate, inspect its exact diff and choose the
smallest falsifiers absent from existing evidence: old-event mutation behind
anchor, changed proof during staging, privacy deletion between continuations,
checkpoint loss after restart, duplicate continuation, or final-commit work
scaling. Do not repeat suites that already cover unchanged source.

The eventual runtime acceptance matrix should cover row/byte bounds at every
stage, actual Worker rowsRead and payload counts, source/proof conflicts,
restart at each transition, rollback after the pointer write, exact retry after
later writes, archival semantics, and post-cutover steady-state read/write cost.
Use synthetic sizes bracketing the known backup shape; root alone validates
the actual private fixture. A refused real room remains refused until its
specific prerequisite is cured and newly proved.

## Stop conditions and remaining authority

Stop an experiment when its finite question is answered, a typed storage fault
invalidates the evidence, or overlap is discovered. Preserve failed controls;
do not raise limits, clear quarantine or relabel an unexplained timeout as fixed.
Root remains sole merger/deployer. This plan authorizes our local research and
evidence delivery; it does not independently grant permission to convert real
rooms, change privacy policy, install a host sandbox or create a routine.

For this work session, completion means the plan is written, the independent
local experiments are executed and the actionable results reach root. Actual
large-room conversion remains an implementation/release outcome requiring its
own qualified evidence and coordinated ownership.

## Primary research references

Read 2026-11-01:

- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/durable-objects/api/alarms/

Execution results and the precise platform implications are recorded separately
in FINDINGS.md to distinguish prior hypotheses from observed results.
