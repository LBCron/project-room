# Member2 MVP handoff

User direction: stop broader research, help the other laptop finish the MVP, and avoid unnecessary complexity.

Agreed with the other laptop at Room sequence 24718: dependable Dot/Codex onboarding is first. Bounded-query implementation is deferred and ownership returned to root. Root retains runtime/core implementation, Dot retains TOML preflight, and Fo retains browser qualification. Member2 provides independent recovery/security boundary checks. Formal availability request answered at sequence 24722.

## Onboarding disposition

Exact candidate: `80b9e73fb5ff487fc01d687062dba14393313bb5`, PR #5565. Node v24.22.1 on this Mac. Production source unchanged.

Seven independent cases passed against real local HTTP servers and disposable state:

1. Symlinked journal receipt refuses before network and preserves target bytes.
2. Hard-linked journal receipt refuses before network and preserves target bytes.
3. Symlinked SQLite ownership file refuses before network.
4. Symlinked operation directory refuses before network.
5. Copying pending state to another origin's operation refuses before network; both original invitations remain usable.
6. A real child process exits immediately after final connection rename, before the journal records completion. Retry preserves member, identity, host and credential; performs zero further redemptions/rotations; and clears pending secrets from the completed receipt.
7. A redemption response carrying another member's valid room token fails the membership check and saves no connection.

Disposition: independent boundary confirmation for these cases; no new onboarding defect found. This is not full security certification, a Node24.19 minimum-version execution, a native friend installation, or complete MVP/release qualification. The owner's existing 118-test suite was not repeated.

Reproduction: `node --test tests/member2-acp-recovery-boundaries.test.mjs` from the exact candidate with its normal dependencies. Raw output: `mvp-onboarding-independent.log`.

## Core integrity observation retained separately

Exact candidate: `61225bed6bce0a4b4df3f6edddbfb995857056fc`. Existing focused upgrade/write-integrity/reconciliation tests: 39 passed, zero failed/skipped.

Independent genuine-source experiment:

* Prior v43 `4b060ff07ce0bbedb3eae216e40825315cc9eff5`, intact strong content baseline: upgrades and can post Unicode.
* Prior v43 `72a7d6e4d7e67e866b6314c2218e8a2a0cac8fc5`, without historical content proof: receives prospective metadata protection while historical content proof stays NULL, then can post.
* Same-length mutation of v43 metadata with a strong baseline: initial current open correctly refuses and preserves projection bytes, but schema advances 43 to 44. Second open succeeds and can read the modified title; ordinary writes still refuse and the integrity scan reports the content failure. No write-based blessing was observed.

Sent to root at sequences 24717 and 24720 for migration atomicity/recovery assessment. This observation is separate from onboarding and is not labeled a newly established onboarding blocker. Stop unchanged-core review per the handoff; root owns any repair.

Reproduction: place `member2-upgrade-negative.mjs` under `scripts/` in the exact core candidate and run `node scripts/member2-upgrade-negative.mjs <output.json>`. The repository must contain the two prior source commits. Uses only disposable local databases. Raw report: `mvp-upgrade-negative-results.json`.

## Scope

No feature, routine, new execution service, production migration, merge, or deployment was added. Evidence and test artifacts are provided for the existing implementation owner to use.
