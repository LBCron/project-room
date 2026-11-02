# Reviewable canonical authorization regression

Source c1c1c0ae1ed7ba99a218cc3275e72dfdf7e0c6ec, tree8847da57546e8b97d19a7306baf20d9539a9f3fe, parenta599faa29ff65567e5c080609cb2d000acd33666. Branch codex/member2-canonical-authz-regression-1102. Adds exactly one149-line file: tests/canonical-work-authz-http.test.mjs. No runtime/UI, dependency, existing QA2 checker, gate or manifest edits. Entire published tree and file were fetched/compared before the exact-head final run; isolated checkout is clean.

The normal Node test uses actual local HTTP for nine principals x six canonical work operations, real invitation/redeem profiles, a share-link guest and actual identity revocation. Production model commands seed independent valid lifecycle prerequisites; every role/action under test crosses the real HTTP boundary. Explicit policy oracles, no known-failure exceptions or skips. Allowed commands bind exact authenticated actor/+1event; denied cells retain identical ten business-table snapshots. Outsider/anonymous/revoked responses cannot contain the synthetic task marker. Final recovery audit passes with zero legacy mirror rows. The canonical matrix intentionally does not replace the older legacy QA2 matrix or hide its stale fixtures.

Executed on Node24.22.1 at the exact published source:

```
node --test tests/canonical-work-authz-http.test.mjs
node --test tests/candidate-manifest.test.js
node node_modules/eslint/bin/eslint.js --max-warnings 0 tests/canonical-work-authz-http.test.mjs
git diff --check
```

New regression55passed/0failed/0skipped (54named cells plus enclosing test). Manifest8passed/0failed/0skipped. ESLint0warnings/errors; diff check pass. Existing shared discoverUnitTests finds the file exactly once in1859files; this is discovery only, not execution of the full suite. Logs/qualification/discovery receipts included. Test uses disposable in-memory data/loopback, closes owned server/store and starts no provider/model or external host execution.

For the other laptop: check out the branch in an isolated review checkout, use existing dependencies/Node24, and execute the first command. Return actual hostname, sourceSHA, Nodeversion, exit and TAP summary/digest if physical second-device execution is being confirmed. Preparing/delivering this command is not execution evidence.

Root retains composition, PR, merging and release. This is a test adapter contribution, not a fix for the pending fresh-room assistant/Updates product issue, standalone charter/pin capability gaps or default OAuth enumeration. Prior a599runtime evidence is retained with its original source pins because this changes only a test file. No new full-suite, Native, hosted, merge, deploy or peer-device/utilization proof.
