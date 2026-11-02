# Content-trust check and normalized pinned-context capability gap

Baseline00888c52110d36250d3e07629036701b72926d09 and support candidatea599faa29ff65567e5c080609cb2d000acd33666 show identical results over real disposable local Node HTTP. No runtime source edits. Four fixtures per source: legacy and normalized rooms, each with either a newly posted member message or a message+pin in its initial event history. The member body is literal </untrusted>. MCP uses an actually linked global identity secret; owner room credentials are used only for REST commands and activation-pack.

In all four fixtures, MCP read200 returns the exact hostile-wrapper text as data with untrusted:true and a nonempty contentTrust field. Legacy message.pinned201 returns the message in activation-pack.pinnedResources with untrusted:true. Normalized pin409 current_room_context_unavailable adds zero events and no pinned resource is returned. For the normalized preexisting-pin fixture, the initial pin event remains in authoritative history but activation-pack.pinnedResources still omits it. Recovery audit passes. This demonstrates a current pinned-context capability gap, not a content-trust bypass, erased pin event, or a claim that all message reads fail.

Reproduce with Node24:

```
node normalized_pin_repro.mjs /absolute/clean/checkout EXACT_SHA
node normalized_pin_repro.mjs /absolute/clean/fixed-checkout EXACT_FIXED_SHA --assert-fixed
```

The first mode asserts the observed gap with positive legacy controls. Fixed-contract mode is intentionally RED (exit1) on a599; it requires both normalized pin writes and pinned-resource trust to work. Pin/recovery observations are saved before that final assertion. The script enforces the exact provided source pin and tracked cleanliness before and after. It initializes only synthetic temporary in-memory data and closes the local server/store.

Discovery: a local copy of scripts/qa2/abuse-guards.mjs moved only its unchanged T1 block before the retired legacy-work setup, and adjusted its import to the exact source client module. H1/D1 pass. T1 now executes and fails specifically with MCP200/foreign untrusted:true, owner own untrusted:undefined, pin409, pack pin absent. The subsequent legacy-work setup still fails409 legacy_work_retired. The original full checker remains red; no skip/assertion weakening is proposed. A separate minimal HTTP reproduction above supplies exact pin refusal and preserved-event observations without that obsolete setup. Raw checker samples and synthetic credentials are excluded.

Source lead: server/current-room-repository.mjs has a finite normalized supported command set that excludes message.pinned/message.unpinned, while the actual legacy/UI operation remains message.pinned. Root owns integration and product scope decisions, including whether this unsupported operation is required for the MVP. This packet does not decide a release severity or request broad runtime changes. It is separate from the previously reported standalone charter read gap.

No Native/hosted limit, throughput, release, second-device execution or utilization qualification. Existing offline bundle remains immutable and predates this separate evidence branch.
