# Cure update — PR #5063, H rows 1–4 + 7: patch, root causes, test log

**Verdict: FILED — the in-scope falsifier is MET for rows 1–4 and 7. On the locally merged tree (cure `69ab79b0` × current main `8c9deff7`), H's exact command set goes from 110/117 (7 failures: rows 1–7) to 115/117. The only remaining failures are rows 5–6, which are Codex's pin-vs-regression ruling and were not touched — their failure signatures are byte-identical before and after. One additional cure-caused failure outside H's set was found and is filed as a named finding for Codex (§5); it is not caused by this patch and was not fixed (out of charter).**

Consumer: Codex's D3 disposition and the landing sitting. Diagnosis/pack work only — nothing pushed, posted, edited on GitHub, merged, or deployed. Main tip re-read live from the GitHub API at the start of this run (2026-11-04): `8c9deff7534ed549df88b730c03af2d9d3a11db8`, unchanged from H's pin. Merged tree: merge commit `3ecfeed8` (fresh scratch clone, clean merge, no conflicts).

Deliverables in this directory:
- `cure-update-5063.patch` (sha256 `101f3f73653cb22b3a72bc64be0fff2bd2e0edec7efac5bfef7236db84950a9a`) — applies on the merged tree, i.e. on the cure branch after merge-up to main `8c9deff7`. 2 files, +18/−4.
- `POSTING-READY-5063.md` — the large-diff justification, verified against the gate (§4).
- `evidence/` — full test logs, hashed in `evidence/MANIFEST.sha256`.

## 1. Reproduction (step 1, before any change)

Same command H used, plus the cure's own three suites H included:

`node --test tests/work-claim-conflict-hint.test.js tests/work-claim-events.test.js tests/work-claim-leases.test.js tests/front-door-batch.test.js tests/needs-me-delivered-review.test.js tests/staging-config.test.js tests/work-claim-permission-falsifier.test.js tests/work-claim-permission-granularity.test.js tests/work-claim-guards.test.js`

Result on the unpatched merged tree (`evidence/run-merged-before.txt`): **110/117, failing exactly rows 1–7** — DC1-A1 ×4, needs-me audit sequence, work-claim-events (row 5), work-claim-leases attestations (row 6). Signatures identical to H's (200≠409; "owned by nobody"; 403≠200 at needs-me line 132; assignee `accept_work` refusal; vera attestation surviving handoff). Rows 8–9 pass, as H found. Reproduction confirmed deterministic and identical to H.

## 2. Root causes (probed, not inferred)

**Rows 1–4 — one cascade, fixture/permissions interaction.** In main's DC1-A1 section of `tests/work-claim-conflict-hint.test.js`, the holder fixture `runOwnerRoute` gives quill `permissions: ["verify"]` only. Under the cure, quill's setup claim is refused by the new claim gate: a direct probe of the DC1 setup returns `{status: 403, value: {error: {code: "work_claims_not_permitted", message: "Claiming work claims needs the accept_work permission."}}}` and the item stays `state: "unclaimed", owner: null`. The refusal carries an error body, so `handleWorkClaims` returns it as a response object instead of throwing — the test setup does not assert it, and every DC1 assertion then runs against an unheld item (owner claim succeeds 200; update reports "owned by nobody"; the A2 setup update throws `work_not_owner` at the setup line). The conflict-copy code itself is intact at main; it is never reached because the held-by-quill state is never established.

**Row 7 — the cure's F2 check, not the permissions the diagnosis guessed.** H's summary said the reviewer "holds no complete_work under the cure model"; the probe shows the reviewer's authority record in fact carries the full set (`["steer","accept_work","complete_work","verify"]`). Replaying the audit sequence over real HTTP, every step succeeds until the queue-suggested completion, which returns **403 `work_review_rejected`: 'Review policy "self_attested" not satisfied for "task-a": only the owner may attest this work'**. Cause: the cure added a `canCloseWork(item, caller, { policy })` check inside the `self_attested` branch of the update handler (git blame on the merged tree attributes that hunk to the cure commit, "F2 self_attested owner check via canCloseWork"; main's branch checks only that `reviewedBy` does not name another member). For `self_attested`, `canCloseWork` reduces to `reviewerId === item.owner`, so the reviewer's verify-to-done — the #3546 review action the granularity suite's own header says "keeps its verify gate" — is refused whenever the caller is not the holder, even after the reviewer has recorded an approve verdict. Correcting H's mechanism here matters for the sitting: no permission seeding would have fixed row 7; the check itself has to learn the reviewer-completion case.

## 3. The cure update (rows 1–4 + 7 only)

**Row 7 — route logic, `server/work-claim-routes.mjs` (+13/−3 incl. one import token).** Inside the cure's F2 `canCloseWork` refusal, one exception: on a `delivered` item, a caller whose *current* review of the item (via the already-imported-family helper `currentReviewOf`, newly added to the import list) is `approve` completes the item instead of being refused. This is exactly the needs-me queue flow: verdict recorded first, then the queue's suggested `done` call. The F2 refusal stands unchanged for any caller with no current approve review — the falsifier suite's F2a/F2b (verify-only reviewer, no recorded review/attestation) still refuse, and the granularity F2 controls (holder finishing their own work) still pass; both suites are in the after-run, green. Nothing about rows 5–6 behaviour is touched: the assignee gate (row 5) and attestation clearing (row 6) are in different code paths, and their failures are unchanged (§4).

**Rows 1–4 — fixture seeding in a file the cure already owns edits in, `tests/work-claim-conflict-hint.test.js` (+5/−1).** `runOwnerRoute`'s holder quill is granted `accept_work` + `complete_work` alongside `verify`, with an explanatory comment — the identical adaptation the cure itself already made three times for this exact situation: in the same file's `runRoute` fixture, in `tests/work-claim-guards.test.js`, and in `tests/work-claim-leases.test.js` (each "setup only, assertions untouched"). No DC1 test, assertion, or copy expectation was changed; the owner-release copy semantics being pinned are main's, intact, and now actually exercised.

Why not a route-logic fix for rows 1–4: the cure's pinned contract, stated in its granularity suite header and its F1 repro test, is "claim requires accept_work" for a verify-only member — every falsifier claim-refusal case (F1 repro, F8 release+reclaim, A1/A2) uses an owner-created item, but the contract as written and pinned is unqualified. Any route change that lets the DC1 holder claim (profile-based, creator-based, or otherwise) contradicts that pinned contract and reopens the F1 hole the cure exists to close; it would be a product-semantics change of the same kind Codex reserved to himself on rows 5–6. If Codex reads H's "do not edit main's test" as covering even fixture seeding in this shared file, then rows 1–4 have no cure-side fix within the contract and become a fourth ruling for him — the pack is still usable either way, since the two halves of the patch are independent file diffs and can be adopted separately.

## 4. Test log (step 2 falsifier)

Same command as §1, patched merged tree (`evidence/run-merged-after.txt`): **115/117.** Rows 1–4 PASS, row 7 PASS. Remaining failures, only:

- Row 5 — `each claim change appends one event…` (work-claim-events): identical error before/after ("Assigning a work claim needs the assignee to hold the accept_work permission.", `work_claims_not_permitted`).
- Row 6 — `handler: review attestations are caller-bound and cleared on handoff` (work-claim-leases): identical deep-equal failure (vera attestation present) before/after.

Collateral sweep (coordinator O's own extension, all `tests/work-claim*.test.js` + `tests/needs-me*.test.js`, patched tree, `evidence/run-broad-after.txt`): **509/514 pass, 3 fail, 2 skipped.** The 3 failures are rows 5, 6, and the §5 finding. No other failures.

**Gates justification verification:** `scripts/pr-diff-size-check.mjs` re-run locally with base `aaa74906`, head `69ab79b0`, body = current PR body + the POSTING-READY section: exit 0 — "1101 changed lines exceed the 300-line threshold, but the PR body carries a justification section… justification found" (`evidence/gates-check-with-justification.txt`). The same check without the section is H's reproduced exit 1.

## 5. Additional finding for Codex (out of charter, not fixed, not caused by this patch)

`tests/work-claim-verified-routes.test.js` — "legacy nonowner self-attested completion keeps its first-call behavior" FAILS on the merged tree. Provenance, all in `evidence/`: with main's `server/work-claim-routes.mjs` the file is 29/29; on the unpatched merged tree it is 28/29 with this single failure; on the patched merged tree it is the same single failure. It is an 8th cure-caused failure from the same F2 `canCloseWork` check as row 7 — H's set did not include this file (H named the `test` job's non-unit suites NOT-RUN). It differs from row 7 in the one way that matters: the non-owner reviewer completes a `self_attested` item on the first call with **no recorded review**, carrying a `requestId` — which sits against the falsifier suite's F2b pin (explicit `self_attested`, verify-only reviewer, no review → must not reach done). Those two pins cannot both hold under a caller-blind rule; distinguishing them needs a Codex ruling on which feature carries the distinction (recorded review, requestId-bound reviewer outcome, designated-reviewer status, or none — i.e. F2 narrowed or the legacy test re-decided). Filed here as a named risk on the D3 disposition, alongside rows 5–6. My row-7 exception deliberately does not cover it: the caller there has no current approve review.

## 6. What was not done

No push to `jill/ut2-l8-claim-perms`; no PR body edit, comment, or label; no merge or deploy. Rows 5–6 untouched. Rows 8–9 untouched (no act, per H). The scratch clone was deleted after evidence capture; the patch, logs, justification draft, and this report are the deliverables.

End state: FILED at `~/workspace/wave-2600-2026-11-04/coordinator-o-5063-cure-update/` (`CURE-UPDATE-5063.md`, `cure-update-5063.patch`, `POSTING-READY-5063.md`, `evidence/`).
