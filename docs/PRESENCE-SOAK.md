# Presence-under-claim-load soak (C43)

A bounded soak that drives presence under simultaneous claim load and
fails loudly if a member's presence **flips**: a connected member holding
live claims must never read back as not-watching / not-listening, and a
confirmed live claim must never vanish from its holder's `workingOn`.

Origin: QUEUE Q62 / C43 — "a deployed presence fix does not hold in
production under claim load". Consumer: Codex at the landing gate.
Falsifier: the soak cannot reproduce the flip on the current head — the
defect model is wrong and the job would certify nothing.

> **Parameter status (2026-11-03 build): PROVISIONAL-ON-LANE-04.** The
> load/assertion parameters below were parameterised from the Q62 child
> record (the ~20-claim shape) before lane 04's reproduction
> (`lane-04-c43-repro.md`, wave-2200 cohort 01) landed. Lane 04's repro
> shape — one holder with 20 native (projection) claims + 20 board-door
> claims under churn by another actor — differs from this job's shape
> (many holders claiming through the board door over HTTP). If lane 04
> reproduces the flip on a leg this job does not drive (native claims,
> claim churn/release cycles), this job's parameters must be amended to
> that leg before the job certifies anything about it.

## Files

| File | Role |
|---|---|
| `tests/presence-claim-soak.test.js` | The soak: node:test, boots the real server in-process on a scratch fixture, drives claim bursts, samples presence, asserts the invariants |
| `.github/workflows/presence-soak.yml` | CI job: weekly (Mon 09:40 UTC) + manual dispatch with actor/round inputs; 10-minute job cap |

The test is also discovered by the ordinary unit suite (`node --test`)
and by the unit-shard planner, so it runs on the normal test lane too.

## Quick start

```sh
# default Q62 shape: 20 actors x 3 bursts = 60 claims, ~25 s locally
npm run test:presence-soak

# larger shape
C43_ACTORS=40 C43_ROUNDS=4 npm run test:presence-soak
```

## What it asserts (every presence sample after baseline)

1. Presence answers HTTP 200.
2. Every stream-holding member's row is present in the roster.
3. `watching === true` for every stream holder.
4. `state === "listening"` for every stream holder (holding a claim is
   not execution; it must not derive `working`, and load must not drop a
   watcher to `idle`/`unknown`).
5. Every claim whose claim POST returned 200 before the sample started
   is listed in the holder's `workingOn`.
6. A streaming control member who never claims keeps
   watching/listening and an empty `workingOn`.

Any violation is recorded with its sample number and the full offending
row, and the test fails with the first five printed.

## Runtime budget

Defaults (20×3) finish in ~25 s locally; the test hard-fails past
`C43_BUDGET_MS` (default 120 s; the CI job sets 240 s inside a
10-minute job that includes `npm ci`). A soak that cannot finish in CI
certifies nothing, so the budget is part of the test, not a comment.

## Knobs

| Env | Default | Meaning |
|---|---|---|
| `C43_ACTORS` | 20 | Simultaneous claim/presence actors |
| `C43_ROUNDS` | 3 | Claim bursts per actor |
| `C43_SAMPLE_MS` | 150 | Presence sample interval target |
| `C43_BUDGET_MS` | 120000 | Hard runtime budget for the load phase |
