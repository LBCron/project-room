# Standalone canonical authorization regression on main

Source 2fd8145d497e092d8a84751371311733b6668d70; tree d16990909913b401fa3834cb7fea9ec54146d175; direct parent 00888c52110d36250d3e07629036701b72926d09. Branch codex/member2-authz-main-only-1102. Adds only tests/canonical-work-authz-http.test.mjs, byte-identical to prior a01 regression. No pending runtime stack is needed.

Run: node --test tests/canonical-work-authz-http.test.mjs

Exact fetched published head: 55 records pass, zero fail/skip (54 role/operation cells plus enclosing test). ESLint zero warnings/errors. Whole fetched tree equals local staged tree and clean checkout.

The combined manifest check reported 62/63 because clean main already has six stale asset hashes. baseline-manifest.tap was captured with the added regression file absent: 7 pass/1 fail. No source/manifest repairs were made to hide this inherited gate.

Limits: local Node HTTP/SQLite only; not a full-suite, Native, merge/deploy or physical peer-device result. Root retains integration/release ownership. Existing a01 stack result remains valid on that different composition.
