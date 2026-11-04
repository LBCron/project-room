# PR #5492 — safety-net disposition (wave-2600 coordinator M, diagnosis only)

**Classification: CURE-CAUSED.** The `safety-net` failure at cure head `fc8e8716695476922b01af847bb654570b4bd700` is a single ESLint error in a test file the cure commit itself added. It is **not** pre-existing at main and **not** an environment flake. The falsifier in the task record is **not met**: the failure cannot reproduce at current main, because the file does not exist there.

Consumer: Codex — this pack is the disposition to adopt. No branch edit, push, label, comment, merge, or deploy was made by this lane.

## 1. The exact failing check

| Field | Value |
|---|---|
| PR / branch / head | #5492, `grokbot-mvp-default-room`, `fc8e8716695476922b01af847bb654570b4bd700` |
| Failing job | `safety-net` (check-run id `126459089720`, run `41795677803`, 2026-11-04T07:56:27Z–07:57:20Z, conclusion `failure`) |
| Passing job at same head | `mechanical` PASSED; all heavy jobs NOT-RUN (skipped, label-gated) — per coordinator A TSV |
| safety-net definition (`.github/workflows/test.yml` at cure head, lines 490–532) | `npm run lint` → `node scripts/ci-affected.mjs --run-stories` → (only if both pass) `node scripts/ci-affected.mjs --run-page-weight`; job exits 1 if lint or stories fail |
| Failing step | Step 1 only: `npm run lint` → ESLint over the repo |
| Exact error | `tests/default-room-mvp.test.js  245:28  error  'paths' is assigned a value but never used. Allowed unused vars must match /^(_|trustOffMessage)/u  no-unused-vars` |
| Error count in CI lint output | Exactly **1 error** (378 problems total: 1 error, 377 warnings; warnings do not fail the gate) |
| Story tests in same CI job | **PASSED 68/68** (0 fail) — stories are not the failure |
| Page-weight step | **Never ran** — the job script exits 1 on the lint failure before reaching it; NOT-RUN, not a failure |
| Offending line (cure head) | `const { f, page, errors, paths } = await harness(t, 1280);` in test `"a pairing import in flight at room reset does not install into the next room"` — `f`, `page`, `errors` are all used in that test body; `paths` is never referenced again in it |

## 2. Why it is cure-caused (four independent reads)

1. **Blame:** line 245 at the cure head is authored by commit `fc8e871669` itself — the cure commit ("tests: regression coverage for the human-push eligibility gate and on-demand reset symmetry", 2026-11-03T23:28:51Z). The failing line arrived *in the cure push*, not before it.
2. **Genealogy:** `tests/default-room-mvp.test.js` does not exist at the PR's merge-base `1ab906c37b5c5bdfe07f1b12808c8855128a713f` and does not exist at current main `8c9deff7534ed549df88b730c03af2d9d3a11db8` (git `cat-file -e` fails at both; GitHub contents API returns 404 at main). The file was added inside the PR branch by `1517923d0` and the failing test was added by `fc8e8716`. Diff merge-base→cure: 5 files, +516/−12.
3. **Local reproduction at cure head** (clean worktree at `fc8e8716`, status-clean, `npm ci` exit 0, node v24.22.1): targeted ESLint `node node_modules/eslint/bin/eslint.js tests/default-room-mvp.test.js` → **exit 1**, the identical 245:28 `no-unused-vars` error, 1 problem (1 error, 0 warnings). Full `npm run lint` at the cure head → **exit 1** with exactly 1 error at the same locus (local warning total differs from CI's — see §5 note).
4. **Local run at current main** (clean worktree at `8c9deff7`, status-clean, `npm ci` exit 0; main tip re-read live at the start of this run and confirmed unchanged at `8c9deff7`): targeted ESLint on the path → file absent ("No files matching the pattern", exit 2 — absence, not the error). Full `npm run lint` at main → **exit 0** (full chain: lint, design-tokens, reachability, i18n-harness, build-ui-strings).

Flake test: not applicable as primary — the error is deterministic static analysis, reproduced identically in three independent executions (CI runner, local targeted, local full). No rerun variance exists to explain.

## 3. Disposition for Codex to adopt

| # | Act | Owner | Notes |
|---|---|---|---|
| D1 | **Fix the one line before any label act.** Remove the unused `paths` destructure at `tests/default-room-mvp.test.js:245` (change to `const { f, page, errors } = await harness(t, 1280);`), or use `paths` in the test body if an assertion was intended. One-line change on the cure branch; this lane did not make it (diagnosis only). | Cure author / Codex | Any fix moves the head — every cure-head verdict, including this one, must be re-read at the new head. Do not land at `fc8e8716`. |
| D2 | Re-run `safety-net` at the new head and confirm SUCCESS before labelling. | Codex | `safety-net` is ungated (runs on every PR event), so this check costs no label act. |
| D3 | Only then: pre-act journal entry for the label act (binding label actor + token class), then the journalled `ready-to-land` label act by Codex with a user/App token, never `GITHUB_TOKEN`. | Codex | Sequence per wave-2500 cohort-02 lane-05 pack §3. |
| D4 | Fresh full CI at the exact (new) head from the `labeled` event; fill the 13-row table in §4 below at source. Anything less than 13/13 SUCCESS = HOLD. | Sitting | The label act alone at the *current* head would predictably fail at least 2 of the 13 rows: `safety-net` (already FAILED) and `lint` — the standalone `lint` job runs the same `npm run lint`, so the same error fails it once it is un-skipped. |

**What does NOT work:** labelling at `fc8e8716` and hoping heavy CI passes (D4 note); waiving the lint error (it is the PR's own regression file, and `unit` row 4 requires that file to actually execute — a cure whose own test file cannot pass lint is not land-ready); quoting `ci-verdict` success (it reports success over skipped/failed jobs; never green).

## 4. What full CI must show after the label act (13 named jobs, per lane-05 pack §4)

Required for **every** row, read at source at the exact head, from the `labeled`-event run generation: **SUCCESS — never SKIPPED**. FAILED / SKIPPED / NEUTRAL / absent (NOT-RUN) all fail the row identically: HOLD.

| # | Job | Required | Extra evidence required |
|---|---|---|---|
| 1 | `changes` | SUCCESS | Plan line verbatim: `docs_only=false`, `browser=true` (anything else = planner defect, filed separately, never waived) |
| 2 | `contract` | SUCCESS | Run id recorded |
| 3 | `lint` | SUCCESS | A `safety-net` SUCCESS never substitutes for this row |
| 4 | `unit` | SUCCESS | Job log shows `tests/default-room-mvp.test.js` **actually executed** (affected selection); selection without execution = selection-path blocker, never waived |
| 5 | `browser` (aggregate) | SUCCESS | All six `browser shard` jobs behind it read individually, each SUCCESS (6/6) |
| 6 | `cloudflare` | SUCCESS | Run id recorded |
| 7 | `friend-agent-e2e` | SUCCESS | Run id recorded |
| 8 | `visual-refresh-guard` | SUCCESS | Run id recorded |
| 9 | `gates` | SUCCESS | Direct evidence the label gate fired (label-gated workflow) |
| 10 | `schema-gate` | SUCCESS | Only possible on a labelled run |
| 11 | `test` | SUCCESS | Entered only alongside rows 1–10 and 12–13 read individually; the aggregate never substitutes |
| 12 | `mechanical` | SUCCESS | Read at the new head; the `fc8e8716` pass is not evidence for a moved head |
| 13 | `safety-net` | SUCCESS | Ungated; proves nothing about the label gate (rows 1, 9, 10 evidence that) |

Carried as by-design **NOT-RUN**, named, never folded into green, never counted toward the 13: `coverage`, `quarantined-tests`, `full`. Also present and not graded: `Cursor Approval Agent` (NEUTRAL at cure head) — not one of the 13, never cited as green or as a failure of the 13.

Current state of the 13 at `fc8e8716` (coordinator A read, for contrast): PASSED 1 (`mechanical`) · FAILED 1 (`safety-net`) · NOT-RUN/skipped 11 (`changes`, `contract`, `lint`, `unit`, `browser`, `cloudflare`, `friend-agent-e2e`, `visual-refresh-guard`, `gates`, `schema-gate`, `test`). `ci-verdict` reported success over this — not green, do not quote.

## 5. Evidence and caveats

Evidence directory: `evidence/` in this workdir (manifest with sha256 hashes in `evidence/MANIFEST.sha256`).

Key files:
- `safetynet-job-log.txt` — full CI job log for check-run `126459089720` (via `gh run view --job 126459089720 --log`): the 245:28 error line, the "378 problems (1 error, 377 warnings)" summary, story tests 68 pass / 0 fail, exit code 1.
- `safetynet-annotations.json` — check-run annotations (via `gh api repos/Uuriko/project-room/check-runs/126459089720/annotations`): the single failure-level annotation at `tests/default-room-mvp.test.js:245:28`.
- `workflow-test.yml-at-cure.txt` — `.github/workflows/test.yml` at the cure head (safety-net steps; lint job's identical `npm run lint`).
- `lint-targeted-cure.txt` / `lint-targeted-main.txt` — local targeted ESLint runs (cure: exit 1, identical error; main: file absent).
- `lint-full-captured.md` — local full `npm run lint` runs (cure: exit 1, 1 error at 245:28; main: exit 0, full chain), with provenance stated inside: duplicate exec generations raced the raw log filenames, so the summary lines are carried there as delivered tool output; the raw raced files are excluded from the manifest. Targeted runs and the CI log above are intact direct files and carry the decisive weight.
- `cure-vs-main-genealogy.txt`, `line245-blame.txt` — merge-base, diff stat, file-absence checks, blame, `paths` usage map.
- `main-tip-live.json` — live main re-read at run start: `8c9deff7534ed549df88b730c03af2d9d3a11db8` (2026-11-04T14:09:50Z), unchanged from coordinator A's pin.
- `default-room-mvp-at-cure.js` — the file as at the cure head; `default-room-mvp-at-main-api.json` — the 404 body at main.
Caveats, stated plainly:
- **Warning-count delta:** CI's lint summary at the cure head reads 378 problems (1 error, 377 warnings); the local full run on the pure branch checkout reads a higher warning total with the **same single error at the same locus**. The CI checkout is the PR merge-commit tree; the local checkout is the branch tree. Warnings do not fail the gate in either tree; the decisive invariant — exactly 1 error, `tests/default-room-mvp.test.js:245:28`, `no-unused-vars` — is identical in CI, local targeted, and local full runs.
- Local runs used node v24.22.1 (CI uses node 24) and each worktree's own `npm ci` from its own lockfile.
- This diagnosis is bound to heads `fc8e8716` (cure) and `8c9deff7` (main). Both were live-verified in this run; if either moves, re-read.
- No GitHub 429 was encountered. No edits, pushes, labels, comments, merges, deploys, or sends were made; both worktrees remained status-clean throughout (node_modules is gitignored).

## Verdict

FILED at `~/workspace/wave-2600-2026-11-04/coordinator-m-5492-diagnosis/DISPOSITION-5492.md` — classification **CURE-CAUSED**, falsifier not met, disposition D1–D4 for Codex to adopt. The one-line fix (D1) is the cure author's / Codex's act, not this lane's.
