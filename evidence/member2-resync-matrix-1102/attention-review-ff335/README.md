# Agent attention review against current composition

Reviewed source: `ff3350cb8d2be1d1c7278677211eeea3282b7c75`. This is a read-only design review and one disposable local Node HTTP/SDK probe. No runtime implementation or production qualification is supplied.

Reuse the current needs-me/digest and paginated reply-request readers for the MVP. Preserve agent-work v1 as a complete, bounded observation of incoming open requests and their selected run states. If a combined paginated contract is still needed later, use an explicit opt-in v2 selection on that same authenticated source rather than introducing another database or a generic attention authority. Current agent-work rejects filters; accepting them requires an intentional versioned implementation, not a client assumption. No new endpoint is necessary for this recommendation now.

## Existing mutations to reuse

| Source | Existing operation | Exact meaning and boundary |
| --- | --- | --- |
| Private local observer notice | `room_acknowledge_attention(noticeId)` | Reconciles access/current conditions and acknowledges one exact local notice. Does not change server work, read markers, approval, understanding or formal reply status. A replacement notice is not dismissed by an obsolete ID. |
| Optional thread notification | `POST /api/rooms/{roomId}/thread-mutes` with threadId/muted | Private, reversible thread-root notification filter. Not work completion or discharge of a formal request. |
| Conversation read position | `POST /api/rooms/{roomId}/read-horizon` | Caller-owned room/thread/private-pair message position. Supports clear/rewind; not an execution watermark or formal-answer record. |
| Personal activity feed item | `POST /api/rooms/{roomId}/activity-read` with ids; activity-read-all with optional type | Feed read state only. Do not map a formal request or execution obligation into it. |
| Formal reply request | Current complete request context's `responseActions` / `room_respond_to_request` | Use answered/declined with exact current answer basis. Persist the complete operation on unknown outcome and retry it unchanged. Reading, receipt delivery and operational run reports do not independently close the current request. |
| Work assignment/claim/review | Existing source-specific work transitions and current context | Refresh and obey the source's assignment/review basis. No generic handled operation should accept work, submit results, release claims or approve reviews. |

## Compact-view and host adapter conflicts

1. Delivery positions are distinct from notice acknowledgment, formal answer status and execution. `evaluatedThrough` is a room-event observation, not a revision of run state. Work revision and run updatedAt also cannot be combined with event sequence by taking a numeric maximum.
2. Current needs-me native traversal binds room, member, credential, head and service codec. Follow returned continuation through empty filtered pages. A changed head/service explicitly refuses the old cursor; restart traversal without silently treating the old partial page as complete. Its declared source completion retains `globalAttentionComplete:false` and omissions. Digest v2 preserves unknown totals as null. These are not a globally lossless snapshot+delta stream.
3. Formal obligations must be refreshed independently of optional attention continuation and compact context-version equality. Current compact resume does this, deduplicates formal requests from optional conversations, and treats unknown/needs_attention/result_ready runs as reconcile-first references. `executionGranted` stays false; absence of a standing blocker is not claim permission.
4. Local currentAttention uses WatchJournal versions2/3 and authenticated snapshot reconciliation. Those schema versions are unrelated to normalized needs-me/digest v2. Do not reuse its directory or infer bounded native-source support merely from equal version numbers. A new adapter would need explicit schema migration and identity/credential/room-generation checks; none is implemented by this review.
5. Candidate item metadata must name its source and revision type. nextRead refreshes context; availableActions are current templates, not durable grants. Keep source omissions, stale/reset and overflow explicit. Do not expose excluded private IDs, bodies, counts or authorization metadata as continuation hints.

## Executed integration probe

`attention_queue_probe.mjs` creates a real normalized room and five ordinary addressed formal requests in disposable Node SQLite, then uses actual local HTTP and SDK calls on the pinned composition.

- `/agent-work` returns422 reply_list_too_large because v1 cannot call its first four-request window complete.
- `resumeAgent` returns pendingReconciliations unavailable, explicit incompleteSources for openRequests and pendingReconciliations, and no observedThrough for openRequests. Its empty openRequests array is therefore unavailable, not observed-empty.
- `RoomAgentClient.replyRequests` follows the returned top-level nextRead and obtains all five unique requests in two pages.
- Exact hashes of current records, proofs, head, events and commands remain unchanged. No acknowledgment, answer, run claim or execution was submitted.

This exposes a convenience/adapter coverage limit, not data loss or an unsafe empty-queue assertion. Until an explicit paginated agent-work contract is implemented, direct callers should follow separate request-list continuations and read selected request contexts. Do not turn a422 into a successful empty view or raise the cap. Operational run reconciliation must retain its own selected-attempt scope.

The first private probe draft looked for continuation under sourceWindow instead of the actual top-level nextRead. That harness assumption failed and was corrected after reading the SDK validator. Final execution passes. No runtime bug was inferred from that first draft.

## Source and existing tests inspected

Read server/routes/agent-work.mjs, server/current-needs-me.mjs, server/reply-requests.mjs, server/activity.mjs, server/thread-mutes.mjs and relevant HTTP/OpenAPI routes; client/agent-resume.mjs, client/attention-inbox.mjs, client/reply-actions.mjs, client/request-runner.mjs; normalized-needs-me, current-needs-me-attention and current-attention test specimens.

Existing specimens cover empty private continuation, tamper/viewer/source/restart refusal, unknown totals/completeness disagreement, local stale notice and revoked-access refusal. They were inspected, not rerun or independently requalified here. This probe adds only the actual five-open-request HTTP/compact-resume boundary. It does not certify every host adapter, live room, Native runtime or production release.
