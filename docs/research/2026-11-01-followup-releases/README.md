# Follow-up production releases, 2026-11-01

Current checkpoint at18:53Z: main is `c52db58787467390042295b181b152ef3ba4de12`; production is the schema-gated recovery `513d3ee8471464803fd3c70dea2fe9ce30f27ad0` from deployment `41336903930`. Strict16/16, public smoke and runtime publication passed; canonical build `2026-11-01T18:30:36.961Z`, entry Worker build `2026-11-01T18:30:47.705Z`. However the subsequent finite recovery trace captured another readiness503, so latency is unresolved and new deployments/historical repair remain held for diagnosis. New main landings5619,5620 and5574 are not deployed. No historical v3 plan or execute has run. Large-room blob removal, bounded wake activation, actual native runtime execution and fresh-account Android qualification remain incomplete. See [use-driven design](use-driven-design.md) and [recovery trace](513d-r2-recovery-trace-summary.json).

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


### Historical repair deployment and live refusal (10:31 UTC)

Deployment `41296448193` successfully published source `21891d44372c7d24006ea37e312853517f5f9d73`. Runtime verification at `2026-11-01T10:19:26.809500Z` records 663 files, 3,513,118 archive bytes and SHA256 `b25b04664b555127ed83bceb9751b6a277ff71bf68780217a4116ead7d7b7a34`. Root source readbacks converged; Jill independently reported readiness 10/10. The attached smoke and immutable runtime receipts preserve those checks.

A source-pinned, journaled plan for the selected 25-event historical quarantine refused with `repair_projection_unavailable`. The script had no execute path. The private input and response remain preserved; only the sanitized refusal is published. The response does not distinguish missing proof, proof drift, content mismatch or hydration failure. Old private backup evidence cannot establish which applies now. No trust baseline was minted, serving row rewritten or quarantine cleared. The underlying provenance/recovery investigation remains open.


### Native mention deployment and pending diagnostic

PR #5595 exact head `859f96cadeb8e62bd4e58889ecd8db33b4c80206` passed hosted run `41297577796`, including all six browser shards, unit, Worker, contract, lint and friend-agent checks. Its merge is `54c92ab83616a5eb46dba7beaaf741da7088ecf0`. Deployment `41298040713` completed successfully. Runtime verification records 664 files, 3,514,701 archive bytes and SHA256 `f6f08c23ef418a9253fb4581e5fc6334e2b52766b0ff66a1b29b812a7f223271`, checked at `2026-11-01T10:41:03.704984Z`. A subsequent release-list readback confirms runtime-2026-11-01-54c92ab is latest. The immutable verification receipt precedes latest promotion and correctly records publicationPromoted=false.

The bounded native mention path preserves fresh policy checks at every callback authorization barrier. Its actual Worker/local OAuth and signed transport qualification is source-pinned; this deployment's public smokes do not establish a new external host or closed-app wake. Account-agent OAuth binding retains a separate full-room read outside this slice.

PR #5597 passed its exact head `f19b880fead1ca63c99e8d8ad9ca5e35ae779727` in hosted run `41298137674` and landed `1b99d27397c03e73ee134da221c783541d7c192c`. It attaches only fixed, code-owned proof refusal diagnostics. No eligibility, status, predicate ordering, SQL, transaction or trust-baseline change is included. Its deployment and fresh live diagnosis remain pending at this checkpoint.

Attachment PR #5596's initial head `5d87a8b` failed hosted unit because both new Operator operations lacked required OpenAPI permission declarations. The exact guard failed locally before four source/generated annotation lines cured it. Current composed head `df8d76d41e9279ef0ed07bfb71683f55992515bb` has fresh checks running; no failure is waived and no optional index installed.


### Diagnostic and attachment releases completed

Deployment `41298609743` published `1b99d27397c03e73ee134da221c783541d7c192c` successfully: strict smoke 16/16, public smoke and runtime publication. Canonical build `2026-11-01T10:42:31.222Z`; entry `2026-11-01T10:42:44.574Z`. Runtime verification at `2026-11-01T10:48:58.693286Z`: 664 files, 3,514,912 bytes, SHA256 `d03828e0baee6d8096dc8acd51c63d53d9c9bb8ea394708636ffc68cefc31fdc`.

The journaled plan-only v2 passed all four source pins and returned HTTP 409 with fixed diagnostic `message_proof_mismatch`. The earlier metadata/projection digest and serving-proof checks completed before that refusal. This supersedes the unverified current missing-metadata hypothesis; the Oct31 missing-proof observation remains historical. The diagnostic does not distinguish absent versus present-invalid message proofs. No repair, proof adoption, serving rewrite or quarantine clearance occurred. Original and v2 private journals remain separate and unchanged.

Deployment `41299172160` then published `86bbb53547dd37e1ee43df9207fefe149929b40c` successfully: strict smoke 16/16, public smoke and runtime publication. Runtime verification at `2026-11-01T10:56:40.113601Z`: 665 files, 3,518,227 bytes, SHA256 `89b2ca6127b7604ffec81edbe3d00bb7f35a0d457146c739a4a5586ae0521033`. Root's fresh six-door receipt confirms all four version reads plus readiness on both origins.

The optional attachment index remains absent. Its fresh exact-source plan admits 698 total rows, 34,765 aggregate key/state bytes and 18,251,677 stored variable bytes, below the independently qualified optional limits. Blob contents were not materialized in JavaScript. Execution and exact saved-input recovery are being prepared; the plan does not prove installation or measured production latency improvement.

New candidates remain separate: first-task UI #5598 at `004b415d11f091cfea91c60e7711e76cc3318fe7` awaits Fo's exact-head browser journey and head CI; OAuth binding #5599 at `eb038e5f1a2e5c3929294380f1674a5713aa9369` awaits head CI. Privacy #5578 at `0d09dea1d536385c7b5c691d00d5645ba6159d59` was marked ready for actual current-head checks after source-preserving composition; draft-skipped jobs are not passed. None has landed at this checkpoint.


### Optional attachment index installed and reconciled

Root reviewed the exact admitted live plan: 698 rows, 34,765 key/state bytes and 18,251,677 stored variable bytes. Execution on source `86bbb53547dd37e1ee43df9207fefe149929b40c` installed only the optional recognized index and saved its receipt. A separate Node process sent the identical saved execute input, verified duplicate/original receipt equality and then made a fresh plan that confirmed the index is currently installed. Both origins passed readiness afterward at `2026-11-01T11:05:02.157Z` (491 and 74 ms observed wall time). These timings are availability checks, not an attribution of production speed to the index. No attachment payload, quota or permission changed. Private fsynced journals are excluded from these receipts.

### OAuth release and privacy landing

PR #5599 exact head `eb038e5f1a2e5c3929294380f1674a5713aa9369` passed hosted `41299936718` and landed `79442b057ed433335c2cf9b5a2e2474a447d3f7c`. Deployment `41300536086` completed successfully, including strict 16/16, public smoke and runtime publication. Root's fresh source/readiness receipt passed. Runtime verification at `2026-11-01T11:15:18.917480Z`: 665 files, 3,519,062 bytes, SHA256 `f6a43d5e8956b1bf14bebd274e12aaaae224e3b1b2be01c05097bb2d81aba7dc`. This is not a live newly issued account-agent OAuth grant test; legitimate grant/resource/read-only validation was qualified in the Worker fixture.

Privacy #5578 landed singly at `7e51d1e16164dc8bf9fa86688eea7d35c1644898` from exact head `0d09dea1d536385c7b5c691d00d5645ba6159d59`. Test run `41299973257` passed. The initial gate `41299973234` failed for missing large-diff justification; the later exact-head pull-request gate `41300599136` passed at 11:09:31Z, before the 11:11:19Z merge. Both are retained; no gate threshold changed. Independent Git merge-tree equals the exact composed tree, and privacy runtime/adversarial corpus match the reviewed f6af053f pin. Deployment `41301218839` is pending.

UI #5598 is now test-only head `9feaa4f627b5e2eb5e2b308d6441cd128a169fb8`. Original hosted 004b415d failures stopped at an assertion requiring deliberately removed DM-policy copy before reload was tested. The one-line test correction asserts the actual task-first action. Hosted `41300598617` passes at the new head; Fo's manual preview remains open under explicit request `reply-8e7bdc23a9b12f37ecd67887e311e5d813ef3c018198d5c0ec1bc62c97cba774`. No UI landing or manual pass is claimed.


### Privacy deployment completed and first-task UI landed

Privacy #5578 deployment `41301218839` passed strict 16/16, public smoke and immutable runtime verification at `2026-11-01T11:24:54.184635Z`: 665 files, 3,523,528 bytes, SHA256 `f5e0ce4cd69c87cd1af7dc9a9bc969e4ee364d3725d14ae5e81a1ce1b2c6872f`. Root independently confirmed both public routes at `2026-11-01T11:29:21.728Z`. Sanitized strict, runtime and live readback receipts are included.

UI #5598 landed `16a637fb29036a7e584b6cf4ae2d39164eafe877` from exact green head `9feaa4f627b5e2eb5e2b308d6441cd128a169fb8`. This followed the user’s own-head-green fast path. Fo subsequently reported real-browser PASS at Room sequence 25229 on desktop 1280×900 and mobile 390×844: task-first orientation, keyboard opening, exact query intent, fragment preservation, claim → in progress → deliver → saved result, and sign-in 8/8. Three nonblocking observations remain explicit: data-loading failure after a successful dialog open consumes the intent; mobile Board entry is behind the sidebar; existing claim policy requires the contribution permission profile. No claim-policy change or production journey test is inferred. Formal request closure remains separate. Deployment `41302108695` is running.


### Later readiness failure and recovery in progress

Jill reported Room sequence 25234: on source `7e51d1e`, canonical readiness returned 200,200,200,200,503,200,200,200,200,200. The failing response records a DO timeout at 2500 ms. Exact per-read wall timestamps were requested and are not yet supplied. Prior strict and fresh readbacks do not establish continuous availability.

Root cancelled `41302108695` while strict convergence was running. Its uploaded UI builds were canonical `2026-11-01T11:30:17.582Z` and entry `2026-11-01T11:30:28.087Z`; no completed strict/live/runtime result is claimed. An early root all-door assertion observed the preceding DO source and refused. Recovery `41302590166` redeploys known prior source through the existing schema-gated pipeline. This is not an already verified provider-version rollback; manual version rollback's committed exact-pair compatibility requirement remains intact. A bounded future-only sanitized tail observes the recovery window, not the earlier incident.

Fo's more detailed reply at 25239 limits her manual coverage: the two identity-reload cases remain pending; wall entry uses standalone agent sign-in rather than an in-place panel. Her manual task journey pass and the hosted browser-shard passes remain distinct.


### Recovery verified

Recovery `41302590166` completed through the normal schema-gated pipeline. Strict smoke 16/16, public live smoke and runtime publication passed. Runtime verification at `2026-11-01T11:43:02.131965Z` records 665 files, 3,519,062 bytes and SHA256 `f6a43d5e8956b1bf14bebd274e12aaaae224e3b1b2be01c05097bb2d81aba7dc`, identical to the original source artifact, under immutable tag `runtime-2026-11-01-79442b0-r2`. Root's fresh all-door check passed at `2026-11-01T11:44:29.186Z`. This does not prove sustained availability or resolve the readiness cause.

The 300-second future-only sanitized observation saw 15 ready responses, all HTTP 200, with recorded Worker totals 16–381 ms. Its 1,147 events contained 1,024 ok and 123 canceled outcomes, with no observed exception classes. Canceled does not itself mean failed HTTP. No SQL-cost/job events were observed; zero cold-phase clock values do not establish zero CPU. The configured expected source is a rollout target, not per-event attestation. This window cannot reconstruct the prior incident.


### Attention scan qualification remains blocked at eb3edf07

The exact-SQL [census](needs-me-5582-sql-census.md), portable script and two structured receipts demonstrate that returned-row budgets do not bound SQL work on plain/sparse histories. The 1k→10k plain fixture returns zero reply rows at both sizes while SQLite progress callbacks grow 9,059→90,059. The constant-ten-viewer mention fixture returns ten rows at both sizes while progress grows 11,354→110,354. These are local SQLite 3.51 engine-progress measurements, not Worker rowsRead, physical I/O, CPU or production latency. Dense/narrow-window controls remain bounded on these fixtures. Source/query pins and planner-statistics contrasts are preserved. Jill retains the code lane for the candidate-selection/cursor cure; no source edit or gate waiver was made from this audit.


### Deployment 41305099031 and next UI landing

Historical absent-proof repair #5600 landed `62820317093f07b930e8f284457ac52b8c04390b`; readiness instrumentation #5602 landed `e8673fd72f174645574b0d1f929dd29fe8a6d98a`; fixture/scanner corrections #5601 landed `8facbfe4389e6ecd23b1c1fb9c2fe398398ee2e4`. Their exact heads passed hosted runs 41303307116, 41303719254 and 41304483595 respectively. The original scanner failure is retained; its cure narrowly permits one exact synthetic random-token expression and keeps literal secret detections. Browser shards for the latter two were not required, not passed.

Deployment 41305099031 completed strict 16/16, public smoke and runtime publication. Root confirmed all four source doors plus both readiness doors at 12:17:18.950Z. Runtime verification records 667 files / 3,528,547 bytes / SHA256 `ba74c6dd73d44e12014459e7b4693856e1a4ddfbf5255fc0bc5b86268f32f123`. The included immutable verification precedes latest promotion; deployment completion is separate evidence. This deploy includes instrumentation, not a causal readiness fix.

Agent attention UI #5603 landed `1cc9ef442381b61e6ea5652524ebc459ed913a56` from exact green head `ea5402942c69885e54be1e10b48273e3b1066c0d`, hosted 41304937738 including six browser shards. It suppresses human-owner rollup calls for agent views while retaining authorized queue reads and clears stale owner content. Its deployment 41306354999 is running. Fo's two manual identity-reload cases remain pending the next verified build.

Natural retention and integrity attempts at 12:00:37/38Z committed after the optional index installation, with zero consecutive failures; integrity records 79 verified rooms and one quarantined event. These job timestamps are not source attestations. No quarantine clearance, historical execute, large-room activation, consent widening or schedule reset is claimed.


### UI deployment 41306354999 completed

Source `1cc9ef442381b61e6ea5652524ebc459ed913a56` passed strict 16/16, public smoke and immutable runtime publication. Root's four-source/two-readiness readback passed at `2026-11-01T12:31:55.293Z`. Canonical build `2026-11-01T12:25:25.015Z`; entry `2026-11-01T12:25:35.108Z`. Runtime contains 667 files / 3,528,587 bytes / SHA256 `e3df249df330afd6c41b9383885b63d6fd650276b00f07e096ee33be7d86f5f0`. Fo was asked to finish only the two remaining manual identity-reload cases against this build. No manual pass is inferred from deployment or hosted browser results.


### Later 1cc readiness failure; recovery started

The completed 600-second sanitized rollout trace records 2,851 tail events and one HTTP 503, on readiness at 12:30:20.132Z. Worker wait reached its 2,500 ms deadline; the same logged RPC settled successfully at 2,988 ms. Nearby health and other reads took approximately 2.9 seconds. All 45 other observed readiness responses were ready. There are zero exception entries, 316 canceled tail outcomes and 69 HTTP 429s; these are not silently counted as successful business requests. The collector finished at its time cap with exit -9. Its target header is not per-event source attestation. Nine DO phase triplets versus 46 Worker responses require a routing/tail-coverage check before drawing conclusions from absent DO logs.

Root immediately dispatched recovery 41307273530 to prior 8fac using runtime r2. This is an operational recovery through the existing schema-gated pipeline, not a proven causal fix or a waived manual provider-version rollback receipt. No timeout, probe semantics, grant, health baseline or schedule changed. Previous strict/live/runtime receipts remain valid observations of those finite checks; they do not clear this later incident. New browser cases and live historical repair stay pending recovery.


### Recovery 41307273530 verified; two later landings

Recovery completed on prior `8facbfe4389e6ecd23b1c1fb9c2fe398398ee2e4`: strict 16/16, public smoke and runtime r2 passed. Root read four matching source doors and both readiness doors at 12:43:24.263Z. The runtime archive is identical to the original 8fac release: 667 files / 3,528,547 bytes / SHA256 `ba74c6dd73d44e12014459e7b4693856e1a4ddfbf5255fc0bc5b86268f32f123`. The finite ten-minute trace recorded 2,567 events, 47 ready responses with I/O waits 15–1,221 ms, zero 5xx and zero exceptions. It separately retains 310 canceled outcomes and 66 HTTP 429s. Source header remains a target, not per-event attestation. Recovery verification does not establish the timeout cause.

#5604 landed `d43cef004029dfb94baf829b886a8fc11b5a932e` from head `5a5f0e91f5f270796504fd67332f46ba55de085a` after hosted 41307145732 passed, including all six browser shards and Worker checks. The earlier scanner and missing-justification gate failures are retained; corrected narrow fixture exception and actual body justification passed. The selected read is not deployed and no live repair plan/execute has run.

#5605 landed `03115919d0a41f64448b8d4a39d140cf73fc87ac` from head `aa3ee1965ffb09c764140a7655466d69956ba65b`; hosted 41307531138 passed, including all six browser shards and Worker checks. Its landed tree exactly equals independent merge-tree `be650154179b0ffa67455816d47cdd9132ee1682`. It adopts #5569/#5570 with attribution: unused room-address code, orphan fixtures and unassigned experiments removed, retained live PR-footer behavior unchanged. Original PRs closed as superseded with comments 6558150797/6558151589. Deployment is pending.

Qualification precision: the i18n harness accepts `I18N_BASE_REF`, not `I18N_BASE`. The selected-status lane separately passed the base-sensitive check pinned to actual 1cc9; the cleanup lane used the supported variable from the outset. Earlier ordinary lint exits remain real, but an ignored-variable setting alone cannot establish the requested comparison base. No baseline or detector threshold was changed.


### Deployment 41309512011 and current qualification limits

#5606 landed `e4d27fca0fc6cb420649a91ee90db5176f72b5d1` from exact head `4b3e67631702df8d5556681f623735dccef356e7`. Own-head hosted run 41308943799 passed unit, Worker, contract, lint and gates. Browser shards were not required, not counted as passed. The existing readiness probe now optionally returns a closed callee observation with strict source/build stamps and SQL/DO I/O clocks. Public response, deadline, SQL count and recovery policy remain unchanged. The normal deployment also delivers the preceding #5604 and #5605 landings.

[Strict smoke](prod-smoke-e4d.json), [runtime verification](runtime-publication-e4d.json) and [fresh live readback](live-e4d-readback.json) are separate receipts. Runtime `runtime-2026-11-01-e4d27fc` contains 667 files / 3,530,915 bytes, SHA256 `171c0ff9470f0ac3be8d5a9f9c28dfc45483b4f05b4c6a780ec134596092050b`. Immutable verification at 13:11:11.814184Z preceded latest promotion; deployment completion and later live readback establish the later state.

The [dual-role finite trace summary](production-e4d-dual-readiness-summary.json) retains 2,379 canonical events (364 canceled, 69 HTTP 429) and 97 entry events. Observed readiness: canonical 21 ready / 15–1,976 ms, entry 9 ready / 9–365 ms. Both have zero observed HTTP 5xx or exception entries. Validated callee stamps identify 13 canonical and 9 entry observations as e4d; other rollout records are old or unstamped. Capture ended at its 600-second cap, with exit -9 and no output cap. Sampling warnings were not observed; completeness is not established. Event counts are not distinct business request counts, and I/O clocks do not isolate CPU, queue or transport latency. The earlier 1cc timeout and recovery evidence remain above.

[Natural job evidence](natural-jobs-1300-committed-1101.json) records retention and integrity committed at 13:00:42/48Z with zero consecutive failures, 79 verified rooms and one quarantined event. Those timestamps are not direct source attestations. The earlier 13:00:18 pre-tick read is not evidence of the 13:00 job.

[Selected read before repair](selected-parity-before-repair-1101.json) is an authenticated GET against the newly deployed bounded endpoint. It reports unknown/proof_invalid, not clean. Raw target and response remain private. Historical mutation is held until saved repair contracts survive derived-checkpoint loss through the ordinary replay consumer. No quarantine row, proof baseline, grant, health counter or schedule was changed. Large-room sidecar preparation is not serving activation and does not remove the blob.


### Recovery and qualified landings,18:53UTC

Source `ef583ba81eeeb284c8b743829aa4a0555752a0e8` (#5608 saved historical contract consumer) deployed in41335150323 with strict/public smoke and verified runtime, canonical build18:10:23.342Z and entry18:10:33.112Z. Fresh both-door readiness503s at18:28:58.616Z caused normal same-floor recovery41336903930 to513d-r2. This is not proof5608 caused the incident; its consumer is now off production and no historical plan or execute occurred.

Recovery runtime `runtime-2026-11-01-513d3ee-r2` was verified before promotion:667files,3,532,148bytes,SHA256 `bfb64fd02d82b19222fdfb8f4267a1a91355c3a1d6fd950af8907233aa39852e`. Both finite600-second recovery traces completed within their2MiB output caps. Canonical sampled39 readiness response observations, including one timeout2500ms followed by successful same-source/build RPC settlement2519ms. Entry sampled12 successful readiness responses. The0ms authority SQL/DO fields use IO-bound clocks, not CPU measurement. Canonical2606 and entry66 log records are not distinct requests or a complete population. The trace establishes recurrence on prior code, not incident causality.

Integrated, not deployed:

| PR | Qualified head | Merge | Validation |
| --- | --- | --- | --- |
|5619 remove misleading dormant wake-load mode|a4e154c16ae474411ccf6d6302a9f9e028f9be38|839a642fc5eb2e5b8a05b962671fc1e2bc2b7cb3|50localchecks;headmechanical/safety-net/verdict passed,broadCI skipped|
|5620 rejected auth fixture placeholder|d55e1b120da99aa047212e5d76dcafa8747cb9c1|82de0f8b42f7bbcb1fd3e92368b43d18280a319a|exactscheduleddiff red/green;43tests;headmechanical/safety-net/verdict passed,broadCI skipped|
|5574 ACP trusted issuer/environment|c0d91dc43fa2dd1b5630243f7cf2206bd72ec997|c52db58787467390042295b181b152ef3ba4de12|ownhead41337799280 success, including contract/lint/unit/Worker/browser/friendjourney|

The first local5574 check completed13,800tests:13,765passed,1failed due two stale ACP manifest pins,34skipped. The exact pins were refreshed and manifest8/8passed afterward; hosted final-head checks passed. Original shadow-import contract failure and manifest failure are preserved. No skipped test is a pass; child environment hygiene does not establish native model execution or an OS sandbox.
