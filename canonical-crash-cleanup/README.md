# Crash test cleanup refinement

Latest source a956b0f82506e0b315a2974c431694f9cdb9fd51 tree9a8f8b4a38932cfc46eb0b5878e502436e1f0bd6 on codex/member2-canonical-crash-ci-1102. Extends test source3b85c99a9 by waiting for child close instead of exit, plus explanatory comment. Parent branch still contains only the two test files relative to main00888. Runtime/UI/manifest unchanged.

A missing child executable emits error/close without exit. Original source cleanup reproduced not terminating within bounded3seconds and leaving its temporary directory until the outer harness removed it. Corrected source: injected nonexistent executable and immediate missing-module exit both fail exit1 in under0.1seconds and remove temporary DB directories. Failure injections were restored before publication. These are expected-failure fixture controls, not passing application cases.

Exact fetched clean published source: node --test tests/canonical-work-process-crash.test.mjs gives5pass/0fail/0skip with actual three controlledSIGKILLs/four server starts. Lint0warnings/errors and diffcheckpass. Both source files fetched byte-equal, full staged tree equals published tree. Earlier discovery unchanged(test1/helper0); not rerun as no path/discovery change.

No broad full-suite, Native, hosted, powerfailure, peer-device execution or release qualification. Prior3b85 evidence remains historical; usea956for integration. Root retains integration/release ownership.
