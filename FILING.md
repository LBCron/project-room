# Q5608 FILING — durable pair-delivery recovery qualification for held PRs #5517/#5537

Lane: Jill's #5608 qualification lane, 50-agent wave (John's order, Sun 2026-11-01). Record: seq 25282 commitment (Jill folds a durable-recovery owner into the next consolidated wave); this filing is that wave's evidence. Offline only. Governing spec: ~/workspace/wave-2026-10-31-resolution/lanes/W2-5517-SPEC.md (Root HELD #5517 + dependent #5537 at muse-room seq 24801).

## 1. What #5608 actually is (premise correction, verified at the GitHub API this run)

PR #5608, head 8dec2a0ff9d4cd9b8040394a9e438781aa04e5e6, branch codex/saved-replay-contract-consumer-1101: "Recover saved historical repair prefixes after checkpoint loss." Merged to main 2026-11-01T18:08:16Z, merge commit ef583ba81eeeb284c8b743829aa4a0555752a0e8 (current main head at qualification time). Not deployed; production is 513d3ee8471464803fd3c70dea2fe9ce30f27ad0 (build 2026-11-01T13:39:36.710Z).

Changed files (9): cloudflare/legacy-session-repair.check.mjs, cloudflare/legacy-session-repair.test-fixture.mjs, docs/OPERATOR-LEGACY-MESSAGE-REPAIR.md, docs/research/2026-11-01-legacy-session-backfill-reconciliation.md, server/historical-replay-contract.mjs, server/messages-store.mjs, server/operator-legacy-session-repair.mjs, server/store.mjs, tests/saved-historical-replay-contract.test.mjs.

It contains no pairing code, no delivery recovery, and no encryption key. A census of remote branches found no branch implementing durable pair delivery; the only pairing branches are the two held PRs' own. Conclusion: no Root helper candidate for the #5517 cure exists in code today. The design owner remains Codex per the W2 spec; this lane qualified the spec's sealed-delivery design as a prototype (below), it did not qualify a candidate.

Held heads verified this run: #5517 open/draft at 8fed505ee26687fed451c252bf22b8f46e17b1f1 (jill/w5-fix-pairs-hash); #5537 open/draft at 19c35539e26bfc819c863c85ef19a642ad0794dc (jill/c1-pairs-backfill-migration).

## 2. Defect reproduction (executed this run, fresh clone, spec fixture)

Fixture (tests/q5608-repro.test.js, railed with this filing): pairing start → approve via pairing.decide → RoomStore close() → new RoomStore on the same sqlite file → pairing.poll(pairId, deviceSecret), plus the spec's three companion cases (close/reopen between start and approve; close/reopen between first poll and replay poll; pollHeld headline variant).

- Main ef583ba81eeeb284c8b743829aa4a0555752a0e8 (control): 4 pass / 0 fail. Main does not reproduce the defect.
- PR #5517 head 8fed505ee26687fed451c252bf22b8f46e17b1f1: 1 pass / 3 fail. Headline, replay-after-reopen, and pollHeld cases all throw PairPollError code=expired_token at server/pairing.mjs:450 (the #servePoll buffer-miss throw). Only start→reopen→approve passes, because approval fills the delivery Map in the new process.

This independently re-executes W2's verdict (their pin was main 1ab906c3; the defect and the control both hold at today's heads).

## 3. Sealed-delivery prototype (the spec's design, applied on top of #5517's head)

Since #5608 carries no pairing approach, the lane implemented the design the W2 spec names ("a sealed (encrypted) durable delivery record needs a server-held key") as an offline qualification prototype in a worktree on #5517's head. One file changed, server/pairing.mjs, +99/−3 (diff railed with this filing):

- Approval (#rememberDelivery) additionally persists the delivery {token, identitySecret, replayUntil} as AES-256-GCM ciphertext in an additive table pair_delivery_sealed, only when a key is configured. The pair id is the GCM AAD.
- The key is read from the process environment (PAIR_DELIVERY_KEY, base64 32 bytes) on every use and is never written to the database.
- On a poll buffer miss (#servePoll, hash rows only), the sealed record is unsealed and served if and only if it decrypts under the configured key for this pair id and its replay bound still equals the pair row's replay_until; the buffer is re-populated, so a following replay poll keeps duplicate:true semantics.
- Every failure — no key, no record, bad tag, truncation, stale bound, missing table — returns null and the poll fails closed to the pre-existing expired_token. Seal-write and cleanup failures never break in-process delivery or mask the poll error. Legacy plaintext rows keep the untouched dual-read path.

Results at the prototype head (worktree of 8fed505e + this patch):

- Acceptance repro, key configured: 4 pass / 0 fail — the credential and identity secret survive close/reopen, the delivered token authenticates for the approved member, replay after reopen returns duplicate:true, pollHeld delivers.
- Acceptance repro, NO key configured: 1 pass / 3 fail — byte-for-byte the unpatched behaviour. The cure is entirely gated on the separately held key existing.
- Abuse suite (tests/q5608-abuse.test.js): 8 pass / 0 fail. Wrong key at reopen → expired_token, and the sealed record survives so the right key still recovers afterwards. Truncated payload → expired_token only (no raw crypto error). Tampered ciphertext → expired_token. Sealed record copied onto a different approved pair → expired_token for that pair (AAD binding), the original pair still recovers. No key at reopen → expired_token. No key at approval → nothing sealed, in-process delivery unchanged, reopen unrecoverable. Full database dump of pairs + pair_delivery_sealed contains neither the token nor the identity secret, and the sealed blob does not authenticate (spec falsifier 3 holds in the sealed era). Sealed record whose replay bound no longer matches the pair row → refused.
- #5517's own suite at the prototype head: pairing-credential-storage + pairing-flow + pairing-reconnect + pairing-authz = 16 pass / 0 fail, including the four hash-only falsifiers and legacy dual-read (spec §3 and §6 preserved).

## 4. Gaps (why WITH-GAPS, not clean QUALIFIED-OFFLINE)

1. No candidate exists. #5608 is unrelated (section 1); nobody's branch implements the cure. The prototype is evidence for the design decision, not a landable PR: the recovery design is Codex's to own per the W2 spec, and Jill's fleet should not land a pairing-semantics change unilaterally.
2. Key lifecycle is undecided by design here: the prototype reads one unversioned key from the environment. Rotating it orphans in-window sealed records (they fail closed to expired_token; the agent re-pairs). Whether that is acceptable, or whether key versioning/overlap is required, is part of the platform decision in section 5.
3. The Cloudflare/Worker store path was not exercised; the prototype was qualified on the Node RoomStore only. The pairs store runs in both runtimes, so a landing candidate needs the same suite green on the Worker path.
4. Composition with #5537 was not executed. #5537 only adds files (the backfill migration) and cannot conflict textually; sealed records exist only for post-#5517 approvals, so the interaction risk is low, but it is unproven rather than proven.
5. The additive table is schema-adjacent (CREATE TABLE IF NOT EXISTS, the same pattern as the store's existing additive tables). Under fleet discipline a landing carrying it lands singly with an independent second check; that classification must be named in any candidate PR body.

## 5. What remains John's (verbatim paragraph for the report)

The one piece of this cure that is John's alone is the delivery key itself: a single 32-byte secret that the server holds outside the database (in the production secret store / Worker environment), generated once under his custody, never committed, never stored in the room store, and never present in any backup or export of the database — because the moment the key and the database travel together, the sealed records are plaintext for anyone holding a database copy and the fix re-opens the exact leak PR #5517 closed. Nothing about the key's generation, storage location, rotation, or loss procedure has been decided or touched by this lane: no production key was generated, and the offline qualification used random throwaway test keys inside a local process only. Until John decides where that key lives and who can rotate it, the cure cannot be adopted in production no matter how green the code is — and if the key is ever lost, every in-window sealed delivery fails closed and affected agents simply re-pair, which is the safe direction.

## 6. Disposition

Verdict: QUALIFIED-WITH-GAPS. No PR opened: the cure gap is a missing candidate plus a key-custody decision, not a Jill-side patch — opening one would pre-empt Codex's design ownership and John's gate. Recommendation to the coordinator: the next consolidated wave names Codex as owner of the candidate (the prototype and both suites transfer as its starting evidence), and John's key-custody decision (section 5) is the gate that converts QUALIFIED-WITH-GAPS into a landable cure for #5517, which then unblocks #5537.

Evidence rail: branch evidence/q5608-qualification-1101 (STATE.md, FILING.md, repro + abuse suites, prototype diff). Prototype worktree retained locally at ~/workspace/wave-2026-11-01-fifty/q5608/work/wt-5517 (uncommitted changes; nothing pushed to the PR branch).
