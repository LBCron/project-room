# #5582 exact-SQL work census: finite blocker

Exact reviewed source: `eb3edf071f4dd4dec9e67bdcfbb041123b001ed8`. The census made no Jill source edits, production/network calls or credential reads and did not rerun broad suites. This evidence-only branch publication is separate.

The candidate bounds application/result rows, but these exact SQL statements do not establish a per-call bound on SQLite work. The finite synthetic controls below demonstrate history-proportional engine progress with constant returned rows. This is a source-level counterexample to the scan-cost qualification, not a production latency or CPU claim.

## Measured controls

Python SQLite 3.51.0, exact unmodified SQL and source schema/index fragments, synthetic in-memory data. A progress handler runs at instruction interval 1 around a warmed statement. The counts are observed SQLite progress callbacks: engine-work evidence, not returned rows, physical pages, SQL rowsRead, bytes read or CPU time. Instrumented timing includes Python callback overhead and is intentionally not used for a speed claim.

| Exact-query fixture | Rows returned, 1k → 10k | Progress callbacks, 1k → 10k | Ratio |
|---|---:|---:|---:|
| plain | 0 → 0 | 9,059 → 90,059 | 9.94× |
| reply-last | 1 → 1 | 9,064 → 90,064 | 9.94× |
| mention-dense | 512 → 512 | 20,040 → 20,040 | 1.00× |
| mention-sparse | 10 → 100 | 11,354 → 112,874 | 9.94× |
| mention-narrow-window | 10 → 10 | 464 → 464 | 1.00× |
| mention-other-member-control | 10 → 10 | 11,354 → 110,354 | 9.72× |

Replies: all 1,000/10,000 events are ordinary message.posted records without replyToId. The query returns no row, so the source repliesOf loop increments scannedRows zero times and exits. Nevertheless, the sequence-range scan evaluates history through the end: 9,059/90,059 progress callbacks. Putting a single reply only at the end also returns one row at both sizes, with 9,064/90,064 callbacks. LIMIT 256 follows the JSON predicates; it caps qualifying output, not the events inspected to find it. The stored event-type/work expression indexes were included, not omitted.

Mentions: the default local planner chooses events PK sequence order, then point-probes mention_states and mention_observations. It does not choose the hypothesized mention_states_member + sort plan on these default statistics. With ten viewer mentions at the start and all remaining mention rows belonging to another member, both fixtures return ten viewer rows, but progress grows 11,354 → 110,354. Thus even constant member output need not bound the driving event scan. Sparse viewer mentions every 100 events similarly grow with the history range.

Dense mentions are an important nonfailure control: the first 512 matching sequence-ordered events end the query with equal engine progress at both sizes. A narrow last-ten sequence window is also constant. Do not generalize the result to every mention query or claim that every invocation scans the whole room.

## Planner-statistics contrast

The same fixture/schema/query was separately profiled after fixture-only ANALYZE. Plain replies remain linear (9,085 → 90,085), and the constant-ten-viewer case remains linear (11,377 → 110,377). For sparse mentions, the optimizer switches to SCAN m, event-ID point lookups and USE TEMP B-TREE FOR ORDER BY, counting 631 → 5,594 callbacks for ten → one hundred candidates. This observes the alternative sort structure, but does not establish a production member-index plan or a >512-row sort on these particular sparse fixtures. The concrete constant-output blockers above do not depend on the sorting hypothesis.

No query was rewritten, INDEXED BY forced, production statistics copied, or hypothetical Cloudflare work count invented. Actual Node/workerd SQLite versions and planner statistics may differ. A returned-row limit cannot itself certify planner-independent work bounds; these local source-equivalent counterexamples are enough to reject that claimed guarantee.

## Exact source and queries

- `repliesOf` SQL SHA256: `a99f73eaccae5bd47e0b547e4f288c57cd049fc3b5b9e16b756e6808af42a6aa`.
- `mentionHorizon` SQL SHA256: `be3924022c0724c28526963917dce1f096435776296069d99462b054208ee8c7`.

Full SQL text, source-file hashes, extracted DDL/indexes, all EXPLAIN QUERY PLAN rows, bytecode opcode counts and both fixture sizes are retained in the structured evidence. Each fixture has at most 10,000 events; actual maximum database size across these controls is 4145152 bytes. The measured query is capped at five seconds / five million progress callbacks, and each in-memory database has a 32 MiB page cap. Both complete runs finished under one second each on this host. These caps are audit controls, not product guarantees.

## Scope and narrow acceptance needed

Block the claim that scannedRows/256/512 bounds SQL work at this head. Preserve the source pin and author evidence; do not relabel the reported result/application count as rows examined by the database. This census profiles only these statements, not the endpoint's authentication, metadata/proof reads, full reducer behavior, message body worst case or publication semantics.

A narrow source cure would bound the indexed input sequence window before JSON filtering/join qualification, and advance continuation only through that actual input window. Replies must account for non-reply events too; mentions must not depend on an optimizer choosing one particular bounded plan. Preserve privacy, current-state/deletion checks, exact cursor/hasMore behavior and empty-window progress. This is a proposed acceptance direction for Jill/root, not an implementation authorization or permission change.

Acceptance should retain these exact 1k/10k plain/sparse/member controls, plus a real Worker SQL-cost census where available. Require a fixed input-window work ceiling and honest counters under zero qualifying rows, not merely a smaller result payload. A claimed cure must keep the bounded input limit inside the driving query rather than after history-dependent filtering, and may need bounded body-byte admission separately. No broad existing suite rerun is requested by this finding.

## Reproduction artifacts

- Script: `needs-me-5582-sql-census-1101.py`; SHA256 `f97c094b2074bacab2231ab14ee4b4091ae9c66f7bcc8589a917468534419788`.
- Baseline evidence: `evidence/needs-me-5582-sql-census-1101.json`.
- Fixture-ANALYZE contrast: `evidence/needs-me-5582-sql-census-1101-analyzed.json`.

The script reads exact Git objects and writes only synthetic in-memory fixture data and exclusive new audit JSON. Existing evidence outputs are not overwritten; retain or copy them before any intentional rerun. The first schema-extraction attempt refused a trailing JavaScript quote in an index definition; that harness extraction was corrected before either counted run and is not a product failure.


Portable branch copy: `needs-me-5582-sql-census.py`; only repository/output path constants and trailing whitespace differ from the original source-pinned census. Set `PROJECT_ROOM_CENSUS_REPO` to a checkout containing the pinned Git objects, and `PROJECT_ROOM_CENSUS_OUTPUT` to a fresh absolute JSON path. Run with `python3 needs-me-5582-sql-census.py`, optionally `--analyzed`. Exclusive output prevents replacing existing receipts. No new run was made merely for these path substitutions.
