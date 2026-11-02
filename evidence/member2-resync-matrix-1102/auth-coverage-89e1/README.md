# Preservation acceptance evidence map on frozen89e1

Read-only review on89e1a58827483f7019085a39205eba62abcd15ba. No runtime source
changes or Node/Native reruns. Four committed compressed logs were decompressed,
hashed and terminal summaries checked: authority Node3/0, authority Native1/0,
lifecycle Native1/0, composed lifecycle/listener Native2/0. coverage.json pins them.

Two evidence metadata corrections:

1. acceptance.json and README say25 security/event/command tables are snapshotted.
   normalizationAuthSnapshot actually lists24 distinct tables. The helper at the
   older evidence-record commit582dc510 and reviewed89e1 is byte-identical. This
   is a count mismatch, not evidence that an account changed or a test failed.
   Correct the count or review an intended fixture change explicitly; do not add
   an arbitrary table merely to satisfy the old number.
2. The old guideRuntime c7e2c913c6663105295ccdc70f20949dc7be4e32 cannot be fetched:
   remoteGit128 not-our-ref and GitHub short-prefix422. Verified composed history:
   8a1c47a123482e60d09c3f67b783ec12383c01e7 (Guide forwarding implementation),
   c9f4199e9ce331e4b7667f6ae0920f7cb5595b41 (test/fixture additions),
   582dc51036817278e1a7bebfe4bed5086feaaa09 (log/acceptance record).
   Cite resolvable composed locations while retaining original provenance as
   historical metadata. Equality to an unavailable original commit is not proven.

The fixtures cover active owner/friend connections; revoked/expired/disconnected
refusals; accepted account sessions; account/invited OAuth access+refresh; atomic
receipt-fault rollback and cold lost-ACK exact execute retry. Native unauthorized
controls cover plan; selected execute negatives are in Node, not silently all
Native endpoint/credential combinations.

Six of seven selected auth implementation/test files match the earlier evidence
record byte-for-byte. AgentConnections changed to protected addressed authority;
separate newer lifecycle logs cover create/rotate/disconnect and cold recovery.
The rest of the transitive runtime is not certified by selected-file equality.
Keep authority preservation, newer lifecycle, and independent89e1 scale evidence
separate. Root owns final authentication/integration/release decisions.

No new runtime bug, production mutation, full-suite clearance or live provider
qualification is claimed. These metadata findings do not require repeating
unchanged workloads simply to refresh a timestamp.
