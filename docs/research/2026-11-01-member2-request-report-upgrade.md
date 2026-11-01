# Independent #5616 review: old journal report evidence

Candidate: `34a36fe21d3a04a781f1f6fcb8149fef58e91575`.
Parent/main reference: `ef583ba81eeeb284c8b743829aa4a0555752a0e8`.
No runtime edits, production calls, host model execution or author-branch changes.

## Result

The new lost-report test passes, but migration excludes the original already
stranded cases from automatic recovery. `openRequestJournal` adds `reported`
with default zero, then executes:

```sql
UPDATE request_runs SET reported=1 WHERE delivered=1
```

In the old runner, `delivered=1` proves only that the answer was confirmed in
the conversation. The subsequent service `delivered` report could fail and
be swallowed. It does not prove that report committed. Treating that old bit
as report evidence incorrectly excludes these rows from both new recovery
queries (`delivered=0 OR reported=0`). The comment that these rows cannot be
reconciled retroactively is not supported: the saved response, original attempt
id and authenticated idempotent delivery path remain available.

## Executed contrast

One focused invocation selected the author's positive control and the new
upgrade control; outcome **1 passed / 1 failed**.

The independent control extracts the exact old runner source from the parent
commit using Git, temporarily imports that unchanged source beside its normal
relative dependencies, and removes it after the test. It uses the real local
Room HTTP fixture and drops only the final `delivered` service report.

Observed state:

1. Old runner executes once and delivers the answer successfully.
2. Its real journal has `delivered=1`, saved response and attempt id, and no
   `reported` column. Service state remains `result_ready`.
3. Close that SQLite connection and reopen the same file with the candidate.
4. Candidate records `reported=1`; service still reports `result_ready`.
5. The regression fails on `legacy delivered does not prove its service report
   landed` (actual 1, expected 0). The host execution count remains one.

The author's new-journal case in the same process passes: a newly lost report
has `reported=0`, queue recovery updates the service and does not rerun the
host. Therefore the failure is specifically the real upgrade path, not the
positive-control setup or the new basic retry mechanism.

Raw local log is preserved as
`/Users/potter/Documents/ChatGPT/project room/request-runner-5616-migration-red.log`.
The fixture uses only synthetic data; it does not launch an external model.

## Suggested owning-lane correction and scope

Preserve uncertainty for legacy delivered rows with recoverable saved response
and attempt identity. Reconcile using the existing authenticated operation;
never rerun the execution backend to repair a report. Do not manufacture a
successful report from a local delivery bit. State without an attempt id needs
an explicit compatibility meaning rather than a false new service assertion.

Keep authentication/authorization checks on reconciliation. Distinguish a
transient report outage from a definite refusal and avoid endless rapid replay
of an already known delivered answer. Those additional classifications were
independently source-reviewed by another agent; this document claims executed
evidence only for the new-journal control and actual old-journal migration.

The author owns the runtime cure; root owns integration and deployment.
This branch is intentionally red evidence, not ready to land unchanged.

## Reproduction

Run from this exact candidate-plus-test branch with Node 24 and Git available:

```sh
node --test --test-name-pattern="upgrading an actual old journal|a lost .delivered. run report is surfaced" tests/reply-agent.test.js
```

The old commit must be present in local Git history. The independent test uses
exclusive temporary module creation and cleans that file on completion.
