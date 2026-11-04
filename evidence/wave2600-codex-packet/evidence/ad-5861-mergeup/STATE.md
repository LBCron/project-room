FILED — sitting pack complete at ~/workspace/wave-2600-2026-11-04/coordinator-ad-5861-mergeup/SITTING-PACK-5861.md (pin: head d9d8df7a × main 8c9deff7; re-pin at the sitting).

# Coordinator AD — #5861 signer merge-up preparation — CLOSED

- Deliverable: SITTING-PACK-5861.md + evidence/ (24 files, MANIFEST.sha256, all hashes verified).
- Falsifier NOT triggered: at the live re-read, #5861 head still = d9d8df7a (Step 0 head),
  mergeable=false / dirty — still CONFLICTING vs main 8c9deff7.
- Conflict inventory: exactly ONE conflict — scripts/CANDIDATE-MANIFEST.json, one hunk
  (deployment section: cloudflare/package.json, cloudflare/pnpm-lock.yaml, cloudflare/room.mjs
  hash pins). Resolution = regenerate with the repo generator at the merged tree
  (node scripts/candidate-manifest.mjs --write); EXECUTED in a scratch lab: merged room.mjs
  hashes to 7d64fd05…, matching neither side, proving hand-picking either side would be wrong;
  regeneration deterministic, zero drift, storeSchemaVersion 46.
- CONFLICT-CORE: no conflict touches signing/digest/seed code. The manifest pins
  cloudflare/room.mjs, which carries the seed-resolution wiring — hence regeneration-only,
  plus a merged-content re-verification step (R-2) in the pack.
- Auto-merges verified line-exact for all 17 PR files (both intents in room.mjs, store.mjs,
  runtime-package.mjs, both errors-catalog mirrors; the rest byte-exact single-side takes).
  Semantic watch item: PR written at schema 45, merged tree fences at schema 46 — lab suite green.
- CI diagnosis: FAILED coverage (root) + test (aggregator; coverage its sole failing input).
  Root = one test, tests/runtime-package.test.js:408, ENOENT on cloudflare/node_modules —
  a stale-base CI gap main fixed in PR #5916 (80d09b7b, merged 2026-11-04T12:25:29Z).
  At current main coverage = SUCCESS. Not signer-caused. Sitting must still observe coverage
  PASSED at the merged head (rule 25).
- Lab pre-evidence: tests/decision-receipts.test.js 11/11 PASS at lab merged tree 9b20bca8,
  incl. falsifiers (a)–(e) and the inert-default byte-shape test.
- Pack carries the post-merge-up test plan (§5) and the R-1…R-10 recheck + refutation
  checklist (§6) that must complete before the FREEZE-RULING is asked of John.
- No pushes, PR edits, comments, merges on shared branches, deploys, sends, or seed handling.
  Scratch clone + merge lab deleted at close.
- Spend: ~1.2 lane-hours of 6. Closed 2026-11-04.
