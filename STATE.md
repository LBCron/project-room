# PR #5579 staged recheck — STATE

Verdict: LANDS-WITH-NAMED-RISK (singly, Codex's gate). Two named risks, both executed and bounded below; neither can move money, fabricate a warning, or corrupt state. Everything else reproduces clean at the composed head.

## Binding facts (read at the GitHub API, 2026-11-01)
- PR #5579: open, draft, head e4c98ef8110fd3cc2d49fc749aa3d867b8bbb3a6 (branch jill/res-0003-dispute-openability), recorded base c1c92c5b65fb6c4fbe87e78cddced8496f0ab51c, mergeable=true/clean, 5 files, +230/−16.
- Title: fix(bounties): warn on create/fund/claim when a bounty can never be disputed (RES-0003, RES-0005).
- Main at lane start: ef583ba81eeeb284c8b743829aa4a0555752a0e8 (production also at ef583ba8, build 2026-11-01T18:10:23.342Z).
- Composition: PR head merged onto ef583ba8 in a throwaway worktree, clean, no conflicts. Composed head **53934ffdb7d318bc5a3bad324100594f3481e919**. All 5 PR files byte-identical between PR head and composed head (blob SHAs compared per file) — zero drift in the touched surfaces across the ~20 merges since the PR's base.

## Money-adjacent surfaces touched (from the full diff)
- server/bounty-escrow.mjs: postBounty / fundBounty / claimBounty compute _openabilityWarnings() from the post-act read view INSIDE the act transaction and return a warnings array. Fund locks money; claim locks bond — the warning computation sits on the money path.
- server/bounty-escrow-routes.mjs: HTTP create/fund/claim responses forward warnings (create also charges spend).
- server/mcp-full-profile.mjs: MCP bounty_post / bounty_fund / bounty_claim forward warnings.
- server/bounty-disputability.mjs: new pure derivation undisputableWarnings() beside disputabilityFor.
- tests/bounty-dispute-openability-warnings.test.js: new, 162 lines.
- Other callers checked: server/public-work-settlement.mjs uses only posted.bounty.bountyId — the additive return field is safe there; cloudflare test fixture ignores the field.
- Behaviour change as claimed, confirmed by execution: warning-only; no act refused that wasn't refused before; disputeBounty remains sole authority.

## Tests on the composed tree (TMPDIR on workspace; node --test)
- Targeted — tests/bounty-dispute-openability-warnings.test.js + tests/bounty-disputability.test.js + tests/bounty-disputability-reads.test.js: **21/21 PASSED**.
- Money neighbourhood — tests/bounty-*.test.js + tests/account-deletion-bounty-journal.test.js + tests/public-work-settlement*.test.js + tests/public-work-mcp.test.js + tests/docs-mcp-parity.test.js: **449/449 PASSED, 0 skipped, 0 failed** (same count the PR body claims at its own head, reproduced on the composition).
- Hosted CI at the composed head: **NOT-RUN** (not dispatched by this lane; the PR head's own hosted runs per its body: ci-verdict/safety-net/mechanical PASSED, the rest SKIPPED by path filters). Lint script: NOT-RUN (all four changed modules are executed under the suites above).

## Adversarial pass (executed on BOTH the composed tree and a pure-main ef583ba8 tree; scripts adversarial.mjs + rollback-check.mjs beside this file; raw outputs adv-composed.json / adv-main.json)

### Read-error
- Membership source hard down (roomAuthority always throws): postBounty fails IDENTICALLY on both trees (same error, 0 bounty rows, journal = genesis rows only). The acts already depended on this source; no new failure mode.
- Flaky source (succeeds N calls, then throws), swept N=0..60: post succeeds at N≥4 on main, N≥5 on composed; fund N≥4 main / N≥5 composed; claim N≥5 main / N≥6 composed. Delta is EXACTLY ONE extra roomAuthority read per act — the _openabilityWarnings → memberLaneIds call.
- Rollback at the composed tree's new failure points (rollback-check.mjs): post @N=4 throws with 0 bounty rows and journal unchanged (genesis only); fund @N=4 throws with the bounty still `proposed` and journal unchanged (no partial lock); claim @N=5 throws with the bounty still `funded` and journal unchanged (no bond locked). verifyConservation ok=true after every failure. Main-tree controls at the same thresholds succeed, confirming the delta is the single added read and that its failure is atomic and fail-closed.

### Unknown-value (pure derivation, composed tree; the export does not exist pre-fix)
13/13 cases executed, no throws:
- Each closed reason maps to its correct text: no_decider_named, verifier_is_poster (the fallthrough — the reason enumeration in disputabilityFor is closed at exactly 3, read in source), verifier_is_executor (and the executor warning correctly beats the pair leg when both apply).
- disputeDecider overrides a poster verifier → disputable, no warning (matches disputeBounty's own ?? composition).
- memberLanes non-array (string) → pair leg skipped, never guessed, as documented.
- claimant = "" → pair leg skipped (empty-string claimant is not a persistable state; claimants are validated lanes).
- verifier = 0 → treated as no designation (consistent with disputabilityFor's falsy handling).
- disputeDecider = 42 (non-string) → passes through as designated, disputable, no crash (not writable through postBounty's lane validation; derivation consistent with the pre-existing read field).
- Designated decider not a room member (3-lane room) → no warning; this is the derivation's documented posting-config scope — dispute-time gates may still refuse — and matches the pre-existing disputabilityFor read field exactly. Not introduced by this PR.
- Empty input {} → no-decider warning; memberLanes [null, undefined] → no crash, no warning.

### One-bad-row (members map mutations, pair configuration, through real postBounty acts)
- Null member row: skipped by the projector; pair warning FIRES. Correct.
- Inactive third member (active: false): excluded; pair warning FIRES. Correct.
- Corrupt string member row ("corrupt-string-row" as a member value): counted as an active lane by memberLaneIds → 3 lanes → pair warning SUPPRESSED on the composed tree (act succeeds, conservation true). Main tree has no warning surface at all, so the composed behaviour degrades to the pre-fix silence — never a fabricated warning, never a money effect.
- Member row with active: "false" (string): same suppression (the projector's pre-existing `active !== false` semantics counts it active).
- Own enumerable "__proto__" member key (map built by JSON.parse): counted as a third lane → same suppression; act succeeds; no prototype pollution observed in the act path.
- Member row whose `active` is a throwing getter: fails at GENESIS identically on BOTH trees — ensureGenesis already enumerates the members map pre-fix; not a surface this PR adds.

### Equivalence
Full lifecycle (post → fund → claim → submit → accept → dispute attempt) executed on both trees: step outcomes identical (dispute refused dispute_unavailable for the default bounty on both), conservation exact on both; the only delta is the warnings array (1 warning at post on composed, field absent on main).

## Named risks (the reason for the grade)
1. **One added read on the money path.** Each of post/fund/claim gains exactly one roomAuthority read inside the act transaction. If that single read fails after the act's own validations passed, the act fails where pre-fix it succeeded. Proven bound: the failure is atomic (full rollback, zero partial journal movement, state unchanged, conservation exact), i.e. a refused act, never a silent money change. Production roomAuthority reads the same store the transaction writes through, so the triggering condition (source serves every validation read and write, fails on the final read) has no realistic production shape; the class is the same one every act in this module already carries 4–6 times.
2. **Pair-warning suppression by junk member rows.** The two-member warning is silently absent if the members map carries any extra counted lane (corrupt string row, string-"false" active, own __proto__ row). Bound: silence only, on an advisory warning; the no-decider / executor / poster warnings do not consult member rows and are unaffected; the counting rule is the pre-existing canonical projector memberLaneIds (shared with the reputation path), which this PR consumes rather than redefines; rows of those shapes are outside the store's own member-record invariants.

## Landing shape
Singly, at Codex's gate, green-at-head re-run on the landing head as usual. PR itself untouched by this lane (no pushes, no edits). Evidence railed: branch evidence/rc5579-recheck-1101 (STATE + both scripts + both raw adversarial outputs).
