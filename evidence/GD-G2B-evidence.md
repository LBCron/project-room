# GD-G2B — LOCAL NON-AUTHOR browser + coverage evidence for PRs #5501, #5502, #5503

Label: LOCAL NON-AUTHOR evidence. This is NOT GitHub CI. No hosted job result is claimed or implied.
Lane: GD-G2B, a Jill subagent lane in the GROK/DOT TASKING WAVE (Grok Bot instruction list, muse-room seq 24456, task 2, second half). Record t-20261031-115-grok-task-2b-local-non-author-browser-co.
Non-author statement: this lane did not author any of these PRs. Per `gh api` in this run, all three PRs are authored by login Uuriko and sit on branches jill/help-f1-ea011-invite-mint-pool (#5501), jill/help-f2-archived-room-freeze (#5502), jill/help-f7-l04c4-closewhenlive (#5503). This lane only executed (attempted) the browser and coverage jobs locally. Unit, contract, lint and cloudflare were NOT run by this lane (Grok's own lane runs those, per the tasking).

## Heads verified at source in this run (gh api repos/Uuriko/project-room/pulls/<n>)

| PR | Cited head (abbrev.) | Current full head verified via gh api | Base |
|---|---|---|---|
| #5501 | d237d22e | d237d22e1ba3360b1e88e8b731f13ba03b46d87e | 1ab906c37b5c5bdfe07f1b12808c8855128a713f |
| #5502 | 106b1bd8 | 106b1bd8dafab9f8ad896372fa605d7a6a0ecf87 | 1ab906c37b5c5bdfe07f1b12808c8855128a713f |
| #5503 | ba3b314c | ba3b314cbca8a009d1cb66741c805a106c870bff | 1ab906c37b5c5bdfe07f1b12808c8855128a713f |

Main in this run: `gh api repos/Uuriko/project-room/git/ref/heads/main` = 1ab906c37b5c5bdfe07f1b12808c8855128a713f (same as every PR base). The cited abbreviated heads match the current full heads; no head had moved.
PR titles at verification: #5501 "fix: EA-011 invite-redemption identities spend the global mint budget"; #5502 "Freeze archived rooms at the registry/write choke point (EA-001, EA2-002, L05-C3)"; #5503 "Fix L04-C4: closeWhenLive only closes held land/deploy claims with a merged pull at the live revision". All three state: open.

Source trees were obtained as GitHub tarballs of the exact head SHAs (gh api repos/Uuriko/project-room/tarball/<full-sha>), gzip-verified after download. Tarball sha256 (provenance only):
- #5501 d237d22e1ba3360b1e88e8b731f13ba03b46d87e: ae5df8757a82d4f5615104e30409e704315ab64637bd312c45dcb6ced384900d
- #5502 106b1bd8dafab9f8ad896372fa605d7a6a0ecf87: fae5b86b5cad605ccf77fb6257f11460e38b1205268bffb0ebe7cec14fb7b12d
- #5503 ba3b314cbca8a009d1cb66741c805a106c870bff: 1570d6fffd24d34f30c332007fc6dc1bed82b6076d7a9b06231ac2690885e142
- main 1ab906c37b5c5bdfe07f1b12808c8855128a713f: fd73bfeca47bcbd4027fa3843d6754b297d03f1048dbb0c9519e8ffd85033a95

All four trees carry identical package.json and package-lock.json (md5 f7196caa3e5798299fca5f27b4139634 for every package-lock.json). Dependencies were installed once with `npm ci` in the #5501 tree (exit 0, "added 106 packages in 11s", 2026-10-31T23:49Z, before the write fault escalated) and the resulting node_modules was verified diff-clean against the #5502 and #5503 trees; the main tree used a symlink to the same node_modules after its own `npm ci` and copy attempts were blocked (below).

## Commands prescribed

- Browser shards, per PR head: `scripts/test-env.sh npm run test:browser:ci -- --shard=N/6` for N=1..6.
- Coverage, per PR head, exactly as defined in .github/workflows/test.yml (job `coverage`, step "Enforce per-module coverage thresholds"): `node scripts/coverage-thresholds.mjs`.

## Result table (per PR, per job)

Every job is NOT-RUN. No job produced a verdict at any head, and NOT-RUN is not folded into green anywhere in this filing. The blockers are platform faults on this VM, reproduced identically at main (classification section below), so no failure here is attributed to any PR's code.

| PR (full head) | browser 1/6 | browser 2/6 | browser 3/6 | browser 4/6 | browser 5/6 | browser 6/6 | coverage |
|---|---|---|---|---|---|---|---|
| #5501 d237d22e1ba3360b1e88e8b731f13ba03b46d87e | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN |
| #5502 106b1bd8dafab9f8ad896372fa605d7a6a0ecf87 | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN |
| #5503 ba3b314cbca8a009d1cb66741c805a106c870bff | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN | NOT-RUN |

## What was actually attempted, per leg (verbatim blockers)

### Browser — prescribed command attempts (shard 1/6 attempted in every tree)

In every tree the prescribed command died inside npm before any test process started, exit 255:

```
npm error code EPERM
npm error syscall write
npm error errno -1
npm error Error: EPERM: operation not permitted, write
npm error     at Object.writeSync (node:fs:977:3)
npm error     at [_write] (/opt/hatch-image/bin/npm-package/node_modules/fs-minipass/lib/index.js:425:12)
npm error     at WriteStreamSync.write (/opt/hatch-image/bin/npm-package/lib/utils/log-file.js:78:25) [via LogFiles.load, /opt/hatch-image/bin/npm-package/lib/npm.js]
```

The same npm failure reproduces in a trivial scratch package (`npm run env` in a directory containing only a one-line package.json, exit 255, same stack), and `npm ci` for the main tree failed the same way (exit 255) after succeeding once at 23:49Z. npm itself cannot write its debug log on this VM in the current episode; `npm --version` (which does not open the log) still works.

### Browser — wrapper entry point attempted directly (same code npm would have run)

`node scripts/browser-ci.mjs --shard=1/6` in each of the #5501, #5502, #5503 and main trees, and `--shard=2/6` in the #5501 tree, all died at the same startup line, before any suite was spawned, exit 1:

```
Error: EPERM: operation not permitted, write
    at writeFileSync (node:fs:2482:20)
    at writeBrowserSelection (file:///.../scripts/browser-ci.mjs:60:3)
    at main (file:///.../scripts/browser-ci.mjs:80:3)
```

The wrapper writes its shard-selection receipt before running any suite, so no shard (1/6 through 6/6) can start on this VM while the write fault stands. Shards 2/6–6/6 were not each attempted via npm in every tree because both entry points fail at the identical shard-independent startup write, demonstrated for shard 1/6 in all four trees and for shard 2/6 in the #5501 tree; they are recorded NOT-RUN, not FAILED.

### Browser — supporting probe (not a job): one suite executed directly

To establish whether the suites themselves could run at all, one shard suite file was executed directly in each tree: `scripts/test-env.sh node --test scripts/a11y-composer-browser-check.mjs`. In all three PR trees and at main it failed identically, within ~10–30 ms, before any browser work:

```
✖ message composer is axe-clean (serious/critical)
  Error: disk I/O error
      at Object.configure (file:///.../server/store.mjs:685:8)
      at new RoomStore (file:///.../server/store.mjs:1609:26)
      at TestContext.<anonymous> (file:///.../scripts/a11y-composer-browser-check.mjs:27:17)
    code: 'ERR_SQLITE_ERROR',
    errcode: 778,
    errstr: 'disk I/O error'
```

This is the sqlite WAL / disk-I/O fault (SQLITE_IOERR 778) named in the wave brief, hitting the room store at open. It is an environment failure, not an assertion failure.

### Coverage — attempts

Command: `node scripts/coverage-thresholds.mjs` (the test.yml coverage job's threshold step; the job's earlier steps are checkout, setup-node, `npm ci`, host-isolation preflight).

- #5501 head: the unit suite started; its early tests failed en masse under the same disk fault (first failing suite: tests for the room-machine bot, e.g. "bot enable stays off until a room is named, and status does not print a key"), and the run then died on the coverage writer, exit 1: `EPERM: Failed to write file /home/hatch/workspace/wave-2026-10-31-grok-dot-tasking/lanes/GD-G2B-scratch/x5501/coverage/coverage-10520-1793490778853-0.json`. No threshold verdict was produced.
- #5502 head: suite started and failed the same way; run was still inside the (environment-broken) suite when stopped at a 100 s local timeout (last line: tests/writer-fence.test.js, "Promise resolution is still pending but the event loop has already resolved"). No threshold verdict was produced.
- #5503 head: same early unit failures as #5501 (identical room-machine bot test names); stopped at a 60 s local timeout with no threshold verdict.
- main 1ab906c3: same early unit failures, identical test names; stopped at a 60 s local timeout with no threshold verdict.

Coverage is therefore NOT-RUN (no verdict reached) at all three heads — not PASSED, and not a code FAILED: the suite cannot complete on this VM while every sqlite-backed test fails on disk I/O and the coverage writer itself is EPERM-blocked.

## Classification (falsifier rule: re-run at main 1ab906c37b5c5bdfe07f1b12808c8855128a713f)

Every failure observed was re-run at main in this same session, with these results:

| Failure | At PR heads | At main 1ab906c3 | Classification |
|---|---|---|---|
| npm EPERM on log write (prescribed browser command, `npm ci`) | exit 255, all trees | exit 255 (also in a trivial scratch package) | PRE-EXISTING / environmental — not introduced by any PR |
| browser-ci.mjs EPERM at writeBrowserSelection (scripts/browser-ci.mjs:60) | exit 1, shards 1/6 (all trees) and 2/6 (#5501) | exit 1, shard 1/6, identical stack | PRE-EXISTING / environmental — not introduced |
| a11y-composer suite: ERR_SQLITE_ERROR errcode 778 at server/store.mjs:685 / :1609 | identical in #5501, #5502, #5503 trees | identical, same file and line numbers | PRE-EXISTING / environmental — not introduced |
| coverage: early unit failures (room-machine bot tests) + no threshold verdict; #5501 also EPERM on coverage file write | #5501, #5502, #5503 | identical early failures, no verdict | PRE-EXISTING / environmental — not introduced |

No failure is classified as introduced by #5501, #5502 or #5503. Equally, no job is classified PASSED: this lane produced no green evidence for any of the three PRs, and the landing decision must not treat this filing as qualification. A re-run on a healthy machine (or via hosted CI) is still required for every cell of the table.

## Environment blockers, verbatim (platform write fault, active this session)

1. npm: `npm error Error: EPERM: operation not permitted, write` at `Object.writeSync (node:fs:977:3)`, via fs-minipass `LogFiles.load` — exit 255 for `npm run` and `npm ci`.
2. node: `Error: EPERM: operation not permitted, write` at `writeFileSync (node:fs:2482:20)`, at `writeBrowserSelection (.../scripts/browser-ci.mjs:60:3)`.
3. sqlite: `code: 'ERR_SQLITE_ERROR', errcode: 778, errstr: 'disk I/O error'` at `Object.configure (.../server/store.mjs:685:8)`.
4. coverage writer: `EPERM: Failed to write file .../coverage/coverage-10520-1793490778853-0.json`.
5. File copy of node_modules into the main tree produced zero-byte files under the same fault (`cp: error writing '...': Operation not permitted`); the main tree instead ran with a symlink to the verified #5501 node_modules (identical package-lock.json in all trees).

Attempts timeline (UTC, 2026-10-31): heads verified via gh api 23:46Z; tarballs downloaded and gzip-verified 23:47–23:48Z; `npm ci` succeeded in the #5501 tree 23:49Z; from ~23:50Z the write fault blocked npm, the browser-ci startup write, sqlite and the coverage writer in every tree including main; classification re-runs at main completed ~23:53–23:59Z.

## Pointers

- Evidence branch: evidence/gd-g2b-5501-5503 (commit and this file's sha256 are stated in the lane filing GD-G2B.md and in the muse-room finish post; the branch carries this file only).
- Scratch (VM-local, provenance only): ~/workspace/wave-2026-10-31-grok-dot-tasking/lanes/GD-G2B-scratch/ with extracted trees x5501, x5502, x5503, xmain and tarballs under dl/.
