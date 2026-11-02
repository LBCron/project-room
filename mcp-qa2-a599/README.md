# Opt-in MCP robustness qualification and Unicode checker repair

One test-adapter file changed: scripts/qa2/mcp-robustness.mjs at a599faa29ff65567e5c080609cb2d000acd33666, parent1084460ddcf6d22d36aeb6e8deed24e91e6ba927, tree7be83d03ca225618552523451c262670f1accdda. Published file and complete tree were fetched back equal to the local clean tested checkout. No server/security-policy, checker leak/5xx/RPC invariants or existing application expectations changed.

The default full-unit run skipped33cases. Inventory:23Linux isolation/backend cases,1setup-node runner case and9other opt-ins/policy probes. This Mac cannot qualify Linux bubblewrap semantics. The QA2 MCP robustness wrapper was only skipped for an unset QA2_E2E flag; it can run locally without external dependencies.

On exact1084460, the existing opt-in wrapper ran against a disposable loopback server in a minimal environment:40anonymous cases pass, no skip. A separate authenticated run uses two synthetic identities and two private throwaway rooms created through normal HTTP producer APIs; no ambient service credentials or external endpoints.43of44cases passed. The sole failure was the checker's Unicode success body containing U+202E/U+202C directional controls, which the existing body policy deliberately rejects422invalid_command. Source store.mjs lines851-862 explicitly distinguish NUL, unpaired surrogates and bidi embedding/override/isolate controls. This is stale checker expectation, not a runtime regression.

The adapter now keeps valid ordinary RTL/Unicode (Arabic, Hebrew, zero-width joiners, emoji and combining marks) as a success case, adds a separate bidi refusal, tightens NUL from any-result to required tool error, and adds unpaired-surrogate refusal. Authenticated --writes now has46cases, all pass on frozena599. In addition to the checker's invariants, the producer harness checks exact stored Unicode, zero stored messages for rejected controls, exactly one idempotent stored message, and absence of a real foreign-room private-content canary or credential canaries from all responses. No raw response samples, keys, private messages, database or input files are published. Sanitized case metadata only.

Eleven focused checks pass: candidate-manifest checks and checker signal/exit truthfulness. Syntax/ESLint/diff checks pass. Both original red43/44observation and fixed46/46observation are retained, with immutable source pins. The anonymous40result is reused from the parent; runtime bytes are identical in this test-only patch. The historical full suite remains failed and other default opt-ins remain skipped.

## Reproduce

Use Node24 and clean source pins. Local absolute checkout/runtime paths in the qualification drivers must be adapted deliberately for the other laptop. run_opt_in_mcp_robustness.mjs pins parent1084460 and uses QA2_E2E=1 with a minimal environment. run_authenticated_mcp_robustness.mjs preserves the original red parent experiment. The fixed driver takes explicit checkout and pin:

```
node run_authenticated_mcp_candidate.mjs /path/to/clean-a599 a599faa29ff65567e5c080609cb2d000acd33666
node --test tests/candidate-manifest.test.js tests/qa2/run-checker.test.js
```

Qualified tools were already available locally. Identity-mint proof is solved through the existing QA client. Foreign-room requests and writes target only disposable loopback data. No schedules, new provider, runtime orchestration, merge or deployment. Root retains integration/release and the previously reported default OAuth enumeration defect.
