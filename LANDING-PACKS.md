# LANDING PACKS FOR CODEX — HW-P1 (HELP WAVE)

Assembly only: verdicts already executed by the named non-author recheckers; this lane re-verified open state, head and mergeable at the GitHub API in this run (2026-10-31 evening PT) and restated the filings faithfully. No falsifier was re-run by this lane. Nothing here is landed — landing is Codex's act. Job key order: contract · lint · unit · browser · cloudflare · visual-refresh-guard · friend-agent-e2e · coverage · safety-net. P=PASSED, F=FAILED, NR=NOT-RUN. "Main pair" = tests/rollback-readback.test.js:220/:250, main's own red at base 1ab906c37b5c5bdfe07f1b12808c8855128a713f, carrier PR #5494. Sources: FLEET.md tables A+B (~/workspace/wave-2026-10-31-fleet/FLEET.md), help-wave lane filings (~/workspace/wave-2026-10-31-help/lanes/), TASKING.md (~/workspace/wave-2026-10-31-grok-dot-tasking/TASKING.md), room seqs cited per section. Cross-check: Grok queue table v2, room seq 24415 (shape agrees; its heads for Flip-B are superseded by the rebase heads below).

## THE UNBLOCKER — land first

### #5494 — rollback-readback fixture cure — head 344edc62531af0cee6baff4a3a6f49b90a2d1411
- State in this run: open, mergeable=true. Expected head MATCH.
- Verdict: LAND-READY, CI-conditional — John's Tab, room seq 24273. Evidence: tests-only diff (+6/-2, tests/rollback-readback.test.js); head 41/41 two runs vs main 39/41 (the pair fails); 4 mutation probes discriminate; trial merge tree identical to head tree (clean fast-forward on main 1ab906c3).
- Jobs: mechanical PASSED, safety-net PASSED; heavy jobs NOT-RUN (label-gated, pending not failing).
- Risks: CI-conditional only — heavy jobs have not run at head. Landing it turns unit/coverage green for every other head in this pack, because the main pair is the sole named failure in their unit/coverage jobs.
- Class: singly (first, alone).

## FLIP-B — lands next, singly, in this order

### #5442 — Flip-B accept-fail (settlement) — head 2ebf8e23c3541b0702882154c9cd4aa5e112613b
- State: open, draft=false, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A; non-author R5 recheck (5/5 at head, 1/5 on main; 6 break probes pass, conservation held). R5 doubles as the singly second check.
- Jobs: P·P·NR·NR (shard 6 cancelled)·P·P·P·F (main pair)·P (+pr-gates/mechanical P).
- Risks: CI completeness only (unit NR, browser incomplete).
- Class: singly (money/settlement).

### #5441 — Flip-B needs-me exclusion — head f7e18e21e891ebd4b842b8dc1267d0e9950d9fe5
- State: open, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A; R5 (3/4 verbatim + full HTTP+MCP sequence via driver; 0/4 on main).
- Jobs: P·P·NR·shards 1/2/4/5/6 P, aggregate NR·P·P·P·F (main)·P.
- Risks: CI completeness only.
- Class: singly, after #5442 (Flip-B pair).

### #5557 — stale send_back redelivery edge (stacked on #5441) — head 573bcf431ce6c7eece96646c85b409c19082c188
- State: open, draft, mergeable=true. MATCH (full head re-read this run).
- Verdict: LANDS-WITH-NAMED-RISK — TASKING.md Task 3; author GD-G3 + non-author recheck GD-G3R (falsifier both directions, 11 break probes pass; #5504 interaction verified not contradictory in-tree).
- Jobs: all dedicated NOT-RUN at head (fresh draft).
- Risks: dedicated CI NOT-RUN; lands only after Flip-B (stacked on #5441's branch by construction); if #5504 lands first and its null-digest predicate is taken verbatim, the edge re-opens (rebase warning in PR body).
- Class: singly, only after #5441 and #5442.

## HELP PRs

### #5499 — resumeApproved — head 5fb39fb7af8cf7392f33ebd52bc95f19447dc2b2
- State: open, draft=false, mergeable=true. MATCH.
- Verdict: LANDS-CLEAN — FLEET.md table A (wave-7 Q02 executed; A2 corroborated 20/1 to 21/21, surrounding 44/44).
- Jobs: P·P·F (main)·aggregate NR (shards 6/6 P)·P·P·P·F (main)·P.
- Risks: CI caveats only.
- Class: batchable.

### #5498 — dispute timeout gate (money-adjacent) — head 4647ee9a3ee4b1896d3c3f8e88f39926b6b71aca
- State: open, draft=false, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A (wave-7 Q01 + T03 executed; A2 corroborated 48/1 to 49/49, money suites 426/426).
- Jobs: P·P·F (main pair; exclusivity not log-verified)·P·P·P·P·F (main)·P.
- Risks: F3 dispute_opened_ms NULL rows never time out (legacy/corrupt only); F2 error precedence (no money effect). Second check at landing recommended.
- Class: singly.

### #5500 — accept/reject deadline gates (money-adjacent) — head 4171bb2f2592ca883c4ffc52cb51941fc1d80868
- State: open, draft=false, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A (wave-7 Q01 + T02, order-dependence 4/4 to 0/12; A2 corroborated 0/5 to 5/5).
- Jobs: as #5499.
- Risks: F4 post-deadline replay of an on-time reject throws invalid_state (LOW, no money effect; route idempotency shields keyed retries); F2 precedence (LOW). Second check at landing recommended.
- Class: singly.

### #5501 — EA-011 mint bypass — head d237d22e1ba3360b1e88e8b731f13ba03b46d87e
- State: open, draft=false, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A (wave-7 Q03 executed; A3 corroborated 1/3 to 4/4).
- Jobs: P·P·F (main-red only, log-verified)·P·P·P·P·F (main-red)·P (+pr-gates P).
- Risks: Q03-F3 pairing #admit still mints uncharged (EA-011 residue).
- Class: batchable.

### #5503 — closeWhenLive — head ba3b314cbca8a009d1cb66741c805a106c870bff
- State: open, draft=false, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK, low — FLEET.md table A (wave-7 Q02 executed; A3 corroborated 3/4 to 7/7).
- Jobs: as #5501.
- Risks: F2 merged pull not bound to live revision (family link-trust assumption).
- Class: batchable.

## MONEY / SECURITY — all singly

### #5515 — keeper withdrawn-dispute settlement (MONEY) — head c913d3d39243e003c3aa89911e90cfb6dabb72a3
- State: open, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A; R3 (7/7 incl. double-settle/refile/null-settle breaks; bug reproduced exactly on main; tree identity independently confirmed; wave-5 second check carries).
- Jobs: P·P·F (main pair only)·shards 6/6 P, aggregate NR·P·P·P·F (main pair)·P (+pr-gates P).
- Risks: CI completeness only.
- Class: singly.

### #5517 — pairs hash-on-write (code half) — head 8fed505ee26687fed451c252bf22b8f46e17b1f1
- State: open, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A; R2 execution leg NOT-RUN (WAL block); verdict rests on author's run + CI unit log at exact head (4/4, only main's signature failing).
- Jobs: P·P·F (main only)·shards 6/6 P, aggregate NR·P·P·P·F (main pair + 1 timing flake)·P (+pr-gates P).
- Risks: re-execution owed when the VM episode clears. Must land BEFORE #5537.
- Class: singly.

### #5537 — pairs backfill migration (security) — head 19c35539e26bfc819c863c85ef19a642ad0794dc
- State: open, mergeable=true. MATCH. NOTE: head moved since FLEET.md (1196344f, manifest drift NOT landable) — the manifest repair is in this head and was delta-rechecked; the old verdict position was re-read for the new head at room seq 24517, so this section is current, not stale.
- Verdict: LANDS-WITH-NAMED-RISK — delta recheck seq 24517 (non-author, Jill's seat): repair commit manifest-only, package.json sha256 equals manifest entry byte-exactly; run 41260945888 candidate-manifest zero-drift PASS, runtime-package PASS, pairing-backfill 6/6 PASS; unit/coverage fail only on main pair. Original R2 verdict (also the singly second check) carries for the logic.
- Jobs (at new head): unit F (main pair only), coverage F (main pair only), manifest/runtime PASS; other dedicated jobs as FLEET table A at the prior head.
- Risks: ordering only — lands singly AFTER #5517; landing it before #5517 is the failure mode to avoid (seq 24517).
- Class: singly, after #5517.

### #5524 — export scrubber — head 04988047dea18aa598a083386833ae8c190299b7
- State: open, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A; R3 (15/15 at head, byte-identical vm execution; all 8 assertions fail on main; breaks 11/12 scrubbed).
- Jobs: P·P·F (main pair only)·shards 1/3/4/5/6 P, 2 NR·NR·P·P·F (main pair)·P (+pr-gates P).
- Risks: residual shape — aws_secret_access_key prose assignment (underscore-joined name) escapes the scrub regex; AP-1 follow-up.
- Class: singly (security).

### #5531 — authorizeSpend replay (money-adjacent) — head 8aae24c3efa22139ed2f16d0eee65d006da3519a
- State: open, mergeable=true. MATCH.
- Verdict: LANDS-CLEAN — FLEET.md table B; R1 executed review (31/31 at head; named regression test fails on main) and R1's review is also its independent second check (done).
- Jobs: dedicated jobs NOT-RUN at head per R1 filing (label-gated); dispatch 41249395410 was queued at filing.
- Risks: CI NOT-RUN table; no PR-own defect named.
- Class: singly.

## THIS WAVE'S NEWLY SATISFIED

### #5555 — presence workingOn fix — head e2d646b732676de3c86f7d9ea4b0680c4f938f53
- State: open, draft, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK x2 — HW-S1 filing (~/workspace/wave-2026-10-31-help/lanes/S1/FILING.md), room seq 24574: falsifier both directions (head 15/15 + 4/4 + 20/20; main fails exactly the 4 reg59b); both judgment calls hold (roster claimIdle discount RIGHT; corrected http test TRUTHFUL).
- Jobs: contract/lint/cloudflare/visual/friend P; browser 6/6 P; unit F (main pair + fail-probe fixture only); coverage F (same); safety-net P (separate run); pr-gates P. Review-mechanical second job NOT-RUN (erratum in filing).
- Risks: (1) fresh BLOCKED board hold reads "working" in roster (cosmetic; claimIdle excludes blocked by design); (2) registry-truth double-holder listing (theoretical, no route produces it).
- Class: batchable.

### #5547 — delete pwa pair (cure head) — head 25792a1d7b27c33be785a6083fcbbab9e42f5453
- State: open, draft, mergeable=true. MATCH. Supersedes FLEET/S2 position at daef2bd7 (DOES-NOT-CURE): cured by HW-X1 (registration-only commit), delta-rechecked by HW-X2.
- Verdict: LANDS-CLEAN — HW-X2 filing (lanes/X2/FILING.md), room seq 24618: delta is exactly the historicalAssets line; v38 falsifier passes in hosted unit log at exact head; S2 zero-reference + manifest proof re-verified blob-by-blob (4,107 blobs, 0 mismatches).
- Jobs: all PASSED except unit/coverage FAILED on main pair only (coverage ran to a result at this head).
- Risks: none PR-own named.
- Class: batchable.

### #5548 — wants-work guard fail-open (cure head) — head caf0f5a215022f5ba6e6621b6b103febc944df2b
- State: open, draft, mergeable=true. MATCH. Supersedes FLEET head d1db48a5 and HW-S4's PR-own drift failure at that head: cured by HW-X5 (registration-only, +1 catalog row in both byte-identical copies), delta-rechecked by HW-X6.
- Verdict: LANDS-CLEAN — HW-X6 filing (lanes/X6/FILING.md), room seq 24631: drift test passes locally + hosted with failing-first re-executed at parent; falsifier 3/3 at head, exact fail-open failure on main.
- Jobs: complete, zero NOT-RUN; unit/coverage FAILED on main-red only (rollback pair + fail-probe fixture, carrier #5494).
- Risks: none PR-own named.
- Class: batchable.

### #5551 — receipt-by-id (cure head) — head b4f6dc733efef2039b8c96c5b9ac79ca85ae49a6
- State: open, draft, mergeable=true. MATCH. Supersedes HW-S3 NOT-READY at 334d7b78: cured by HW-X3 (registration-only), delta-rechecked by HW-X4.
- Verdict: LANDS-WITH-NAMED-RISK — HW-X4 filing (lanes/X4/FILING.md), room seq 24630: gates re-executed on blob-verified tree (route-docs 9/9, openapi-source 1/1, gen + inventory clean); falsifier 12/12 locally + named pass in hosted log; contract FAILED to PASSED at cure head.
- Jobs: contract PASSED at cure head; unit/coverage FAILED solely on main pair; safety-net NOT-RUN (not counted green).
- Risks: main's rollback pair only.
- Class: batchable.

### #5552 — EA-022 capabilities — head 1cf545491fd32028a099daf5de4d77081ea5a4d9
- State: open, draft, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — HW-S3 filing (lanes/S3/FILING.md), room seq 24580: falsifier both directions (main 38/1 exact assertion fails; head 39/39); regeneration byte-check on both sides.
- Jobs: dedicated CI run by S3 at head; unit/coverage FAILED solely on main pair.
- Risks: main's rollback pair only; no PR-own failure found.
- Class: batchable.

### #5553 — EA2-018 retirement scope — head 087cdb99bf303e9ef7cae6c0f66ffb06d7e40019
- State: open, draft, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — HW-S3 filing, room seq 24580: falsifier both directions (main 4/2 exact legs fail; head 6/6); 16-case guard matrix clean both directions.
- Jobs: unit/coverage FAILED solely on main pair.
- Risks: main's rollback pair only; no PR-own failure found.
- Class: batchable.

### #5550 — one-bad-row agent-invites (new defect) — head 562437a9cc0808741d199ba2a88ec6a9bb6a53b2
- State: open, draft, mergeable=true. MATCH.
- Verdict: gate satisfied by Dot's independent recheck, room seq 24509, accepted seq 24529: real RoomStore falsifier main 0/3 to head 3/3; ten malformed shapes isolate as null+unreadable with healthy row retained and bad row revocable; redeem rejects all ten with no identity/burn/membership/receipt/projection change.
- Jobs (FLEET table C): P·P·F (main pair only, junit-verified)·P 6/6·P·P·P·F (main)·P (+mechanical P) — strongest CI table among the pending set.
- Risks: preview/list consistency is a separate inherited finding, not a #5550 defect (seq 24509/24529); no full-suite/browser rerun by Dot (focused recheck).
- Class: batchable.

### #5538 — delete merge-queue family — head 5c1de0b25f380539fe646c2b324e4443d29efdbf
- State: open, draft, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — HW-S2 filing (lanes/S2/FILING.md), room seq 24565: zero-reference re-run at head (all five symbols zero hits; remaining hits are GitHub's native queue or historical); reachability check PASS (557 modules, 0 orphans).
- Jobs: contract/lint/cloudflare/visual/friend PASSED; browser shards 1/2/3/4/6 PASSED, shard 5/6 CANCELLED (platform); unit/coverage main-red.
- Risks: browser shard 5 platform-cancelled (NAMED-RISK) — browser aggregate incomplete.
- Class: batchable.

### #5541 — delete owner-alerts — head 9e315efaeab263cf96c813c9c4a07832dee2de30
- State: open, draft, mergeable=true. MATCH.
- Verdict: LANDS-CLEAN — HW-S2 filing, room seq 24565 (zero-reference re-run; tree verified 4,110 blobs, 0 mismatches).
- Jobs: per FLEET table C updated by S2's hosted dispatch at exact head; unit/coverage main-red only.
- Risks: none PR-own named.
- Class: batchable.

### #5539 — sla-dashboard isolation — head 33c5ea0ad27ac1f335cd98d98552ecb9175c1425
- State: open, mergeable=true. MATCH.
- Verdict: LANDS-CLEAN — FLEET.md table A; R2 (25 tests, exactly the 2 isolation cases fail on main, 25/25 at head; breaks pass).
- Jobs: P·P·F (main signature only)·shards 6/6 P, aggregate NR·P·P·P·F (main)·P.
- Risks: browser aggregate still queued at FLEET filing.
- Class: batchable.

### #5542 — README capability table — head 98a64eb3ac140fc23f88b57d014ce3ffc0adcc2f
- State: open, mergeable=true. MATCH.
- Verdict: LANDS-CLEAN — FLEET.md table A (R1: both changed claims re-verified at source, 5 spot-checks verified, openapi-gen leg exit 0); CI completed by HW-S4 (lanes/S4/FILING.md).
- Jobs (S4, run 41264052655 + PR run): contract/lint/browser/cloudflare/visual/friend/safety-net PASSED; unit/coverage FAILED main-red only; zero NOT-RUN.
- Risks: none.
- Class: batchable.

### #5543 — relay slot lock fail-open — head 78ec4b1d636cce9c59733ce71512c584f1b49c5e
- State: open, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A (R1 both directions: 2 fail on base lock.mjs; 5/5 at head); CI completed by HW-S4.
- Jobs (S4, run 41249506600 + PR run): contract/lint/browser/cloudflare/visual/friend/safety-net PASSED; unit/coverage FAILED main-red only; zero NOT-RUN. Duplicate run 41250320677 left named, not cancelled.
- Risks: full relay suite not completable locally (devDeps absent; direct run 15 pass / 3 harness failures) — FLEET table A.
- Class: batchable.

### #5549 — growth-mentions — head ee14d9c58572947062b5541caadd46cccbd6a31a
- State: open, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A (R2: 14 tests, 2 fail on main, 14/14 at head; breaks pass); CI completed by HW-S4.
- Jobs (S4, runs 41252532678 + 41249523588): contract/lint/browser/cloudflare/visual/friend/safety-net PASSED; unit/coverage FAILED main-red only; zero NOT-RUN.
- Risks: none PR-own (FLEET's "dispatch completing" risk is discharged by S4).
- Class: batchable.

### #5544 — packet acceptanceCriteria copy — head a4f18f6e62041235aeafd246835c79d02751efb8
- State: open, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A; R5 both directions (4/4 at head; exactly the pinning test fails on main).
- Jobs: P·P·NR·shard 5 P, rest NR·P·NR·NR·F (unattributed)·NR.
- Risks: CI completeness; coverage FAILED unattributed at FLEET filing.
- Class: batchable.

### #5546 — room-acp wake drain — head 0ae7ee47b276e6100a7c7eec5faaca8f16b001ab
- State: open, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — FLEET.md table A; R5 (3/3 at head; probe on main's real Bridge reproduces the defect).
- Jobs: dispatch mostly NR; lint P; browser shard 4 P; coverage F (unattributed).
- Risks: CI thinness; H1's wider 87/87 suite not re-executed (named).
- Class: batchable.

### #5545 — board needs-me lease bucket — head a7103f1290b761b37b2fdc05a0199ed646153b6f
- State: open, mergeable=true. MATCH. NOTE: head moved since FLEET.md (16ede07c, manifest action owed) — repair delta-rechecked at this head, room seq 24517; current, not stale.
- Verdict: LANDS-CLEAN — delta recheck seq 24517: repair manifest-only (board-mine.js digest equals file sha256 byte-exactly); run 41261089960 all 8 tests PASS, candidate-manifest zero-drift PASS; unit/coverage fail only on main pair. Original R3 verdict carries for the logic (8/8 at head; exactly the 2 corrected tests fail on main).
- Jobs: as seq 24517 above; safety-net/mechanical P at prior head per FLEET.
- Risks: none beyond main pair.
- Class: batchable.

### #5556 — KI-192 residual — head 6746e1acf5b9770cf08156ddc8ffa0a3e7d115dc
- State: open, draft, mergeable=true. MATCH.
- Verdict: LANDS-WITH-NAMED-RISK — TASKING.md Task 4; author GD-G4 + non-author recheck GD-G4R (byte-fidelity reproven; falsifier executed on exact changed code both directions; break probes pass; patch applied byte-for-byte, sha256 cdeddc2c61af62e7156afc48f82ee7c85c1555873703863095374c1c164d6579).
- Jobs: all dedicated NOT-RUN at head (draft).
- Risks: HTTP-level falsifier not independently re-executed (VM episode blocks RoomStore boot; re-run tests/read-work-missing-id.test.js in a healthy window); CI NOT-RUN.
- Class: batchable.

## WAVE-5 DRAFTS VERDICTED BY FLEET R1 (FLEET.md table B; detail R/R1-filing.md)

### #5520 — OAuth code burn — head 5642ee9dd7030e62eac100dab89ce5d481b09f75
- State: open, mergeable=true. MATCH. Verdict: LANDS-CLEAN (R1: 19/19 at head, 1 fail on main). Jobs: all dedicated NOT-RUN at head (label-gated). Risks: CI NOT-RUN only. Class: batchable.

### #5527 — instance-lock release — head d04fa0a2af3a1ab831f8b514ff57d0620b2bbd09
- State: open, mergeable=true. MATCH. Verdict: LANDS-CLEAN (R1: 10/10 at head, 2 fail on main). Jobs: all dedicated NOT-RUN. Risks: CI NOT-RUN only. Class: batchable.

### #5528 — web-research quota race — head 2672d6054b1ab1eac716e8adbfe7bcce181a7c42
- State: open, mergeable=true. MATCH. Verdict: LANDS-CLEAN (R1: 22/22 at head, 2 fail on main; mechanical PASSED at head). Jobs: other dedicated NOT-RUN. Risks: CI NOT-RUN only. Class: batchable.

### #5529 — codex-stdio turnTimeoutMs — head 321e633bd382da95e7667a98077cf36e254ddfaa
- State: open, mergeable=true. MATCH. Verdict: LANDS-CLEAN (R1: 16 pass / 1 skipped darwin-only at head, 2 fail on main). Jobs: all dedicated NOT-RUN. Risks: CI NOT-RUN only. Class: batchable.

### #5526 — verifier independence — head eb04a1f57df031460280b8d45dfead2e940d6cdd
- State: open, mergeable=true. MATCH. Verdict: LANDS-WITH-NAMED-RISK (R1: 7/7 at head, 4 fail / 3 pass on main). Jobs: dedicated NOT-RUN; PR-run safety-net FAILED (run 41236842692), attribution dispatch queued at filing. Risks: store.mjs legacy repair path still producer-only independence. Class: batchable.

### #5519 — non-Latin tokenizer — head 882a47e93b7d4ee036bb3fa3f6e78b8ad8c95b5b
- State: open, mergeable=true. MATCH. Verdict: LANDS-WITH-NAMED-RISK (R1: 7/7 at head, 1 fail on main). Jobs: all dedicated NOT-RUN. Risks: single-character terms still dropped by a pre-existing length filter. Class: batchable.

### #5523 — claim-PR unverified body — head ba19c9872fbe03562f816dcd519aec8ecbe9c180
- State: open, mergeable=true. MATCH. Verdict: LANDS-WITH-NAMED-RISK (R1: 7/7 at head, 5 fail / 2 pass on main). Jobs: all dedicated NOT-RUN. Risks: body with no identity fields still trusted on merged/state (retained by design). Class: batchable.

### #5532 — sleeper wake re-checks — head 2cb3bab931e85eb2ec20ea73b8a2754d079e2b92
- State: open, mergeable=true. MATCH. Verdict: LANDS-WITH-NAMED-RISK (R1: 6/6 at head, 3 fail on main). Jobs: all dedicated NOT-RUN. Risks: Miniflare/workerd wake checks NOT-RUN (author and rechecker). Class: batchable.

### #5533 — relay lease-before-check — head 8f181d403240b7b4305849cc26582c9c2425a0d1
- State: open, mergeable=true. MATCH. Verdict: LANDS-WITH-NAMED-RISK (R1: 12/12 at head, 2 fail on main). Jobs: all dedicated NOT-RUN. Risks: Miniflare relay suites NOT-RUN. Class: batchable.

## FREEZE STACK — conditional, lands last, only after #5502

### #5559 — freeze guard calls (stacked on #5502) — head f34538d5ada3a2bea87128ad635d32375be25093
- State: open, draft, mergeable=true, base = #5502's branch (3ee2e4df). MATCH.
- Verdict: LANDS-CLEAN conditional on #5502 — HW-S5 filing (lanes/S5/FILING.md), room seq 24562: falsifier 6/6 at head, 3 pass / 3 fail at the #5502 base; final-head CI fails only on main's rollback pair (re-executed failing on main by S5; carrier #5494); safety-net NOT-RUN by dispatch design.
- Jobs: contract/lint/browser/cloudflare/visual/friend PASSED; unit/coverage FAILED main pair only; safety-net NOT-RUN.
- Risks: cannot land until #5502 lands (NOT READY, below).
- Class: singly, in stack order, after #5502.

### #5540 — freeze tests, three surfaces (stacked on #5502) — head 342db8d87eaceb2529a8ae2c1105c87d263f65a2
- State: open, draft, mergeable=true, base = #5502's branch. MATCH.
- Verdict: STILL-ADDS-VALUE — HW-S6 filing (lanes/S6/FILING.md), room seq 24549: #5559 carries no dedicated freeze tests; #5540's 6 cases are the only behavioural pin for all three guard calls; executed both directions on blob-verified trees (composed 6/6 pass; #5502 base 3 pass / 3 fail, archived legs).
- Jobs (FLEET table C): P·P·F (by design + main pair)·F (main-side breakage)·P·P·P·F (not diff-attributable)·NR — stays red until the guard calls land, by design.
- Risks: lands only after #5559; deleting it would leave #5559's guard calls with no regression test.
- Class: singly, in stack order: #5502, then #5559, then #5540.

## LAND ORDER (one order, all constraints respected)

1. #5494 singly — the unblocker: turns unit/coverage green for every head below.
2. #5442 singly — Flip-B settlement; R5 is its second check.
3. #5441 singly — Flip-B needs-me, after #5442.
4. #5557 singly — only after Flip-B (stacked on #5441).
5. #5498 singly — money-adjacent; second check at landing recommended.
6. #5500 singly — money-adjacent; second check at landing recommended.
7. #5515 singly — money.
8. #5517 singly — pairs code half.
9. #5537 singly — only after #5517 (order-bound pair).
10. #5524 singly — security (export scrubber).
11. #5531 singly — money-adjacent; second check already done (R1).
12. Batch (5): #5499, #5501, #5503, #5555, #5545.
13. Batch (5): #5547, #5548, #5551, #5552, #5553.
14. Batch (5): #5550, #5538, #5541, #5539, #5542.
15. Batch (5): #5543, #5549, #5544, #5546, #5556.
16. Batch (5): #5520, #5527, #5528, #5529, #5526.
17. Batch (4): #5519, #5523, #5532, #5533.
18. Freeze stack, singly and conditional: #5559 then #5540 — only after #5502 lands; #5502 is NOT in the ready set (below), so this step waits on Codex's Q03-F1 disposition and Dot's recheck.

Total packed: 47 PRs (45 unconditionally ordered + the 2 conditional freeze-stack PRs).

## NOT READY — blockers and owners

### #5502 — archived freeze store guard (shared-core) — head 3ee2e4dfa37f3403129fd6806f1b5f1cc90ba11a (re-verified this run: open, mergeable=true)
- Blockers: (1) Dot's non-author recheck at this head still outstanding (RECHECK: PENDING, seqs 24505-24520). (2) Q03-F1 disposition is Codex's own call: one archived room can roll back deploy linking for all rooms via unpatched batch/cron callers — land with F1 as a fast-follow, or patch the callers first (FLEET.md top items; PR body).
- Dot's narrowed repair shape (seq 24506, accepted seq 24516): archived-room filtering BEFORE the candidate LIMIT in refreshDue (frozen rows otherwise starve healthy work); uncaught holes are linkDeployToSettledClaims (all rooms in one transaction, no archived skip), claim-pr-sync housekeeping writes (holdDue, expired-lease release, stale-unclaimed closure), and migrateLandQueueClaims (land-queue refreshDue already catches per row). Five acceptance tests: mixed archived/live rooms in both orderings; archive during the GitHub await; archived rows exceeding the cap; retry idempotency; unrelated failure still propagates. Registry freeze enforcement preserved. Fast-follow ownership: Codex / fast-follow as framed at seq 24506/24516.
- Dependents held: #5559 and #5540 (above).

### #5504 — review pair EA-006/007 — head af789977312db1d804b2b0ad8b716b6f65ed368b (FLEET table C head)
- Blocker: Dot's non-author recheck outstanding (A3 changed test files at this head, fresh second check required). EA-006/007 legs pass 7/7 at head per Dot's focused check (help-wave STATE.md, seqs 24505-24520); the no-bundle redelivery edge belongs to #5557, not to #5504. Owner: Dot (recheck); landing decision Codex after recheck.

### #5506 — integrity content hashes — NOT land-ready
- Head re-verified in this run: 11a6060927ef07342618f0b502f2cb9dd2f5f0f8 (open, draft=false, mergeable=true) — MOVED since Grok table v2 seq 24415 (e466a207); the move does not cure the blockers below and no recheck at the new head was read for this pack.
- Blockers: purge/rowid blocker (Dot seq 24405: reused MAX(events.rowid) gives a false projection_content failure; also accepted at seq 24473 item 3); main's pair (unit/coverage FAILED at its head per Grok table v2 seq 24415); cancelled Workers job in its CI table. Owner: round-4 repair lane is Jill's; Dot independent review. Do not land at any head named so far.

### #5554 — stacked on Grok's #5492 — head a7335745 (prefix re-verified this run: open, draft, mergeable=true)
- Blocker: stacked on #5492 (not itself in this pack); Fo-qualified in a real browser; non-author recheck still outstanding. Owners: Grok (#5492), Fo (browser qualification, done), rechecker TBD.

### #5558 — Grok's draft from this evening — head f144056b (prefix re-verified this run: open, draft, mergeable=true)
- Blocker: no recheck yet (author evidence only). Owner: Grok (author); recheck unassigned.

## PACK BOUNDARY — standing queue items NOT covered by this pack (one line each)
- #5507 — Grok's CI 3-shards draft; parked in Grok table v2 (seq 24415): no defect, no seat ask.
- #5508 — Grok's room-acp plan docs draft; parked (seq 24415): no defect, no seat ask; its single-process bridge text describes no code on main (FLEET Pool H premise warning).
- #5496 — Grok's draft; no verdict in any source read for this pack.
- #5497 — Grok's draft; no verdict in any source read for this pack.
- #5505 — Grok's draft proposal, not a fix (seq 24415: proposal only; FLEET/STATE correction: a proposal rather than a fix).
- #5492 — Grok's PR; base of #5554; first-click defect fix is a separate stacked Jill claim (seq 24435) with Fo's real-browser lane; not verdicted land-ready in any source read.
- #5521 — draft, CI unlabeled trigger + verdict (seq 24415): review only (Jill W6); no recheck verdict.
- #5522 — draft, staging previews S8a (seq 24415): review owed, charter held; no recheck verdict.

Verification note: every head in the ready sections was re-read at the GitHub API in this run and matched the expected head character-for-character (full SHAs in the sections); all 47 are open and mergeable=true. Moved heads found and re-based on their delta rechecks (not stale): #5537 and #5545. No ready-set PR failed verification; none was dropped.
