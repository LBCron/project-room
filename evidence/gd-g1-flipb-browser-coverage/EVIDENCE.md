# GD-G1 — Flip-B local non-author browser + coverage evidence

LABEL: LOCAL NON-AUTHOR EVIDENCE. This is not GitHub CI. Produced by lane GD-G1 (Jill fleet; non-author for both PRs) under Grok Bot task 1 (muse-room seq 24456). Record: t-20261031-113-grok-task-1-local-non-author-browser-cov. Runs executed 2026-10-31 23:47 UTC to 2026-11-01 02:48 UTC on this VM.

## Subjects (verified at source this run via the GitHub API)

| Tree | Commit | Tree SHA |
|---|---|---|
| main (baseline) | 1ab906c37b5c5bdfe07f1b12808c8855128a713f | e31a14730bed67144e3fb45eb2d11c85f470efb7 |
| PR #5441 alone | f7e18e21e891ebd4b842b8dc1267d0e9950d9fe5 | 0260666554ca4312b98fa438ea098539830b5a98 |
| PR #5442 alone | 2ebf8e23c3541b0702882154c9cd4aa5e112613b | e579fcd0696f675cdea13627b1cd657b8ba2ff52 |
| Composed (Flip-B) | local composition d2c346cda020187b522a0a57a0a5fc5a9e37f6b5 (cherry-pick of 2ebf8e23 onto f7e18e21) | 7358c7373f9c4ab6a5575a7101e2917862724e08 |

Both PR heads are exactly the heads cited in the tasking (verified unchanged at source; both still based on main 1ab906c3). The composed tree was recomposed locally and its tree SHA matches the cited composed tree and Dot's independent recomputation (muse-room seq 24432). PR diffs (API file lists): #5441 = server/needs-me.mjs, server/work-claims.mjs, tests/needs-me-delivered-review.test.js. #5442 = server/bounty-escrow.mjs, two errors-catalog.md copies, tests/bounty-accept-fail-verdict.test.js, tests/bounty-rubrics.test.js.

## Jobs (as defined in .github/workflows/test.yml at main 1ab906c3)

- Browser: `scripts/test-env.sh npm run test:browser:ci -- --shard=N/6`, N=1..6, full-suite scope (CI_BROWSER_SCOPE unset; plan = 146 scripts, 776 test cases). npm is blocked by the platform write fault (verbatim below), so the identical underlying command ran instead: `scripts/test-env.sh node scripts/browser-ci.mjs --shard=N/6` (package.json at main: test:browser:ci = `node scripts/browser-ci.mjs`).
- Coverage: `node scripts/coverage-thresholds.mjs` (the coverage job's run command, verbatim).
- Not run, per tasking: unit, contract, lint, cloudflare (Grok's lane owns them).

## Environment blockers (verbatim, material to every NOT-RUN)

1. Platform write fault (EPERM episode, fleet-wide since ~15:37 PT 2026-10-31). Bisected in this run: in a node process, `writeFileSync` succeeds before and fails after the process reads any repo source file (reproduced with package.json, scripts/browser-ci-durations.json, scripts/test-env.sh, server/needs-me.mjs). Files are created 0-byte when the write syscall is refused: `Error: EPERM: operation not permitted, write at writeFileSync (node:fs:2482:20) at writeBrowserSelection (scripts/browser-ci.mjs:60:3)`.
2. npm is unusable under the fault, every invocation: `npm error code EPERM; npm error syscall write; at LogFiles.load (/opt/hatch-image/bin/npm-package/lib/utils/log-file.js:78:25)`. One `npm ci` partially installed then died (`npm warn tar TAR_ENTRY_ERROR EPERM: operation not permitted, write`), truncating node_modules/playwright/package.json. Because npm ci cannot complete, runs used a symlink to an existing complete install whose lockfile differs from main's in exactly 2 of 108 packages (launder 1.7.1 installed vs 1.7.2 locked; sanitize-html 2.17.7 vs 2.18.0). Playwright is exactly the locked 1.62.1; Chromium is the cached chromium-1234. Neither differing package is touched by either PR.
3. sqlite WAL fault, VM-wide: RoomStore configure fails with `Error: disk I/O error at Object.configure (server/store.mjs:685:8) { code: 'ERR_SQLITE_ERROR', errcode: 778, errstr: 'disk I/O error' }`. Neither PR touches server/store.mjs.
4. Acceptance-fixture contamination (found and repaired): scripts/acceptance-fixture.mjs generates scripts/.acceptance-fixture.<digest>.generated.mjs on first import; a 0-byte EPERM-truncated generation (23:57 UTC) made later imports return `TypeError: createAcceptanceFixture is not a function`. Two early shard runs were discarded for this. The file was regenerated in a healthy window and verified before all counted runs: 7168 bytes, sha256 421ff70b89c7a8f77d84459070cbf42f35a9372254bab93f908a0a4e55ad4ce6, export is a function; identical copies in every worktree.
5. A runtime session loss at ~02:21 UTC killed two in-flight shard loops (5441 S3, 5442 S2 mid-run; their junit files are 52-byte headers). From ~02:39 UTC the EPERM episode hardened and every further shard attempt died at the startup selection write (5441 S3: 8 further attempts; 5442 S2: 8; 5441 S4 / 5442 S3+: repeated attempts; main S1/S2/S3/S6: repeated attempts 02:42–02:48 UTC). Harnesses were stopped at 02:48 UTC for a clean cutoff.

## Results — browser shards (verdict per exact head; cases/failures from that shard's junit XML, filed beside this document under junit/)

### Composed tree 7358c7373f9c4ab6a5575a7101e2917862724e08

| Job | Verdict | Cases | Failed |
|---|---|---|---|
| browser shard 1/6 | FAILED | 35 | 1 |
| browser shard 2/6 | PASSED | 120 | 0 |
| browser shard 3/6 | FAILED | 155 | 2 |
| browser shard 4/6 | PASSED | 169 | 0 |
| browser shard 5/6 | PASSED | 188 | 0 |
| browser shard 6/6 | FAILED | 109 | 1 |
| coverage | NOT-RUN | — | — |

Total 776 cases, 4 failed. Failing cases:
- S1: scripts/email-password-browser-check.mjs — "password signup opens one personal room without optional setup, with profile editing available later": locator.waitFor: Timeout 3000ms exceeded.
- S3: scripts/visual-regression-browser-check.mjs — "login/join entry pages match visual baselines": 11078 pixels differ (1.08% of frame, budget 1.00%); "signed-in room view and message list match visual baselines": 21314 pixels differ (2.08%, budget 1.00%).
- S6: scripts/recovery-browser-check.mjs — "actual Node entrypoint pauses without touching populated data, then resumes the same Room in a browser": Expected values to be strictly deep-equal.

### PR #5441 alone — head f7e18e21e891ebd4b842b8dc1267d0e9950d9fe5

| Job | Verdict | Cases | Failed |
|---|---|---|---|
| browser shard 1/6 | PASSED | 35 | 0 |
| browser shard 2/6 | FAILED | 120 | 1 |
| browser shard 3/6 | NOT-RUN | — | — |
| browser shard 4/6 | NOT-RUN | — | — |
| browser shard 5/6 | NOT-RUN | — | — |
| browser shard 6/6 | NOT-RUN | — | — |
| coverage | NOT-RUN | — | — |

- S2 failing case: scripts/help-offer-browser-check.mjs — "a selected helper remains visible when time expires without a new event": action returned help_offer_refused / command_rejected for workItemId "offer-guide".

### PR #5442 alone — head 2ebf8e23c3541b0702882154c9cd4aa5e112613b

| Job | Verdict | Cases | Failed |
|---|---|---|---|
| browser shard 1/6 | FAILED | 35 | 1 |
| browser shard 2/6 | NOT-RUN | — | — |
| browser shard 3/6 | NOT-RUN | — | — |
| browser shard 4/6 | NOT-RUN | — | — |
| browser shard 5/6 | NOT-RUN | — | — |
| browser shard 6/6 | NOT-RUN | — | — |
| coverage | NOT-RUN | — | — |

- S1 failing case: scripts/email-password-browser-check.mjs — same case as composed S1, same locator.waitFor 3000ms timeout.

### Main 1ab906c37b5c5bdfe07f1b12808c8855128a713f (classification re-runs)

| Job | Verdict |
|---|---|
| browser shard 1/6 | NOT-RUN (repeated attempts 02:42–02:48 UTC, all startup EPERM) |
| browser shard 2/6 | NOT-RUN (same) |
| browser shard 3/6 | NOT-RUN (same) |
| browser shard 6/6 | NOT-RUN (same) |
| coverage (control) | NOT-RUN — attempted with a 240 s cap; V8 collection writes refused verbatim: `EPERM: Failed to write file .../wt-main/coverage/coverage-28380-1793501039749-0.json` (and siblings), plus ERR_SQLITE_ERROR 778 in tests; killed at cap, exit 124 |

## Coverage (all trees): NOT-RUN

Command `node scripts/coverage-thresholds.mjs`. Composed tree: attempted at full length with a 1500 s cap — the suite under collection was still in early alphabetical test files at the cap (exit 124), with RoomStore setups failing throughout on the 778 WAL fault quoted above; no threshold evaluation was ever reached. Main control (240 s cap): same signature, plus EPERM refusals on the coverage JSON writes themselves (quoted above). The blocking path (server/store.mjs WAL configure; the coverage script's own file writes) is identical on all four trees and untouched by either PR, so PR-alone coverage is filed NOT-RUN on the composed attempt plus the main control rather than two more identical burns.

## Classifications (falsifier rule: re-run at main 1ab906c3)

The main browser re-runs are NOT-RUN (blocker 5), so classifications rest on the completed cross-tree runs and the verified diffs; each is labelled with its basis. No classification is folded into a PASSED verdict anywhere above.

- email-password case (composed FAILED, #5442 FAILED, #5441 PASSED 35/35): NOT introduced by either PR — pre-existing / environmental timing flake in this environment. Basis: the relevant auth/email code is byte-identical across main, both PR heads, and the composition (neither diff touches it), the same case passes on one tree and times out on two others, and the failure mode is a 3000 ms locator timeout on a loaded, faulting VM.
- visual-regression cases (composed FAILED; PR-alone S3 NOT-RUN): NOT introduced by either PR. Basis: neither diff touches any UI, template, style, or baseline file; the deltas (1.08% and 2.08% vs a 1.00% budget) are local-Chromium rendering differences against CI-captured baselines. The composed FAILED verdict stands as measured.
- recovery case (composed FAILED; PR-alone S6 and main S6 NOT-RUN): UNRESOLVED. The case exercises RoomStore pause/resume across a process restart, squarely inside the blast radius of the active 778 WAL fault, so an environmental cause is plausible but not proven; no completed main re-run exists to clear it. The composed FAILED verdict stands as measured.
- help-offer case (#5441 FAILED; composed PASSED the same shard and case): NOT introduced by #5441 — flake-consistent. Basis: the composed tree contains #5441's exact changes and passed this case; #5441's diff (needs-me review queue) does not touch offer/help-offer code; the assertion is time-expiry based. Main re-run NOT-RUN.

## Bottom line for the landing seat

- Composition as measured locally: browser 3 of 6 shards PASSED, 3 FAILED (4 of 776 cases); coverage NOT-RUN.
- No measured failure is attributable to either PR's diff; one failure (recovery) is unresolved because the environment blocked its main re-run.
- The NOT-RUN legs (5441 S3–S6, 5442 S2–S6, all coverage, main re-runs) are blocked by the platform write fault, not by the code: every attempt's verbatim blocker is recorded above. Re-running them when the fault clears is the remaining step.
