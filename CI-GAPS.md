# CI-GAP TABLE — RD-R23 Part B (for Codex's sitting)

Lane RD-R23, record t-20261101-157-rd-r23-ci-gap-table-rechecks-tab-s-five-.
Read in this run (2026-10-31 ~22:10–22:20 PT) at the GitHub API: every
slate PR's current head, all test.yml runs at that head, and the jobs of
each completed run. NO CI was dispatched by this lane (Codex seq 24748
no-duplicate rule). Base set: slate packet §6 + RD-R4 SLATE-PACKET.md —
spine 9 (#5560–#5568) + 40 independent + 9 conditional = 58 PRs (the 2
struck standalones #5494/#5506 are excluded from the set).

## Method / classes

- TERMINAL: at least one completed test.yml run at the current head in
  which every heavy job (unit, lint, contract, coverage, cloudflare,
  browser shards + aggregate, visual-refresh-guard, friend-agent-e2e)
  reached a terminal non-skipped conclusion. A terminal table is not
  green: most of these dispatch runs conclude failure on the main pair /
  coverage; the per-job verdicts live in the cited run.
- LABEL-SKIPPED (the gap): runs exist at the head, but in every run the
  heavy jobs are SKIPPED (label-gated PR pattern) — no terminal heavy
  table exists at that head.
- IN-FLIGHT: a run at the head not yet completed. NEVER-RUN: no test
  run at the head at all.
- HEAD-MOVED: current head differs from the slate packet's pin; both
  heads named.

## Headline

- Slate PRs checked: 58. Lack a terminal heavy-job table: **22**, all
  LABEL-SKIPPED at their gap-read head. IN-FLIGHT: 1 — #5568 only, at
  its newest head (below). NEVER-RUN: 0. HEAD-MOVED: 1 (#5568, moved
  twice during this run, counted inside the 22). Terminal table
  present: 36.

## Amended classes (coordinator note, Root DM seq 24801, Jill seq 24821)

- #5517 @ 8fed505ee26687fed451c252bf22b8f46e17b1f1 — HELD-BY-ROOT
  (executed regression: RoomStore close/reopen between approve and poll
  returns expired_token at this head; main preserves credential +
  identity). Dependent #5537 @ 19c35539e26bfc819c863c85ef19a642ad0794dc
  — HELD-BY-ROOT with it. Both have terminal dispatch tables (below);
  the hold, not CI, governs them.
- #5524 @ 04988047dea18aa598a083386833ae8c190299b7 — COMPOSITION-REVIEW
  (Root's), NOT ready. It has a terminal dispatch table (below); the
  review flag, not CI, governs it.
- Ready set as restated by the note: 36 READY heads composing into
  draft #5568 (note's pin 5f6d38fc83; head has since moved to
  7264b395a987d4bca7476f7d4d4a97622efff153, see the gap row) as the
  single release vehicle; #5561 is not
  to land as a broken intermediate (its own terminal table exists;
  the composition governs).

## The gaps — 22 LABEL-SKIPPED (no terminal heavy table at current head)

| PR | Current head | Evidence run at head | Note |
|---|---|---|---|
| #5512 | 831675fdeb2b6c7c5bf7cfabb791a6bba0c9e167 | PR run 41234958550 (success) | heavy 0/9 terminal, 9 skipped |
| #5519 | 882a47e93b7d4ee036bb3fa3f6e78b8ad8c95b5b | PR run 41236383388 (success) | heavy 0/9, 9 skipped |
| #5520 | 5642ee9dd7030e62eac100dab89ce5d481b09f75 | PR run 41236492156 (success) | heavy 0/9, 9 skipped |
| #5521 | 5e81f469cdcd705e5e42843fb9bc5eef7580dc6a | PR run 41236507477 (success) | heavy 0/9, 9 skipped |
| #5523 | ba19c9872fbe03562f816dcd519aec8ecbe9c180 | PR run 41236648872 (success) | heavy 0/9, 9 skipped |
| #5525 | f64a58c74db588de042a7121c319967bc384d34f | PR run 41236680477 (success) | heavy 0/9, 9 skipped (money-single; packet §4.2 already flags test jobs NOT-RUN) |
| #5527 | d04fa0a2af3a1ab831f8b514ff57d0620b2bbd09 | PR run 41236933133 (success) | heavy 0/9, 9 skipped |
| #5528 | 2672d6054b1ab1eac716e8adbfe7bcce181a7c42 | PR run 41236973342 (success) | heavy 0/9, 9 skipped |
| #5529 | 321e633bd382da95e7667a98077cf36e254ddfaa | PR run 41237038669 (success) | heavy 0/9, 9 skipped |
| #5530 | 05d16f6a4c1c90a09e4b1b98a23ec361f3f8cd64 | PR run 41237091800 (success) | heavy 0/9, 9 skipped (conditional, freeze family) |
| #5532 | 2cb3bab931e85eb2ec20ea73b8a2754d079e2b92 | PR run 41237123058 (success) | heavy 0/9, 9 skipped |
| #5533 | 8f181d403240b7b4305849cc26582c9c2425a0d1 | PR run 41237254980 (success) | heavy 0/9, 9 skipped |
| #5534 | 0ad296f07748812c1a4394cfd1f6f631064c9d41 | PR run 41237351654 (success) | heavy 0/9, 9 skipped (conditional, freeze family) |
| #5535 | 26def764d632ab0095c6d98bbc4019f84297ea80 | PR run 41237378570 (success) | heavy 0/9, 9 skipped (conditional, freeze family) |
| #5556 | 6746e1acf5b9770cf08156ddc8ffa0a3e7d115dc | PR run 41254081940 (success) | heavy 0/9, 9 skipped |
| #5557 | 573bcf431ce6c7eece96646c85b409c19082c188 | PR run 41254344435 (success) | heavy 0/9, 9 skipped (Tab-five PR; fresh local suites in FILING.md) |
| #5563 | 61b55ff937842e25d89cdf0bb3af971c97a3cb89 | PR run 41271055441 (success) | heavy 0/9, 9 skipped (spine; packet §2 blocker 1) |
| #5564 | 535a70fb7d0316dc35b60d4b8a63baef51dcd145 | PR run 41271945312 (success) | heavy 0/9, 9 skipped (spine) |
| #5565 | 9c3f185c39ba73fa2138e9c5dcefd354ea89316e | PR run 41273301287 (success) | heavy 0/9, 9 skipped (spine) |
| #5566 | 4ae8c7bc895d52c3d06786bed0a0168c166e4348 | PR run 41273338560 (success) | heavy 0/9, 9 skipped (spine) |
| #5567 | 9b2003e03e741b4ea646b2ef5c7dad1e21f88c14 | PR run 41273904555 (success) | heavy 0/9, 9 skipped (spine) |
| #5568 | HEAD-MOVED twice in this run: packet 9909bf8b5c978d48607cffadf4e4416f954de1b7 → 5f6d38fc83 (gap-read) → 7264b395a987d4bca7476f7d4d4a97622efff153 (filing-read, draft, mergeable=true) | PR run 41275678521 at 5f6d38fc83 (success, heavy 0/9 skipped); at 7264b395: PR test run 41276359500 (success, label pattern) + workflow_dispatch test run 41276361957 QUEUED | Release vehicle; the queued dispatch at the newest head is the packet §2 blocker-1 run in flight — IN-FLIGHT, not yet a terminal table |

## Terminal table present — 36 (dispatch run at current head, heavy 14/14 terminal)

#5441 (run 41271076413) · #5442 (41271082028) · #5498 (41246557986) ·
#5499 (41246568661) · #5500 (41246576649) · #5501 (41246041935) ·
#5502 (41258016838) · #5503 (41246057963) · #5504 (41256928840) ·
#5515 (41246671021) · #5517 (41247140632, HELD-BY-ROOT) ·
#5524 (41246661237, COMPOSITION-REVIEW) · #5526 (41249392297) ·
#5531 (41249395410) · #5537 (41260945888, HELD-BY-ROOT) ·
#5538 (41247178972) · #5539 (41247129243) · #5540 (41247783142) ·
#5541 (41248567237) · #5542 (41264052655) · #5543 (41250320677) ·
#5544 (41250318342) · #5545 (41261089960) · #5546 (41248991334) ·
#5547 (41265639508) · #5548 (41266698480) · #5549 (41252532678) ·
#5550 (41249884290) · #5551 (41266324512) · #5552 (41263854509) ·
#5553 (41263865123) · #5555 (41259640637) · #5559 (41262730202) ·
#5560 (41271088568) · #5561 (41271090307; composition governs, not a
broken-intermediate landing) · #5562 (41271287073)

All heads above were re-read at the API in this run and match the
slate packet's pins except #5568 (HEAD-MOVED, named). No head in the
independent or conditional sets moved.
