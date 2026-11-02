# Bounded pending access requests: implementation evidence

Code `aec29ee1275db508070f4bfbfd902f207469fcd8`, parent main `00888c52110d36250d3e07629036701b72926d09`, tree `474c5f1b30227f2a76e2691b4b2968400158cc0a`. Published on `codex/member2-access-request-pages-1102` and fetched back: complete local tree matches. Root owns merge/deploy. This packet does not establish remote execution or deployment.

Pending HTTP and hosted MCP reads use authenticated opaque keyset pages, default25 and max50; an unselected oversized queue explicitly refuses rather than silently claiming completeness. Expired backlog is filtered with no sweeping writes. Cursors bind current access/source/credential/session/selection and expire explicitly across cold service. Native/admin UI independently pages25request controls; legacy owner retains original selected report pages via authorized metadata. Sponsor decision-only approval had an existing undefined permissions.some failure; actual browser regression verifies the narrow guard, exact submitted body and unchanged identity/perms.

Frozen revision:210 API/viewer/access/owner/MCP/catalog tests,4 actual Chromium journeys,1 actual Native workerd test and6 browser shard wiring tests pass. Browser owner/admin fully traverse1000requests in40pages with25rows/75buttons, preserve selected native work page, reset stale queue and restore keyboard focus. Legacy owner30requests stay reachable, and sponsor approval works beyond first queue page. Native1000requests all reached40pages, ownerfirst936/last937/max938physical reads,0writes; expired1000+fresh27 firstpage953reads/0writes. No latency speedup claim. Baseline packet7487f1a has original unbounded25vs1000costs.

Reproduce from repo root with Node>=24.19 and existing npm dependencies:

```
node --test tests/access-request-page.test.mjs tests/needs-attention-viewer.test.js tests/needs-attention-retry.test.js tests/errors-catalog-drift.test.js tests/mcp-openapi-drift.test.js tests/browser-suites.test.js tests/mcp-core-profile.test.js
node --test scripts/access-request-pages-browser-check.mjs
node --test cloudflare/access-request-pages.check.mjs
```

For Native use matching July2026 workerd via MINIFLARE_WORKERD_PATH and installed cloudflare dependencies. Native test is wired into cloudflare/package.json. Browser is automatically disk-discovered; measured duration is added for shard balancing. Full210-test neighboring batch is recorded in contract.log; individual names remain visible.

Final i18n/strings/schema/secret-diff/dependency checks pass. ESLint0errors/1prefer-const warning. YAML parses. OpenAPI route inventory gate FAILS with exactly25identical unrelated legacy GET findings on the complete unchangedbase60 and composedtree; logs retained. No route allowlist weakening. Prior7c boot census1pass is separately labeled. Source manifest hashes every21changed files. All fixtures are local, disposable and produced through normal request creation; no live normalization, grant change, user signup, shared scheduling or production deploy.
