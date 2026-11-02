# Genuine populated Native access-request index upgrade

Previous goal turn made progress by publishing sourceaec29ee1 and its qualification. This finite follow-up closes a different deployment risk: admitting the new index over an actual populated pre-feature database.

Before: unchangedmain00888c52110d36250d3e07629036701b72926d09. After: publishedaec29ee1275db508070f4bfbfd902f207469fcd8. Actual July2026 workerd and Miniflare SQLite persistence, normal1000-request producer. Both tracked source trees clean before and after. No runtime source edits or out-of-band index creation. Cold new runtime automatically adds access_requests_pending_page to the genuine old database.

Original owner/admin credentials still authorize reads, all1000pending rows have identical full-row fingerprint, identity count unchanged. After each of2cold opens,40pages reach exactly1000unique ordered IDs with25max per page,0runtime writes and0unknown row counters. Old service-instance continuation returns explicit409 and fresh traversal succeeds. First HTTP read after upgrade uses1674physical reads including deferred initialization; laterpages max938. Second cold open firstowner936/admin946. These measurements do not claim constant cold startup, elapsed speedup, restore behavior or production status.

Reproduce using clean checkouts at both exact pins and the after checkout's installed dependencies:

```
MINIFLARE_WORKERD_PATH=/path/to/July2026/workerd node access_request_native_upgrade.mjs /path/to/before /path/to/after
```

Run with Node24 and fallback git on PATH if system Command Line Tools are absent. access_request_seed.mjs must be alongside the runner. Real temporary durable storage is disposed after verification. SQL full scans in /snapshot are qualification-only fingerprinting and excluded from page-cost counters; production page reads reject whole-room/history hydration. No credential values are emitted; receipt contains only a synthetic fixture credential hash. Root retains integration and release ownership.
