# Root Codex to Grok Bot: complete ownership handoff

John's latest direct instruction is to move all Root-owned work to Grok Bot because Root is low on usage. This transfers source/integration ownership, release coordination, merge/deploy responsibility, verification and pending Root decisions. Earlier messages saying Root is the sole merger/deployer are superseded by this instruction. Use your own existing identity and authorized GitHub/Cloudflare access. No credentials are handed over, and this does not itself change technical grants. Report an exact access blocker if your existing access cannot perform an operation. Root is stopping work; do not wait for Root approval.

## Immediate order

1. Finish monitoring the already-running release, not a duplicate deployment. Main is `2c4485f2ec2ee85deb302ee2cedc78b2d4176546` (#5939). Deploy `41897283805`: deploy job and golden smoke SUCCESS at handoff; runtime-publication job was finishing. Finish/check publication, record canonical and entry buildIds, and smoke both production doors. Full exact qualification `41897289224` is running. The other laptop's finite watch is being stopped; you own its final verdict. Do not describe pending qualification as passed.
2. Finish your #5930 Board repair before feature work. Integration branch `codex/board-list-integration-1104` contains your exact two commits adopted onto current main: `02ea311bd` + `e453b7513` (original author commits `6208ed074` + `2d8799309da32ff139374a2e38ee8d6806d98093`). This handoff doc is an additional documentation commit. Author branch is unchanged. Root reproduced the 95-member Board test failing on main with409 and passing after1/1. Independent peer source review CLEAR, but broader/Native qualification is NOT complete. Publish/review/merge the integrated candidate only after missing controls below.
3. Continue the remaining source queue and agent coordination. Preserve current identities, privacy and exact tested/deployed distinctions. Do not bulk merge old author branches that were already adopted into main or blindly land light-CI-only features.

## Current release and CI facts

- Previous deployed/fully qualified main was `8c9deff7534ed549df88b730c03af2d9d3a11db8` (#5918). Full run41844863024 SUCCESS:15,996 total,15,979pass,17skip,0fail/0cancel. Module coverage machine82.6>=79.6%, server96.2>=95.4%, src56.2>=51.7%. Runtime published and verified. Schema46.
- Later scheduled41882431070 failed one TEST in unit and coverage: old ping-pong test inferred throttling whenever HTTP elapsed>=350ms. It reported first throttle14(unit)/4(coverage) vs21, AFTER successfully asserting delivery. This is not lost-wake evidence. Coverage stopped after suite failure, not OOM or threshold failure. Full log SHA2564334c1f0faa6fb830439716d113477d97d6faab14f95f9ffa0afab46406b0fb0.
- #5939 fixes that test only. Source `c480ce46e0ccc12006431cfaa65cf2a817f244d7`, merged2c4485f2. Tests now inspect actual enqueue.throttled and registered waiter release; preserve HTTP delivery, exactACK, empty queue and over-budget minimum wait. Only fixture bucket refill clock is pinned. Artificial400ms response delay makes original test fail1vs21; fixed11/11, composed bucket/poll underV8coverage37/37. Independent review CLEAR; preflight/lint passed. No production code, wake limits, schema or permissions changed.
- #5917 fixed rare random43-character issued credentials colliding with oat_/iat_/rak_ prefixes. Exact issued hash selects existing validation path; no revocation/expiry/room/account/session bypass. Do not rotate real credentials to work around failures.
- #5918 streams coverage line unions instead of retaining all raw ranges. Thresholds, exclusions and timeouts unchanged. Actual earlier4GB evaluator OOM fixed and hosted qualified. Do not undo or just raise heap limits. Coverage artifacts were not retained by the workflow, so historical raw-payload replay is unavailable.
- Native archive test passed286s in the successful run, close to existing300s inner cap. Latest scheduled Native260.9s and relief124.5s passed. Record headroom as limited; do not claim universally fast or enlarge limits blindly.

## #5930 qualification remaining

Changes only work-list all/results to read protected owner+viewer authority rather than full member census/pins. needs_me already uses an addressed path; other overview callers stay unchanged. Existing witnesses, row/hash/revision checks, privateWorkForViewer, work summaries and encrypted cursor/horizon stay intact. Unrelated roster/pin corruption ceases to block this addressed listing; it is not a whole-room integrity audit.

Retain/add controls for owner/viewer witness tampering, private-work outsider vsparty visibility, and results pagination containing actual saved results (author test only traverses emptyresults). Run relevant current-work-list, overview, attention/privacy suites and actualNative current-work-list/current-overview checks. Author claimed53pass+1baseline failure in current-attention('v2 requires its own directory'); Root has NOT verified that baseline claim. Classify actual failures rather than accepting it. Refresh candidate manifest if deployment files change. Stage the exact composed runtime head before release.

Important separate observed issue: Root's lobby posting helper failed its preliminary checkConnection with409 current_room_context_unavailable BEFORE posting. Team-room posting works. Do not claim #5930 fixes all lobby connection/context paths: its scope is Board listing. Root sent lane ownership to you in team seq2417 instead.

## Agents and unfinished decisions now transferred

Team room `room-fafdae79cf8c`; public lobby `project-room-lobby`. Grok Bot existing member `ai_NiIvggYi1S2wfYN_`; Claude cloud `ai_83ohplyWt0CwC4yt`; Root `ai_c564fc5a275378c2c941b380aea39a3bed60fe61`. No new seats/keys.

Claude seq2412/2414 asks decisions on next agent-loop wave. Root answered seq2416:
- A: Root server-design ownership for ask states/10-second truthful delivery signal is now YOUR ownership. Keep progress out of acknowledgement chat; distinguish delivered from working.
- B: Claude stale-ask draft waits for that state contract.
- C: Claude owns draft for incoming+open discovery using existing witnessed inbox index only; both/all paths unchanged, corruption/privacy/opaque-cursor tests retained. No broad unchecked party-index shortcut. Require exact patch and failing-before/passing-after evidence.
- D: preserve complete answerBasis semantics; do not silently declare unseen context complete.
- E: you can measure existing courier receipts without generating unnecessary wakes.

Feature queue is NOT blanket approved: #5921 claims to replace held#5858 scheduler; #5925–5929 triage/import/docs/Slack/health-cache need exact-head review and flags off unless separately authorized. Held#5891 palette has known focus/navigation failures; #5898 preview has production-authority boundary issue. Reconcile originals already adopted rather than re-merging them. Jill lobby348 references branch jill/w2600-codex-packet/e34c9f664; treat as evidence/queue input, not permission to skip review. User's fast path allows local head-verified evidence for NOT-RUN jobs and no waiting on main between merges; actual failures still need classification/fix. No mass PR/branch pruning was authorized.

## Release discipline and resources

Use existing workflow deployment, schema gate and compatibility guard. Smoke after each deploy; recover/rollback only with a qualified compatible pair. Never downgrade schema46 to45. Earlier bounded-recovery repair did not make every final audit bounded: wholeRecoveryBounded remains false. Do not invent finished blob/whole-system guarantees beyond measured evidence.

Public doors: https://room.trydemigod.com and https://www.getdasha.com/room. Record exact mergeSHA, canonical/entry buildIds, actual full verdict and runtime artifact verification; separate tested/integrated/deployed/live-proved. Keep messages short, mention owners, no acknowledgement-only runner posts. No scheduled routines (John declined them).

Root local checkouts, for a Mac-side worker only: /Users/johnpotter/src/pr-fresh-wake-release-1103 (test-only5939 clean/pushed) and /Users/johnpotter/src/pr-board-list-integration-1104 (this clean/pushed integration). Full private historical release notes are /Users/johnpotter/src/PROJECT-ROOM-ROOT-RELEASE-2026-11-04.md. Do not upload private credentials or identity folders. Existing peer chat01a1a09d-60e7-767a-ae05-c420a5624020 is the same physical Mac, not the friend's Windows laptop. No proof Windows host is writable. Peer retains evidence and is told to stop. No local CPU suites remain active.
