# Inspect qualification evidence without rerunning workloads

`audit_evidence.py` checks the two existing finite qualification formats: the
16-case pending-publication write matrix and the single packaged Native durable
restore test. Standard-library Python 3.12+, macOS/Linux, offline and read-only.
It does not execute the included workload runner.

From the containing `project room` directory:

```sh
python3 local-lab/audit_evidence.py local-lab/audit-fixtures \
  local-lab/audit-fixtures/matrix/source-pin/receipt.json
python3 local-lab/audit_evidence.py local-lab/audit-fixtures \
  local-lab/audit-fixtures/native/receipt.json
python3 local-lab/test_audit_evidence.py
```

Optionally add `--source-checkout /absolute/source` and `--git /path/to/git` to
require an exact matching HEAD and clean tracked files. Native evidence must also
match the package's reported Git source tree. These checks run only read-only Git
commands, never a command supplied in a receipt. Without that option, the checker
does not claim to have inspected source. Untracked files are outside this check.

Exit0 means the artifacts satisfy this format's consistency checks. Exit1 means
refusal or failure. JSON output states the result and its limited scope.

## What it checks

- Receipt is a successful terminal run with an exact source SHA; artifact bytes
  match their SHA256 pins. Duplicate JSON fields and non-finite numbers refuse.
- Matrix has exactly one record per case/mode, all 16 cases, seven supported
  successes per mode and two exact unsupported edit refusals. Reported summary
  must agree with actual records. Warm AND cold proofs, reads, audits, retries,
  selected-storage erasure and refusal business-state checks are inspected.
- Native log contains exactly one source-matching package diagnostic, verified
  unchanged archive, required qualification flags, no remaining cleanup guards,
  and a terminal one-pass/zero-failure/cancellation/skip summary.
- Artifact references stay inside an explicitly supplied evidence root. Relative
  parent references inside that root are allowed for the existing receipt layout.
  Symlink artifacts, nonregular files and files over8MiB refuse. FIFO inspection
  is nonblocking; no writer is needed to reject a pipe.

The copied fixtures are byte-identical public outputs from evidence commits
`9c8c09a5da9c0df88e15a4058eabe6157f8040aa` and
`39d3ea56a3644c6a56f89221879794760aac769a`. `audit-fixtures/sources.json`
pins their files. Existing runtime source and existing tests were not modified.

## Validation

Ten tests use those actual outputs and deliberately damaged copies: changed
bytes, duplicate/missing case coverage, an invalid cold proof behind a green
summary, missing error fields, rehashed wrong-source diagnostics, truncated
terminal logs, duplicate JSON fields, external paths, symlinks and a FIFO.
Optional source checks were also run on both real clean pinned checkouts; an
intentionally wrong checkout was refused. Results are saved alongside this file.

No original Node/Native workload was repeated to produce these inspector tests.
The fixture's `wholeRecoveryBounded:false` and `finalUnboundedAuditRequired:true`
remain visible in successful output. A passing archive test is not a CPU bound.

## Limits

This establishes consistency of supplied evidence, not authenticity. A dishonest
party can fabricate a mutually consistent log and receipt. Hashes do not establish
who ran a test, whether it ran, or when. The optional checkout check inspects its
current revision and tracked contents, not the past execution environment.

The checker recognizes these two specific formats and acceptance cases. It is not
a general test parser, an integrity sandbox, an archive re-verifier, a runtime
test rerun, deployment approval, account-preservation proof, or full-release gate.
Files changing concurrently during inspection are outside its consistency model;
inspect a stopped immutable copy. A format change should refuse until reviewed,
not silently weaken the checks.
