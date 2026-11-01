# LANDING SLATE PACKET — RD-R4, for Codex

Lane RD-R4, record t-20261101-156-rd-r4-landing-slate-packet-for-codex-seq.
Claim: muse-room seq 24770. Prepared 2026-10-31 ~21:50–22:15 PT.

## Provenance (source-bound)

- **Ask:** Codex, muse-room DM seq 24748 (replying to the SA-S2/SA-S3
  findings): update the landing slate against current main with exact
  heads, dependencies and remaining ready blockers; strike standalone
  #5494 (already in #5560) and standalone #5506 (content already
  reconciled in #5562); no blind 42-PR merge; identify the small tested
  independent fixes that remain valuable; name any incompatibility with
  the schema-44 prospective write proof; source-bound packet; no
  duplicate CI.
- **Codex's framing, recorded as his assertions (seq 24748):** root is
  reconciling docs/schema + serializer; actual Worker failures are
  assigned to the physical Mac; John directly authorizes coordinated
  merge/deploy now, with Codex (root) as sole deployment owner.
- **This packet authorizes nothing.** It is a slate, not a landing act.
  Merges and production deploys remain Codex's hands alone (operating
  manual Absolute 5). No merge, deploy, close or cancellation was made
  by this lane; no CI was dispatched by this lane (see §6).
- **Sources bound:** GitHub API reads in this run (2026-11-01
  04:47–05:05 UTC) — every head, base, draft flag and mergeable state
  below is from those reads; RD-R1 master table + Amendment 1
  (READINESS.md, this wave); HW-P1 LANDING-PACKS.md (branch
  evidence/hw-p1-landing-packs @ 4df28076, sha256 2a0f57b9…; re-read via
  the contents API in this run); SA-S2 FILING.md + finish post seq 24751;
  SA-S3 FILING.md + finish post seq 24742; SA-S1a finish seq 24741;
  SA-S1b (seat-asks STATE.md lane log); Dot's composed-stack ledger seq
  24739 and ledger update seq 24767; Grok's queue post seq 24745; PR
  bodies of #5567 and #5568 read at the API in this run.
- **Verification basis, this run:** main head
  **1ab906c37b5c5bdfe07f1b12808c8855128a713f** (unchanged from every
  source pin). All 62 PRs named in this packet were re-read at the API:
  **zero heads moved** against the R1/pack/filing pins, and every one
  reads open with **mergeable=true** at read time. Stacked bases were
  read, not assumed (§2). Ancestry claims about the release vehicle
  were checked with compare reads, not taken from prose (§2).

## 1. Slate at a glance

| Section | Count | Contents |
|---|---|---|
| Spine (composed stack + release vehicle) | 9 PRs | #5560–#5567 as one stacked chain, landed as release PR #5568 |
| Struck standalone | 2 | #5494, #5506 — do not land independently |
| Independent remainder, landable now | 40 | Flip-B trio (3) + money/security/deadline singles (7) + batches A–F (30) |
| Conditional (named blockers; land only when cleared) | 9 | #5502, #5504, #5526, #5530, #5531, #5534, #5535, #5559, #5540 |
| Not in slate | 3 + exclusions | #5522, #5554, #5558 + one-line exclusions (#4951/#4900/#5125/#4561/#4352) |

## 2. The spine — composed stack, landed as #5568

**Release vehicle (this run, API): PR #5568** "Reconcile the Project
Room MVP and dependable agent connections", head
**77f1f839f17db3b97d995ebe550aeb8a6fbef44f**, branch
codex/mvp-release-reconciliation-1101, base main, draft=true,
mergeable=true (mergeable_state clean), 157 ahead / 0 behind main.
Its body (read this run) states: it includes the exact ancestry of
#5560–#5567 plus schema documentation reconciliation, maintained
distribution documentation links and the physical Mac's seven
independent recovery boundary tests; #5494 is present exactly once;
#5506's content integrity was reconciled in #5562 and must not land
separately; **"This PR is not yet a passing release receipt. Schema 44
requires forward recovery; do not deploy an older writer after
migration."**

Ancestry verified by compare reads in this run (not prose):
#5564 head is an ancestor of #5568 (release 18 ahead / 0 behind);
#5566 (7 ahead / 0 behind); #5567 (5 ahead / 0 behind). The Worker
repair commit 7135786a0c243d23cf10ce7f61653942272312bf is **NOT** in
#5568 (compare: diverged, 19 ahead / 1 behind) — it stays with the
physical Mac per Dot seq 24767 and Codex's seq 24748 framing.

### Chain (base → head, all draft, all mergeable=true this run)

| Step | PR | Head (full) | Base | Carries |
|---|---|---|---|---|
| 1 | #5560 | 414e60ffa1e0948e7640c41113f7ba5b92ac6c4f | main @1ab906c3 | Bounded discovery + message migration continuity. Carries #5494 exactly once (merge 1fe19af9, blob-identical per SA-S3) and the four other superseded PRs #5486/#5490/#5491/#5493 (R1). It is NOT a composition of the HW-P1 pack: only #5494 of the pack's ordered PRs is inside it (SA-S3 finding C1). |
| 2 | #5561 | 72a7d6e4d7e67e866b6314c2218e8a2a0cac8fc5 | #5560 @414e60ff | Explicit canonical message authority without room-history references. Wholly outside the pack (SA-S3 C5). |
| 3 | #5562 | 61225bed6bce0a4b4df3f6edddbfb995857056fc | #5561 @72a7d6e4 | #5506's integrity cure, reconciled: rounds 1–3 cherry-picked, round 4 replaced by the schema-44 write-proof design (SA-S2: CURE-CARRIED-WITH-DELTA; deltas D1/D6/D7 in §5). |
| 4 | #5563 | 61b55ff937842e25d89cdf0bb3af971c97a3cb89 | #5562 @61225bed | Agent invitations simplified; readiness bound to current observations. Non-browser state cases 7/7 (SA-C2) and browser qualification 7/7 + G8 8/8 (Fo, seqs 24700/24702/24716) at this head. |
| 5a | #5564 | 535a70fb7d0316dc35b60d4b8a63baef51dcd145 | #5562 @61225bed (sibling, not in the #5563 line) | Avoid duplicate canonical integrity scans. No verdict source existed at R1's sweep; Dot seq 24739 flagged integrate-or-explicitly-exclude — **resolved: included in #5568** (compare-verified this run; Dot seq 24767 concurs). |
| 5 | #5565 | 9c3f185c39ba73fa2138e9c5dcefd354ea89316e | #5563 @61b55ff9 | Recover interrupted ACP onboarding; adopts Dot distribution checks. (Dot seq 24739: the 80b9→9c3f step was manifest-only.) |
| 6 | #5566 | 4ae8c7bc895d52c3d06786bed0a0168c166e4348 | #5565 @9c3f185c | Explicit native consent for agent-issued invitations (Codex's native invitation permissions leg). |
| 7 | #5567 | 9b2003e03e741b4ea646b2ef5c7dad1e21f88c14 | #5566 @4ae8c7bc | Preserve Codex configuration during setup and interrupted saves. Adopts Dot's TOML conflict preflight (patch c4fada1f5, handoff SHA ee27aeadaa7c4de5a46656c76c2c6bcf9ae5cbc0b4759d5a2e16d79dd0862b03, per its PR body) + atomic saves, change detection, CODEX_HOME handling. Owner-local validation in the body: 47 setup/join/config tests pass; SIGKILL staged-replacement evidence. |

### Remaining ready blockers on the spine (named, owned)

1. **Functional CI is SKIPPED, not green, at #5563–#5568 heads**
   (Dot seq 24739 for #5563–#5566; Dot seq 24767 for #5567 run
   41273904555 and release run 41274136671). Independently confirmed
   in this run via the jobs API for runs 41273301287 (#5565),
   41273904555 (#5567) and 41274136671 (#5568): safety-net PASSED;
   unit, lint, contract, coverage, cloudflare, browser, visual,
   friend-agent-e2e all SKIPPED (draft-PR pattern). **No fresh full CI
   pass exists for the final composed head 77f1f839.** This is the
   spine's largest remaining blocker: a final-head required-receipts
   run (dispatch test.yml at 77f1f839 when Codex freezes the slate)
   is Codex's to call — this lane dispatched nothing (§6).
2. **#5560's own dispatch table is not clean** (SA-S3, run
   41271088568): 8 PASSED / 1 FAILED — browser shard 3/6, one 30 s
   timeout in native-result-browser-check (154 passed in shard).
   Owner per #5568's body: Fo owns the reported browser timeout.
3. **#5561's own dispatch table is not clean** (SA-S3, run
   41271090307): 6 PASSED / 3 FAILED, all #5561-own — contract (schema
   doc drift 42 vs 43), unit + coverage (projection-at-rest.test.js:256
   serializer bypass). Status inside the release: Dot seq 24767
   records both as resolved-as-source in #5568 (README/CURRENT-ROOM/
   SERVICE corrected 42→44; the serializer census red superseded by
   #5562's serialized-binding change, 18 local passes attributed to
   the owner) — **source progress, explicitly NOT CI qualification**
   (Dot's own qualifier). They clear only with blocker 1's run.
4. **#5562's failures at its own head** (SA-S2 COMPLETION, run
   41271287073): unit PASSED (13,061 pass / 0 fail; integrity family
   green by name), pr-gates dispatch 41271289087 PASSED; contract
   FAILED (SERVICE.md schema 42 vs STORE_SCHEMA_VERSION 44 — the docs
   leg of blocker 3, cured in #5568's tree per Dot 24767, unrun);
   cloudflare FAILED — the archive write-proof case ("legacy shapes
   refuse the archive until the upgrade runs" fails with
   projection_corrupt) plus a webhook hydration case; browser shards
   2/3/5 FAILED (not integrity-family, not adjudicated by SA-S2).
   Dot seq 24739 attributes the browser/Worker causes: metadata-proof
   mismatch legs and the account-deletion "Projection proof requires
   the write transaction" case — **Worker failures are assigned to
   the physical Mac** (Codex seq 24748); the archive case is a
   schema-44 interaction (§5).
5. **Dot's round-5 judgement on #5562's replacement semantics is
   outstanding** (SA-S2): whether the schema-44 write-proof design
   supersedes her confirmed round-4 semantics (D1/D6/D7, §5) is hers
   to adjudicate. Not a code blocker; it is the standing evidence
   caveat on step 3.
6. **SA-D2's independent review of the TOML preflight is armed, not
   executed.** Dot's handoff did land — inside #5567 (see chain) —
   but Jill's filed review (harness + failing-before baseline at
   61b55ff9, seat-asks STATE.md) has not run against the adopted tree.
   Owner: Jill's fleet, on Codex's/Dot's word; ~0.5 lh.
7. **#5568 is draft** and its head will move if further help-wave
   fixes are reconciled into it (its body reserves exactly that).
   Any head move re-opens blockers 1–4 at the new head. Freeze first,
   then qualify.

## 3. STRUCK — standalone, do not land

| PR | Head (this run) | Struck because |
|---|---|---|
| #5494 | 344edc62531af0cee6baff4a3a6f49b90a2d1411 | Its commit is inside #5560 exactly once (SA-S3 C2, blob-identical) and inside #5568 ("already present exactly once", its body; Codex seq 24748). Its standalone LAND-READY evidence (Tab seq 24273; Grok seq 24745 local suites) is real but the route is superseded: landing it standalone double-lands the change and re-opens the pack step-1 conflict SA-S3 named. |
| #5506 | 11a6060927ef07342618f0b502f2cb9dd2f5f0f8 | Its content is reconciled in #5562 (SA-S2 verdict CURE-CARRIED-WITH-DELTA) and carried into #5568; its round-4 mechanism is superseded (§5) and its standalone head was never land-ready (pack §NOT READY blockers stand as filed). Landing it standalone would re-introduce the replaced mechanism against the schema-44 design. |

## 4. Independent remainder — small tested fixes, in land order

Order reconciles HW-P1's pack order with R1 + Amendment 1 and the
composition (pack steps that double-scheduled struck/composed content
are removed; #5526 is removed from pack batch 16 — see §4.4). Every
head below was re-verified at the API in this run (open, mergeable=
true, head unchanged from its verdict pin). Verdict shorthand:
LC = LANDS-CLEAN, LNR = LANDS-WITH-NAMED-RISK (risk named in R1's row;
the row is the source). Singly = money/security/shared-core/schema
class: lands alone, green at the exact head, independent second check.

### 4.1 Flip-B (singly, in this order; then its stacked carrier)

| # | PR | Head | Verdict / notes |
|---|---|---|---|
| 1 | #5442 | 2ebf8e23c3541b0702882154c9cd4aa5e112613b | LNR. Lands singly FIRST. Hosted completion SA-S1a (run 41271082028): browser 1–6 + aggregator PASSED; coverage FAILED, classified NOT-INTRODUCED (identical on main run 41271087780). R5 recheck doubles as the singly second check (pack). |
| 2 | #5441 | f7e18e21e891ebd4b842b8dc1267d0e9950d9fe5 | LNR. Singly after #5442. **draft=true at this run — Codex readies it before landing** (R1/Grok seq 24745 note stands). Hosted: run 41271076413, same table as #5442 (SA-S1a). |
| 3 | #5557 | 573bcf431ce6c7eece96646c85b409c19082c188 | LNR. Stacked on #5441 (base verified this run: #5441's branch @f7e18e21); lands only after Flip-B. Carrier of #5504's redelivery edge — composition condition in §4.4. Dedicated CI all NOT-RUN at head per its verdict sources (draft pattern; PR run 41254344435 at head exists, run-level success on skipped jobs — not green). |

### 4.2 Money / security singles (each singly, in this order)

| # | PR | Head | Verdict / notes |
|---|---|---|---|
| 4 | #5498 | 4647ee9a3ee4b1896d3c3f8e88f39926b6b71aca | LNR (Q01+T03), money-adjacent. Deadline family leg 1 of 3. Second check at landing recommended (pack). SA-S1b: browser 6/6 PASSED at head; coverage FAILED main-pair only (not-introduced). |
| 5 | #5500 | 4171bb2f2592ca883c4ffc52cb51941fc1d80868 | LNR (Q01+T02), money-adjacent. Deadline family leg 2 of 3. SA-S1b same CI note as #5498. |
| 6 | #5525 | f64a58c74db588de042a7121c319967bc384d34f | LNR (Q01-F5), money-adjacent. Deadline family leg 3 of 3 (Amendment 1, Q01: family lands in one sitting in any order; placed here to keep the family together). CI per Q01: mechanical + safety-net PASSED, test-bearing jobs NOT-RUN. |
| 7 | #5515 | c913d3d39243e003c3aa89911e90cfb6dabb72a3 | LNR (R3), MONEY singly. Landing-surface warning (Q05): the independent second-check PASS exists only in a workspace filing (wave-2026-10-31-everything/fix/fix02-second-check.md), NOT on the PR record — read it there, not on GitHub. |
| 8 | #5517 | 8fed505ee26687fed451c252bf22b8f46e17b1f1 | LNR, singly. **ORDER-BOUND: must land before #5537.** R2 execution leg NOT-RUN (WAL block) — re-execution owed (R1). Exposure closes only when #5537's migration executes (Q05). |
| 9 | #5537 | 19c35539e26bfc819c863c85ef19a642ad0794dc | LNR, singly, **only after #5517** (ordering is the named risk). Delta-rechecked at this head (seq 24517). |
| 10 | #5524 | 04988047dea18aa598a083386833ae8c190299b7 | LNR (R3), SECURITY singly (export scrubber). Residual: aws_secret_access_key prose shape escapes the scrub regex (AP-1); Q06-F1 names further leaking shapes. §5 line: UNVERIFIED vs schema-44 (different surface; no interaction on record). |

### 4.3 Batches of ≤5 (non-money, non-shared-core, non-schema)

Pack batches 12–15 and 17, reconciled (Amendment-1 READY additions
placed: #5512 in batch E, #5521 in batch F; #5526 removed — §4.4):

- **Batch A:** #5499 (5fb39fb7af8cf7392f33ebd52bc95f19447dc2b2, LC) ·
  #5501 (d237d22e1ba3360b1e88e8b731f13ba03b46d87e, LNR) ·
  #5503 (ba3b314cbca8a009d1cb66741c805a106c870bff, LNR-low) ·
  #5555 (e2d646b732676de3c86f7d9ea4b0680c4f938f53, LNR) ·
  #5545 (a7103f1290b761b37b2fdc05a0199ed646153b6f, LC)
- **Batch B:** #5547 (25792a1d7b27c33be785a6083fcbbab9e42f5453, LC) ·
  #5548 (caf0f5a215022f5ba6e6621b6b103febc944df2b, LC) ·
  #5551 (b4f6dc733efef2039b8c96c5b9ac79ca85ae49a6, LNR) ·
  #5552 (1cf545491fd32028a099daf5de4d77081ea5a4d9, LNR) ·
  #5553 (087cdb99bf303e9ef7cae6c0f66ffb06d7e40019, LNR)
- **Batch C:** #5550 (562437a9cc0808741d199ba2a88ec6a9bb6a53b2, LNR;
  Dot recheck seq 24509 accepted 24529) ·
  #5538 (5c1de0b25f380539fe646c2b324e4443d29efdbf, LNR; browser shard 5
  platform-CANCELLED is the named risk) ·
  #5541 (9e315efaeab263cf96c813c9c4a07832dee2de30, LC) ·
  #5539 (33c5ea0ad27ac1f335cd98d98552ecb9175c1425, LC) ·
  #5542 (98a64eb3ac140fc23f88b57d014ce3ffc0adcc2f, LC)
- **Batch D:** #5543 (78ec4b1d636cce9c59733ce71512c584f1b49c5e, LNR) ·
  #5549 (ee14d9c58572947062b5541caadd46cccbd6a31a, LNR) ·
  #5544 (a4f18f6e62041235aeafd246835c79d02751efb8, LNR) ·
  #5546 (0ae7ee47b276e6100a7c7eec5faaca8f16b001ab, LNR) ·
  #5556 (6746e1acf5b9770cf08156ddc8ffa0a3e7d115dc, LNR; dedicated CI all
  NOT-RUN at head per verdict source)
- **Batch E:** #5520 (5642ee9dd7030e62eac100dab89ce5d481b09f75, LC) ·
  #5527 (d04fa0a2af3a1ab831f8b514ff57d0620b2bbd09, LNR per Q07) ·
  #5528 (2672d6054b1ab1eac716e8adbfe7bcce181a7c42, LC) ·
  #5529 (321e633bd382da95e7667a98077cf36e254ddfaa, LC) ·
  #5512 (831675fdeb2b6c7c5bf7cfabb791a6bba0c9e167, LC per Q05; CI at
  head: test jobs SKIPPED, draft pattern — not full-suite green)
- **Batch F:** #5519 (882a47e93b7d4ee036bb3fa3f6e78b8ad8c95b5b, LNR) ·
  #5523 (ba19c9872fbe03562f816dcd519aec8ecbe9c180, LNR) ·
  #5532 (2cb3bab931e85eb2ec20ea73b8a2754d079e2b92, LNR; Q08-F4 evidence
  caveat in R1) ·
  #5533 (8f181d403240b7b4305849cc26582c9c2425a0d1, LC per Q08) ·
  #5521 (5e81f469cdcd705e5e42843fb9bc5eef7580dc6a, LC for its own
  claims only, Q08; conflict watch: parked #5507 also edits test.yml
  and is not in this slate)

Count check §4: 3 + 7 + 30 = **40 landable in §4.1–4.3 order
today**; the freeze family and the other conditionals follow §4.4
(9 items). Independent universe = 49 = R1's READY 44 + the five
non-stack PARTIALs (#5502, #5504, #5526, #5540, #5559); the other
PARTIALs sit in the spine (#5562, #5563) or §8 (#5522, #5554).

### 4.4 Conditional — named blockers, owners, exact unblock acts

| PR | Head | Open edge (source) | Unblock |
|---|---|---|---|
| #5502 | 3ee2e4dfa37f3403129fd6806f1b5f1cc90ba11a | PARTIAL. Q03-F1: one archived room can roll back deploy linking for all rooms via unpatched batch/cron callers. Dot's narrowed repair shape + five acceptance tests are on record (seqs 24506/24516): filter archived rooms BEFORE the candidate LIMIT in refreshDue; holes named in linkDeployToSettledClaims, claim-pr-sync housekeeping writes, migrateLandQueueClaims. Dot's non-author recheck at this head also outstanding (pack). | **Codex's disposition** (his call, seq 24748 framing): land with F1 as fast-follow, or patch the callers first. Everything below waits on this. |
| #5531 | 8aae24c3efa22139ed2f16d0eee65d006da3519a | READY (LC, second check done) but composition-bound: shares authorizeSpend with #5530 (Q08). The pack placed it in the money singles (step 11); Q08 §4.2 orders it singly BEFORE #5530's rebase and after #5502. Carried here, not in §4.2, to avoid double-counting. | Land singly after #5502's disposition; composed tree re-runs both spend suites + the freeze suite. |
| #5534 | 0ad296f07748812c1a4394cfd1f6f631064c9d41 | READY (LC, Q08 cluster 1, executed 4/4 at head). Freeze complement 16b; batchable after #5502. | After #5502 lands. |
| #5535 | 26def764d632ab0095c6d98bbc4019f84297ea80 | READY (LC, Q08 cluster 1, executed 2/2 at head). Freeze tranche-3 closure; batchable after #5502. | After #5502 lands. Batch with #5534 (batch of 2). |
| #5530 | 05d16f6a4c1c90a09e4b1b98a23ec361f3f8cd64 | READY (LNR, Q08 cluster 1) WITH composition conditions: lands after #5502, rebased onto the composed tree with #5531, performing its committed swap of the local guard copy for #5502's refuseArchivedWriteDb; composed spend suites re-run. | After #5502 + #5531; rebase is part of the landing act. |
| #5559 | f34538d5ada3a2bea87128ad635d32375be25093 | PARTIAL. Stacked on #5502 — base verified this run: #5502's branch @3ee2e4df (current). LC for its delta, conditional on #5502 first. | After #5502 (and the §4.4 order above). |
| #5540 | 342db8d87eaceb2529a8ae2c1105c87d263f65a2 | PARTIAL, tests-only, red by design until #5559's guard calls land. **Base is stale**: verified this run — its base is #5502's branch @106b1bd8 (the superseded head), not @3ee2e4df; it needs retarget/rebase when the stack moves. Lands LAST in stack order #5502 → #5559 → #5540. | After #5559; retarget first. |
| #5504 | af789977312db1d804b2b0ad8b716b6f65ed368b | PARTIAL. EA-006/007 legs pass 7/7 at head (Dot); fresh non-author recheck still owed (A3 changed test files). The no-bundle redelivery edge is NOT #5504's — its carrier is #5557 (§4.1), with the composition condition: whichever of #5504/#5557 lands, the composed result must preserve #5504's bundled-delivery expiry AND #5557's null-digest generation binding; if #5504 lands first with its null-digest predicate verbatim, the edge re-opens (R1, #5557 row). | Dot's recheck, then Codex's landing call; sequence it against #5557 with the condition above. |
| #5526 | eb04a1f57df031460280b8d45dfead2e940d6cdd | PARTIAL (demoted by Amendment 1). PR-caused safety-net failure at this exact head (Q07: i18n ratchet +3 from its own new strings); not green at head; money-adjacent class — cannot land until fixed and re-run. Removed from pack batch 16. | Author fix + safety-net re-run at the new head, then it re-enters a batch. |

## 5. Schema-44 prospective write proof — incompatibility lines

Seed source: SA-S2 FILING.md (D1–D11) + finish seq 24751. The
schema-44 design lives in #5562 (server/write-integrity.mjs,
transaction-scoped proof frames in store.transaction;
assertProjectionWrite / recordProjectionWrite in
projection-at-rest.mjs; per-room metadata_hash; STORE_SCHEMA_VERSION
42 → 44 in writer-fence.mjs) and reaches main only via #5568.

- **#5506's round-4 mechanism — INCOMPATIBLE / SUPERSEDED.** Seeded
  baseline stamp (seeded_baseline), purge recomposition and both
  newness bridges are deleted in #5562; case 4f is inexpressible
  against #5562's code (no such column). What replaces it: birth
  seeding at room creation + open-time schema<44 migration (D4) +
  transaction-scoped write proofs (D2). Never land #5506 against a
  tree containing #5562's design, in either order.
- **#5562 itself — COMPATIBLE-BY-CONSTRUCTION, with three named
  evidence breaks (not incompatibilities):** D1 dot4 acceptance file
  absent (cases 4a–4i have no executed presence); D6 round-1 NULL-hash
  adoption inverted, fail-closed; D7 post-drift ordinary writes now
  throw projection_corrupt (both are acceptance edits, executed green
  in the hosted unit job). Plus one executed interaction failure at
  its head: the cloudflare archive case fails against the write-proof
  layer (legacy shapes + archive path) — named for Codex in SA-S2;
  Worker-side ownership per seq 24748. Dot's round-5 judgement on the
  replacement semantics is outstanding (§2 blocker 5).
- **#5561 — INTERACTS, UNVERIFIED at the composed head.** Its
  serializer census failure (projection-at-rest.test.js:256: a write
  bypassing the serializer) sits in exactly the file #5562's proof
  layer rewires. Dot seq 24767 records #5562's serialized-binding
  change as superseding the red, with 18 owner-local passes — local
  evidence only; at the composed head the leg is UNVERIFIED until
  §2 blocker 1's run executes it.
- **#5568's own warning (its body):** "Schema 44 requires forward
  recovery; do not deploy an older writer after migration." Once the
  release deploys, rollback across the schema-44 boundary is not a
  revert — see the annex.
- **Freeze family (#5502, #5530, #5534, #5535, #5559, #5540) —
  UNVERIFIED against schema-44.** Their mechanism is write refusal at
  the store choke point (refuseArchivedWriteDb and guard calls) —
  the same store surface the proof frames wrap. No source on record
  executes any of them against a schema-44 tree, in either order.
  If the release lands first, each freeze item's verdict needs a
  composed-tree re-run before landing; if the freeze family lands
  first, §2 blocker 1's run must include the freeze suites. Stated
  as UNVERIFIED, not compatible, not incompatible.
- **#5517 / #5537 (pairs hashing + backfill migration) — UNVERIFIED.**
  A data migration over a store table; no source executes it against
  the schema-44 store. The pair's internal order (#5517 → #5537) is
  unaffected; the schema interaction is unexamined, not cleared.
- **Everything else in §4 — no interaction on record.** Flip-B,
  deadline family, money singles #5498/#5500/#5515/#5525, #5524, and
  batches A–F touch no store-integrity, projection or purge surface
  in any verdict source consulted; they carry no schema-44 line
  beyond this sentence. (#5524's line is stated in §4.2 for
  completeness: UNVERIFIED, different surface.)

## 6. CI — collect-only, zero dispatched

Per the ask (no duplicate CI): this lane checked the Actions API for
every slate-critical head before any thought of dispatch. **Runs
already exist at every such head; nothing was in flight at read time;
this lane dispatched NOTHING.** Collected anchors:

| Head | Run(s) at the exact head (API, this run) | State |
|---|---|---|
| #5560 414e60ff | test dispatch 41271088568 (SA-S3) + PR runs | completed, failure (browser shard 3 — §2.2) |
| #5561 72a7d6e4 | test dispatch 41271090307 (SA-S3) | completed, failure (§2.3) |
| #5562 61225bed | test dispatch 41271287073 + pr-gates dispatch 41271289087 (SA-S2) | completed (§2.4) |
| #5563 61b55ff9 | PR test run 41271055441 | completed; functional jobs SKIPPED (§2.1) |
| #5564 535a70fb | PR test run 41271945312 | completed; same draft pattern |
| #5565 9c3f185c | PR test run 41273301287 | completed; jobs table read this run — safety-net PASSED, functional SKIPPED |
| #5566 4ae8c7bc | PR test run 41273338560 | completed; same draft pattern |
| #5567 9b2003e0 | PR test run 41273904555 | completed; jobs read this run — SKIPPED pattern (Dot 24767 concurs) |
| #5568 77f1f839 | PR test run 41274136671 | completed; jobs read this run — safety-net PASSED, functional SKIPPED |
| #5442 / #5441 | dispatches 41271082028 / 41271076413 (SA-S1a) | completed; browser green, coverage not-introduced FAILED |
| #5498–#5503 set | SA-S1b hosted dispatches at exact heads | completed; zero NOT-RUN on the set |
| #5557, singles, freeze set | PR/dispatch runs exist at every head (API-listed this run) | completed; per-job tables live in their verdict filings (R1 CI column) |

The one run this packet calls for — a fresh full test.yml dispatch
at the frozen #5568 head (§2 blocker 1) — does not exist yet at any
composed head and is Codex's to dispatch at freeze time; it is a
first run at that tree, not a duplicate.

## 7. Deploy-day annex (short)

Applies per landing step (release flip, each single, each batch).
Owners: **Tab** = verification packs / per-flip second reader
(RD-T2 claimed seq 24752: /api/version both doors + /api/ready ×10
raw under each deploy post); **Fo** = room responsiveness; **Grok**
has already committed (seq 24745) to the qa- room golden-path smoke +
health after each deploy post.

- **Per-flip checks:** production /api/version equals the new main
  head (both doors); /api/ready ×10 raw (Tab); golden-path smoke —
  invite → join → human posts work → agent claims → delivers → human
  accepts → receipt exists with honest verification status → outcome
  findable afterwards (Grok's qa- room run + Jill's door probes);
  room responsiveness post (Fo).
- **Deploy record:** the flip-ledger entry for the flip is the deploy
  record — one contemporaneous entry per flip, naming the batch/step,
  the head deployed, and the smoke outcomes. A step is
  LANDED-UNDEPLOYED (scores zero) until its flip is confirmed by the
  version check.
- **Rollback note (standing rule: revert first, re-think second):**
  any batch that regresses production is reverted as a batch before
  diagnosis; singles revert singly. **Exception carved by #5568's own
  body: after the schema-44 release deploys, do not deploy an older
  writer — recovery is forward-only (a fixing release on top), not a
  revert across the migration boundary.**

## 8. Not in slate

- **#5522** (b96f4103017f9b3271b09e650bab24fe099f8e3e) — PROPOSAL-NOT-
  A-FIX (Q08): cures no defect; lands only if Codex chooses the
  dev-mode slice on its own merits.
- **#5554** (265252bbbe2552fc2612c917101fe615572f2af1) — stacked on
  #5492 (base verified this run @1a8834ed), which itself carries no
  land verdict; #5554's qualification head is unstated in its sources
  and a non-author recheck is outstanding. Neither enters until
  #5492 is verdicted.
- **#5558** (head per R1: 8687a5a7d13b) — NO-VERDICT in R1; author
  evidence only per the pack. Not re-verified for this packet
  precisely because no non-author verdict exists to bind.
- **The 554 NO-VERDICT PRs** (R1) — no verdict, no slate entry; this
  packet invents none.
- Exclusions, one line: #4951 PARKED · #4900 OUT · #5125 bound ·
  #4561 and #4352 never-touch — none is in this slate and none was
  touched by this lane.

## 9. Counts (recap)

In slate: spine 9 (#5560–#5567 + vehicle #5568) · landable-now
independent 40 (§4.1–4.3) · conditional 9 (§4.4) · struck 2 ·
not-in-slate 3 named + 554 NO-VERDICT.
Heads moved during this run: **none**. CI dispatched by this lane:
**none**.
