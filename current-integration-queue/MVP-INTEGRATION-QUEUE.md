# MVP integration queue: current actionable handoff

Root retains shared runtime/UI/product/integration and release ownership. Member2 qualification lane is complete for the unchanged source currently available. Latest forward read26195: no new incoming handoff, needsMe0; runtime-only canary is not for this desktop. Message delivery does not prove physical peer execution. Fresh main fetch remains00888c52110d36250d3e07629036701b72926d09. All three owned source checkouts clean; qualification pins match. Audit runs no application tests.

## Ready independent test contributions

| Contribution | Source and integration | Existing qualification |
| --- | --- | --- |
| HTTP authorization | Branch codex/member2-authz-main-only-1102 at2fd8145d497e092d8a84751371311733b6668d70. One commit directly onmain00888. Adds tests/canonical-work-authz-http.test.mjs only. |55records pass/0fail/0skip; lintclean. Evidencecc19a2c935577515e2244013e0b3f9d825a17384 folderauthz-main-only. |
| Actual HTTP process crash/retry | Branch codex/member2-canonical-crash-ci-1102 at a956b0f82506e0b315a2974c431694f9cdb9fd51. TWO commits onmain:3b85c99a919e2d9b225e076dd5cb0b0948075941 THENa956. The latter alone is cleanup refinement and cannot add the initial test. Adds test+child helper only. |5records pass/0fail/0skip;3controlledSIGKILLs/4starts;lintclean. Evidence026a78497a24da24876988deae1f2d7738847e52 foldercanonical-crash-cleanup. Expected spawn/early-exit failure controls terminate cleanly. |

Neither contribution requires the eight pending runtime-stack commits. Existing a01 stack authorization variant is the same test on another composition; integrate one version only. The two independent contributions have not been composed together here; qualify chosen composition before claiming combined results. No PR/merge/deploy performed in this lane.

Exact local jobs for the selected contribution:

    node --test tests/canonical-work-authz-http.test.mjs
    node --test tests/canonical-work-process-crash.test.mjs

Return actual hostname, sourceHEAD, Nodeversion, command, exit and receipt/TAPdigest to establish device-side execution. A queued job or delivered message is insufficient.

## Open product/runtime acceptance

1. Fresh normalized room assistant/setup/Updates: owner selects supported behavior, truthful visible limitation, or scoped creation choice, then supplies exact changed commit/tree. Local mixed-room and cross-account checks show capability flags reset in tested sequential flows, but do not repair missing normalized capability. Baseline7c8d6a05, HTTP fallback5d06650a, rendered fallback73bb80ec, mixed-roomdd555e2c. No chosen product patch inferred from fixture interventions.
2. Stale room-access notice after account replacement: reproduced in4/6desktop/phone states. Exact sourcea599. Portable failing gate06416c85f9ccdb593fa59460e6d2c910bf0f03f3 folderaccount-switch-portable-gate; full screenshot packet282f05371556f334c588f25ca26a1d53c17e8d3a. Copy checker outside target checkout and run node check-account-switch.mjs --repo CHECKOUT --source FULLSHA --output NEW_DIRECTORY --viewport phone. Expected exit1 until fixed. Scoped boundary controls403/409 pass; no bypass/content-leak finding. Root owns UI fix.
3. Normalized standalone charter GET409, pin409/preexistingpin omitted from activation context, and default account OAuth seat enumeration remain separate reproduced gaps. Existing assert-fixed repros stay red on unchanged source. Root owns changed contracts.
4. Six stale asset hashes in clean main candidate manifest remain an inherited gate. Clean baseline7pass/1fail incc19a2c9. New regression passing does not clear that failure. Refresh manifest against final selected tree; do not use a different candidate manifest blindly.
5. Historical full-unit failures/served OpenAPI/webhook/sponsor audit gates remain unqualified. No fresh whole release green, review approval, physical peer execution or deployed source proof.

## Next action by ownership

Root: review a ready independent contribution, publish exact chosen source for an open fix, or send a concrete nonoverlapping task. Member2: run the corresponding finite acceptance when changed source is available and reuse unchanged evidence. The current bounded local qualification backlog has no unfinished process; further unchanged reruns or test variants would not advance these owner decisions. No schedule, monitor, CPU filler or generic orchestrator is needed.
