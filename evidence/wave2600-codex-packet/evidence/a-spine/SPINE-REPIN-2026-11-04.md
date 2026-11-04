# Spine re-pin at current main — wave-2600 coordinator A

**Verdict: SPINE STILL NOT LANDABLE AS-IS at main `8c9deff7`. Only #5862 is closable now (superseded). #5805 is the only item structurally ready to advance; #5128 and signer #5861 are both CONFLICTING vs current main; #5063 and #5492 cure heads both carry FAILED jobs.**

Pin (verified at source in this run, 2026-11-04T14:23Z–14:4xZ):
- Production `/api/version` (start AND end reads, identical): `sourceRevision 8c9deff7534ed549df88b730c03af2d9d3a11db8`, buildId `2026-11-04T14:11:46.267Z`.
- GitHub main tip: `8c9deff7534ed549df88b730c03af2d9d3a11db8` (2026-11-04T14:09:50Z, "Merge pull request #5918"). Production head = main tip. No flip occurred during this run.
- Evidence: `evidence/` in this directory (raw `gh` JSON per PR, check-runs JSON + latest-per-name TSVs, compare JSONs, PR bodies, bot failure comment), hashed in `evidence/MANIFEST.sha256`. Commands: `gh pr view <n> --json …`, `gh api repos/Uuriko/project-room/pulls/<n>`, `gh api repos/Uuriko/project-room/commits/<head>/check-runs?per_page=100`, `gh api repos/Uuriko/project-room/compare/<head>...8c9deff7…`, `curl -s https://room.trydemigod.com/api/version`.
- CI classification rule: latest check-run per job name at the exact head SHA; success = PASSED, failure/cancelled = FAILED, skipped/neutral = NOT-RUN. NOT-RUN is never green. `ci-verdict` reporting success over skipped/failed jobs is not quoted as green anywhere below.
- Falsifier check: NOT met. Five of six items remain OPEN and unlanded; only #5862 is superseded. This re-pin is therefore live work for the sitting, not zero.

## Per-item re-pin

### 1. PR #5805 — native-room public projection — ADVANCE FIRST
- State: OPEN, **draft**, no labels. Branch `fix/native-public-projection`, head `ecbad3b9266418acb712ba7f88e5c2284043930b` (unchanged). 530 additions / 35 deletions / 14 files (565 lines).
- Conflicts vs current main: **mergeable = true, mergeable_state = clean** (REST read this run). Head is diverged: main 319 commits ahead, head carries 3 unique commits — mergeable despite distance, but the merged result has never been CI-tested.
- CI at exact head (single run generation, 2026-11-03): PASSED: `mechanical`, `safety-net`, `ci-verdict`. FAILED: none. NOT-RUN (all skipped): `browser`, `browser shard`, `changes`, `cloudflare`, `contract`, `coverage`, `friend-agent-e2e`, `full`, `gates`, `lint`, `quarantined-tests`, `schema-gate`, `test`, `unit`, `visual-refresh-guard`.
- **Large-diff justification: still ABSENT.** Grep of the live PR body this run finds no "Large diff justification" section (only an in-line justification for one guard narrowing). At 565 lines vs the 300 threshold, `gates` is predicted to fail on diff size once it actually runs. (Wave-2500 c08 drafted the justification text — 565 lines / 14 files — it has not been filed to the body.)
- Next acts: (a) Jill files the large-diff justification to the PR body; (b) Codex gives the R1 strike-or-confirm and five-condition decisions (c09 packet); (c) Codex un-drafts / marks ready so heavy CI runs at the exact head; (d) land **singly** (shared-core). Owner: Jill (a), Codex (b–d).

### 2. PR #5128 — public proof residuals, as amended — CONFLICTING
- State: OPEN, non-draft, label `ready-to-land` present. Branch `ppr/public-proof-residuals`, head `f2cbdd4a51d6f70f2489d2b0c33cdcd10df7703a` (unchanged). 103 / 10 / 7 files.
- Amendment chain verified live: branch `amend/5128-a8` at `2c1c87641ebfaeea47fec60936234ba5cb89bb0c` = #5128 head + 2 commits (compare: head is ancestor, amend 2 ahead / 0 behind vs head), itself diverged from main.
- Conflicts vs current main: **mergeable = false, mergeable_state = dirty — read twice this run.** Main is 3,049 commits ahead of the head; head carries 2 unique commits. (Wave-2500 c08 conflict surface: `server/http.mjs` vs #5897, errors-catalog mirrors vs #5879, `server/public-work-claims.mjs` vs #5870 — re-confirm file-by-file at merge-up; main has moved since.)
- CI at exact head (Oct 28 runs — stale against current main; proves nothing about the merged result): PASSED: `browser`, `browser shard 1–6`, `changes`, `cloudflare`, `contract`, `gates`, `lint`, `mechanical`, `safety-net`, `schema-gate`, `test`, `unit`, `visual-refresh-guard`. FAILED: none in latest-per-name (earlier generations' cancelled `safety-net`/`test` were superseded). NOT-RUN: `coverage`, `full`, `quarantined-tests` (skipped); Cursor approver neutral.
- Note: its A6 condition precedent is already satisfied in production by #5872 (see #5862 below), not by #5862.
- Next acts: Codex merge-up + conflict resolution on `ppr/public-proof-residuals`, then fast-forward `amend/5128-a8` (`2c1c8764`) onto it, fresh full CI at the new exact head, land **singly** after #5805. Owner: Codex.

### 3. PR #5862 — A6 base-fix — SUPERSEDED, CLOSE AT SITTING (pack prepared, not executed)
- State: OPEN, **draft**, no labels. Branch `fix/a6-fail-closed-intersection`, head `b1849bab00ba7d8e704558d52a2fb00dc7d22cee`. Mergeable = true / clean vs current main (irrelevant — do not land).
- Supersession verified at source this run: PR #5872 state **MERGED**, merged 2026-11-04T03:56:29Z, merge commit `e1fd90587e7acd4c081847eae73f6817220d22c8`, and that commit is an ancestor of current main (compare `e1fd9058...8c9deff7`: main 267 ahead / 0 behind).
- CI at exact head: PASSED: `mechanical`, `safety-net`, `ci-verdict`. FAILED: none. NOT-RUN: all heavy jobs skipped (draft). Not quoted as green; moot once closed.
- Next acts (journal-first, sitting executes — see `CLOSE-PACK-5862.md`): (a) pre-act journal entry, disposition `superseded-by #5872`; (b) close #5862 with that disposition; (c) branch `fix/a6-fail-closed-intersection` deletion as a **separate** journalled act. Owner: Jill prepared the pack; the sitting (Jill/Codex) executes.

### 4. PR #5063 — Board claim permissions, cured — FAILED AT CURE HEAD
- State: OPEN, non-draft, label `ready-to-land` **present**. Branch `jill/ut2-l8-claim-perms`, head `69ab79b0f2b2ebc1dbdeb74dd2708ff89c53c29d` — the pushed cure is the live branch tip (branch read = PR head). Main 3,049 commits ahead; head carries 5 unique commits.
- Conflicts: mergeable = true, mergeable_state = **unstable** (checks failing).
- CI at exact cure head (latest per name): PASSED: `browser`, `browser shard 1–6`, `changes`, `cloudflare`, `contract`, `friend-agent-e2e`, `lint`, `mechanical`, `relay`, `safety-net`, `schema-gate`, `visual-refresh-guard`. **FAILED: `gates`, `test`, `unit`.** NOT-RUN: `coverage`, `full`, `quarantined-tests` (skipped); Cursor approver neutral. (`ci-verdict` says success over three failed jobs — not green, do not quote.)
- The bot-posted failing-test list at this head (2026-11-04T08:16:41Z, filed verbatim at `evidence/pr-5063-unit-failures-comment.txt`) names 9 tests: DC1-A1 ×4 (owner-release copy on claim/update of member-held items, incl. A2 sub-case), "each claim change appends one event…", "handler: review attestations are caller-bound…", "B-9: the matcher sits below the offers workspace…", "[legacy compatibility] audit sequence…", "persistent staging deploys only an explicitly dispatched candidate".
- This is harder than the wave-2500 snapshot (checks were still pending then). Whether these 9 are the D3 pre-cure-model pins, cure regressions, or main-side breakage is **not** decided by this lane.
- Next acts: Codex **D3 disposition first**, naming each of the 9; if pins, a cure update, then fresh CI green at the new exact head; only then land (singly per order). Owner: Codex (D3 + landing), Jill (this evidence).

### 5. PR #5492 — default-room MVP, cured — FAILED safety-net, heavy CI never ran
- State: OPEN, non-draft, label `i18n-growth` only — **`ready-to-land` ABSENT**. Branch `grokbot-mvp-default-room`, head `fc8e8716695476922b01af847bb654570b4bd700` — pushed cure is the live branch tip. Main 2,104 commits ahead; head carries 5 unique commits.
- Conflicts: mergeable = true, mergeable_state = **unstable**.
- CI at exact cure head (latest per name): PASSED: `mechanical` (and `ci-verdict`, over skips — not green). **FAILED: `safety-net`.** NOT-RUN (all skipped): `browser`, `browser shard`, `changes`, `cloudflare`, `contract`, `coverage`, `friend-agent-e2e`, `full`, `gates`, `lint`, `quarantined-tests`, `schema-gate`, `test`, `unit`, `visual-refresh-guard`; Cursor approver neutral.
- Next acts: (a) Codex dispositions the `safety-net` failure at `fc8e8716` — the label act alone no longer suffices; (b) journalled `ready-to-land` label act by Codex (user/App token, never GITHUB_TOKEN); (c) fresh full CI at the exact head with the 13 named jobs showing SUCCESS, never SKIPPED; (d) land after #5063. Owner: Codex.

### 6. PR #5861 — receipt signer Option B — NOW CONFLICTING, lands last, singly
- State: OPEN, **draft**, no labels. Branch `build/receipt-signer-option-b`, head `d9d8df7a22c9c27deb88c2cb82a435cad318fea8` (unchanged, = branch tip). 842 / 26 / 17 files. Body carries its "Large diff justification" section (verified this run).
- Conflicts vs current main: **mergeable = false, mergeable_state = dirty — read twice this run.** This is new since Step 0: the PR was built on `16eaf2b9` and merged up over `e0b8309b` at filing; main is now 270 commits ahead of its head (2 unique commits). Any merge-up done now will drift again before the sitting ends — merge-up belongs at the sitting, immediately before landing.
- CI at exact head (latest per name; two run generations): PASSED: `browser`, `browser shard 1–6`, `cloudflare`, `contract`, `friend-agent-e2e`, `gates`, `lint`, `mechanical`, `quarantined-tests`, `unit`, `visual-refresh-guard`. **FAILED: `coverage`, `test`.** NOT-RUN: `changes`, `full`, `schema-gate` (skipped), `safety-net` and `ci-verdict` (latest instances skipped, superseding the draft generation's successes).
- Standing gates unchanged: money/shared-core, lands singly and last; the stricter landed-only reading (signer does not start over a formally held #5492) keeps it behind #5492; **FREEZE-RULING is John's** when the signer nears landing; no seed exists and seed/arming remain John's post-landing acts; S1 go is John's.
- Next acts: at the sitting only — Codex merge-up + conflict resolution, fresh CI green at the new exact head, non-author recheck + refutation pass at that head, John's FREEZE-RULING, then Codex lands singly. Owner: Codex (merge-up/landing), John (freeze ruling), Jill (recheck).

## Updated landing-sitting order

Gate Zero (before any act): re-read production `/api/version` and main tip. Main is still moving (the other seat's unledgered run was at ~1 flip/hour at last read); **this re-pin is valid only while main = `8c9deff7`** and every head verdict above must be re-confirmed at the sitting's start.

1. **#5862 close** — journal entry (disposition `superseded-by #5872`), close, then branch delete as a separate journalled act. Independent of everything else; do it first. Pack: `CLOSE-PACK-5862.md`. Owner: sitting (Jill/Codex).
2. **#5805** — Jill files large-diff justification → Codex R1 + five-condition decisions → un-draft → heavy CI green at exact head → land singly. Owner: Jill, then Codex.
3. **#5128-as-amended** — Codex merge-up + conflict resolution → FF `amend/5128-a8` (`2c1c8764`) → fresh CI green at new head → land singly. Owner: Codex.
4. **#5063** — Codex D3 disposition on the 9 failing tests at `69ab79b0` → cure update if pins/regressions → fresh CI green → land. Owner: Codex.
5. **#5492** — Codex `safety-net` disposition → journalled `ready-to-land` label act → full CI, 13 named jobs SUCCESS → land. Owner: Codex.
6. **#5861 signer, last and singly** — merge-up at the sitting → fresh CI green at exact head → recheck + refutation → John's FREEZE-RULING → Codex lands. Seed/arming after, John's acts. Owner: Codex / John / Jill.

Nothing in this report merges, deploys, closes, deletes, posts, or sends anything. All bound acts above are prepared only, journal-first at execution.
