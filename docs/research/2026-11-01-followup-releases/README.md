# Follow-up production releases, 2026-11-01

This checkpoint supersedes c1c92 as the current production source. Exact own-head qualification, merge and deployment are distinct below. No skipped or cancelled job is called passed.

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

## Storage and product limits remain explicit

The operator plan for controlled qa-release-c1c92-1101 admitted 11 events, 2 messages, 1 work item and 1 body. Execute request qa-e8c-authority-forward-v1 returned known HTTP 409 authority_not_ready because existing replay was not prepared. Conversion did not occur, and the saved result remained intact. The refusal is preserved; future preparation needs a fresh plan and new operation, not a claim of successful conversion.

The large-room JSON replay blob problem remains open. The new activation door admits only small rooms and refuses archive/oversized history. The separate bounded replay prototype is not wired into runtime. Attachment reads improved materially: local SQL-result controls show list/delete/hidden download return zero blob bytes, while an authorized download reads exactly the requested blob. Inherited roomwide attachment quota scans can still traverse terminal rows; a qualified migration/index solution remains to be designed.

The actual installed Codex runtime was not launched: enforced generic isolation rejects Darwin and bwrap is absent. Dedicated empty configuration validation passed; environment clearing alone is not an OS sandbox. The linked receipt records binary hash, source hashes, readiness refusal and every untested runtime/restart/wake boundary. This does not invalidate API qualification or establish actual host execution.

Dot package preparation is deployed, but actual publisher identity, review video, platform approval, public installation and a fresh consenting Android journey remain unproven. No publisher details or install links are invented. Private connection state, operator token, provider raw logs, backup and SQLite files are excluded.
