# Public boundary test adapter

Commit1084460ddcf6d22d36aeb6e8deed24e91e6ba927, tree0a360f9afd74f2b0693e5f8b582bee4959594e78, parent56c1b7e3bc400fff2eb8ed25748edb68bf288882. Two test files only. Existing static receipt specification route GET/HEAD is now represented in exact anonymous probes and exact public publication IDs. Neither inventory check is weakened; new undeclared routes still fail. No runtime, OpenAPI allowlist or access change.

Run on this physical Mac with bundled Node24.22.1, SQLite and existing dependencies:

```
node --test --test-concurrency=4 tests/invite-only-boundary.test.js tests/route-publication.test.js tests/a2a-receipt-extension-route.test.mjs
node node_modules/eslint/bin/eslint.js tests/invite-only-boundary.test.js tests/route-publication.test.js
git diff --check
```

12cases pass,0fail,0skip,1.496s. Lint and diff check pass. Included existing HTTP transport case forbids room hydration, compares static spec body, checks empty HEAD and byte length, refuses POST, and observes no event writes. Unchanged-main baseline previously reproduced missing-probe and missing-public-IDs failures. Both final files were fetched from GitHub and compared byte-equal to the tested working tree; full tree also equals. Original4986 source remains frozen for historical evidence.

This removes two known test inventory failures in a separate reviewable patch. Served-OpenAPI runtime inventory, webhook snapshot, sponsor event audit and sponsor coverage remain unqualified integration items. Full-suite release readiness is not established. No merge, deployment or peer execution claim.
