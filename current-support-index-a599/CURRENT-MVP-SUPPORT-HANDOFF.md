# Current MVP support handoff

Tested source: `a599faa29ff65567e5c080609cb2d000acd33666`, tree `7be83d03ca225618552523451c262670f1accdda`. Freshly fetched main: `00888c52110d36250d3e07629036701b72926d09`; this source candidate is not merged into that commit. Root owns runtime integration, product decisions, PR/release; member2 owns qualification and evidence.

Read-only audit verified 42 artifacts in nine separately published packets against exact local Git blobs and direct a599 parents. No tests rerun by the audit. Four audit controls pass: real packet set, tampered receipt refusal, missing screenshot refusal, and changed observation requiring reclassification. This is consistency proof, not independent authenticity or release readiness.

| Packet | Outcome | Exact scope |
| --- | --- | --- |
| [sdk-native](https://github.com/Uuriko/project-room/tree/affbd0d9011606e61c7ad318bcc30573be21c6d9/official-sdk-native-a599) | scoped-pass | Official SDK on local Native: cold reconnect, no duplicate, revocation401. |
| [native-isolation](https://github.com/Uuriko/project-room/tree/685d7cc586514a6d9ff82d3f0f3f5fd0e78d2518/native-concurrent-isolation-a599) | scoped-pass | Two actual SDK agents on local Native; simultaneous submission, no forced internal interleaving. |
| [canonical-capacity](https://github.com/Uuriko/project-room/tree/b5dfc44972c23e6f2ec066099de31cc8cef55914/canonical-capacity-a599) | scoped-pass | Local HTTP small configured cap boundaries; no default1000/20 scale claim. |
| [canonical-roles](https://github.com/Uuriko/project-room/tree/fa7abfe2642a73462852d31774f879f01566856b/canonical-roles-a599) | scoped-pass | Local HTTP54role/action cells; no delegation/autonomy/Native claim. |
| [canonical-process-crash](https://github.com/Uuriko/project-room/tree/b041f89ea7ca6b8bb0854568893ed95594d3a2e0/canonical-process-crash-a599) | scoped-pass | Local fileSQLite/Node actual SIGKILL after commit; no power-loss/Native claim. |
| [charter-gap](https://github.com/Uuriko/project-room/tree/0ceabb94e30b6582957206d16705851d03a6284d/charter-read-gap-a599) | reproduced-gap | Normalized standalone charter read409; legacy200 and activation pack retains instructions. |
| [pin-gap](https://github.com/Uuriko/project-room/tree/7e10b14ba082b118ccce6c74d5dd190bbb405f13/pinned-context-gap-a599) | reproduced-gap | Normalized pin409 and preexisting pin omitted from activation context; no trust bypass/event-erasure claim. |
| [fresh-room-sections](https://github.com/Uuriko/project-room/tree/d77d64a3a60d071ab165a12348795ffe293307f2/fresh-room-sections-a599) | observed-gap | Fresh human/agent HTTP room windows declare five unavailable sections; source-only UI guard. |
| [fresh-room-browser](https://github.com/Uuriko/project-room/tree/7c8d6a056d8acd54ed9987d7c60d1a16281b4d4b/fresh-room-browser-a599) | observed-gap | Actual local desktop/phone fresh signup; hidden setup/unavailable Updates, not assistant-readiness pass. |

Do not sum these overlapping scopes as unique tests. Five scoped passes coexist with four reproduced/observed gaps. No full-suite, review, merge, deploy or physical peer-device execution/utilization is established.

## Next integration decisions and acceptance

1. Fresh normalized rooms: owner chooses actual supported assistant/aggregates or a truthful visible limitation. Local HTTP and rendered1280/390 signup proof is in the last two packets. FRESH-ROOM-ACCEPTANCE.md in the browser packet covers Settings, explicit @Room outcomes, Updates/Catch-up, reload/room switching and no fabricated empty counts. No automatic legacy-format rollback from this lane.
2. Standalone charter read: normalized GET/charter409 while updates/activation-pack work. Minimal realHTTP repro has --assert-fixed; keep historical version selection, bounded reads, privacy and viewer/session binding. Root owns fix.
3. Pinned context: normalized pin409 and preexisting pin omitted from activation-pack, with authoritative event preserved and ordinary MCP trust markers intact. Owner decides MVP support/explicit limitation; no content-trust bypass or event loss claimed.
4. Default account OAuth enumeration remains a separate earlier red finding: main00888 and candidate1084460 omit normalized seats without an explicit preference, while configured seats work. Prior packet [sponsor restore and enumeration](https://github.com/Uuriko/project-room/tree/ebc7e2b4f81f5f1b290c73078a3df523d2e71b90/sponsor-recovery-1084460). That packet is NOT reaudited in the42-artifact count above.
5. Historical full-unit failures/gates are not cleared by these focused checks. Root must compose changed runtime fixes and execute required final checks. Membership, keys, host verification, final-composition review basis and release ownership remain untouched.

## Useful next work for each laptop

Root: select the product behavior and publish an exact changed composition commit/tree with affected paths and intended claim. Choose a support packet to run locally if a second-device reproduction is useful. Return actual device-side hostname/runtime/source/command/exit/receipt digest; message delivery is not execution.
Member2: qualify that changed composition using the corresponding finite reproducer/checklist; reuse unchanged evidence. Check the forward Room message reader and current-client assigned-work reader before accepting work. One runtime-only canary remains for its enrolled runtime, not this desktop. No new scheduler, service or access policy is needed.

The seven-tip offline bundle at evidence/member2-offline-current-1102 remains immutable and predates these later packets. Fetch newer evidence branches separately; do not infer they are inside that bundle.

## Reproduce the consistency audit

Use an exact clean a599 checkout with the evidence commit objects fetched and the local packet folders/files referenced by current_support_packets.json. Fetch main immediately before running if reporting observedFetchHead as main: the audit itself does not fetch, and deliberately names that field FETCH_HEAD rather than silently assuming a branch.

```sh
python3 audit_current_support.py /absolute/local-lab /absolute/a599-checkout --git /absolute/git
python3 check_current_support_audit.py
```

The negative-control script is configured for this workspace and creates only temporary copied artifact trees. Scripts do not run application tests or send network traffic. Any mismatched bytes/parent/source/semantic receipt or missing artifact refuses the index.
