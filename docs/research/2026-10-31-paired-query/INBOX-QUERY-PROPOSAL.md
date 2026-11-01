# Inbox query proposal and experiment results

Exact source: PR #5491, `896d2f3102221d061c6ff51454e350fd82ebfdfd`. Experiments use disposable Node SQLite databases. They do not modify the shared schema, integrate a migration, qualify Workers write cost, or establish production latency.

## Recommendation

Separate the small assignment-index improvement from the larger reviewer-routing change. A partial active-owner index is a direct follow-up with limited migration scope. Reviewer lookup benefits from a tag-token sidecar, but that sidecar is safe only after all writer/import/restore paths maintain it atomically or a completeness-aware fallback exists. Do not treat the reviewer prototype as production-ready.

The current code already avoids full claim/history hydration. It bounds each metadata batch to 128 rows, then applies reviewer identity and current-review checks before the 50-result public limit. Preserve that behavior. Bounded batches do not make a full scan bounded in total CPU.

## Current predicates and plans

`server/work-claim-sqlite.mjs` constructs JSON expressions that accept numeric envelope versions and legacy plain objects. The owner index is `(room_id, owner-expression)`. The assignment query adds `rowid > cursor` and the active-state predicate, but the index includes terminal claims. SQLite reports `SEARCH work_claims USING INDEX work_claim_inbox_owner (room_id=? AND <expr>=? AND rowid>?)`; it still evaluates state on historical owned rows.

The review index is partial on nonterminal claims with a nonempty tags array, indexed by room. The query excludes the current owner and pages by rowid. SQLite reports `SEARCH work_claims USING INDEX work_claim_inbox_review (room_id=? AND rowid>?)`. It has no index restriction for the actual reviewer tag, so unrelated active tags remain candidates.

## Assignment improvement

Disposable DDL uses the same owner JSON expression as the current query and this exact partial predicate:

```sql
WHERE state_expression IN ('claimed','in_progress','blocked','delivered')
```

With this index present, SQLite chooses `active_owner_prototype` with room, owner and rowid range restrictions. Missing legacy state is not an active assignment in the current contract; do not broaden it accidentally. The caller still excludes superseded claims. This prototype does not eliminate scanning many active-but-superseded claims, and does not claim to.

Five warm measurements per fixture, one active owned result after terminal history, 4 KiB history per distractor:

| Terminal owned claims | Existing median | Partial-index median | Index build |
| --- | ---: | ---: | ---: |
| 100 | 0.270 ms | 0.046 ms | 0.271 ms |
| 1,000 | 2.500 ms | 0.049 ms | 2.694 ms |
| 5,000 | 11.540 ms | 0.044 ms | 12.210 ms |

These are local in-memory samples. Index construction parses existing JSON once and can fail on corrupt rows; it must participate in atomic schema initialization and schema-stamp/definition verification. Write/index maintenance overhead remains to be measured on the intended runtime. Prefer a distinct additive index name, coordinated replacement after compatibility checks, and a code-owned rebuild path. Existing read-only old handles must retain correct scan behavior.

## Reviewer candidate design

Store raw reviewer-tag suffixes, not permanently resolved member IDs. Example fixture shape:

```sql
reviewer_tokens(room_id, claim_rowid, exact, slug)
reviewer_exact(room_id, exact, claim_rowid)
reviewer_slug(room_id, slug, claim_rowid)
```

`exact` preserves the text after `rev-`; `slug` applies the exact existing lowercase/alphanumeric normalization. At read time derive lookup keys from the current member ID and current display name. The exact ID and normalized alias lookups are a UNION, so duplicate tokens do not duplicate candidates. Always run the current `resolveNamedReviewers` again against current membership: an active member ID takes precedence over an alias, collisions invalidate alias routing, and inactive members do not receive review asks.

Keep `hasCurrentReview` and its revision, owner, claim timestamp, CI head, delivery digest and delivery generation semantics at the final filter. Do not invent another review-basis implementation in SQL. The prototype deliberately uses the exact source functions as its oracle.

A simple `rowid IN (UNION tag lookups)` makes the unrelated-tag case fast but can materialize every matching tag row. Its five-warm-run query medians at 100/1,000/5,000 unrelated tags were 0.058/0.057/0.052 ms, versus 0.993/9.661/49.134 ms for current candidate enumeration. Token population is outside those query timings. These figures must not be presented as a hard CPU bound or complete end-to-end comparison.

## Bounded raw-key continuation

The separately tested bounded design first obtains at most 128 raw keys:

```sql
SELECT claim_rowid FROM reviewer_tokens
 WHERE room_id=? AND exact=? AND claim_rowid>?
UNION
SELECT claim_rowid FROM reviewer_tokens
 WHERE room_id=? AND slug=? AND claim_rowid>?
ORDER BY claim_rowid LIMIT ?
```

Both branches use covering indexes with `claim_rowid>?`; `EXPLAIN QUERY PLAN` reports `MERGE (UNION)` and indexed range searches on `reviewer_exact` and `reviewer_slug`. Fetch the compact claim metadata only for those keys, preserve current SQL visibility/state filters, then apply current semantic checks.

Advance the cursor over **every raw key consumed**, including claims omitted by SQL or semantic filtering. An empty filtered batch is not end-of-list. The experiment has two empty 128-key pages before a late matching result and returns a continuation on both. Only raw-key exhaustion proves EOF. Count 51 semantic matches to decide the existing 50-result `hasMore` contract.

The experiment's rowid checkpoint is not a deployable cursor. Production continuation must bind the actor/authentication epoch, room, selection, revision and current member/alias state. Changed membership, claim routing, review basis, deletion/recreation or restore must require restart or a provably consistent snapshot. Without those bindings, a cursor can silently omit work or cross an authorization change. A finite work budget can produce no matches plus a continuation; callers must present that as incomplete discovery, not `nothing open`.

## Sidecar completeness and write obligations

The fixture adapter updates the claim and tag rows together in its caller's transaction. Production needs an explicit inventory of all paths: registry set/delete, transaction rollback, direct SQL maintenance, restore/import, database replacement, privacy purge, migration, and fixture adapters. Deletion must remove tokens before rowid reuse can designate a different claim. A sidecar must never be regarded as complete merely because its table exists.

For rollout, either atomically backfill at a bounded, measured database size, or maintain dual writes with an explicit generation/backfill watermark and a correct fallback for uncovered rows. Advance completeness only in the transaction that establishes coverage. Validate/rebuild under a code-owned schema version after restore. Do not replay arbitrary backup SQL to create the index. Failed or interrupted backfill must not publish a false complete marker.

An imported corrupt claim must preserve current failure/quarantine semantics. The prototype operates on valid legacy/enveloped rows; malformed codec behavior is not qualified by these tests. Actual Workers migration, eviction/restart, read-only old-database compatibility, write amplification, cancellation and cross-version cursor behavior remain adoption gates.

## Executed negative cases

All eight checks in `inbox-query-prototype.mjs` passed:

1. A relevant review after 270 current reviews survives bounded empty pages.
2. Exact IDs, normalized aliases, alias collisions, renames, inactive members and ID precedence match the existing resolver.
3. Unrelated tags, superseded and terminal claims, private-room rows and legacy missing state do not produce false routing or hide a late relevant item.
4. Revision, CI head, digest and generation changes preserve current-review decisions.
5. The 50-result boundary is calculated after semantic filtering, retaining a 51st match as evidence of more results.
6. Tag replacement, deletion, rollback and rowid reuse do not retain stale tokens in the fixture adapter.
7. A fully SQL-filtered raw-token batch advances with continuation rather than falsely reporting EOF.
8. Bounded-key lookup still agrees with current alias and stale-review semantics.

Runnable experiment: `node inbox-query-prototype.mjs SOURCE_ROOT REVISION_LABEL RESULT_PATH`. Raw results and plans: `inbox-query-prototype-results.json`. The revision label is caller-supplied provenance; SHA-256 hashes of both imported production files independently bind actual inputs. No production fix, merge or deploy is claimed.

## Bounded-page and write-cost follow-up

With 1,000 and 5,000 already-reviewed matching tags, a 128-key budget consumed exactly 128 keys, returned no matches plus an explicit continuation, and took local warm medians of 1.69 and 1.66 ms respectively. This bounds page work; finding a late result across many pages still requires total work proportional to relevant candidate history. These are separate measurements from the very fast unrelated-tag lookup.

A naive sidecar replacement on 1,000 unchanged-tag claim updates caused 3,000 logical row changes versus 1,000 for raw item updates, taking 26.56 ms versus 4.77 ms in this in-memory sample. The comparison is a fixture write operation, not the full production registry or WAL accounting. It is sufficient to reject blind delete/reinsert of tags on every unrelated update: production should maintain a tag diff only when tag routing changes, with atomic invalidation/rebuild coverage. Do not trade the read bottleneck for unnecessary writes.
