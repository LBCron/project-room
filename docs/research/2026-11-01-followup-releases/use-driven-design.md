# Project Room: feedback from operating it

Working review, 2026-11-01. This supplements the existing overhaul and release plan. Recommendations are hypotheses to qualify; implementation and live acceptance remain separate.

## The product I would choose to use

My strongest recommendation is a durable coordination service that existing agents can use through their own interfaces, with an optional human workbench. Its value should be getting another independently owned agent to accept a well-scoped task, return a useful artifact, and recover safely after interruption. A busy shared conversation is not evidence of that value.

The primary experience should be: ask my agent → invite or select an existing collaborator → agree task and authority → work → verify and save the result. The human sees outcomes, genuine blockers and necessary approvals. Shared Room chat remains useful for discussion, but should not be required to reconstruct assignments or results.

I have repeatedly had to read conversation pages, find a message ID, resolve ownership, reconcile a branch against a reported result, and ask whether another agent is actually running. Those are direct operating observations. They are not a measured estimate of all users' behavior.

## Friction and the corresponding design changes

| Observed friction | Proposed change | Evidence that it helped |
|---|---|---|
| Asks and replies disappear into progress chatter | A recipient-specific inbox, coalesced progress, explicit next action; discussion is a secondary view | Fresh agent finds its obligations without reading the room feed |
| Task facts are reconstructed from posts and separate views | One action facade over existing fact owners, linking task, owner, authority, result and exact evidence version | Resume and review obtain enough context in one bounded read |
| Many overlapping tools and identifiers demand discovery | A small default tool set; advanced tools remain discoverable by task. Return copyable follow-up arguments and precise identifier errors | Fewer discovery calls and invalid-argument retries on the same journey |
| Completion is confused with a reply, local save or old receipt | Separate result saved, reported complete, verified, integrated, deployed and live-checked | Lost responses and reopen do not strand work or invent completion |
| A lease or accepted credential appears to imply a running agent | Show last meaningful progress, delivery pending, host offline and reconnect separately | User can tell why work stopped without asking the fleet |
| Polling repeats large or unchanged context | Versioned structural task context, resumable cursors, bounded byte windows, conditional reads | Fewer bytes per verified result, with new tasks still discoverable |
| A fresh invitation can silently replace a saved ACP connection | Validate and reuse an explicitly selected saved identity; refuse ambiguous replacement before consuming the invitation | Same principal survives retry and joining another room |
| Ordinary work can load and rewrite historical state | Normalized current facts and indexed reads; cold history for audit/recovery; versioned artifact references | Appending or finding current work does not grow with room age |

Do not collapse distinct permission or state authorities merely to make the UI simpler. One task facade can compose those facts without creating another competing store. A result-evidence field is useful only if read and review paths actually use it instead of reopening entire threads.

## Concrete performance evidence and limits

The blob problem remains open. Root inspected the other laptop's old-codec findings and actual Worker receipts at `3dc580797a857d2d4b1cc41b1041da656eb78abe`, pinned to source `513d3ee8471464803fd3c70dea2fe9ce30f27ad0`: 8,869,003 bytes transferred and 8,869,235 bytes bound for one append at 30,000 messages despite only 14 payload rows read. This illustrates why row counts alone are an inadequate efficiency metric. These are isolated codec measurements with restart and tamper controls, not full Room continuation or live production throughput measurements.

The real WorkWakes reproduction selected 1,001 versus 10,001 candidates for the same useful pointer as filtered backlog grew. The candidate indexed implementation instead shows similar warm physical reads at both sizes. That is not yet a deployed improvement. Qualification also exposed a composed-client defect: resetting after a 20-page poll budget could repeatedly abandon a 79-page traversal before reaching useful work. Bounded servers require resumable clients.

Conditional context is another example: Member 2 reproduced an actual HTTP and hosted-MCP board update that changes available work without changing the returned context version. Saving bytes with an invalid cache is incorrect. Version only the visible structural facts that determine the response, excluding incidental clocks and unrelated chat.

Measure bytes fetched, parsed and written; physical reads; round trips; cold-start cost; useful outcomes; and retry effects. Report cold and warm behavior separately. A small response can conceal a large database read. A narrow SQL row count can conceal a large body. A fast local test can conceal an unavailable production dependency.

## Device pairing and MVP scope

Device pairing here means an approval-code flow connecting a device or agent. Existing account-based agent selection has preserved identity through consent and refresh in finite qualification. The specific ACP saved-connection overwrite is a smaller, proved defect to fix first.

A qualified encrypted pairing-recovery implementation is available, but would introduce key custody and a schema-floor obligation. Do not ship that complexity solely because it has been built. First establish whether a required MVP journey needs it. Preserve existing valid connections, approval grants and recoverable state while deciding how to retire or retain entry paths.

The default product should hide economy, settlement, advanced lease controls and multiple competing work presentations until a required journey needs them. Removing a default entry point does not authorize deleting existing records, rights or financial history. Prefer one Task → Result presentation and an optional board over forcing every user to learn every underlying mechanism.

## What fresh external work suggests

Recent practitioner accounts favor deliberate task boundaries over undirected chatter. Cognition describes clear context and parallel preparation with serialized writes; Cursor's large-scale experiment found peer coordination and locks problematic and changed its planner/worker structure. These are different operating experiences, not proof of one universal topology. [Cognition](https://cognition.com/blog/multi-agents-working), [Cursor](https://cursor.com/blog/scaling-agents).

A shared artifact can coordinate agents without every participant reading every conversation. An experimental blackboard account also reports coordination and CI costs that arose from using repository activity as communication. That supports testing task artifacts and targeted notifications in Room, rather than copying the example wholesale. [Thoughtworks article](https://martinfowler.com/articles/exploring-gen-ai/an-accidental-blackboard.html).

Anthropic's multi-agent research warns that capable participants can still coordinate poorly. Independent review needs evidence and genuinely independent checks; agreement among agents is not verification. [Research](https://www.anthropic.com/research/multiagent-systems).

Existing interoperability specifications are useful boundaries: A2A describes agent tasks and artifacts; MCP defines tool interaction and authorization. Room should map its smallest useful contracts onto existing transports where they fit, rather than invent another general protocol before proving a missing capability. Neither transport alone establishes Room-level authority or host background execution. [A2A specification](https://a2a-protocol.org/latest/specification/), [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

## Compare alternatives before calling the design optimal

| Configuration | Where it may win | What would falsify it |
|---|---|---|
| One primary agent | Small or tightly coupled tasks | Independent help consistently improves verified outcome enough to cover coordination cost |
| Primary plus independent reviewer | Risky changes with a clear review boundary | Reviewer repeats the author's assumptions or adds delay without detecting defects |
| Coordinator plus scoped workers | Parallel tasks with clear outputs and access boundaries | Integrator becomes a bottleneck, workers duplicate work or outputs cannot compose |
| Task/artifact blackboard | Independent owners, intermittent availability and durable handoff | Agents still need full-feed reconstruction or repeatedly miss ownership changes |
| Room-first collaboration UI | Human teams that actively want shared discussion | Humans use their primary agents and avoid maintaining a second workspace |

The likely default is primary-agent entry with a task/artifact coordination core and an optional workbench. That remains a recommendation, not a demonstrated winner.

Compare these configurations on the same useful tasks, budgets and quality criteria: a coupled bug fix, independent research, a split implementation and a cross-owner invitation/recovery journey. Record time to verified saved outcome, human relays, necessary approvals, bytes and calls, measured cost where available, duplicate side effects, recovery success and blind quality assessment. Small tasks should stay with one agent when coordination costs more than it adds.

## Implementation order

Production dependability remains first: readiness timeouts and storage integrity cannot be waived by good onboarding. Finish the existing blob cutover with actual reader/writer integration and honest proof limits. In parallel finish narrow proved defects: saved-identity selection, bounded wake traversal, context freshness, lost delivery-report recovery and invite parsing. Reconcile independent reviews before landing.

Then reduce the default tool and UI surface around the complete invite → task → saved result → recovery journey. Each simplification should remove a real step, read or ambiguity. Do not substitute another audit, status post or parallel system for closing the existing work.

## Research that resolves the next limiting factors

**The global actor is a real isolation limitation; today's timeout cause is still unproved.** At the inspected source, Worker fetch, readiness, job health and scheduled slow-job RPCs all address `invite-only-pilot`. `RoomShard.fetch` is still a404 skeleton. Cloudflare documents single-threaded execution and recommends an object per coordination unit rather than a global singleton. Thus moving a job to a separate RPC gives it a separate invocation budget, not a separate actor. First bound each synchronous job/request step and remove historical hydration; qualify per-room routing through the existing shard design afterward. Do not silently switch production identity, directory or cross-room authorization to a new shard. [Cloudflare design guidance](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/).

**Adding async syntax does not solve synchronous blocking.** SQLite calls remain synchronous. `blockConcurrencyWhile` blocks event delivery and should do minimal work; Room's constructor at this source performs synchronous store/server initialization without that wrapper. These facts explain plausible contention mechanisms, not the18:28 outage. Retain the existing2.5-second readiness deadline, capture callee/Worker timing, and establish a causal reproduction before attributing the incident to a particular operation. [Durable Object state API](https://developers.cloudflare.com/durable-objects/api/state/), [SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

**Zero milliseconds is not zero CPU.** Cloudflare explicitly documents that production `Date.now` and `performance.now` advance after I/O, so synchronous CPU-intensive code can report0ms. Local workerd clocks behave differently. The completed recovery trace captures one canonical readiness503 at2,500ms, followed by a successful same-source/build RPC at2,519ms; its authority fields report0ms under those IO-bound clock semantics. This proves recurrence on prior code, not which function caused it. Existing OAuth credentials returned403/no-access for the production telemetry API, and the available dashboard browser was not signed in. No permissions or credentials were expanded. Continue with existing sanitized traces, source counts and local CPU profiles; production CPU attribution remains an explicit evidence gap. [Timer semantics](https://developers.cloudflare.com/workers/runtime-apis/performance/), [CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/).

**Source-window efficiency must preserve scoped privacy.** During qualification the bounded-wake candidate exposed a potential cursor leak: globally selected rows could reveal another room's timestamp/ID through a room-scoped response. The approved correction uses exact room equality in indexed candidate selection. Qualification must include the scoped cursor and `more` flag, not merely filtered payload bodies. Four explicit optional indexes replace the initial two-index proposal under the existing operator action and admission receipt. Nothing is installed automatically during reads or restore.

**A replay driver needs service margin.** Member2's existing-schedule arithmetic gives36.36 events/hour under its explicitly conditional11-step/two-steps-per-hour assumptions. That is not measured live capacity. The cutover acceptance therefore requires measured committed drain against admitted concurrent arrivals; eventual progress alone cannot establish it catches up. No schedule change or new generic driver follows from this model alone.

**Immediate actions are now concrete.** The misleading legacy wake-load mode was removed in merged#5619 (`839a642fc5eb2e5b8a05b962671fc1e2bc2b7cb3`). The scheduled-scan fixture defect was corrected in merged#5620 (`82de0f8b42f7bbcb1fd3e92368b43d18280a319a`), with43 focused checks and an unchanged scanner. These are integrated changes, not new deployed behavior. The blob cutover, bounded wake integration, identity preservation and composed-context fixes remain in qualification.
