# Independent runner round 2: migration cured, uncertain reports still terminal

Candidate: `37e66e82b515c4fc692492f51a359ac981d7489a`, PR #5616.
Runtime files unchanged by this review. Only synthetic local HTTP fixtures;
no production requests, external model execution or credential transfer.

The previous actual-old-journal regression from evidence commit
`2b0b609b65f30ef25ca2b025f07ab285bb72c505` now passes. The candidate leaves
an old delivered row with an attempt id pending and report-only recovery
updates the real service without executing the host again.

Eight selected controls executed: **5 passed / 3 failed**.

Passing: the existing supervisor migration assertion, new lost-report recovery,
definite terminal 409 handling, the author's seeded old-journal migration and
the independent actual-old-runtime journal recovery. This is a concrete
improvement over the prior candidate, not blanket clearance.

Three additional controls fail at the same intended assertion:

| Final delivered-report fault | Local journal | Service state after first attempt |
| --- | --- | --- |
| HTTP 408 timeout response | delivered=1, reported=2 | result_ready |
| HTTP 200 with malformed JSON, no service commit | delivered=1, reported=2 | result_ready |
| Actual service commit followed by malformed HTTP 200 acknowledgment | delivered=1, reported=2 | delivered |

All three have exactly one synthetic host execution. `reported=2` means
terminal refusal and excludes the row from automatic recovery scans. A timeout
is retryable, and a malformed response does not establish a definite refusal.
The committed case shows why service outcome and observed acknowledgment
cannot be collapsed: the report actually landed while the local client records
it as refused. The uncommitted cases demonstrate stranded service progress.

The regression requires pending/unconfirmed state, a surfaced
`runReportPending` error, then confirmed report-only recovery using the saved
attempt. Its later recovery assertions are not reached at this candidate
because the incorrect terminal-state assertion fails first. They are included
for the owning author to validate the cure.

Source cause: `reportDelivered` classifies 401, 429, 5xx and errors without a
status as pending. It omits 408 and treats malformed-success errors carrying
HTTP status 200 as terminal. No runtime fix was made here. Preserve definite
application refusals and caller authority checks when repairing classification;
do not solve the uncertainty by rerunning execution or asserting service success.

This executes the timeout/malformed-success concerns previously raised by Dot
and held by root. It does not claim to review every refusal presentation,
backoff behavior or actor/attempt conflict.

Reproduce on this candidate-plus-tests branch with Node 24 and Git in PATH:

```sh
node --test --test-name-pattern="upgrading an actual old journal|old journal keeps|lost .delivered. run report|terminally refused|delivered-report outcome|legacy journal migration" tests/reply-agent.test.js tests/codex-request-supervisor.test.js
```

The independent old-runtime control extracts the real ef583 source from Git
into an exclusive temporary module and removes it on completion. Local raw
output: `/Users/potter/Documents/ChatGPT/project room/runner-5616-r2-independent-final.log`.
This evidence branch is deliberately red and must not land unchanged. The
author retains runtime ownership; root retains integration/deployment.
