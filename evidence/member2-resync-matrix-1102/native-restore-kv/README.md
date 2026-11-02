# Native restore: private KV audit repair

Standalone fix: `dff5d160e39eeef737d4d73edc5c395ee54b66b8`, parent `00888c52110d36250d3e07629036701b72926d09`, tree `efd3382c8ab77e59c9ab5d7ca1352f8065960917`, branch `codex/member2-native-restore-kv-1102`.

Complete composition: `308a5a910ac6c9febe8ffb708932075b3cf2a1f1`, tree `72a4430fbb5f297429493885c45be11391ec82d3`, branch `codex/member2-access-pages-composed-1102`. Both published trees were fetched back and compared against the tested local trees. Root owns integration and release.

A real `ctx.storage.put` creates Cloudflare’s private `_cf_KV` table. The actual configured-KV restore API reached `audit_pending`, then returned 422 because `PRAGMA foreign_key_check("_cf_KV")` is forbidden. SQL observation captured the statement without bindings. Both unchanged main `00888c521` and the earlier `1785f8e9` composition reproduce it. Ordinary heartbeat and retention code also use Durable Object KV.

The fix excludes platform-owned `_cf_` tables from the Native adapter’s per-table foreign-key walk. It retains every Native application table and complete Node coverage. The quick-check filter, privilege guard, cursor, seal and publication checks stay intact. Six Node tests pass, including rejection of an actual orphan in an application table named `_cf_child`. The new actual Native regression fails on original code and passes on the fix: 229 quick-check tables and 230 eligible foreign-key tables, both valid application parent/child tables checked, and private KV preserved. Admission remains pending after engine completion; this test cannot claim publication. The new Native check is wired into `cloudflare/package.json`.

For full-path qualification, the unchanged Native runtime created 1,000 pending requests through normal producers and exported 3,180,645 bytes. The strict authorized API restored that backup into the fixed Native composition. It rejected partial queue reads with 503, accepted exact cold source resume, passed the full independent audit, and completed cleanup. After a cold reopen, both original credentials worked, all request rows and identities were unchanged, and 40 bounded pages reached all 1,000 unique requests with zero listing writes. Late pages used at most 938 physical row reads. Admission was clear, frozen guards were absent, and temporary source KV keys were removed.

That run completed 1,164 continuations, including 166 cleanup calls, with 997 unique actual recovery frontiers. The separate diagnostic driver allows at most 20,000 continuations and rejects unchanged or cycling frontiers. It establishes no production latency or whole-recovery bound. The original broad 650-message Native test independently hits its existing 500-step ceiling on both unchanged main and the fixed candidate. Its source, cap and timeout remain untouched; both failure logs are retained and no pass is claimed. The 1,000-request fixture was not reduced to fit a smaller budget.

The full run tested local commit `349f62dc4bc57f272b3a596303e371d15f86f942`; published `308a5a9` has exactly the same complete tree. The composed local `CI=1 node scripts/check.mjs` passed its syntax, lint, docs, skill, OpenAPI, schema, secret and inventory gates, plus 15 embedded tests. Fifteen neighboring engine/schema/restore-envelope tests also pass. This is local evidence, not full root unit-suite, hosted CI, production restore, peer execution, or deployment evidence.

Reproduce the focused checks with Node 24, installed cloudflare dependencies, and matching July 2026 workerd:

```
node --test tests/recovery-engine-continuation.test.mjs
MINIFLARE_WORKERD_PATH=/path/to/workerd node --test cloudflare/recovery-native-kv.check.mjs
```

To repeat the complete backup experiment, keep `access_request_seed.mjs` beside the runner and use clean checkouts at the exact old and new pins:

```
ACCESS_RESTORE_AFTER_PIN=308a5a910ac6c9febe8ffb708932075b3cf2a1f1 \
MINIFLARE_WORKERD_PATH=/path/to/workerd \
node access_request_native_restore.mjs /path/to/old-00888 /path/to/new-308a5
```

The runner checks both pins and tracked cleanliness, uses the new checkout’s existing esbuild/Miniflare dependencies, and removes temporary storage. Export bytes and synthetic credentials stay in process memory. Only a synthetic credential hash appears in the receipt. No real user or operator state changed.
