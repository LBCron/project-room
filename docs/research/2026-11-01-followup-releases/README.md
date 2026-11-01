# Follow-up production releases, 2026-11-01

Current observation, 10:08 UTC: production is `d3e73bf53972993905411d78df9e6560b5794aae` (canonical build `2026-11-01T09:58:00.832Z`, entry build `2026-11-01T09:58:09.665Z`). Deployment `41295314517` passed strict smoke 16/16, public smoke and runtime publication. Main also contains historical repair landing `21891d44372c7d24006ea37e312853517f5f9d73`, which is not deployed at this observation. Corrected controlled live post/retry/reversal QA passed at 10:10:43 UTC; its earlier harness failures remain preserved.

The sections below are dated checkpoint history. Later receipts supersede earlier limitations explicitly; failed attempts remain preserved. Exact head qualification, merge, deployment and live checks are distinct. No skipped or cancelled job is called passed.

| PR | Qualified head | Merge |
| --- | --- | --- |
| #5583 import pilot limits | 80f2da822eaef1cba3211c9e45d1041a8eff628b | d0bf44e6d3a88f04500ebef297ad17b246d98c66 |
| #5584 Dot package preparation | bb04550e1a1e7eb9ec38e6ba33c90d4f1bbfd080 | ce82ae053ff2c47cbc4a4816f4ef30c43a76c76c |
| #5585 sanitizer security | dc5337b09788d17dfc8202c18395ff6075ca7dcf | 8835b2bee1821123ea0421bb11fab7d2dee36653 |
| #5581 bounded operator activation | d3a2bf6399a211ff4acf272f495939cc74115a58 | f4832b85a237fb0ecf43e9a3e46172c719ec3fc2 |
| #5586 attachment quota, privacy and payload reads | 5cb90c57d0da0f68b8e8b27c46531608720a2e8d | e8c29d2f36fd8859d1c2c733abc1ed0052f9d68b |

## Deployment 41283850869

Source 8835b2bee1821123ea0421bb11fab7d2dee36653. Canonical buildId 2026-11-01T07:13:21.804Z; entry buildId 2026-11-01T07:13:30.088Z. Normal workflow succeeded, strict smoke 16/16 and public smoke passed; both DO doors adopted the source. Runtime runtime-2026-11-01-8835b2b verified 660 files / 3,492,414 archive bytes / SHA256 34432901c23f39652d88fd019d7a5535831e6975d3ccb1d7ee43a57598aa6a44. Immutable verification precedes latest promotion; subsequent release readback confirmed promotion.

Fresh qa-release-8835-1101 exercised native API accept/start/complete, original-request retries after progress, changed-input rejection and exact immutable saved text. Completion a29fdf11-5226-4f37-8288-858b870d76ea. This is controlled API qualification, not physical dropped packets, actual model execution, independent human approval or idle wake.

## Deployment 41284741200

Source e8c29d2f36fd8859d1c2c733abc1ed0052f9d68b. Canonical buildId 2026-11-01T07:26:29.441Z; entry buildId 2026-11-01T07:26:37.442Z. Gate, deploy and runtime publication succeeded; strict smoke 16/16 and public smoke passed, both DO doors adopted. Runtime runtime-2026-11-01-e8c29d2 verified 661 files / 3,495,988 archive bytes / SHA256 aae1417059fcb630b35b9c27124e205d8eb725e728da715139f9ddbbad179cc3. Subsequent latest-release readback confirmed promotion. Jill independently read both version doors and 10/10 ready; Fo independently read /, /join, readiness and health. Room evidence 25096 and 25099.

Main's intermediate push test runs were cancelled by newer-main concurrency; those are NOT-RUN. Own-head checks and preserved local qualification supported each landing under the authorized fast path. No health reset, schedule change, threshold change, rollback or production room conversion occurred.

## Earlier limits at e8c29 — later receipts supersede qualified cases

The operator plan for controlled qa-release-c1c92-1101 admitted 11 events, 2 messages, 1 work item and 1 body. Execute request qa-e8c-authority-forward-v1 returned known HTTP 409 authority_not_ready because existing replay was not prepared. Conversion did not occur, and the saved result remained intact. The refusal is preserved; future preparation needs a fresh plan and new operation, not a claim of successful conversion.

The large-room JSON replay blob problem remains open. The new activation door admits only small rooms and refuses archive/oversized history. The separate bounded replay prototype is not wired into runtime. Attachment reads improved materially: local SQL-result controls show list/delete/hidden download return zero blob bytes, while an authorized download reads exactly the requested blob. Inherited roomwide attachment quota scans can still traverse terminal rows; a qualified migration/index solution remains to be designed.

At this earlier checkpoint, the actual installed Codex runtime had not been launched: enforced generic isolation rejects Darwin and bwrap is absent. Dedicated empty configuration validation passed; environment clearing alone is not an OS sandbox. The linked receipt records binary hash, source hashes, readiness refusal and every untested runtime/restart/wake boundary. This does not invalidate API qualification or establish actual host execution.

Dot package preparation is deployed, but actual publisher identity, review video, platform approval, public installation and a fresh consenting Android journey remain unproven. No publisher details or install links are invented. Private connection state, operator token, provider raw logs, backup and SQLite files are excluded.

## Deployment 41288119449

Source 06e811ff383283346251c8c2c7e9da12fdbee1d5. Normal gate, deployment and runtime publication succeeded. Canonical buildId 2026-11-01T08:16:42.717Z; entry buildId 2026-11-01T08:16:52.627Z. Both Worker and DO doors adopted the source. Strict smoke 16/16 and public smoke passed; health reports verified, with no degraded jobs. Jill independently read both version doors and readiness 10/10 (Room 25123).

| PR | Qualified head | Merge |
| --- | --- | --- |
| #5587 Claude existing-agent OAuth and recovery errors | 6c685212f46a2285d7fffe39e72944618d2e6f58 | 6d52075214f21da61d3d65058ef3465c2e107370 |
| #5571 durable heartbeat attempts and monotonic outcomes | adf5c286bab372f78842cecea525ed1ef46b6557 | 06e811ff383283346251c8c2c7e9da12fdbee1d5 |

Own-head hosted test runs 41287448887 and 41287495162 passed all substantive selected checks. Full/coverage/quarantined jobs were skipped, not passed. Runtime runtime-2026-11-01-06e811f verified 661 files / 3,500,705 archive bytes / SHA256 4e204d2e41cbc65035268d564b8a8d63b17e6883bce6791c50e3825722da8bf9. Immutable verification precedes promotion; subsequent latest-release readback confirmed promotion. Raw GitHub metadata timestamps differ by one hour from build/host observation times; both are preserved in receipts.

Five live public OAuth checks passed: anonymous initialization/eight-entry discovery, protected access entry's HTTP 401, registered Claude client reaching existing-agent approval, refusal of an unregistered callback, and unknown refresh credential returning invalid_grant. No consent submitted, credentials used or grants minted. The initial probe incorrectly expected generic account login; it was corrected to the resource-bound existing-agent approval prompt and this adjustment is retained. Actual Claude host consent, native runtime execution and background wake remain untested.

Heartbeat success at 08:00:36.530Z predates this deployment and is not attributed to the new attempt instrumentation. No reset, threshold, schedule or grant changes occurred. The large-room blob problem and previously documented live conversion refusal remain open; no operator conversion occurred in this release.

## Deployment 41289726348 — spend-pricing route single

PR #5576 qualified at 5590d7dcb8f1e640817c455ebe1fecce368e0e33 (own-head hosted run 41289272386 succeeded), landed and deployed at 108b5c1f90fa1c5d7c01ed6e17d8c8d41bc653ee. Canonical buildId 2026-11-01T08:39:28.860Z; entry buildId 2026-11-01T08:39:38.068Z. Gate, deployment and runtime publication succeeded; strict smoke 16/16 and public smoke passed. Both Worker/DO doors adopted the source; Jill independently confirmed both DO doors and readiness 10/10 (Room 25132).

Runtime latest runtime-2026-11-01-108b5c1 targets exact source: 661 files / 3,500,773 archive bytes / SHA256 0aa3129c474c6289649a0806b4a539803c11b09a667978c2695da1707f67635b. Immutable verification precedes promotion; subsequent release readback confirmed latest. Full/coverage/quarantined jobs were skipped, not passed.

Dedicated existing QA-room live checks passed authorized pricing read, anonymous HTTP 401, cross-site origin_denied HTTP 403, and same-origin non-session room credential in cookie HTTP 401. Pricing state/revision remained identical; no grants minted or pricing changes. Initial source pin refused the old DO revision during propagation. A later test expectation incorrectly anticipated route HTTP 401 before the global Origin gate HTTP 403; this was corrected and both controls tested separately. Live rate exhaustion and a read-only API-key write were not tested. Local focused controls and hosted head qualification cover those behaviors.

## Storage qualification at 0f83478

PR #5588 landed at 0f83478a9d7646f8297547723b06802cedc1167b from qualified head 8e8a7a047eb023635a07a1b9cecdb1ecaf596a75 (run 41290057997). Deployment and the controlled live conversion/reversal qualification are recorded below. Its first hosted run 41289516117 failed a pinned census test. Exact-main source census confirms the previously unrecorded operator admission dependency was already present on 06e811ff (expected 62 sites / actual 63), not a new runtime regression. The explicit test and design record now include it; original failure retained, no waiver. Six census and eight manifest tests passed locally.

The attachment SQL cost research is synthetic local workerd evidence, not production latency. Its concrete index/query improvement is held for a globally bounded index-install migration; index creation must not become hidden cold-start work. No schema or attachment source was changed by that research. The large-room JSON blob problem remains open.

## Deployment 41290515907 — bounded preparation and recovery

Source 0f83478a9d7646f8297547723b06802cedc1167b is deployed and live-verified. Canonical buildId 2026-11-01T08:51:02.029Z; entry buildId 2026-11-01T08:51:10.818Z. Gate, deployment and runtime publication succeeded; both Worker/DO doors adopted source, strict smoke 16/16 and public smoke passed. Jill independently confirmed both DO doors and readiness 10/10 (Room 25137). Runtime latest runtime-2026-11-01-0f83478 verified 661 files / 3,503,653 archive bytes / SHA256 b75bd586357b8b1560e481193f47e2bccfc20a9f578a6c90975d60fb901d9b2f. Subsequent release readback confirmed latest promotion.

Controlled qa-release-c1c92-1101 completed five separate client processes: prepare with intentional response-body cancellation, recover the exact prepare, execute with cancellation, recover the exact execute after editing, then prepare and reverse current canonical state. Both directions required one preparation step. The original receipt returned after the edit; the original saved work result and edited probe remained intact after reversal. This is interrupted client receipt persistence and cross-process exact retry, not physical network loss or a DO restart during live conversion. Existing old refusal input was preserved; new intent IDs were journaled durably before each call. Private journal, token and row content are excluded. Large/archive rooms remain refused; the global blob problem is not declared solved.

The scheduled integrity run at 09:00:43.001Z completed on this deployed source with lastAttemptAt matching the run, attemptOutcome committed, no uncommitted attempt, zero consecutive failures, 77 verified rooms and zero blocked rooms. One board event remains quarantined (reducer_rejected); forensic reconciliation is ongoing, not reset or hidden. Retention likewise recorded a committed 09:00:41.016Z attempt. Earlier 06:00/07:00/08:00 successes predate the new attempt instrumentation; this is the first observed natural integrity execution with the new durable attempt fields.

Current follow-ups are separate from this successful release: #5577 passed its local storage/notification composition checks at 3349c34d but its hosted browser shard 3 found a real DST reminder-time bug. At the Los Angeles fall-back hour, a future 01:06 is parsed as the earlier occurrence and is rejected as past. Original desktop/mobile failures are retained; a narrow separate repair is underway, without timeout increases. #5589 is published at 116a87372 as a dependency of #5577, with bounded ordinary-post/Guide qualification; neither is deployed. #5578 remains held for a newly reproduced present-task-column attribution failure. No stale source label substitutes for qualification.

### Reminder correction and actual CLI metadata (09:32 UTC)

Reminder PR #5590 landed at `acedbeedc0de9cceb924fc763c5e85b45de8fa10`. Own-head CI `41292042959` passed. Deployment `41292719162` passed strict smoke (16/16), public live smoke and runtime publication. Canonical build: `2026-11-01T09:21:20.606Z`; entry build: `2026-11-01T09:21:30.618Z`. Root verified both Worker and Durable Object version doors converged. Fo independently reviewed the repeated-hour correction and ran 15 reminder tests; Jill independently observed 10/10 readiness checks. No production reminder was created as part of this checkpoint.

The actual installed native Codex binary is version `0.159.2`, while the adapter protocol pin is `rust-v0.162.1`. In a fresh dedicated credential profile, two separate real app-server processes initialized, exited cleanly and initialized again using that same profile. The allowlisted metadata receipt excludes private protocol output. This establishes only initialization and process restart; no model turn, thread recovery, Room publication, closed-app wake or OS isolation qualification is claimed. The existing generic Darwin isolation blocker remains.

The older main unit failure at `06e811ff` (`41288050088`) was a stale work-item census: `server/operator-message-authority.mjs` was missing from the expected file inventory. Current main includes explicit census correction `8e8a7a047`; the original failure remains preserved. This was not evidence of a runtime failure, and no job-wide quarantine was adopted.

### Webhook release rolled back (09:45 UTC)

Deployment `41293524688` uploaded source `9eec755f351ebdbcb3c5d8cf86f967aad6824f60` (canonical build `2026-11-01T09:32:34.897Z`, entry build `2026-11-01T09:32:44.989Z`) but failed strict smoke: canonical readiness returned 503 after a 2.5-second Durable Object probe timeout. The other 15 checks passed. No runtime was published for this candidate.

Automatic recovery verified both prior Worker allocations and both Worker/DO source doors back at `acedbeedc0de9cceb924fc763c5e85b45de8fa10` at `2026-11-01T09:43:34.918Z`. Root independently ran post-rollback strict smoke: 16/16 passed. This is recovery confirmation; the timeout cause is still under investigation. The original failed smoke and recovery artifacts are preserved.

PRs #5589, #5591 and #5592 subsequently landed sequentially with their own heads green, ending at `3d22e0944ad8dbc82d1084b2cc54b5b62b07c6c7`; none is deployed at this checkpoint. No timeout was widened or failed deployment relabeled successful.

### Successful composed deployments after the rollback

Source `3d22e0944ad8dbc82d1084b2cc54b5b62b07c6c7` deployed successfully in `41294828583`: strict smoke 16/16, public smoke, all four source doors and runtime publication. Canonical build `2026-11-01T09:50:54.815Z`; entry build `2026-11-01T09:51:03.084Z`. Runtime: 661 files, 3,507,195 bytes, SHA256 `6ae53081ac1d6792af0c8ffaacf1b01ff307410a3e5ba2d647c0a35ba3e0c5ce`; latest release readback matched. This includes webhook authentication/atomic settlement, bounded ordinary posts, referral correctness and workflow comment corrections.

Source `d3e73bf53972993905411d78df9e6560b5794aae` then deployed successfully in `41295314517`, adding qualified work-reference post admission. Strict smoke 16/16, public smoke, all source doors and runtime publication passed. Runtime: 661 files, 3,507,747 bytes, SHA256 `618e366b499024777804d6624923d4fce55910027f63340f447f7747f706ece2`. The isolated earlier 2.5-second readiness timeout did not recur in these checkpoints; its production cause remains unresolved.

Historical repair PR #5594 passed its own head checks and landed at `21891d44372c7d24006ea37e312853517f5f9d73`. Its initial size gate failed because the body lacked the repository-required large-diff justification. The body now explains the atomic admission/repair/test slice; an edited-event gate passed with unchanged source. No live repair or quarantine clearance is claimed.

### Corrected live canonical posting qualification

At `d3e73bf`, seven separate Node processes completed bounded preparation, canonical conversion, cancellation of the initial HTTP 201 posting response, exact-input recovery, and reversal in the dedicated QA room. Exactly one new message persisted; changed input under the same operation ID was refused. The saved work result, edited probe and posted message survived reversal. This is intentional response-body cancellation and interrupted local acknowledgment qualification, not physical network loss, process crash, Worker restart or a live SQL cost measurement. Authority markers remain hidden from public snapshots.

The first harness incorrectly intercepted only HTTP 200 and stopped after the new post returned 201. Its original intent stayed saved; exact retry resolved it, and safe reversal completed after a final readback hit the unchanged Operator rate limit. The corrected harness uses separate IDs/journal, records the actual 201 cancellation and paces Operator requests. Earlier failures and receipts were not overwritten or treated as product failures.

A separate future-only, sanitized canonical Worker observation decoded 617 events over ten minutes, with no exceptions and two readiness log samples (maximum total 511 ms, no failure). This limited sample does not establish the prior timeout's cause or fleet-wide latency. Raw provider events, URLs, bindings and private identifiers are excluded.
