# Candidate local unit qualification and generated-record repair

All work ran on member2 physical Mac, not the peer laptop. Full unit run used existing unitPlan/runTestFiles at exactly 4986df689a1773e4162f7c686667a02f15f18c4c, four workers. Source remained clean. Full run failed; do not treat focused proof as release qualification.

The initial run had 14,888 passes, 116 failures and33skips. Correcting Python for just27failed files cleared six failures;110remain.93report missing gh, one missing npm, eight clock cases require further attribution. No stub executables or dependency-check weakening were used.

Six selected contract files were run on unchanged main00888c52110d36250d3e07629036701b72926d09:27cases,6failures. They reproduce stale manifest assets, webhook catalog drift, work-receipt anonymous probe/OpenAPI/public inventory omissions and event73-vs72. The existing untested-modules check independently fails for agent-sponsor-transfer.mjs on unchanged main. Root owns these integration items.

Repair56c1b7e3bc400fff2eb8ed25748edb68bf288882 on codex/member2-candidate-contract-1102 changes only scripts/CANDIDATE-MANIFEST.json and tests/fixtures/mcp-catalog.snapshot.json. Tree3cf4cdeb38f5eee04665582d2bc3a2fcce293b9f was fetched back and both files match tested bytes. Pending-list schema hash ce1a58ad02b66cf8 records limit1..50 and cursor1..4096, requiredroomId and unchanged annotations. Remaining catalog drift equals unchanged baseline's two webhook rows. Manifest is rebuilt mechanically, covering inherited stale pins as well as our changed UI/strings/Native test command.21focused cases pass.

Reproduce repair checks with Node24:

```
node --test --test-concurrency=4 tests/access-request-page.test.mjs tests/room-mcp-membership-admin.test.js tests/candidate-manifest.test.js
```

No production code, test expectations, grants or access policies are weakened. No merge/deploy or remote-execution proof. Raw full JUnit/logs remain local to avoid publishing arbitrary case bodies. This packet contains only sanitized summaries.
