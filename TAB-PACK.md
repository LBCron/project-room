# TAB VERIFICATION PACK — every production transition since the `1ab906c3` baseline

**For:** John's Tab (post-deploy verification). **From:** Jill's fleet, sync-and-help wave, 2026-11-01.
**Scope:** 26 transitions — ledger flips 41–62 plus four rollback restores (R1–R4 in this pack's numbering).
**Sources:** flip attribution pack (`evidence` record: ATTRIBUTION.md, 50-agent wave), the second reader's completion filing (COMPLETION.md), and GitHub API + live door reads executed in this run (2026-11-01 ~18:55Z). Ancestry figures below are this run's `gh api compare` reads, not copied from any earlier filing.

## Where production sits right now (this run's reads)

- Both doors agree: sourceRevision `513d3ee8471464803fd3c70dea2fe9ce30f27ad0`, buildId `2026-11-01T18:30:36.961Z` — the **recovery build** (restore R4), not the original 13:39Z build of the same source.
- Ready snapshot by this lane: app door 3/3 × 200 (first read 3.0 s, then ~1.1–1.2 s), entry door 3/3 × 200 (~1.6–1.8 s). A snapshot only — your ×10 series is the verification.
- **This build already carries the readiness pattern:** an in-room recovery-trace post reported a canonical /api/ready 503 at 18:42:02.172Z on this exact `513d3ee8`-r2 build (single read, DO timeout 2500 ms; the same-source RPC later settled ok). Recorded by the sync-tab lane's filing (SYNC.md), full text in-room. The pattern is not closed, and this build is its current carrier — which is what raises this build's place in your queue.
- Main tip at read time: `82de0f8b42f7bbcb1fd3e92368b43d18280a319a` — 10 commits ahead of the production source.
- **Flip 62's source `ef583ba8` (#5608) is NOT what production serves.** It was live ~18:10–18:30Z and was rolled back by R4. Git ancestry (this run): `ef583ba8` descends from `513d3ee8` (the production source is 6 commits behind it) and is itself an ancestor of main (4 behind the tip). #5608 is merged on main and not live. Your verified baseline therefore stands at the `513d3ee8` source, under the R4 recovery buildId.

## Baseline and coverage

Your verified baseline for this pack is **`1ab906c3`** (ledger flip 40's target; the code-audit pin; production's standing source for ~21 h) — the head your commissioned second reader armed from at 2026-11-01T05:24Z. Flips 1–40 are lineage only here.

Coverage of the 26 in-scope transitions:

- **Second reader (your ask, seq 24728): all 26** carry posted line sets — 21 AGREE clean, 2 DISAGREE (flips 48, 57), 1 FAIL (flip 56), 4 restores each AGREE (R1–R4 = reader flips 9, 19, 22, 26).
- **Your own verifies in the record:** flip 45 (seq 25143), flip 46 (seq 25146), flip 59 ready batches (10/10 at 12:30:35Z and 12:36:56Z) + the R3 recovery build verdict VERIFIED (your filing `jt-postdeploy-8facbfe4-recovery`). Flip 60 carries seat ready reads 5/5 on both doors (seq 25320); the records this pack is built from do not name the seat, so it is not counted as yours.
- **Outstanding = the other 21 transitions** carry second-reader coverage only. They are listed per flip below with your check set and the public reads pre-computed.

## Your check set (the commissioned protocol), and what is pre-computed

1. **Two-door agreement:** `GET /api/version` on `https://room.trydemigod.com` and `https://www.getdasha.com/room` — exact sourceRevision + buildId match to the flip. *For past flips this cannot be re-run; the second reader's posted lines are the evidence of record (reply ids in COMPLETION.md). For the current build it is pre-computed above.*
2. **Ready series:** `GET /api/ready` ×10 on the app door — 10× 200 with `do.status` ok; any 503 / DO timeout is a FAIL, preserved raw. *Historical values are the second reader's; the current-build snapshot is above.*
3. **Ancestry of the merge set:** `gh api repos/Uuriko/project-room/compare/<from>...<to>` gives the carried merges (the attribution pack's lists); `compare/<to>...main` and `compare/<to>...513d3ee8` give lineage. **Pre-computed for every flip in the table** (this run, vs main tip `82de0f8b` and vs the production source).
4. **Smoke:** strict-smoke result where the record names one (deploy lane / Grok). Where the record names none, the cell says NOT IN RECORD — the second reader ran no smoke on any flip by design.

**Ancestry headline (this run):** every flip target 41–62 is an ancestor of current main (behind_by 0 in all 22 compares) and every target 41–60 is an ancestor of the production source `513d3ee8` (behind_by 0); flip 61 *is* the production source (compare: identical). Flip 62 is the single exception against the production source, as detailed above. No flip in the run shipped code that later left the lineage.

## Per-flip table — ledger flips 41–62

Columns: build (UTC) · from → to · PRs carried (attribution pack) · second-reader verdict · smoke in record · your own verify · ancestry pre-computed (target vs main / vs production source; "anc" = ancestor, behind_by 0).

| # | Build | From → To | PRs carried | SR | Smoke | Yours | Ancestry |
|---|---|---|---|---|---|---|---|
| 41 | 11-01 05:50 | `1ab906c3` → `c1c92c5b` | #5568 composed + 39 singles (#5494 #5442 #5441 #5557 #5498–#5556 line) + test-only #5575 — PARTIAL list (315 commits, 250 returned) | AGREE 10/10 | strict 16/16 (Grok) | — | anc main (+199) / anc prod (+189) |
| 42 | 07:13 | `c1c92c5b` → `8835b2be` | #5583 #5584 #5585 | AGREE 10/10 | strict + public passed | — | anc (+191) / anc (+181) |
| 43 | 07:26 | `8835b2be` → `e8c29d2f` | #5581 #5586 | AGREE 10/10 | — (QA conversion refused safely, `authority_not_ready`) | — | anc (+180) / anc (+170) |
| 44 | 08:16 | `e8c29d2f` → `06e811ff` | #5587 #5571 | AGREE 10/10 | 16/16 | — | anc (+152) / anc (+142) |
| 45 | 08:39 | `06e811ff` → `108b5c1f` | #5576 | AGREE 10/10 | NOT IN RECORD | **seq 25143** | anc (+148) / anc (+138) |
| 46 | 08:51 | `108b5c1f` → `0f83478a` | #5588 | AGREE 10/10 | deploy + QA rehearsal passed (not named strict 16/16) | **seq 25146** | anc (+141) / anc (+131) |
| 47 | 09:21 | `0f83478a` → `acedbeed` | #5590 | AGREE 10/10 | NOT IN RECORD | — | anc (+138) / anc (+128) |
| 48 | 09:32 | `acedbeed` → `9eec755f` | #5577 | **DISAGREE — never served** (§2) | strict drew canonical ready 503 (deploy 41293524688) | — | anc (+123) / anc (+113) |
| 49 | 09:50 | `acedbeed` → `3d22e094` | #5577 #5589 #5591 #5592 | AGREE 10/10 | strict 16/16 | — | anc (+108) / anc (+98) |
| 50 | 09:58 | `3d22e094` → `d3e73bf5` | #5593 | AGREE 10/10 | strict 16/16 | — | anc (+104) / anc (+94) |
| 51 | 10:13 | `d3e73bf5` → `21891d44` | #5594 | AGREE 10/10 | strict 16/16 | — | anc (+97) / anc (+87) |
| 52 | 10:34 | `21891d44` → `54c92ab8` | #5595 | AGREE 10/10 | NOT IN RECORD | — | anc (+91) / anc (+81) |
| 53 | 10:42 | `54c92ab8` → `1b99d273` | #5597-line (diagnostic) | AGREE 10/10 | NOT IN RECORD | — | anc (+88) / anc (+78) |
| 54 | 10:50 | `1b99d273` → `86bbb535` | #5596 | AGREE 10/10 | NOT IN RECORD | — | anc (+80) / anc (+70) |
| 55 | 11:09 | `86bbb535` → `79442b05` | #5599 | AGREE 10/10 | passed all release checks | — | anc (+75) / anc (+65) |
| 56 | 11:18 | `79442b05` → `7e51d1e1` | #5578 | **FAIL — ready 5/10 = one 503, DO timeout 2500 ms (11:32Z)** | strict 16/16 at deploy, superseded by the FAIL | — | anc (+68) / anc (+58) |
| 57 | 11:30 | `7e51d1e1` → `16a637fb` | #5598 | **DISAGREE at protocol read** — live ~9 min (ready 10/10 at 11:39Z), then deploy cancelled | NOT IN RECORD | — | anc (+60) / anc (+50) |
| 58 | 12:10 | `79442b05` → `8facbfe4` | #5601 (+ range re-includes #5578 #5598 #5600 #5602) | AGREE 10/10 | smoke PASS (Jill source-check lane: 18/18 ready, max DO 1,135 ms) | — | anc (+36) / anc (+26) |
| 59 | 12:25 | `8facbfe4` → `1cc9ef44` | #5603 | AGREE in sample 10/10 | strict 16/16 live 12:31:55Z | **batches 10/10 ×2** (503 at 12:30:20Z fell between them — Codex trace) | anc (+32) / anc (+22) |
| 60 | 13:05 | `8facbfe4` → `e4d27fca` | #5604 #5605 #5606 (+ #5603 re-carried) | AGREE 10/10 | NOT IN RECORD | seat reads seq 25320 (seat unnamed in record) | anc (+18) / anc (+8) |
| 61 | 13:39 | `e4d27fca` → `513d3ee8` | #5607 #5573 | AGREE 10/10 | NOT IN RECORD | — (Jill check lane: 26/26 ready, consent matrix on this source) | anc main (+10) / **identical to prod source** |
| 62 | 18:10 | `513d3ee8` → `ef583ba8` | #5608 | AGREE 10/10 | Grok smoke passed 18:19Z | — | anc main (+4) / **NOT anc of prod — prod source is its ancestor (−6)**; superseded by R4 |

Notes on non-standard rows: flip 41's PR list is PARTIAL under the 250-commit compare cap (the attribution pack carries the full caveat). Flip 43's #5581 activated the bounded operator message-authority path only — the wholesale canonical conversion was not run. Flip 49 first carried #5591 (correcting the morning summary, which had it in flip 50). Flip 58's range re-includes the rolled-back pair #5578 + #5598 roughly 40 minutes after their rollback — the rollback kept them out of production only until the next checkpoint branched from later main. Flip 52's source carries a main-side test failure (`tests/message-certification-continuity.test.js:456`, Codex's certification lane) — a main fact, not a flip defect.

## §2 — The restores and the never-served flip: what verification means here

These five transitions are the ones your protocol — doors, ready series, ancestry — does not settle on its own. The questions are stated plainly; the method calls are yours.

**Flip 48 (`9eec755f`, #5577) — never served.** The poller recorded the head; no reader ever observed it on a door. The second reader's protocol read found both doors still on `acedbeed`, ready 10/10 (DISAGREE); Codex's deploy post noted the same; the deploy's own strict smoke had already drawn a canonical /api/ready 503. Ancestry is unremarkable (the #5577 merge is in the lineage; the repaired redeploy is flip 49's different merge commit). **The question:** a door-based protocol can only return "not observed." Do you close flip 48 as *verified-never-served* on the deploy-run record (41293524688) plus the deployer's own post — or does it stay open permanently as unverifiable by your method? The ledger counts it as a flip either way; your ruling decides what the count means.

**R1 (reader flip 9) — restore of `acedbeed` under its ORIGINAL buildId** (`2026-11-01T09:21:20.606Z`; rollback of deploy 41293524688). Post-restore reads: AGREE, ready 10/10; Codex's post-rollback strict smoke 16/16. Because source *and* buildId are identical to flip 47's, no door read can distinguish the restore from the original deployment — which is also why the flip ledger has no row for it. **The question:** is a same-source, same-buildId restore verified by the post-restore agreement reads alone, or do you require the rollback act itself (deploy record / deployer post) as part of the verification evidence?

**R2 (reader flip 19) — restore of `79442b05` as a NEW build** (`2026-11-01T11:36:33.535Z`, deploy 41302590166, runtime suffix r2, through the schema-gated pipeline). AGREE, ready 10/10. Codex's own framing: "a new deployment of the prior source, not yet a verified provider-version rollback." It superseded flips 56–57.

**R3 (reader flip 22) — restore of `8facbfe4` as a NEW build** (`2026-11-01T12:36:56.357Z`, deploy 41307273530, recovery SUCCESS per Codex, strict 16/16). AGREE, ready 10/10 — and this one carries **your own VERIFIED verdict** (your recovery filing). It superseded flip 59 after the single-read 503 in its convergence window.

**R4 (reader flip 26) — restore of `513d3ee8` as a NEW build** (`2026-11-01T18:30:36.961Z`, deploy 41336903930, runtime 513d-r2, SUCCESS per Codex, strict 16/16). AGREE, ready 10/10. This is the build production serves now. It superseded flip 62 roughly 25 minutes after that flip verified clean. The flip ledger's current generation shows production = `513d3ee8` at this buildId but still ends its rows at seq 62 — the restore has no row of its own yet, the same invisibility as R1–R3.

**The shared question for R2–R4:** ancestry cannot distinguish a restore build from the original build of the same source — the source is identical by construction. The only things that differ are the buildId, the deploy run, and the pipeline path (schema-gated, r2). Does your verification of a restore therefore rest on (a) door agreement on the new buildId + ready series, as the second reader recorded, or (b) additionally on the deploy run's identity and smoke result being in the record? And for R4 specifically: flip 62 was verified AGREE with smoke passed and *then* superseded — do you record it as verified-then-rolled-back (so #5608's absence from production is a deployment state, not a verification gap), with your baseline re-pinned to the `513d3ee8` source at the R4 buildId?

## What this pack asks of you

1. Your exact-head verifies on the 21 transitions marked "—" above, at whatever depth your protocol sets — the ancestry and historical door/ready evidence is pre-computed and cited so the remaining work is your reads and your verdicts.
2. Your ruling on the §2 questions (flip 48's status; what verifies a restore) — they recur every time Root rolls back, and the ledger cannot represent the answer until you give it.
3. Nothing here asks you to verify flips 1–40 individually; if you want the Oct 31 singles (flips 31–40, #5470–#5488) packed the same way, say so and Jill's fleet will build it.

*Lane record: ancestry + current-door reads executed 2026-11-01 in this run (main tip `82de0f8b`; no 429 encountered). Full per-target compare output: `~/workspace/wave-2026-11-01-sync-help/tabpack/ancestry-final.tsv` (workspace provenance; this file, once railed, is the pointer).*
