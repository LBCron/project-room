# Final reusable canonical authorization regression

Final sourcea01c0b301597927ec18f521980f3b51350021fd8, treec7adf00dba49b770666a47dedb13fce1cfdbbaa6 on codex/member2-canonical-authz-regression-1102. Compared to a599, adds only tests/canonical-work-authz-http.test.mjs. No runtime/UI/dependency/gate edits. Earlier c1c1 source and its evidence remain historical; this packet supersedes that head for review.

The fixture explicitly selects normalized representation only during its owned room initialization, then restores the original initializer before HTTP profile setup or matrix calls. This tests existing normalized authority without requiring the product to keep normalized-by-default creation. It does not take a position on the pending legacy-creation product decision and mocks no authorization or response.

Nine real principals x six canonical work operations. Actual HTTP invite/redeem profiles, share-link guest and identity revoke; real valid unlinked outsider/anonymous. Model commands seed independent valid lifecycle prerequisites. Allowed command attribution/+1event, ten business-table snapshot refusal atomicity, foreign-response task-marker absence, zero legacy mirror rows and final recovery audit are checked. No exceptions/skips or substitute allow classes. Existing old QA2 checker and failures remain untouched.

Final exact-head commands:

```
node --test tests/canonical-work-authz-http.test.mjs tests/candidate-manifest.test.js
node node_modules/eslint/bin/eslint.js --max-warnings 0 tests/canonical-work-authz-http.test.mjs
git diff --check
```

63test records passed/0failed/0skipped:54named matrix cells, enclosing test and8manifest cases. ESLint0warnings/errors, diffcheck pass. Shared normal unit discovery includes new file once in1859files; not a full-suite run. Entire published code tree and file fetched equal, clean isolated checkout. Logs/qualification/discovery included.

Peer-local repeatable work: in an isolated checkout of the source branch, use existing dependencies and Node24, run the first command, return actual hostname/HEAD/Node/exit/TAPdigest if second-device execution is being confirmed. Delivery itself proves none of that. No schedules, host grants, provider/model execution or runtime setup is needed. Test uses disposable in-memory data/loopback and closes its owned server/store.

Root owns composition/PR/merge/release; no PR or deployment from this lane. Existing fresh-room, charter, pin and default OAuth findings remain independent and unresolved. Prior a599runtime evidence keeps its original pins; this changes only a test. No full-suite, Native/hosted, release or peer-laptop-utilization qualification.
