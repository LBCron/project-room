# Receipts faces: corrected list copy + JSON verification caveats

Draft PR prepared by Jill's fleet (wave-2600 coordinator I, from coordinator B's filed fix packs) for Codex, sole production writer, to land or close. Base: main `8c9deff7` (re-pinned via GitHub API at open time; also the production build both defects were reproduced on). Head: `51b074eb5`.

## Defects (reproduced live 2026-11-04 on production build 8c9deff7)

1. The `/receipts` header (`server/receipts-page.mjs`, was line 102) and the page meta description (was line 92) claimed the list is merged/completed work, while coordinator B's live census found **0/46** public receipts merge-backed (no non-null `pullRequest` or `mergedAt`), with submitted and rejected receipts in the list.
2. The `.json` face carried a bare `{"state":"verified"}` verification object on **10/46** faces (12 object-shape faces in total: 10 verified + 2 self_attested), stripping the caveats the HTML face carries (member-reviewed tier, no merge verified by the server, unsigned).

## Fix (one file: `server/receipts-page.mjs`, +9/−3)

- Header and meta description replaced with B's corrected copy verbatim: no list-level merged or completed claim; each receipt states what was checked.
- `publicJson` verification passthrough: object verification is enriched additively — `tier` ("member-reviewed verdict" for `verified`, "bundle unaltered (self-asserted)" for `self_attested`, the HTML face's own tier wordings), `mergeVerified` computed from the record's own `pullRequest` + `mergedAt`, and `signed: false`. No field removed or renamed; `verification.state` consumers unaffected. Both JSON faces (list and detail) are cured in this one place.

One deliberate deviation from B's literal `proposed-fix.patch`: the patch as written spreads any truthy `verification` into an object, which would have corrupted the string-verification faces (`hash_only` / `system_checked`, 33 of 46 faces) into character-index objects. The enrichment here applies only when `verification` is an object, and string values pass through untouched — which is the behaviour B's pack states as its scope ("the string-verification faces are untouched"). Verified by direct probe: `hash_only` and `system_checked` pass through byte-identical; `self_attested` gains its tier; a verified record carrying a PR + merge stamp yields `mergeVerified: true`; a record with no verification gains none.

## Falsifier check (coordinator B's `check-receipts-copy.mjs`, run both ways this session)

- Pristine main `8c9deff7`: **FAIL, exit 1** — `FAIL (1)` header/meta claim present (`headerClaim: true, metaClaim: true`); `FAIL (2)` verification exactly `{ state: 'verified' }`, `hasTier/hasMergeFlag/hasUnsigned` all false.
- This head `51b074eb5`: **PASS, exit 0** — `PASS (1)` and `PASS (2)`.

## Tests (run locally at head `51b074eb5`, node --test)

- Batch 1 (7 files: design-tokens, public-work-receipt-outcome, lot-receipt-page, receipt-cross-reference-page, receipt-share, receipts-skip-link, receipt-dispute-decider): **41 PASSED / 0 FAILED**
- Batch 2 (9 files: fleet-incident-evals, front-door-batch, receipt-detail-dates, receipt-detail-honesty, receipt-sr-noise, receipt-stamp-outcome, receipt-verdict-links, receipt-verdict-page, receipt-share): **53 PASSED / 0 FAILED**
- `scripts/lint-design-tokens.mjs`: **PASSED** (ratchet clean, 0 new)
- Full suite: **NOT-RUN** locally (targeted suites above cover every test file importing the changed module)

## CI at exact head `51b074eb5`

Read via `gh pr checks` at head `51b074eb5` after all runs settled. The PR is a draft, so the heavy jobs were skipped by the workflows; skipped is recorded here as NOT-RUN and is never folded into green.

- PASSED: `mechanical` (11s), `safety-net` (1m6s), `ci-verdict` (4s — the verdict job's own status; it does not make the skipped jobs green)
- NOT-RUN (skipped on draft): `browser`, `browser shard`, `changes`, `cloudflare`, `contract`, `coverage`, `friend-agent-e2e`, `full`, `gates`, `lint`, `unit`, `visual-refresh-guard`, `quarantined-tests`, `schema-gate`, `test`
- FAILED: none

## Open gate

Rule-35 adversarial sentence-probe of the new copy by a non-author is still owed before landing.

No adversarial pass section is included: coordinator B's pack supplies the exact sentences to attack but no executed probe, and none was executed by this lane (author side). The gate above stands.
