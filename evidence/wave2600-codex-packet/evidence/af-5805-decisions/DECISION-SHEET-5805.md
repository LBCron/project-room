FILED — #5805 Codex decision sheet: five conditions identified verbatim from the record, each graded against evidence at the exact head; R1 recheck checklist attached. Nothing posted, edited, or merged.

# Coordinator AF — PR #5805 decision sheet for Codex (wave-2600)

**Task record** — Source: wave-2600 coordinator A re-pin (`~/workspace/wave-2600-2026-11-04/coordinator-a-spine/SPINE-REPIN-2026-11-04.md`) + G/L follow-through. Consumer: Codex at the #5805 landing sitting (step 2 of the sitting order, after Gate Zero and the #5862 close). Falsifier: **did not trigger** — the five conditions are named verbatim in the record (sources below). Appetite: 5 lane-hours. Expiry: Fri 2026-11-06 17:00 PT. This sheet is paper only: no PR edits, comments, labels, pushes, merges, deploys, or sends were made. Live reads this run: 2026-11-04 ~06:56–07:00 PT, guard-check `halted: false` before the batch, no 429.

## 0. Live re-read of PR #5805 (this run) and drift vs coordinator A's pin

| Field | A's pin (2026-11-04T14:23Z–14:4xZ) | This run (live, GitHub API) | Drift |
|---|---|---|---|
| Head | `ecbad3b9266418acb712ba7f88e5c2284043930b` | `ecbad3b9266418acb712ba7f88e5c2284043930b` | none |
| Main tip | `8c9deff7534ed549df88b730c03af2d9d3a11db8` | `8c9deff7534ed549df88b730c03af2d9d3a11db8` | none — A's re-pin is still valid |
| State / draft / labels | OPEN, draft, no labels | OPEN, draft, no labels | none |
| Mergeable | true / clean | true / clean | none |
| Diff | +530 / −35 / 14 files (565 lines) | +530 / −35 / 14 files | none |
| PR body | justification ABSENT (16,124 B) | 18,182 B, sha256 `73c7adc27924247d3b0839ebd3367dc784de544c7aa5fef51a3443ee53589a5c` | **changed by coordinator L's posting — expected, not drift** |
| CI at exact head | PASSED: mechanical, safety-net, ci-verdict · FAILED: none · NOT-RUN: 15 | PASSED: mechanical, safety-net, ci-verdict (advisory only) · FAILED: none · NOT-RUN: 15 (same set) | none in verdicts; `gates` and `quarantined-tests` re-ran 2026-11-04T14:30:25Z, still skipped |

**Justification — verified present and exact.** The body now carries `## Large diff justification:` (exactly 1 occurrence). The appended section is byte-for-byte coordinator G's corrected text (`~/workspace/wave-2600-2026-11-04/coordinator-g-5805-justification/POSTING-READY.md`, sha256 `49c63be82b7f49526212198f5776f76b8ed5e0230d27c95aae3f6bd085bd1141` — the section extracted from the live body hashes identically), and the whole body hashes to L's recorded after-write value. So the pre-sitting act "Jill files the large-diff justification" is **discharged**; the `gates` diff-size failure A predicted (565 > 300 with no justification) no longer has its premise. `gates` itself is still NOT-RUN (skipped at the draft head) — it must run at the merge-up head (§4).

**CI at exact head `ecbad3b9…`, latest per job name (this run; NOT-RUN is never green):** PASSED — `mechanical`, `safety-net`, `ci-verdict` (advisory only under LC+, never cited as green). FAILED — none. NOT-RUN (all skipped, draft head) — `browser`, `browser shard`, `changes`, `cloudflare`, `contract`, `coverage`, `friend-agent-e2e`, `full`, `gates`, `lint`, `quarantined-tests`, `schema-gate`, `test`, `unit`, `visual-refresh-guard`.

## 1. The two decisions, exactly as the record names them

Source: wave-2500 cohort-02 lane-01 pack §1 Gates 2–3 (`~/workspace/wave-2500-2026-11-03/cohort-02/lane-01-5805-pack.md`), restated in the c09 Codex packet items (a)/(b) (`~/workspace/wave-2500-2026-11-03/cohort-09/CODEX-PACKET.md` lines 32–33). Both are **hard gates before the merge step**; both answers must be recorded verbatim in the sitting record; an unanswered decision = HOLD and the spine stops at #5805.

- **Decision (a) — R1 strike-or-confirm.** Re-opt-in in #5805 is edge-triggered: previously projected rows return only on each item's own next qualifying transition (fail-closed under-publication; pinned by test 4 of `tests/current-public-receipts.test.mjs`). **Confirm** = land as disclosed, with the one-cycle observation protocol scheduled at close-out — #5805 is not called landed-alive until that one full observed cycle completes. **Strike** = send #5805 back for the level-triggered re-projection sweep; the item does not merge in this sitting.
- **Decision (b) — five-condition rule strike-or-confirm.** A native item projects only when all five hold: (1) room recorded setting on · (2) item `state==='completed'` · (3) receipt present · (4) `hasConfirmedIndependentPass(item)` · (5) the item's own `work.public_set` publish intent on. Legacy needed the room setting alone. **Confirm** = land the stricter rule. **Strike** = legacy parity, and a strike must name its scope in the bracket or it is not executable; the item does not merge as-is in this sitting.

## 2. The five conditions — evidence and verdicts

The implemented predicate, read from the head diff this run (`server/public-read-model.mjs`, new `syncCurrentRoomReceipts`; evidence `evidence/pr-5805.diff` lines 195–197):

```js
if (item && receiptsOn && item.state === "completed" && item.receipt && typeof item.receipt === "object"
  && hasConfirmedIndependentPass(item) && publicTask(item).enabled === true) {
```

with the else-branch deleting the row on any non-qualifying transition. The diff's own design comment (lines 163–172) states the same five legs in prose. **Execution caveat applying to all five:** the behavioural suite that pins them (`tests/current-public-receipts.test.mjs`, 244 lines, 7 tests) is authored at the head but has **never executed in CI at the exact head** — `test` and `unit` are NOT-RUN (skipped, draft). The only execution claim on record (c08's "combined 35/35 at the filed head") was struck from the posting text by coordinator G as unverified and is **not** evidence. Each verdict below is therefore **MET as implemented and pinned at the exact head; behavioural execution NOT-RUN**, discharged only at the merge-up head under §4. Under rule 25, no condition may be quoted as behaviourally proven before that run.

### Condition 1 — room recorded setting on
- **Evidence:** `receiptsOn = publicReceipts(state).enabled === true`; the recorded value is written from `state.room.publicReceipts` into the `room_public_receipts_setting` mirror in the toggle's own transaction (diff lines 178–185), and an opt-out or archive purges the room's rows in the same transaction (lines 187–190). The recorded-setting reader gains a current-record leg in `server/public-visibility.mjs` (`recordedReceiptsSetting`, diff ~lines 453+), and `server/current-room-repository.mjs` admits `room.public_receipts_set` as a supported writer event and narrows the published-room guard so a recorded setting no longer refuses.
- **Authored pins:** test 1 (toggle admitted in a native room; mirror records it), test 3(c) (published + verified but setting never recorded → zero rows, mirror undefined), test 4 (recorded 0 reads back as `{status:'recorded', enabled:0}`; opt-out deletes rows in its own transaction), conformance test "the recorded-setting leg reads the authoritative current record for native rooms".
- **Verdict:** MET (implemented + pinned) · execution NOT-RUN.
- **Codex act if MET:** the leg stands as part of a confirmed rule; no separate act. **If NOT-MET:** the strike on decision (b) must name this leg in its bracket scope; #5805 does not merge as-is.

### Condition 2 — item `state==='completed'`
- **Evidence:** the literal conjunct `item.state === "completed"` in the predicate (diff line 196).
- **Authored pins:** no dedicated negative test isolates this leg; tests 2 and 3 set up completed items and assert `f.item().state === 'completed'` as a setup fact (diff lines 601, 619). A non-completed item also fails condition 3 (no receipt object), so the conjunction is pinned jointly, not leg-by-leg.
- **Verdict:** MET (implemented) · execution NOT-RUN · **named gap for the second checker:** no independent negative pin for this leg — SC-A's refutation battery (§4) should include a non-completed item with receipt-shaped state forced, or record why it is unreachable.
- **Codex act if MET:** as condition 1. **If NOT-MET:** strike names this leg; no merge as-is.

### Condition 3 — receipt present
- **Evidence:** the conjunct `item.receipt && typeof item.receipt === "object"` (diff line 196) — an object-shaped receipt is required, not merely a truthy field.
- **Authored pins:** test 2's positive path projects exactly one `wir_` row with proof level `room-recorded-completion`; no dedicated receipt-absent negative (jointly pinned with condition 2, same gap as above).
- **Verdict:** MET (implemented) · execution NOT-RUN · same named gap as condition 2.
- **Codex act if MET:** as condition 1. **If NOT-MET:** strike names this leg; no merge as-is.

### Condition 4 — `hasConfirmedIndependentPass(item)`
- **Evidence:** the conjunct `hasConfirmedIndependentPass(item)` (diff line 197), imported from `../src/events.js` (diff line 105) — the same helper production uses, not a test-local stub.
- **Authored pins:** test 3(b) is a dedicated negative: published intent + room setting on, item completed but verification absent → `hasConfirmedIndependentPass(f.item()) === false` asserted on the item itself, zero rows. Test 4's re-projection is triggered by a fresh `verification.recorded` pass.
- **Verdict:** MET (implemented + dedicated negative pin) · execution NOT-RUN.
- **Codex act if MET:** as condition 1. **If NOT-MET:** strike names this leg; no merge as-is. (This is the leg whose failure would most change the product's promise — "verified" receipts — so a strike here should be presumed scope-wide unless Codex's bracket says otherwise.)

### Condition 5 — the item's own `work.public_set` publish intent on
- **Evidence:** the conjunct `publicTask(item).enabled === true` (diff line 197), driven by the item's own `work.public_set` event; the design comment names this intent "the only per-item consent signal that is itself writer-qualified" in the native context (diff lines 169–172).
- **Authored pins:** test 3(a) dedicated negative (verified + setting on, no intent → zero rows: "verified but unpublished intent projects nothing"), test 3(d) (completion before intent → zero rows), test 7 adversarial (intent revoked after projection removes the row in the same transaction; archive purges it).
- **Verdict:** MET (implemented + dedicated negative pins) · execution NOT-RUN.
- **Codex act if MET:** as condition 1. **If NOT-MET:** strike names this leg; no merge as-is.

**Sheet-level reading for decision (b):** the rule Codex is asked to confirm is the rule the head implements — all five legs are present as a single conjunction, fail-closed (any non-qualifying transition deletes the row), with dedicated negative pins for legs 1, 4, 5 and joint pinning for legs 2–3. Nothing in the record supports a NOT-MET on any leg. What is **not** on record is any executed run of the pinning suite; that is a landing precondition (§4), not a defect in the rule.

## 3. R1 — evidence and acts

- **Evidence:** code comment and behaviour split in `syncCurrentRoomReceipts`: the setting *mirror* is level-triggered on the room record's own change; the *rows* are edge-triggered on work-item transitions (diff lines 156–172). Test 4 pins the disclosed behaviour end-to-end: opt-out deletes rows in the toggle transaction; re-opt-in flips the mirror but re-projects **nothing**; the row returns only on the item's next qualifying transition (a fresh verification pass).
- **Verdict:** implemented exactly as disclosed · execution NOT-RUN (same caveat as §2).
- **Codex acts:** **Confirm** → land as disclosed; at close-out Jill schedules the one-cycle observation, and #5805 is not called landed-alive until that cycle completes clean (an adverse observation re-opens the item; rollback per rule 23 is the standing move on a production regression). **Strike** → #5805 leaves the merge path for the level-triggered re-projection sweep rework; record the strike and stop the item (and with it the spine, per the sitting order). **Unanswered** → HOLD; the spine stops here.

## 4. R1 recheck checklist for the sitting (exact-head green and the heavy suites)

**The heavy-suite problem, stated plainly.** At the draft head, 15 of 18 job names are NOT-RUN (every heavy suite skipped because the PR is draft and unlabelled), and the head is diverged — the merged result has never been CI-tested anywhere. The 3 PASSED jobs at `ecbad3b9…` prove nothing about the tree that would actually land. All grading below happens at the **merge-up head**, never at the draft head, and never inherited from a composed-tree prediction (both recorded predictions, `ce386cbd…` and `8473b256…`, are superseded).

1. **Gate Zero first:** re-read production `/api/version` and main tip in the sitting's own run; if main ≠ `8c9deff7…`, every head verdict in this sheet is re-confirmed before use. Guard-check shows no fleet GitHub halt; any 429 halts all GitHub work for the sitting.
2. **Merge-up (Codex):** re-derive the prediction with `git merge-tree` against the fresh main; merge up and push the merge-up head. A conflict that changes patch content = HOLD and re-disposition. Named composition risk: `server/public-read-model.mjs` was edited on main by PR #5872 (hide public-work receipts when source and mirror disagree) in the same subject area #5805 rewrites — a clean textual merge is **not** semantic clearance.
3. **Decisions before any merge step:** Codex answers (a) R1 and (b) the five-condition rule (§§1–3); Jill records both verbatim. Either strike, or either unanswered at the merge step = the item stops.
4. **Journal, then mark ready (Codex):** J-LABEL journal entry first, then mark #5805 ready and apply `ready-to-land` with a **user/App token, never `GITHUB_TOKEN`** (a `GITHUB_TOKEN` label triggers no runs; removing the label replaces full results with NOT-RUN). Journal drafts are in the lane-01 pack §2 (J-LABEL / J-MERGE / J-DEPLOY) — do not reword a refused entry (exit 3) to force it through.
5. **Exact-head green = LC+ at the merge-up head** (lane-01 pack Gate 4 / §4 sheet): **R-CORE** `mechanical` + `safety-net` both PASSED. **R-DISPATCH** `unit`, `test`, `contract`, `gates`, `cloudflare` — **zero NOT-RUN permitted**, any FAILED or NOT-RUN = HOLD; `schema-gate` conditional (required if the merge-up diff touches schema; if judged not applicable, record NOT-APPLICABLE with the reason and the judge's name — never blank, never folded into PASSED; the filed diff carries zero DDL). `lint` / `browser` dispatch-only under C2; `ci-verdict` advisory only, never cited as green.
6. **The pinning suite must actually execute:** `tests/current-public-receipts.test.mjs` runs inside `unit`/`test` at the merge-up head — all 7 tests, including test 3 (consent negatives, legs 1/4/5) and test 4 (the R1 pin). A green sheet in which this suite did not run does not discharge §2's NOT-RUN caveats. Also required at the composed head: `errors-catalog-drift` re-run PASSED (#5805 touches both errors-catalog mirrors — shared-catalog rule, no inherited pass), plus `verify:affected` and the runbook §4.1 named suites at that head.
7. **Second check (rule 20, non-author):** checker role **SC-A** per the lane-08 assignment (`~/workspace/wave-2500-2026-11-03/cohort-02/lane-08-second-checks.md`) — not the PR author, not the lane-01 pack author, not the lane-08 author, not the merger. Scope minimum: the §4 CI sheet re-read at the same head; `errors-catalog-drift` at the composed head; the `public-read-model.mjs` #5872 × #5805 composition read semantically; the conditions 2–3 refutation item named in §2. Evidence as a D-B packet (`cohort-02/checks/5805.packet.json`) graded by a foreground evidence-checker run; any positive verdict is **PROVISIONAL** (default D-A) until the falsifier population reaches 20 gated positives, and settles only after the refutation battery runs. A defect finding is a rule-27 blocker on this landing surface, not a quiet note.
8. **Merge and deploy:** J-MERGE (disposition `landed`) then merge singly (shared-core, rule 20). Deploy block: Gate 6 pin (pre-wave production build + both Cloudflare version IDs, schema regime named) before dispatch; J-DEPLOY; Codex dispatches (sole production writer; freeze-class flip needs John's go expressly covering it); deploy record INTENT → DEPLOYED → VERIFIED with the version check on both doors and the 20-minute settle guard. NO-MOVE / DEGRADED / RATE-LIMITED = LANDED-UNDEPLOYED, scores zero, next spine item held.
9. **Close-out:** landed-alive line only on the VERIFIED confirmation — and if R1 was confirmed, only after the one-cycle observation scheduled at close-out completes (§3).

## 5. Evidence index

- Live reads this run: `evidence/pr-5805-pulls-api.json` (sha256 `ab80e543e14ea4c8b74b8dd78e4efc69010ce7f8daffda94997a5477466845da`), `evidence/pr-5805-checkruns.json` (sha256 `8d26471d4f8ce400cd6183160fe83adc2f8d14c131e566362d7e1c2873beb7b6`), `evidence/pr-5805.diff` (sha256 `8742294534a972e4186a1ef9403ff81a9585264ae1e573c7025844e80cd19878`); hashes in `evidence/MANIFEST.sha256`.
- Record sources: coordinator A re-pin (§0); G's corrected justification + L's verified posting (§0); lane-01 pack Gates 2–4, §2 journal drafts, §4 CI sheet, §5 second check (§§1, 4); c09 packet items (a)/(b) (§1); lane-08 second-check assignment (§4 item 7); cohort-01 lane-01 re-verification (mergeable clean at anchor main; justification then absent — since cured).
