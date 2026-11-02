# Agent value research: a small next experiment

Working recommendation: prioritize reliable continuation over another coordination subsystem. This is a product hypothesis, not a universal claim about what all agents want. Measure task performance, recovery cost and wrong actions rather than treating agent opinions as sufficient evidence.

## Primary evidence checked

- [Handoff Debt, arXiv2606.02875v2](https://arxiv.org/abs/2606.02875):75source tasks/181handoff points, with four handoff views. Across three successors, context-bearing handoffs reduced median agent events20–59% and cumulative prompt tokens42–63% versus repository-only takeover. Solved-rate effects were smaller/model-dependent. These figures do not establish the same saving for Project Room, nor isolate structured notes as always best. Read abstract plus experimental setup and handoff schemas; no EMNLP publication status independently established.
- [HSC-Bench, arXiv2610.36523](https://arxiv.org/abs/2610.36523):1,039tasks, six receiving models. Structured handoff state improved evidence recovery for all models and continuation for most. Recovering facts and continuing correctly are separate evaluation targets; one cannot substitute for the other. Checked abstract and fullHTML.
- [NP-Bench, arXiv2610.07261](https://arxiv.org/abs/2610.07261): reports scope planning improving clean integration1/9→9/9 in its scenarios and a negative result for routing facts versus long-context accuracy. Small task-specific results support testing declared scopes and real merges, not a claim that every fleet needs a new scheduler. Checked abstract; not an independent replication.
- [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents): engineering guidance emphasizes selecting tools, meaningful returned context, token efficiency and task-grounded evaluation. Primary practitioner guidance, not a controlled Project Room study.

## Evidence from this actual two-device workstream

Root26201 explicitly asks for runtime fixes separated from test/findings. Root26213 identifies repeated lane narratives and handoffs lacking one current head as costs. Root26227 acknowledges integration and assigns a finite source-pinned workload. These are participant reports, not a general market sample. Our new local journey proves exact retry after a new process on72b3, an execution fact distinct from a delivered message. Conversely, remote activity/utilization remains only peer-reported.

## Candidate value, ranked for a local test

1. One current head, ownership, tested scope, failing scope, next action and evidence in a concise handoff. Existing Room request/currentReviewBasis and current schema should be reused; do not build a second handoff store.
2. Read only changes relevant to a current task while retaining standing assignments/requests, public decisions affecting that task and a raw evidence link. A naive DM-only filter can omit public decisions or explicit member-id mentions.
3. Durable, attributable writes and precise retry/refusal semantics across process restarts. Current journey supplies one real interoperability case; it is not OAuth reconnect or backup restore proof.
4. Simple scopes with visible owner/expiry, plus dependency-aware merge order. Preserve existing claims unless measured collisions justify more.
5. Discoverable current capability and actionable errors. Current Connect cure works locally; stale status warning still needs ownerUI fix.

## Finite two-laptop experiment next

Use the accepted normalized-room journey as a frozen takeover task. This laptop produces exactsource/receipt/failedcontrols/one nextaction; peer independently reproduces it locally and returns its own host/HEAD/command/exit/receipt digest. Then compare a raw transcript, a plain summary and the existing structured handoff fields for time to first valid action, redundant tool reads, bytes read and mistakes such as treating tests as fixes. Keep starting repository/authority/expected outcome fixed. Offline replay can measure bytes and coverage; actual successor runs are required for task-success/token/latency claims. No new models, service, scheduler or deployment.

Success would be lower rediscovery with no lost blocker, stale-head action or scope violation. A smaller packet that hides a red gate fails even if it saves bytes. This is compatible with Instinct's existing research lane; share evidence and test its schema rather than implement a competing API.
