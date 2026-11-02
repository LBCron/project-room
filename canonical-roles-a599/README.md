# Current canonical-work HTTP role/action matrix

Exact sourcea599faa29ff65567e5c080609cb2d000acd33666, Node24.22.1, disposable normalized room. No runtime source edits. Execute canonical_work_roles_http.mjs after adjusting its absolute source/Git paths. It refuses a mismatched pin or tracked source changes before/after, closes its loopback server and in-memory store, and emits only synthetic aggregate/cell observations.

54cells pass: nine actual principals x six current actions. AgentRooms creates the synthetic agent-owned room through the production model; identities are synthetic but real records. Collaborator/contributor/reviewer/chat/revoked fixtures use real HTTP agent-invite creation and redeem endpoints with actual identity secrets, rather than assumed permission arrays. The revoked principal is revoked through the real HTTP identity endpoint. The guest uses actual HTTP owner share-link creation and join-agent. Outsider has a valid unlinked identity; anonymous has no credential. Effective permissions are recorded in the receipt. Initial exploratory fixtures used room-key principals; the final fixture uses a legitimate global agent-room owner to meet share-link creation authority, without weakening policy.

All54tested role/action cells use real HTTP. Production model commands create separate valid lifecycle prerequisites for each cell, so one successful cell cannot change another's task. Claims have disjoint paths. No mocked authorization. Expected policy is fixed explicitly; there are no KNOWN-failure exceptions, skips or relaxed outcome classes.

| Action / prerequisite | Allowed tested roles | Other members |
| --- | --- | --- |
| work.proposed, fresh ID | owner, collaborator |422 command_rejected |
| work.accepted, work assigned to tested member | owner, collaborator, contributor | reviewer/chat/guest422 command_rejected |
| claim.acquired, accepted work assigned to contributor | contributor | owner/collaborator/reviewer422; chat/guest403 |
| claim.renewed, active contributor claim | contributor | owner/collaborator/reviewer422; chat/guest403 |
| claim.released, active contributor claim | owner, contributor | collaborator/reviewer422; chat/guest403 |
| owner claim-cap configuration | owner |403 work_claims_not_permitted |

Outsider403 no_access; anonymous/revoked401 unauthenticated across all actions. Their18responses never contain the synthetic task marker. There are10allowed and44refused cells. Each allowed command is attributed to its exact authenticated member and adds one event. All44refusals retain identical hashes of serialized rows from ten named authoritative tables. Final auditRecovery passes; legacy work_claims mirror has zero rows.

Limits: local Node HTTP only, model-seeded lifecycle prerequisites, not full journeys. No Native, hosted limits, production/user state, delegate/human-owner/autonomy tier matrix, stale round/version fuzzing, guest chat/read policy, or other-laptop execution/utilization claim. Previous canonical-capacity packet covers cap boundaries and retry; this adds roles without rerunning that scale. The old QA2 legacy-work checker, default OAuth enumeration, standalone normalized charter reads and normalized pins remain separately red/unqualified; this packet does not clear release gates. Root retains runtime integration/merge/deployment.
