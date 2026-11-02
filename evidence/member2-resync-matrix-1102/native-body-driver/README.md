# Source-bounded Native restore test driver

Standalone test-only commit `bdee803d4fa2ee3db225f5b6b07b04ab411737a9`, parent `00888c52110d36250d3e07629036701b72926d09`, tree `0439c7755de32f1cc140619011a7bd83777e7b80`, branch `codex/member2-native-body-driver-1102`.

Combined candidate `4986df689a1773e4162f7c686667a02f15f18c4c`, tree `e0b52214ad91d867e7b543465b72ee75a3d6b7eb`, on `codex/member2-access-pages-composed-1102`. It adds this adapter to the already qualified runtime composition `308a5a9`. Both complete published trees were fetched back and compared to tested local content. Root retains integration and release.

The original broad Native test failed its aggregate 500-step assertion on unchanged main. Recovery now has a separate independent report phase; the complete unchanged fixture needs 330 pre-report calls, 401 report calls and one publication call. The old aggregate ceiling incorrectly rejected valid report work.

The adapter keeps the 500-call limit for non-report recovery and retains the original 120-second timeout. Report calls use the repository’s existing `reportProgressGuard`, whose finite bound comes from the independent Node source rows, cells, bytes and merge work. Every report call must advance the actual source/merge/hash frontier. A fixture-only endpoint returns a hash of that actual frontier, never source cells; the guard uses it solely as an opaque identity. No production endpoint, source or admission rule changed.

The original 650 messages, saved command, 1-MiB attachment, malformed trailer refusal, interrupted upload refusal, canonical-import preflight, cold source resume, zero cold source I/O, strict verified publication, cold readiness, exact command retry, downloaded size/hash and temporary source KV cleanup assertions remain intact. Source size is 3,151,048 bytes. The complete actual Native test passes on main-based and composed trees in 732 calls. Each run creates a fresh real fixture, so source hashes differ; no cross-run speedup is inferred.

Two negative controls reject revision/counter churn with a fixed frontier and an endless stream of fresh identities beyond the source-derived bound. Five Node guard/finalization tests pass; both controls also pass on the composition. ESLint exits zero with two existing prefer-const warnings; syntax, dependency and secret-diff checks pass. The repaired Native case is added to `cloudflare/package.json`: all 88 prior test entries remain, with 89 total and no duplicates. The only merge conflict was the test-list line; all earlier access-queue and private-KV regressions stay registered.

Reproduce with Node 24, installed cloudflare dependencies, and the matching July 2026 workerd:

```
node --test tests/recovery-report-progress.test.mjs tests/recovery-finalization-continuation-contract.test.mjs
MINIFLARE_WORKERD_PATH=/path/to/workerd node --test cloudflare/restore-body-native.check.mjs
```

This qualifies the existing case’s verified publication and original assertions. Full cleanup admission/guard clearing is covered separately by the prior 1,000-request restore evidence; this adapter does not extend that claim. Its conservative report budget is test-only and establishes no production CPU or latency bound. No unchanged broad suite was rerun to fill CPU; full local runtime CI evidence remains pinned to `308a5a9`. There is no hosted CI, peer execution, merge, live restore or deployment claim. Graphify runtime was absent, so imports and source references were read directly.
