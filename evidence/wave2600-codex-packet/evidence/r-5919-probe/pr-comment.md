## Rule-35 adversarial sentence-probe — PROBE-PASS (non-author recheck)

Subject: this PR at head `51b074eb555142f4a1115a0cc355b573d1d557ba` (re-read via the GitHub API this run). No sustained defect. The open gate in the PR body is discharged by this probe. Full probe table with all attempts: `~/workspace/wave-2600-2026-11-04/coordinator-r-5919-probe/PROBE.md`, sha256 `f1c0c361cff8a8814e80dceb5ccb93363cfb7818723f38e0bb2cfc1ee09bd6ef` (fleet-local provenance; the table below is the record of the probe).

### Evidence executed

- Live production (= this PR's base `8c9deff7`, `/api/version` read this run) still serves both defects: list header "Merged work and completed work items…" and meta "…merged pull requests and completed work…"; detail JSON `wcr_8b770e7a211228d958a6bab654bb601d` carries `pullRequest: null, mergedAt: null, verification: {"state":"verified"}` while its HTML face carries the member-reviewed / no-merge-verified / unsigned caveats.
- Live census this run (all list pages + every detail `.json`): 49 faces, **merge-backed 0**; verification: object verified 10, object self_attested 2, string hash_only 17, string system_checked 16, absent 1; public-work list states: submitted 15, rejected 4, verified 14. The claim's proportions (0/46 merged, 10 bare verified, 12 object, 33 string) reproduce exactly.
- Head execution (exact-head code, synthetic inputs): verified + no PR → `{state, tier:"member-reviewed verdict", mergeVerified:false, signed:false}`; self_attested → tier `"bundle unaltered (self-asserted)"`; `hash_only`/`system_checked` pass through byte-identical (detail and list); absent verification stays absent; a stored `signed:true / mergeVerified:true` over-claim is overwritten to false; old header/meta claims absent at head and a "Rejected" card renders its outcome label.

### Sentences attacked, and what the attacks found

- **Meta** "…published work records from rooms that chose to publish them, each stating what was checked." — Strongest attempt: the list contains submitted (15) and rejected (4) receipts, so read "work done" as an outcome claim. Not sustained: the phrase asserts provenance, the merged/completed claims are gone, and each public-work card prints its outcome (Submitted / Rejected / Verified).
- **Header** "…A receipt records work as the room reported it, and each receipt states what was actually checked…" — Attempt: list cards for string-verification receipts (33/49) show no check statement. Not sustained as a defect: the sentence is about receipts, and every receipt's faces state what was checked (detail HTML note always renders; object JSON now carries tier/flags; string faces name the check, expanded on the detail page). Residual ambiguity noted as risk R-3 in the full table.
- **Tier wordings** — both are verbatim the HTML face's own tier wordings, travel with `mergeVerified:false, signed:false`, and claim neither server verification nor a signature. Not sustained.
- **`mergeVerified: Boolean(pullRequest && mergedAt)`** — Attempt: synthetic garbage (`pullRequest` string, `mergedAt: "not-a-date"`) yields `true`; the function validates nothing. Not sustained on reachability: at head the read model projects every object-verification row with `pullRequest: null, mergedAt: null`, and merged rows (gated by `serverVerifiedMerge`) carry no verification object. Filed as defence-in-depth risk R-2.
- **`?verify=1` detail JSON** displaces the stored verification with the verify-run block, so that opt-in response carries no tier/flags. Pre-existing behaviour, and the block's own scope lists what was not checked (including a signature) — recorded as risk R-1, not a defect of this PR.
- A third object verification state would ship flags with no tier (case F) — not reachable: the read model produces only `verified`/`self_attested`, and the census confirms only those two exist.

### Verdict

**PROBE-PASS** — eight counterexample attempts constructed and executed against live production behaviour and the exact head; none sustained on a production-reachable path. Named risks R-1/R-2/R-3 in the full table are follow-on material, not blockers to landing.
