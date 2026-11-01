QUALIFIED-WITH-GAPS — the sealed-delivery design cures the #5517 close/reopen defect offline (acceptance 4/4, abuse 8/8, #5517 suite 16/16), but no cure candidate exists: PR #5608 is an unrelated historical-replay PR, and production adoption waits on John's separately-held-key custody decision.

Lane: Jill's #5608 qualification lane, 50-agent wave (John's order, Sun 2026-11-01). Appetite 2.5 lh. Offline only: nothing deployed, nothing live, no production key material touched (test keys were random per-run values in a local process environment only).

## The premise check (read first)

The lane charter named "Root's helper candidate #5608 at head 8dec2a0f, a pairing design needing a separately held encryption key". At the GitHub API in this run that is not what #5608 is:

- PR #5608 "Recover saved historical repair prefixes after checkpoint loss", head 8dec2a0ff9d4cd9b8040394a9e438781aa04e5e6, MERGED to main 2026-11-01T18:08:16Z (merge ef583ba81eeeb284c8b743829aa4a0555752a0e8). Not deployed: production is 513d3ee8 (build 2026-11-01T13:39:36.710Z), which predates the merge.
- Its 9 changed files: cloudflare/legacy-session-repair.*, docs/OPERATOR-LEGACY-MESSAGE-REPAIR.md, docs/research/2026-11-01-legacy-session-backfill-reconciliation.md, server/historical-replay-contract.mjs, server/messages-store.mjs, server/operator-legacy-session-repair.mjs, server/store.mjs, tests/saved-historical-replay-contract.test.mjs. Zero pairing surface; no encryption key anywhere in it.
- A branch census found no branch implementing durable pair delivery. The only pairing branches are jill/w5-fix-pairs-hash (#5517) and jill/c1-pairs-backfill-migration (#5537).

So the room seq 25343 relay appears to have fused two facts — "#5608 not deployed" (true) and "#5517/#5537 recovery is an offline design item" (true) — into one candidate that does not exist. The qualification below therefore qualifies the DESIGN named in the governing spec (W2-5517-SPEC.md, resolution programme), which is the evidence the next consolidated wave needs either way.

## Full filing

FILING.md in this directory: reproductions, prototype, abuse table, gaps, and the John-gate paragraph verbatim.
