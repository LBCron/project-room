# Executed findings and implementation handoff

Source: `513d3ee8471464803fd3c70dea2fe9ce30f27ad0`. Measurements made locally
on 2026-11-01 with Node 24.22.1 and cached Miniflare 4.20260730.0 / workerd.
All data is synthetic. No production mutation, private backup access, deployment,
schedule or runtime source change occurred in this lane.

## Finding 1: small snapshot rows do not bound continuation cost

The existing codec in `server/message-replay-snapshot.mjs` splits a serialized
snapshot at 600,000 UTF-16 code units and writes a part manifest containing a
SHA-256 digest. Decode reads every part, joins all text, hashes it and parses
the complete state. A small appended message causes every part to be rewritten.
Splitting avoids one large SQL value; it does not turn that state into a
bounded working set.

The real local SQLite experiment measured:

| Messages | Full JSON bytes | Part rows | Bytes read after reopen | Bytes bound for one-message append |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | 293,960 | 0 | 293,960 | 294,072 |
| 10,000 | 2,948,960 | 5 | 2,949,032 | 2,949,190 |
| 50,000 | 14,788,960 | 21 | 14,789,033 | 14,789,335 |

Independent real workerd codec execution, including dispose/recreate on the
same persisted directory, measured the same scaling:

| Messages | Read SQL rows | Read payload bytes | Append bytes bound | Append rows written |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | 1 | 293,930 | 294,045 | 1 |
| 10,000 | 6 | 2,949,002 | 2,949,162 | 6 |
| 30,000 | 14 | 8,869,003 | 8,869,235 | 14 |

These synthetic state shapes differ slightly between probes; exact raw receipts
are beside this document. The difference is intentional and no byte-for-byte
cross-runtime identity is claimed. Each runtime checks its own round-trip
digest/content across restart. Altered persisted parts refuse after restart;
the SQLite probe also removes a part and requires refusal. The unsplit 1,000
case has no part corruption control and records null, not a false pass.

The Worker append at 30,000 messages took about 91 ms request wall time locally.
That is not an admission bound or production CPU claim. More significant is
that just 14 returned rows transfer almost 9 MB. A row-only budget misses this
cost, and a small `events` count misses it too. The hash protects torn parts;
it does not independently prove the replay source was legitimate.

The direct backfill path confirms relevance: `fillRoom` loads the snapshot
before applying its bounded event batch, and `saveCursor` serializes the new
state each committed chunk. `BACKFILL_COMMIT=25` and a 200-event call can therefore
rewrite the checkpoint up to eight times. This last multiplier is a source
inference; the codec experiment did not measure a full reducer/backfill call.

Action: root's existing COW lane should make changed pages/records the working
unit. Admission and telemetry must include checkpoint bytes read/written and
peak assembled state, not only SQL rows, event count or individual value size.
Keep the existing codec compatibility path until its replacement has qualified
checkpoint-loss and privacy semantics. Do not merely increase part size.

## Finding 2: demonstrate service margin, not just durable progress

Current source has 11 deferred checks, executes at most two per integrity visit,
uses a default 200-event backfill batch and schedules integrity hourly. If this
were the only effective replay driver and every visit completed, its optimistic
long-run capacity would be 400/11 = 36.36 events/hour for the entire sweep.

With an initial lag of 1,799 events, starting deferred step zero:

| New events/hour | Lag after 72 hourly visits | First instant caught up in finite model |
| --- | ---: | ---: |
| 0 | 0 | hour 49 |
| 20 | 639 | hour 110 |
| 36 | 1,791 | hour 4,900 |
| 40 | 2,079 | never within 72 hours; positive long-run drift |
| 100 | 6,399 | never within 72 hours; positive long-run drift |
| 1,000 | 71,199 | never within 72 hours; positive long-run drift |

First caught up is a point-in-time observation, not sustained zero lag: new
events can arrive before the next service visit. At 36/hour the service margin
is tiny; the extremely slow catch-up is consistent with the formula. With an
illustrative half allocation to one of two rooms, even 20/hour grows lag to
1,939 after 72 hours. The actual selector does not promise equal shares.

This is explicitly conditional. It does not establish actual live arrival
rates, actual service allocation, frequency of other callers or a causal
explanation for historical heartbeat delays. Root's new continuations may
provide other service. Observe their completed batches and byte-limited work
before claiming a catch-up time.

The result also includes sensitivity for proposed consumers. For example,
200-event successful batches six times an hour give 1,200 events/hour before
byte limits: only a 200/hour margin against 1,000 arrivals/hour, about nine
hours to drain the example backlog in a fluid estimate. Sixty batches/hour
would provide 12,000 before byte limits. These are capacity arithmetic, not
recommended schedules or deployed throughput. No driver was added.

Action: use the existing owned continuation mechanism to consume finite useful
work while pending. Record a tuple `(head, committed replay sequence, generation,
events, source bytes, checkpoint read/write bytes, outstanding lag, reason)`.
Require positive measured net drain under an admitted arrival workload. Persist
the stop reason and fail honestly when a room cannot catch up under its budget.
Keep normal integrity verification independent of migration progress.

## Source qualification and minimal continuation contract

Reuse existing mechanisms rather than introduce another migration framework:

1. **Admit a generation.** Bind room, decoder/adapter version, source prefix,
   schema and independently trusted serving/proof evidence. Read raw UTF-8
   bytes with strict decoding where historical provenance depends on bytes;
   preserve the existing `historical-replay-contract.mjs` framing. The current
   saved small-prefix consumer is owned by root and is not reimplemented here.
2. **Capture bounded pages.** Store immutable source/staging pages with explicit
   row/byte budgets, exact consumed position and cumulative manifest digest.
   A per-page hash detects later page mutation. It does not validate original
   content merely because it was hashed during capture.
3. **Qualify archived records.** Full authoritative message record and posting
   provenance must match protected evidence. Archive counts or thread stubs
   cannot establish full content parity. The events table at this pin stores
   sequence/id/body, without an independent per-event hash-chain field. Do not
   describe a newly computed replay digest as proof an older event never changed.
   Where historical evidence is insufficient, return unknown/refused, or require
   the separately qualified reconstruction contract and independent equality.
4. **Preserve active proofs.** Existing valid entity proofs constrain replay;
   never overwrite posting sequence and stamp a new proof from the altered log.
   Missing and invalid proofs remain distinct. Any exception for absent proofs
   must have independently proved complete equality and an explicit receipt.
5. **Consume a tail.** Capture a stable source horizon and then process the
   allowed live tail with measured service margin. New legitimate writes cannot
   silently change the interpretation of completed pages. Late edits/deletions
   must either update the right generation atomically or invalidate it; they
   must never be ignored just because their message was captured earlier.
6. **Commit a small pointer.** The final transaction checks generation/head and
   completed qualifications, then switches serving metadata and writes the saved
   receipt. No final full-state assembly, all-record hash, all-record copy or
   legacy full parity scan may hide behind this small-looking operation.
7. **Retry and recover.** Identical operation id/input returns saved progress or
   the final saved result. Changed input conflicts. Restart resumes the committed
   generation. Checkpoint loss must consume the saved historical contract; it
   cannot fall back to a different reducer interpretation. Old generations are
   reclaimed in bounded steps after the needed recovery window.

Privacy is a write-path requirement across all stages. A redaction/deletion
must purge affected staging pages, checkpoints and saved replay material in the
same privacy transaction or invalidate any artifact that could republish it.
Do not retain unbounded historical payload merely to make conversion easier.

One additional review target is fallback diagnosis:
`diagnoseFreshBlock` and `rediagnoseBlock` can fall back to `diagnoseBlock`, which
loads/replays the full event history; `diagnoseFromCursor` also reads the whole
selected suffix. A small replay batch alone does not bound error handling.
Existing typed storage-fault propagation must remain intact. Root should cover
checkpoint absence/corruption and blocked-event diagnosis in its resource matrix,
not only the successful continuation and final pointer swap.

## Focused next ownership and acceptance

Root keeps the runtime lane. Offer this laptop one finite exact-source review
when the COW/historical consumer is ready. Useful falsifiers are an older-event
change behind the immediate anchor, privacy deletion between pages, missing
checkpoint after process restart, duplicate continuation after later writes,
and final commit cost versus total history. No need to repeat the completed
small-room review, broad unit sweep or other agents' live smoke.

The local probes are complete and passed their assertions. They establish codec
round-trip/refusal and resource scaling; they do not complete large-room
conversion, prove live throughput or reproduce a production outage.

## Primary documentation checked on 2026-11-01

Cloudflare currently documents a 2 MB SQL string/BLOB/row ceiling and default
30-second active CPU budget. Per-operation application budgets should sit below
these and be tested together; these published ceilings do not prove behavior of
an already-stored old oversized value. [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/)

Synchronous storage transactions roll back on throw and their callback cannot
return a promise. This supports a small atomic final pointer and saved receipt,
not an arbitrarily long synchronous final scan.
[SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

Alarms are at least once, have a single active alarm per object and bounded
automatic error retries. Therefore existing alarm-driven continuation must have
durable progress and idempotent input. This research did not add or change one.
[Alarms API](https://developers.cloudflare.com/durable-objects/api/alarms/)

## Reproduction

From the pinned worktree, with Node 24 and cached dependencies available:

```sh
node docs/research/2026-11-01-member2-large-history/checkpoint-probe.mjs /tmp/new-codec-results.json
node docs/research/2026-11-01-member2-large-history/progress-model.mjs /tmp/new-progress-results.json
node docs/research/2026-11-01-member2-large-history/checkpoint-worker-probe.mjs /tmp/new-worker-results.json
```

Choose fresh output paths: the scripts use exclusive creation. The Worker probe
resolves installed esbuild/Miniflare through `cloudflare/package.json`; this
session reused cached dependencies without installing packages. Each actual
database directory is temporary and removed on completion. Generated Wrangler
cache files are not part of this evidence branch.
