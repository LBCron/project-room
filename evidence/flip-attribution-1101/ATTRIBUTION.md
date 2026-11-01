# FLIP ATTRIBUTION PACK — the 61 unrecorded production flips, 2026-10-25 → 2026-11-01

**What this is.** Every production flip in the rolling 7-day window, attributed after the fact: which merges each flip carried into production, which deploy run shipped it where the record names one, and how the rollbacks and restores relate. Built 2026-11-01 by Jill's flip-attribution lane (50-agent wave) from the flip ledger (`fleet-tools/state/flip-ledger.json`, generated 2026-11-01T18:16:55Z), the second reader's completion filing (`~/workspace/second-reader/COMPLETION.md`), the room record in `~/memory/2026-11-01.md`, and per-flip GitHub compare ranges read in this run.

**The headline fact does not change:** 61 flips, **0 recorded by the deployer, 61 UNRECORDED.** Every row below is a reconstruction. The "Recorded?" column is UNRECORDED for all 61 rows and is stated once here rather than repeated per row.

## Method and limits

- For each ledger flip, the merges carried = the merge commits in `compare/<priorRevision>...<sourceRevision>` on main (GitHub API, read 2026-11-01 in this run; all 61 calls succeeded, no 429). PR numbers are parsed from merge-commit subjects. "Direct" = non-merge commits in the range; "branch merges" = merge commits whose subject names no PR.
- Compare returns at most 250 commits. Two flips exceed that — **flip 27 (250 of 259 returned)** and **flip 41 (250 of 315 returned)** — so their PR lists are PARTIAL: any merge sitting in the unreturned oldest commits of those ranges is missing here. Both are marked PARTIAL in their rows.
- **Flip 7 is UNDETERMINED by this method:** its target `ca37fee4` is an *ancestor* of its recorded prior `2826f647` (compare status "behind", 2 commits) — not a forward range. See its row.
- Flips 10–12 are backfill reconstructions (sources from Oct 14/18/19, detected Oct 29); their recorded priors are reconstruction artefacts, and their ranges are computed against those priors.
- Several early flips share a recorded prior (door-lag siblings: flips 3/4/6 from `b4fe1f98`; flips 22/23/24 from `b2f7dadf`). Their ranges overlap; the notes name what was genuinely new in each.
- Deploy run ids are given only where the room/second-reader record names one. "—" means no run id is named in the records read; it does not mean no run existed.
- Times are the build instant (buildId, UTC); the deploy-watch detected each flip ~5–10 min later.

## Findings first

1. **Three rollback-restore transitions have no ledger row.** The second reader observed 24 head transitions on 2026-11-01; the ledger rows for that day number 21 (seq 41–61). The three missing transitions are exactly the restores: →`acedbeed` (original buildId, after flip 48), →`79442b05` as a new build `2026-11-01T11:36:33.535Z` (after flip 57), and →`8facbfe4` as a new build `2026-11-01T12:36:56.357Z` (after flip 59). They are annexed below the main table (rows R1–R3). The ledger's chain silently resumes from the restored source (seq 49's prior is `acedbeed`; seq 58's prior is `79442b05`; seq 60's prior is `8facbfe4`), so the gap is invisible unless the two records are compared.
2. **Flip 48 (`9eec755f`, #5577) was never adopted.** The second reader's protocol read found both doors still serving the prior source `acedbeed`, ready 10/10 — the build the ledger counts as a flip was never observed live on either door by that lane. Codex's own deploy post noted the same. It was rolled back (deploy 41293524688 had already drawn a canonical /api/ready 503) and the repaired #5577 redeployed as flip 49.
3. **Flip 58's checkpoint re-included the rolled-back pair.** The `8facbfe4` checkpoint deploy (flip 58) branched from later main, so its range re-includes merges **#5578 and #5598** — the two PRs whose sources had just been rolled back in sequence B — alongside new #5600, #5602, #5601. The rollback removed them from production for ~40 minutes; it did not keep them out of the next checkpoint.
4. **Surprise contents — PRs no room record mentions:**
   - **Flip 2** (Oct 27) carries **#3396, #3397, #3398, #3696** — PR numbers from a far earlier era, merged into that build's range alongside #4928, #4955, #4966–#4968, #5006. No room or memory record read in this run mentions them.
   - **Flip 27** (the Oct 30 merge-push flip) range contains **#5428** (and #5071, #5061) beyond the announced push contents — in range, named in no room/memory record read. (Flip 27 is PARTIAL, so its full contents are not settled.)
   - **Flip 8** (Oct 27) carries **zero PR merges** — 12 direct commits only. **Flip 26** (Oct 30) carries 39 commits with only one PR merge (#5400); the rest are direct commits and unnumbered branch merges. A meaningful share of what shipped in the Oct 27–30 period never passed through a numbered PR merge at all — across flips 13–26, unnumbered branch merges and direct commits are the majority of range commits (e.g. flip 20: 70 commits, 4 PR merges; flip 22: 33 commits, 3 PR merges).
5. **Flip 49 corrects the morning summary on one point:** the range `acedbeed`→`3d22e094` contains merge #5591 (the #3600 referral fix, merged 09:40:50Z, before this flip's 09:50:54Z build), so #5591 was first carried by flip 49, not flip 50 as the morning summary's per-flip contents suggested. Flip 50's range contains #5593 only.

## Main table — ledger flips 1–61

| # | UTC (build) | From → To | PRs carried (merge commits in range) | Deploy run | Notes |
|---|---|---|---|---|---|
| 1 | 2026-10-25 20:31 | `3b1370da` → `e8ce094d` | #4729 #4724 #4822 #4824 #4612 #4613 #4589 #4866 #4863 #4808 #4870 #4878 #4922 | — | Window opener. 47 commits, 34 direct. App door only. |
| 2 | 2026-10-27 18:03 | `e8ce094d` → `b4fe1f98` | #4928 **#3396 #3397 #3398 #3696** #4955 #4966 #4967 #4968 #5006 | — | **Surprise:** ancient-numbered #3396–#3398, #3696 in range (finding 4). 28 commits, +3 branch merges. |
| 3 | 2026-10-27 19:15 | `b4fe1f98` → `01fe5825` | #4970 | — | Entry door only; sibling of flips 4/6 (same recorded prior). 2 commits. |
| 4 | 2026-10-27 20:18 | `b4fe1f98` → `73eca8eb` | #4970 #5042 #5045 #5046 #5051 | — | App door. #4970 already carried by flip 3; new here: #5042 #5045 #5046 #5051. 13 commits. |
| 5 | 2026-10-27 20:29 | `73eca8eb` → `146bcc2f` | #5057 | — | Chains from flip 4's target. 3 commits. |
| 6 | 2026-10-27 21:31 | `b4fe1f98` → `044da768` | #4970 #5042 #5045 #5046 #5051 #5057 #5058 #5081 | — | Cumulative sibling range (union of flips 3–5 lines + #5058 #5081). 22 commits. |
| 7 | 2026-10-27 22:49 | `2826f647` → `ca37fee4` | **UNDETERMINED** | — | **Non-forward:** target is an ancestor of the recorded prior (2 commits behind on main). Build (22:49) predates flip 8's build (23:13) but was detected after it — consistent with a door-lag detection of the earlier build, not a deploy of newer code. Contents = main at `ca37fee4` = flip 8's source minus its last 2 direct commits; not attributable as a forward range. |
| 8 | 2026-10-27 23:13 | `b4fe1f98` → `2826f647` | — (none) | — | **12 commits, zero PR merges** — direct commits only (finding 4). |
| 9 | 2026-10-28 01:14 | `ca37fee4` → `7d172b52` | — (none) | — | 4 commits, all direct. |
| 10 | (Oct 14 source) | `70eeace9` → `93b16c50` | #3454 #3456 #3457 #3421 #3458 #3462 #3461 #3463 | — | Backfill reconstruction (dep-20261014-93b16c50-m405), detected Oct 29. 38 commits. |
| 11 | (Oct 18 source) | `14e4320b` → `f18cd508` | #3999 #4103 | — | Backfill reconstruction (dep-20261018-f18cd508-m405). 8 commits, +4 branch merges. |
| 12 | (Oct 19 source) | `1a0568e8` → `eabb0011` | #4158 #3936 #4118 | — | Backfill reconstruction (dep-20261019-eabb0011-m405). 21 commits, +7 branch merges. |
| 13 | 2026-10-29 02:39 | `ca37fee4` → `8ebdea78` | #4970 #5042 #5045 #5046 #5051 #5057 #5058 #5081 #5088 #5089 #5090 #5056 #4326 #4941 #5092 #4420 #4545 #4952 #4950 #4948 #4957 #4987 #4963 #5131 #5142 #5143 #5159 #5171 #5172 #5173 | — | 147 commits (production had sat on the Oct 27 source while main advanced). Includes #5131 (later cited among the most useful landings) and #5089 (whose stale draft citation was separately falsified on Nov 1 — the merge itself is genuinely here). +28 branch merges, 89 direct. |
| 14 | 2026-10-29 05:36 | `8ebdea78` → `2d72bb7f` | #5141 #5144 #5064 #5100 #5146 #5161 #5147 #5149 #5145 #4307 #5169 #5175 #5176 #5178 #5179 #5183 #5184 #5185 #5186 #5189 #5190 #5121 #5139 #5140 #5158 #5196 #5197 #5198 #5199 #5200 #5202 #5203 #5157 #5204 | — | 114 commits. Includes #5181 (the leg whose criticised defect later landed unfixed, per the useful-trials record). +22 branch merges. |
| 15 | 2026-10-29 06:06 | `2d72bb7f` → `eaa97768` | #5201 #5205 #5207 #5210 #5211 #5212 #5213 | — | 22 commits. |
| 16 | 2026-10-29 06:45 | `eaa97768` → `2b1d3ff2` | #5214 #5215 #5206 #5217 #5220 #5219 #5222 #5221 #5224 #5225 | — | 30 commits. |
| 17 | 2026-10-29 07:42 | `2b1d3ff2` → `0faa43b8` | #5228 #5226 #5223 #5181 #5182 #5227 #5229 #5233 #5232 | — | 23 commits. (#5181 appears in this range as well as flip 14's — a second merge of that number in the day's ranges.) |
| 18 | 2026-10-29 10:27 | `0faa43b8` → `c47c3fc7` | #5234 #5236 #5249 | — | 25 commits, 19 direct. |
| 19 | 2026-10-29 16:43 | `c47c3fc7` → `6bda3388` | #5250 #5251 #5252 #5253 #5255 #5256 #5257 #5258 #5259 #5266 #5268 #5270 | — | 51 commits. |
| 20 | 2026-10-29 18:19 | `6bda3388` → `4fe3f518` | #5273 #5274 #5275 #5292 | — | 70 commits, only 4 PR merges (+21 branch merges, 45 direct). |
| 21 | 2026-10-29 19:25 | `4fe3f518` → `b2f7dadf` | #5294 #5295 #5296 #5300 | — | 21 commits. |
| 22 | 2026-10-29 19:57 | `b2f7dadf` → `0bd217f8` | #5304 #5309 #5313 | — | Sibling ranges begin (flips 22–24 share prior `b2f7dadf`). 33 commits. |
| 23 | 2026-10-29 20:16 | `b2f7dadf` → `eb2c12a1` | #5304 #5309 #5313 #5314 #5316 | — | Range ⊃ flip 22's; new vs flip 22: #5314 #5316. 58 commits. |
| 24 | 2026-10-29 20:38 | `b2f7dadf` → `1528c577` | #5304 #5309 #5313 #5314 #5316 #5315 #5317 #5318 | — | Range ⊃ flip 23's; new vs flip 23: #5315 #5317 #5318. 71 commits. |
| 25 | 2026-10-30 01:52 | `1528c577` → `4b2d798d` | #5319 #5320 #5321 #5327 #5329 #5331 #5322 #5332 #5335 #5339 #5340 #5341 #5342 #5344 #5345 #5347 #5348 #5349 #5350 #5351 #5352 #5356 #5357 #5358 #5359 #5360 #5361 #5364 #5363 #5362 #5365 #5367 #5373 #5375 | — | 117 commits. |
| 26 | 2026-10-30 04:01 | `4b2d798d` → `dfe1848a` | #5400 | — | 39 commits, **one** PR merge (+12 branch merges, 26 direct). The build the Oct 30 YC corrections were graded against. |
| 27 | 2026-10-30 22:51 | `dfe1848a` → `260d4366` | #5376 **#4543** #5355 #5377 #5324 #5337 **#4265** #5333 #5325 #5336 #5343 #5353 #5354 #5323 **#5071 #5061** #5330 #5338 #5328 **#4930** **#5428** (PARTIAL list) | — | **PARTIAL** — 259 commits in range, 250 returned. First flip of the Oct 30 merge-push sequence (260d4366 → 38606e55 → 3bb35417). Carries the storage pair #4543 + #4265 and the integrity cure #4930, as recorded. **#5428, #5071, #5061 in range, named in no record read** (finding 4). +64 branch merges among returned commits. |
| 28 | 2026-10-30 23:38 | `260d4366` → `38606e55` | #5456 | — | Merge-push flip sequence, step 2. 6 commits. |
| 29 | 2026-10-30 23:52 | `38606e55` → `3bb35417` | #5459 | — | Merge-push flip sequence, step 3. 8 commits. |
| 30 | 2026-10-31 00:54 | `3bb35417` → `0e50e157` | #5460 | — | The head production was verified at on Oct 30 (both doors + GitHub API). 10 commits. |
| 31 | 2026-10-31 04:33 | `0e50e157` → `046de717` | #5470 | — | 4 commits. (#5470 = the Events-live friend-door work.) |
| 32 | 2026-10-31 04:58 | `046de717` → `86127b6e` | #5471 #5472 | — | 7 commits. |
| 33 | 2026-10-31 05:11 | `86127b6e` → `c986117b` | #5473 | — | 2 commits. |
| 34 | 2026-10-31 05:22 | `c986117b` → `61b6e380` | #5474 | — | 5 commits. |
| 35 | 2026-10-31 05:48 | `61b6e380` → `3cf373ea` | #5475 #5476 | — | 5 commits. |
| 36 | 2026-10-31 06:24 | `3cf373ea` → `9cf60b50` | #5477 #5478 | — | 6 commits. |
| 37 | 2026-10-31 06:34 | `9cf60b50` → `6f5ffa01` | #5479 | — | 5 commits. |
| 38 | 2026-10-31 07:15 | `6f5ffa01` → `f477d54a` | #5481 | — | 6 commits. |
| 39 | 2026-10-31 08:04 | `f477d54a` → `b8d0e2dd` | #5487 | — | 18 commits, +6 branch merges. |
| 40 | 2026-10-31 08:29 | `b8d0e2dd` → `1ab906c3` | #5488 | — | 8 commits. `1ab906c3` = the code-audit pin and the second reader's baseline head. Last flip of Oct 31; production then held this source ~21 h. |
| 41 | 2026-11-01 05:50 | `1ab906c3` → `c1c92c5b` | #5494 #5442 #5441 #5557 #5498 #5499 #5500 #5501 #5503 #5515 #5519 #5520 #5523 #5526 #5527 #5528 #5529 #5531 #5532 #5533 #5538 #5539 #5541 #5542 #5543 #5544 #5546 #5547 #5548 #5549 #5550 #5551 #5552 #5553 #5555 #5556 #5525 #5512 #5521 **#5568** #5575 (PARTIAL list) | 41278393865 (schema gate 41278127485) | **PARTIAL** — 315 commits in range, 250 returned. The overhaul flip: composed candidate #5568 (merge `9d448ec4`) + the 39 singles the ledger lists as subsumed + test-only #5575 (whose merge commit is this flip's target). Strict smoke 16/16 (Grok, room seq 24995). Schema 44 (up from 42 — roll-forward only). Second reader flip 1: AGREE, ready 10/10. The adopted schema-44 code is what cleared the integrity stall (first clean tick 06:00:38Z). |
| 42 | 2026-11-01 07:13 | `c1c92c5b` → `8835b2be` | #5583 #5584 #5585 | 41283850869 | #5583 import capacity, #5585 Gmail sanitizer repair, #5584 Dot's hosted-plugin packet. Strict + public smoke passed. SR flip 2: AGREE 10/10. |
| 43 | 2026-11-01 07:26 | `8835b2be` → `e8c29d2f` | #5581 #5586 | 41284741200 | #5586's merge commit is this flip's target (it adopts Grok's #5580, whose original PR was left open — its close is Codex's). **#5581 activated the bounded operator message-authority path** — the wholesale canonical conversion was NOT run; a controlled QA conversion refused safely (`authority_not_ready`). SR flip 3: AGREE 10/10. |
| 44 | 2026-11-01 08:16 | `e8c29d2f` → `06e811ff` | #5587 #5571 | 41288119449 | **#5571 landed + deployed** (heartbeat-visibility patch, qualified head `adf5c286`); #5587 also in range (its merge `6d520752` precedes #5571's in the range). Smoke 16/16. SR flip 4: AGREE 10/10. |
| 45 | 2026-11-01 08:39 | `06e811ff` → `108b5c1f` | #5576 | — | #5576 spend pricing guards, landed alone (composed head `5590d7dc`). Tab post-deploy verify seq 25143. SR flip 5: AGREE 10/10. |
| 46 | 2026-11-01 08:51 | `108b5c1f` → `0f83478a` | #5588 | — | #5588's merge commit is this flip's target (head `8e8a7a04`). Deployment + QA-room rehearsal passed; Tab verify seq 25146. SR flip 6: AGREE 10/10. |
| 47 | 2026-11-01 09:21 | `0f83478a` → `acedbeed` | #5590 | — | #5590 reminder repair (DST repeated-hour scheduling; merge commit = this target). SR flip 7: AGREE 10/10. This source becomes the rollback target for flip 48. |
| 48 | 2026-11-01 09:32 | `acedbeed` → `9eec755f` | #5577 | 41293524688 | **FAILED + ROLLED BACK.** This target is #5577's merge commit. Deploy drew canonical /api/ready 503 (DO timeout 2500 ms) in strict smoke. **Second reader never observed this build live on either door** (doors stayed on `acedbeed`, ready 10/10 — DISAGREE, finding 2). Fo's 09:39Z smoke and later reads on this source read ready 200; the 503 remains unexplained, not relabelled fixed. Restored by R1. |
| 49 | 2026-11-01 09:50 | `acedbeed` → `3d22e094` | #5577 #5589 **#5591** #5592 | 41294828583 | The repaired #5577 redeploy: this target is #5592's merge commit; range also carries #5589 (merge `4c112648`) and **#5591 (merge `6226db63`) — first carried here, correcting the morning summary** (finding 5). Strict 16/16 (Codex seq 25171). SR flip 10: AGREE 10/10. |
| 50 | 2026-11-01 09:58 | `3d22e094` → `d3e73bf5` | #5593 | 41295314517 | #5593; strict 16/16; controlled QA recovered an interrupted ack (corrected QA pass 10:10:43Z, seq 25179). SR flip 11: AGREE 10/10. |
| 51 | 2026-11-01 10:13 | `d3e73bf5` → `21891d44` | #5594 | 41296448193 | #5594 existing-Operator repair mode; this target is its merge commit (from head `142ced8c`). Deploy SUCCESS, strict 16/16, doors converged. Fresh historical plan returned 409 `repair_projection_unavailable` — no repair executed, quarantine remains. SR flip 12: AGREE 10/10. |
| 52 | 2026-11-01 10:34 | `21891d44` → `54c92ab8` | #5595 | 41297577796 (run named in room record at landing) | #5595 native mention context (from head `859f96ca`). SR flip 13: AGREE 10/10. Main-side caveat born here: `tests/message-certification-continuity.test.js:456` fails on main at this head (main's own push run 41298028077) — Codex's certification lane, not introduced by #5595. |
| 53 | 2026-11-01 10:42 | `54c92ab8` → `1b99d273` | #5597 | 41298609743 | The #5597-line diagnostic deploy (SR: "diagnostic deploy"). #5596's head `df8d76d4` passed unit/browser on this source. SR flip 14: AGREE 10/10. |
| 54 | 2026-11-01 10:50 | `1b99d273` → `86bbb535` | #5596 | 41299172160 | #5596 optional attachment live index; this target is its merge commit. Optional index NOT installed by this flip (installed later, on this source, per room seq 25212: plan 698 rows; no permission/quota change). Historical proof mismatch isolated (absent vs invalid distinct). SR flip 15: AGREE 10/10. |
| 55 | 2026-11-01 11:09 | `86bbb535` → `79442b05` | #5599 | 41300536086 | #5599 OAuth (passed all release checks); this target is its merge commit. Becomes the verified restore source for sequence B. SR flip 16: AGREE 10/10. |
| 56 | 2026-11-01 11:18 | `79442b05` → `7e51d1e1` | #5578 | 41301218839 | **#5578 deployed** (privacy fail-open cure; this target is its merge commit, composed head `0d09dea1`). Strict 16/16 at deploy — then **readiness FAIL: second reader caught ready 5/10 = one HTTP 503, DO timeout 2500 ms (11:32Z read)**; a later independent check on this source also found one 503/10. Rolled back in sequence B (R2). SR flip 17: FAIL. |
| 57 | 2026-11-01 11:30 | `7e51d1e1` → `16a637fb` | #5598 | 41302108695 (cancelled) | #5598 First-task UI; this target is its merge commit (head `9feaa4f`). Live on both doors at 11:39Z (ready 10/10), then its deploy was **cancelled** by Root in response to flip 56's FAIL and production restored to `79442b05` (R2). SR flip 18: DISAGREE at protocol read (restore already in place). |
| 58 | 2026-11-01 12:10 | `79442b05` → `8facbfe4` | **#5601** (+ range re-includes #5578 #5598 #5600 #5602) | 41305099031 | New checkpoint deploy after the rollback. Jill's source-check lane bound to this source: **18/18 ready reads PASS** (12:18–12:29Z, both doors, max DO 1,135 ms), smoke PASS — **this source was clean**; the night's third 503 belongs to flip 59, not this one. Range re-includes the rolled-back #5578 + #5598 (finding 3). SR flip 20: AGREE 10/10. |
| 59 | 2026-11-01 12:25 | `8facbfe4` → `1cc9ef44` | #5603 | 41306354999 | #5603 attention-card guard; this target is its merge commit (head `ea540294`). Strict 16/16 verified live 12:31:55Z; second reader's sample clean (ready 10/10) — **but the deploy lane's bounded trace caught a single /api/ready 503 at 12:30:20.132Z** (2500 ms; same RPC settled ok at 2988 ms, during DO source convergence; cause unproven, Root retains it). Jill's source-check lane caught the same signature at 12:30:21.839Z on the app door. Restored by R3 after ~10 min as poller head. SR flip 21: AGREE in its sample. |
| 60 | 2026-11-01 13:05 | `8facbfe4` → `e4d27fca` | #5604 #5605 #5606 (+ #5603 re-carried) | — | Range runs from the *restored* `8facbfe4` (R3), so it re-carries #5603 alongside new #5604 (operator-selected parity), #5605 (adopts #5569/#5570 — the resolution programme's deletion-carrying PRs), #5606 (this range's tip line). Seat ready reads on this source: 5/5 200, both doors (seq 25320). |
| 61 | 2026-11-01 13:39 | `e4d27fca` → `513d3ee8` | #5607 #5573 | — | **Current production** at pack time. Carries #5573 + #5607 (mcp-contracts batch). Independently verified by Jill's check lane on this exact source: 26/26 ready reads across both doors, max DO 1,494 ms — no convergence-window failure — and the full consent matrix completed here (opt-in projects on all four faces; recorded opt-out + directory=true exposes nothing for 11.4 min). SR flip 24: AGREE 10/10. Steady ~4¼ h at second-reader drafting time. |

## Annex — rollback-restore transitions with no ledger row

| # | UTC (build) | From → To | Deploy run | Notes |
|---|---|---|---|---|
| R1 | 2026-11-01 09:21 (buildId unchanged) | `9eec755f` → `acedbeed` | — (rollback of 41293524688) | Second reader flip 9 (poller 09:51:58Z): AGREE, ready 10/10; Codex's post-rollback strict smoke 16/16 on `acedbeed`. Because the restore re-served flip 47's exact source **and** buildId, the flip ledger registered no new flip — its seq 49 simply resumes from `acedbeed`. |
| R2 | 2026-11-01 11:36:33.535 | `16a637fb` → `79442b05` | 41302590166 | Second reader flip 19: AGREE, ready 10/10. A **new deployment of the prior source** through the schema-gated pipeline (runtime suffix r2) — "not yet a verified provider-version rollback" (Codex). Supersedes flips 56–57. Ledger seq 58 resumes from `79442b05` with no row for this transition. |
| R3 | 2026-11-01 12:36:56.357 | `1cc9ef44` → `8facbfe4` | 41307273530 | Second reader flip 22: AGREE, ready 10/10; recovery deploy SUCCESS per Codex 12:43:24Z, strict 16/16. Restores flip 58's source as a new build after flip 59's single-read 503. Ledger seq 60 resumes from `8facbfe4` with no row for this transition. |

## Rollback / restore map (summary)

- **Sequence A:** flip 48 (`9eec755f`, #5577) fails strict smoke (ready 503) and is never adopted on the doors → R1 restores `acedbeed` → flip 49 redeploys the repaired #5577 with #5589, #5591, #5592.
- **Sequence B:** flip 56 (`7e51d1e1`, #5578) passes strict smoke, then draws a single-read DO-timeout 503 → flip 57 (`16a637fb`, #5598) deploys and is live ~9 min → its deploy is cancelled → R2 restores `79442b05` (new build) → flip 58 checkpoints forward to `8facbfe4`, re-including #5578 + #5598 in its tree.
- **Sequence C:** flip 59 (`1cc9ef44`, #5603) draws a single-read 503 in its convergence window → R3 restores `8facbfe4` (new build) → flips 60–61 proceed from the restored source; production steady at `513d3ee8` since 13:39Z.
- `79442b05` served as a production source three times (flips 55, R2's restore target lineage, and as flip 58's base); `8facbfe4` twice as a deploy target (flips 58, R3) plus as flip 60's base. All restores were themselves UNRECORDED deploys — they appear in no deploy record either; only the second reader's posts and the deploy-watch stubs for neighbouring flips evidence them.

## Counts

- Ledger flips attributed: **61 / 61 rows** (60 forward ranges resolved; flip 7 UNDETERMINED as a forward range; flips 27 and 41 PARTIAL under the 250-commit compare cap).
- UNDETERMINED (full): **1** (flip 7). PARTIAL: **2** (flips 27, 41).
- Restore transitions annexed: **3** (R1–R3), none with a ledger row, none recorded by the deployer.
- Recorded by the deployer: **0 of 61** (and 0 of the 3 restores).
- Deploy run ids named in the record: 17 of 61 flips (all in the Nov 1 sequence) + 2 of 3 restores.

*Sources: flip-ledger.json (2026-11-01T18:16:55Z generation); GitHub compare API reads in this run; `~/workspace/second-reader/COMPLETION.md`; `~/memory/2026-11-01.md`; room sequence references as cited in those records. Where the compare range and the morning summary disagreed (flip 49 / #5591), the range is followed and the disagreement is flagged in finding 5.*
