# Sponsor-transfer full restore and default OAuth enumeration defect

Frozen candidate1084460ddcf6d22d36aeb6e8deed24e91e6ba927, tree0a360f9afd74f2b0693e5f8b582bee4959594e78. Qualification only: no runtime/integration edits. Root owns fixes and release.

## Full actual Native restore: pass for configured-seat workflow

Normal producer APIs create a normalized room, a managed agent seat, an unrelated linked agent and separate sponsor/recipient human accounts. Recipient requests the existing seat; owner approves without changing identity or permissions. Before transfer, the old OAuth grant works. After transfer, its access and refresh rows remain unrevoked: denial is due to the durable adoption binding, not a blanket token-history rewrite. The managed key is revoked. A separate pre-transfer unredeemed OAuth code is retained for the recovery check.

The actual Native source exports45,408bytes. The strict authorized restore API refuses pending readiness503, accepts exact cold source resume, passes full independent content audit and completes cleanup:113continuations including46cleanup,66unique advancing real frontiers, unchanged20000diagnostic cap. After cold readiness200, all eleven table row fingerprints match exactly (order-independent row hashes), and the same member identity/permissions/sponsor are preserved. Request/decision events, identity/account links, connection rows and immutable operation history, credential revocation and OAuth code/access/refresh records survive. Fingerprints are compared before deliberately exercising refresh rotation.

Old managed-key authentication, old OAuth refresh and old unredeemed-code exchange are refused after restore. New recipient and unrelated-agent refreshes work and resolve the intended seats. Exact approval retry adds no room event. Final immediate audit passes; restore admission is clear, frozen guards gone and temporary source KV removed. The fixture creates real private Durable Object KV on both sides. Raw fixture credentials/backup remain in memory/private local storage and are not published.

Existing tests/agent-sponsor-transfer.test.mjs already cover real indirect sponsor behavior and immediate auditRecovery; the module-reference lint warning is not proof that no behavioral tests exist. The new local experiment fills the full-backup/recovery gap, rather than repeating those existing tests. It does not change Root's sweep count or coverage gate files.

## Separate defect retained: default enumeration is red

Actual Native before AND after restore: listMcpOAuthAgents with explicit preferred room/member selects the adopted seat; without preferences returns no seat. Its full-room hydration throws current_room_context_required and is silently caught.

A smaller Node real-HTTP reproduction isolates two equivalent approved adoptions, one legacy and one normalized-current. For GET /oauth/authorize?connection=account:

| Representation | Client without seat preference | Client with explicit seat preference |
| --- | --- | --- |
| Legacy |200, selectable binding |200, selectable binding |
| Normalized-current |409agent_connection_required, no binding |200, selectable binding |

This reproduces on unchanged main00888 as well as candidate1084460. It is not introduced by the pending-list patch. The helper's fallback uses store.room when no preference is provided, catches the normalized-context refusal and skips the room. A valid adopted seat is then presented as absent. Root should fix default enumeration using the normalized authority/member surface while preserving sponsor consent, permission and adoption binding checks; no implementation is proposed here.

`sponsor_default_enumeration_repro.mjs --assert-fixed` intentionally exits1 on both pins. Its explicit-preference and legacy cases remain positive controls. Do not call this packet all-green or release-qualified. The configured restore result is narrower than generic OAuth readiness.

## Reproduce

With Node24, existing esbuild/Miniflare dependencies and matching July2026workerd:

```
LOCAL_LAB_GIT=/path/to/git MINIFLARE_WORKERD_PATH=/path/to/workerd \
node sponsor_transfer_native_restore.mjs /path/to/clean1084460 /path/to/dependency-checkout

LOCAL_LAB_GIT=/path/to/git node sponsor_default_enumeration_repro.mjs \
/path/to/clean1084460 --assert-fixed

LOCAL_LAB_GIT=/path/to/git LOCAL_LAB_EXPECT_PIN=00888c52110d36250d3e07629036701b72926d09 \
node sponsor_default_enumeration_repro.mjs /path/to/clean00888 --assert-fixed
```

Fixture and restore driver stay adjacent. For a Root fix, set LOCAL_LAB_EXPECT_PIN explicitly to the new tested commit before running the failing contract. No credentials, backups or databases are included. Scope is local Node/actual Native, not production, hosted resource limits, deployment or another laptop's execution.

Initial fixture probes were retained locally: using the reserved rak_ API-key prefix and then an overlong opaque room key failed before restore. Final managed key is the legitimate43-character shape and authenticates before transfer. A source assertion expecting default selection exposed the real defect; it remains in receipts as a separate red contract. First HTTP probe used the invitation default instead of connection=account; final account-connection probe above is the relevant result. No runtime guards or test gates were weakened.
