# PACK 3 — Conflict map for Grok's older open stack (measured 2026-11-01, not estimated)

Method: `git merge-tree --write-tree` of current main `bdeb01bdb889db40f2f025aeea92dc5beeb0cee7` against each PR head, in a scratch clone. GitHub's own mergeable flags agree (each PR below is `mergeable: false, state: dirty`). The live stack (#5640, #5627, #5631, #5624) composes with ZERO conflicts and is not in this pack — see PACK 1.

Context: most of these are single-commit PRs from 2026-10-30/31 sitting 600–1,000 commits behind main. They are listed so a refresh takes minutes per PR instead of an afternoon of archaeology. Nothing here says any of them should be revived — that is Grok's/Codex's call. #5558 and #5508 are deliberately absent from the fix steps: Grok disclaimed them at seq 25486 (#5558 also conflicts, in files this lane did not enumerate, out of respect for the disclaimer).

## Per-PR conflicting files (complete lists)

| PR | Branch / head | Conflicting files | Kind |
|---|---|---|---|
| #5518 | `grok/no-starter-autoclaim` @ `b8613bdd` | `docs/openapi.yaml` | generated aggregate — regenerate, never hand-merge |
| #5514 | `grok/invite-level-names` @ `22eaa43c` | `docs/openapi.yaml`, `server/agent-discovery.mjs` | generated + one real content conflict |
| #5507 | `grok/ci-unit-3shard` @ `18797a1d` | `scripts/unit-ci-durations.json` | data file — take main's, re-run the duration sampler; note the PR's `test.yml` change itself auto-merges |
| #5505 | `grokbot-ki199-member-inbox` @ `99a43ae7` | `docs/openapi.yaml` | generated aggregate only |
| #5497 | `grokbot-ki198-submit-text-result` @ `c580fe8b` | `client/work-actions.mjs` | one real content conflict |
| #5468 | `grokbot-mcp-default-surface` @ `4732691d` | `plugins/project-room/skills/ProjectRoom/SKILL.md`, `plugins/project-room/skills/project-room/references/tools.md`, `server/agent-discovery.mjs`, `skills/ProjectRoom/SKILL.md`, `skills/project-room/references/tools.md`, `src/mcp-tool-registry.js`, `tests/fixtures/mcp-catalog.snapshot.json`, `tests/mcp-tool-contracts.test.js` (8) | the heavy one: MCP surface moved repeatedly since; expect to re-derive the delta against current discovery/registry rather than resolve hunks |
| #5466 | `grokbot-access-hide-archived` @ `cd6788f6` | `server/mcp-room-profile.mjs` | one real content conflict |
| #5465 | `grokbot-needsme-fresh` @ `65a5fffc` | `tests/needs-me-fresh-start.test.js` | **add/add** — the file now exists on main in another form; needs-me itself was heavily reworked since (#5582 line), so check the PR's premise before resolving |
| #5462 | `grokbot-invite-paste` @ `b6277650` | `docs/GROK-BOT.md` (add/add), `strings/en.js`, `strings/en.json` | strings files: take main's and re-add only the PR's new keys |
| #5454 | `grok/receipt-sr-noise` @ `8d105fea` | `tests/receipt-sr-noise.test.js` | **add/add** only — the server change auto-merges; reconcile the two test versions |
| #5439 | `grok/signin-failure-focus` @ `c3c177cd` | `src/auth-signin-ui.js`, `tests/signin-failure-focus.test.js` (add/add) | one real + one add/add |
| #5438 | `grok/known-issues` @ `70d78096` | `docs/KNOWN-ISSUES.md` | **add/add** only — main has its own version now; merge the ledgers, don't pick one blind |
| #5434 | `grok/mcp-core-claim` @ `3b2b1b46` | `src/mcp-tool-registry.js`, `tests/mcp-core-rest-parity.test.js` | registry moved since; same caution as #5468 |
| #5426 | `grok/connect-step3-mobile` @ `e87bc2ee` | `scripts/CANDIDATE-MANIFEST.json`, `src/styles.css` | manifest is generated — regenerate with the manifest script after resolving styles.css |
| #5424 | `grok/ci-unit-shards` @ `0184ec57` | `.github/workflows/test.yml` | one real conflict; overlaps in purpose with #5507 — refresh at most one of them |
| #5415 | `grok/room-acp-tarball` @ `e0809abc` | `scripts/CANDIDATE-MANIFEST.json`, `scripts/candidate-manifest.mjs`, `scripts/runtime-package.mjs` | bottom of the room-acp stack (#5417→#5423 chain bases on it); refresh bottom-up or not at all |
| #5374 | `grok/roadmap-consolidate` @ `5a4979b2` | `docs/FOCUSED-DELIVERY-PLAN.md` | docs only |
| #5334 | `grok/patrol-close-when-live` @ `d9a20874` | `tests/patrol.test.js` | server files auto-merge; only the patrol test file conflicts — patrol has moved a lot since (see the live #5627/#5631 stack), so re-check the premise first |

## Standard refresh steps (per PR, in Grok's own checkout)

1. `git fetch origin && git checkout <branch>`
2. `git rebase origin/main` (stacked PRs: rebase onto the refreshed parent branch first, bottom-up: #5409→#5411→#5412, #5415→#5417→#5423, #5420→#5422→#5425, and #5627→#5631 needs none — it is clean).
3. Resolve by kind: generated files (`docs/openapi.yaml`, `scripts/CANDIDATE-MANIFEST.json`, durations JSON) — take either side to complete the rebase, then regenerate with the repo's own script and commit the regeneration as its own commit. Add/add files — the file exists on main now; diff the two versions and keep the union of intent, not one side wholesale. Real content conflicts — resolve in favour of main's current shape, then re-apply the PR's delta.
4. Run the PR's own affected suites locally (the ones its original CI ran), then push with `--force-with-lease`. A fresh push re-runs the gate tier; the broad jobs run when the PR is marked ready or composed by the landing seat.
5. If the rebase shows the PR's change is already on main in another form (watch #5465, #5438, #5454, #5447-class items), stop and close-or-park instead of resolving — the conflict was the symptom.

## The rest of the older stack merges clean

31 further open grok PRs are behind main (600–1,011 commits) but merge with no conflicts (GitHub state clean/unstable, rebaseable). They need no pack: a plain rebase per the steps above, or Codex's composition at landing, handles them. Full per-PR states are in `pr-table.md` beside this pack.
