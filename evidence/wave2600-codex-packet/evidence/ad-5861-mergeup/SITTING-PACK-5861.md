# SITTING PACK — PR #5861 receipt signer merge-up

**Prepared by coordinator AD (wave-2600), 2026-11-04. Read-only lane: nothing was pushed, posted, or edited on GitHub.**
**Pin: PR head `d9d8df7a22c9c27deb88c2cb82a435cad318fea8` × main `8c9deff7534ed549df88b730c03af2d9d3a11db8`. If either has moved at the sitting, re-pin before acting — the conflict inventory below is exact only at this pin.**

PR: [#5861](https://github.com/Uuriko/project-room/pull/5861) "Receipt signer Option B: signed pre-execution decisions, digest-bound outcomes", draft, branch `build/receipt-signer-option-b`, base recorded at `e0b8309b` (main is 270 commits ahead of the base).

---

## 1. Verdict for the sitting

The merge-up is **one conflict in one generated file**, resolvable mechanically by regenerating that file at the merged tree — a resolution this lane **executed and verified in a scratch lab** (merged lab commit `9b20bca845dd6a888ebad2efa96427100daf43a1`). Every other PR file auto-merges with both intents intact, verified line-by-line. The two FAILED CI jobs at the current head trace to a single stale-base CI gap that main has already fixed (PR #5916); they are not signer defects. The signer's own test suite passes **11/11 at the lab merged tree**, including all five falsifiers and the inert-default byte-shape test, under main's schema 46.

Nothing in this pack touches the seed. The seed step remains John's separate operator act after landing; the FREEZE-RULING is asked only after §6's checklist completes.

## 2. Conflict inventory (complete — exactly one)

Merge attempted in the lab: `git merge --no-commit --no-ff 8c9deff7` from head `d9d8df7a`. Result: **one content conflict, one hunk**; all other files merged clean.

### C-1 — `scripts/CANDIDATE-MANIFEST.json`, `"deployment"` section (working-copy lines 199–207)

The manifest pins `sha256:` hashes of deployment files. Three adjacent entries conflict:

| Entry | Base | PR head (ours) | Main (theirs) |
|---|---|---|---|
| `cloudflare/package.json` | `7c40c07e…` | `7c40c07e…` (unchanged) | `1280e808…` |
| `cloudflare/pnpm-lock.yaml` | `ccd56c35…` | `ccd56c35…` (unchanged) | `647852b1…` |
| `cloudflare/room.mjs` | `6826917c…` | `2b505a66…` | `c5656735…` |

- The PR changed only the `room.mjs` line (its +2/−1 signer wiring in `cloudflare/room.mjs`); the other two lines are base values pulled into the conflict block by adjacency.
- Main changed all three: `room.mjs` via PR #5905 (commit `67240d68`, wake adapters) and PR #5730 (commit `a8a1ce42`, lobby-link routing); the package/lock pair with them; main's manifest itself was last refreshed by PR #5917 (commit `18825315`).
- **Neither side's text can be taken.** The merged `cloudflare/room.mjs` hashes to `7d64fd059957accf09dc89f85687f5dc2fa07eaf5774f98ff97c4d705ee8552a` — neither `2b505a66…` nor `c5656735…`. (The merged `package.json` and `pnpm-lock.yaml` do equal main's values, `1280e808…` / `647852b1…`, because those files come from main unchanged.)

**Resolution (MECHANICAL — executed in the lab):** do not hand-pick hashes. At the merged tree run the repo's own generator:

```
node scripts/candidate-manifest.mjs --write
```

Lab result: `froze scripts/CANDIDATE-MANIFEST.json: schema 46, 185 assets, 9 deployment files`; the `room.mjs` pin became `7d64fd05…` (the merged bytes); a fresh `buildCandidateManifest()` rebuild compared **equal** to the regenerated file (deterministic, zero drift — the same check `scripts/verify-preflight.mjs` performs). Regeneration also re-pins `storeSchemaVersion` from the merged `server/writer-fence.mjs` (= 46) and every other entry against the merged tree, which hand-resolution cannot do.

**CONFLICT-CORE assessment:** the conflicted *text* is a hash list — it contains no signing, digest-binding, or seed code, and no resolution choice can alter signer behaviour. It is flagged here, not as core code, but because one pinned file, `cloudflare/room.mjs`, **carries the seed-resolution wiring** (`receiptSignerFromEnv(env)` passed into `RoomStore`). That is precisely why the resolution must be regeneration from the merged bytes rather than a hand-picked side: picking either side would pin a hash that does not match the shipped worker. The sitting additionally re-verifies the merged `room.mjs` content itself (§6, item R-2).

### Auto-merged files — both intents verified

Merged-tree file vs each parent was diffed for all 17 PR files (evidence: `merged-tree-file-diffs.txt`). Single-side takes are byte-exact. The four two-side files:

- `cloudflare/room.mjs` — merged vs main differs **only** by the PR's two signer lines (import + `receiptSigner: receiptSignerFromEnv(env)`); merged vs head differs **only** by main's two wake-adapter lines (PR #5905). Nothing else moved.
- `server/store.mjs` — merged carries the PR's signer wiring exactly (+12/−2: `receiptSigner` option defaulting to `receiptSignerFromEnv(process.env)`, `this.receiptSigner`, passed into `BountyEscrow`) alongside main's +9/−2. **Schema note (the sitting's one semantic check):** the PR was written at `STORE_SCHEMA_VERSION` 45; main is at **46** and the merged tree fences at 46. The PR adds no schema objects of its own (no migration, no new table — wiring only), and the lab ran the signer's suite green at the merged tree under v46 (§4). If the sitting's re-run differs, stop — that is a defect, not a merge artefact.
- `scripts/runtime-package.mjs` — PR's registration line for `server/decision-receipts.mjs` present alongside main's +17/−2. (Rule-21 registration also lands via `scripts/candidate-runtime-fixture.mjs`, PR-only take, byte-exact.)
- Both `errors-catalog.md` mirrors — main's +13 lines and the PR's one new row (`invalid_decision`) both present.

## 3. CI diagnosis at the current head (run 41789458380)

Run: workflow `test`, `workflow_dispatch` on the branch at `d9d8df7a`, 2026-11-04T07:02:03Z — it tests the branch head itself. Full detail: `evidence/ci-diagnosis.md`.

- **FAILED: `coverage`** (root) and **`test`** (the aggregator job; its tally shows COVERAGE as the sole failing input — every other job success, safety-net skipped). All remaining jobs: PASSED or SKIPPED — none other FAILED.
- Root failure is exactly **one test**: `tests/runtime-package.test.js:408` "verified offline archive runs the actual Native durable restore qualification" — `ENOENT … lstat '…/cloudflare/node_modules'` at test line 424, because the coverage job at the PR's base never installed that directory. (The log's other ✖, `tests/fixtures/unit-ci/fail-probe.mjs`, is an intentional fixture inside a passing harness test — not a failure. The coverage thresholds were never evaluated; there is no coverage-shortfall finding.)
- **Not head-caused; would not fail at current main.** Main fixed the gap in **PR #5916** (commit `80d09b7b`, merged 2026-11-04T12:25:29Z — after the head run): the coverage job now installs the locked Native archive dependencies. At main `8c9deff7`, `coverage` = **success** (2026-11-04T14:10:12Z) and `test` = success.
- Rule 25 still binds the sitting: this history explains the red; it does not clear it. Coverage must be observed PASSED at the merged tree's exact head (§5).

## 4. Lab pre-evidence (scratch only — the sitting re-runs everything at its own head)

Lab merged tree `9b20bca8` (head × main at the pin above, manifest regenerated):

- `node --test tests/decision-receipts.test.js` → **11/11 PASS, 0 fail** (output: `evidence/lab-decision-receipts-test-output.txt`). The suite is the signer's own: genuine pair control · outcome-alone control · falsifier (a) fabricated outcome with a copied decision signature · (b) attacker-key pair · (c) replayed pair (single-use) · (d) amount/target altered after signing · (e) unbound outcome presented as a pair · env surface (unset/blank seed inert, invalid seed throws) · keeper-path end-to-end pairs · **inert default: unarmed escrow returns `signed: []`, byte-for-byte the old shape**.
- Manifest regeneration deterministic and drift-free (§2).

## 5. Post-merge-up test plan (at the sitting's merged tree, exact head)

PASS means: every job below named **PASSED** in the same run that reports it; NOT-RUN or SKIPPED is never folded into green (rule 25).

1. **Full CI on the merged head** (the `test` workflow, dispatched on the branch after merge-up + manifest regeneration are pushed by the sitting's owner): required PASSED — `mechanical`, `lint`, `unit`, `contract`, `browser` (all shards), `cloudflare`, `safety-net`, `schema-gate`, `gates`, `coverage`, and the aggregator `test` / `ci-verdict`. `coverage` is the named watch item: it must run (not skip) and PASS — its PASS at the merged tree is what closes §3.
2. **Signer suite locally or in CI at the merged tree:** `node --test tests/decision-receipts.test.js` → 11/11 PASS, 0 fail (lab baseline §4).
3. **Neighbouring money suites:** the bounty escrow / receipts suites that import the touched modules (`server/bounty-escrow.mjs`, `server/bounty-receipts.mjs`, `server/store.mjs`) — green, as covered by `unit`/`full` above; any failure in a decision/escrow/receipt test is a stop, not a footnote.
4. **Manifest drift check:** `node scripts/verify-preflight.mjs` (or a generator rebuild diff) → zero drift at the merged tree.
5. **Runtime-package qualification:** `tests/runtime-package.test.js` green inside the coverage/unit runs — including "verified offline archive runs the actual Native durable restore qualification", the test that was red for the stale-base reason.

## 6. Recheck + refutation checklist — all items complete BEFORE the FREEZE-RULING is asked of John

Non-author recheck (Jill) at the sitting's exact merged head; D-A refutation battery against each decisive claim:

- **R-1 Re-pin.** Main tip and PR head re-read live at the sitting. If either moved since this pack, the merge-up is redone and §§2–4 re-derived — no inherited verdicts.
- **R-2 Merged-content diffs.** For `cloudflare/room.mjs` and `server/store.mjs`: merged vs main shows only the PR's lines; merged vs head shows only main's lines (the §2 patterns). Any extra delta is a stop.
- **R-3 Manifest.** Regenerated (never hand-edited); drift check zero; `storeSchemaVersion` in the manifest equals `STORE_SCHEMA_VERSION` in the merged `server/writer-fence.mjs`.
- **R-4 Inert-default proof (reachable production path).** With no seed configured, an escrow transition returns `signed: []` and no decision key, byte-for-byte the pre-signer shape — the suite's inert-default test at the merged head, plus the env-surface test (blank seed inert, malformed seed throws). This is the claim the freeze decision rests on: landing the build changes no production behaviour until a separate arming act.
- **R-5 Refutation battery (from the suite, re-executed, not quoted):** falsifiers (a)–(e) of §4 each fail closed at the merged head — fabricated outcome with copied signature, attacker key, replay, post-signing alteration, unbound outcome. A single unexpected PASS anywhere in (a)–(e) flips the verdict to DEFECT and the item does not proceed.
- **R-6 Digest binding spot-check.** One genuine pair from the keeper path verifies; the same outcome with one byte of the decision altered does not.
- **R-7 Schema-46 behaviour.** Signer suite green under the merged v46 fence (R-5's run is this run); the runtime-package schema assertions (now `STORE_SCHEMA_VERSION`-relative at main) green in CI.
- **R-8 No-seed-handling audit.** The merge-up diff contains no seed value, no env file with a secret, and no seed generation step. `ROOM_RECEIPT_SIGNER_SEED` appears only as the env *name* the code reads. (This pack and its evidence were produced without any seed handling.)
- **R-9 CI verdict at exact head.** §5 item 1 complete with each job named PASSED / FAILED / NOT-RUN; any FAILED or unexplained NOT-RUN stops the sitting.
- **R-10 Named risk carried, not cured:** signed decisions never expire (the standing named risk from the #5861 recheck, filed with the persistence follow-on). It is restated to John with the FREEZE-RULING ask, not silently carried.

Only with R-1…R-10 complete does the sitting put the FREEZE-RULING to John: whether his merge/deploy order covers this freeze-class signer flip. The seed and arming remain separate operator acts after landing, in that order, neither bundled into the landing.

## 7. Evidence index (this lane's workdir, `evidence/`)

- `step1-live-read.txt` — live main tip + PR record at the pin.
- `ci-head-d9d8df7a.txt`, `ci-failed-runs.txt`, `ci-failed-annotations.txt`, `ci-run-meta.txt` — CI record.
- `ci-test-job.log`, `ci-coverage-job.log` (+ `ci-coverage-clean.txt`) — full job logs for run 41789458380.
- `ci-diagnosis.md` — the §3 diagnosis in full.
- `test-yml-head-vs-main.diff` — the single coverage-job hunk main gained (PR #5916).
- `pr5861-files.txt`, `pr5861-full.diff` — the PR's 17 files and full diff.
- `conflict-manifest-hunks.txt` — the C-1 hunk in all three stages.
- `merged-tree-file-diffs.txt` — per-file merged vs head / vs main table.
- `main-side-overlap-commits.txt` — main-side attribution for overlapped files.
- `lab-merge-log.txt`, `lab-regenerated-manifest.json`, `lab-decision-receipts-test-output.txt` — the lab merge, its regenerated manifest, and the 11/11 suite output.
- `MANIFEST.sha256` — hashes of the above.

Scratch (the local clone and merge lab) was deleted at close; the lab merged commit `9b20bca8` exists only as the recorded provenance above — the sitting reproduces the merge from the two pinned parents.
