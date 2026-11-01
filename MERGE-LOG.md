# MERGE-LOG — W0-MERGE audit trail

Lane record t-20261101-167-w0-merge-deduplicated-consolidated-ledge · Programme t-20261101-158-total-resolution-programme-resolve-all-i.

## Merges applied (16)

| ledger id | kept source | absorbed sources | rule | basis |
|---|---|---|---|---|
| RES-0813 | MI-067 | MI-067-RESIDUE | 4 | EX-A header + task directive: MI-067-RESIDUE is the residue act of MI-067, filed as its own §8c row; merger may fold. |
| RES-0304 | EA2-001 | EA2-001 / D06-C3 | 1 | Identical defect id EA2-001 in both extracts (rule 1), corroborated by task-named rule-4 pair D06-C3/T03 ↔ EA2-001: same decideDispute timeout-gate defect, same carrier PR #5498. |
| RES-1395 | CHANGE 7 | K07-B-06 | 4 | Task-named rule-4 pair: identical anchor server/fee-credit-ledger.mjs expiry boundary; K07-B-06 statement names itself "(the CHANGE 7 question, suite side)". |
| RES-0299 | D05-C1 | EA-005; EA2-003 | 4 | D05-C1 statement carries the explicit cross-reference "(known EA-005 / EA2-003)" and restates both legs (acceptWork + rejectWork deadline gate) as one behaviour, one carrier PR #5500. |
| RES-0141 | T2-L05a-C1 | X05-C2 | 4 | X05-C2 location/statement: "(also X14-C2; known T2-L05a-C1)" — same webhook fan-out DM-fence defect (edit leg + follow-up leg), X14-C2 already collapsed into X05-C2 inside EX-C. |
| RES-0121 | L05-C1 | C03; C04-F4 | 3 | Same anchor (integrity counts+lengths checksum, server/store.mjs) + same failure in substance: C03 is the executed multi-field evidence of "L05-C1 blindness"; C04-F4 is a padding-row bypass of the same count+length+sequence sums. Same carrier family PR #5506. C02-1 (load-path projection adoption, "extends") considered and NOT merged — distinct mechanism. |
| RES-0120 | L04-C4 | R06-C1 | 3 | Same anchor (closeWhenLive) + same failure (claims moved to done outside the claim/delivery/review path) + same carrier PR #5503; R06-C1 is the projection face of the same defect ("new angle on L04-C4"). |
| RES-0129 | L07-C3 | A06-NEW-1 | 3 | Same anchor (parseInvite origin binding) + same failure (redemption POST relocatable to a non-issuer origin); A06-NEW-1 enumerates further forms of the identical missing check ("extends L07-C3"). |
| RES-0132 | L09-C4 | A10-EXP-C | 4 | A10-EXP-C statement carries the explicit cross-reference "(L09-C4 executed)": client RoomClientError retention of the same unbounded server-supplied next[] command text. |
| RES-0188 | L04-C8 | T2-L04b-C1; X11-B3 | 4 | T2-L04b-C1 is the "EXECUTED state-change of L04-C8" (rule 4) — the precise form of the same needs-me residual, same carrier PR #5441. X11-B3 joins under rule 3: same anchor (needs-me delivered-no-PR cell), same failure (delivered-without-PR claim never surfaces), same carrier PR #5441 (Flip-B). |
| RES-1252 | EA-006 | L04-C1 | 4 | Pass-through row L04-C1 statement: "filed as duplicate of EA-006 (graded in F-07, FOLD → #5504)"; §3 names EA-006/EA-007 duplicates L04-C1/L04-C2. |
| RES-1253 | EA-007 | L04-C2 | 4 | Pass-through row L04-C2 statement: "filed as duplicate of EA-007 (graded in F-07, FOLD → #5504)". |
| RES-1254 | EA-011 | T2-L02b-C4 | 4 | Pass-through row T2-L02b-C4 statement: "DUPLICATE-OF EA-011 (graded in F-07, FOLD → #5501)". |
| RES-0180 | MI-511 | L02-C5; A04-NEW-1 | 4 | L02-C5 declares itself the "residual of MI-511" (rule 4): talk-policy seeding — link() and both access-request admission paths never seed, agents wakeable by anyone. A04-NEW-1 joins under rule 3: same failure stated as the producer census (only 3 of ≥8 admission producers seed; link/member.added agents born wakeable by any room member). |
| RES-0006 | F-S2a-2 | D05-C2; K07-B-03 | 4 | D05-C2 cites "(register row 5; suite side K07-B-03)" — REGISTER row 5 is F-S2a-2; K07-B-03 states "(same defect as D05-C2, suite side)". One defect: acceptWork pays despite a stored citation verdict of "fail". |
| RES-0722 | EA2-009 | T01-C1 | 3 | Same anchor (fundBounty, server/bounty-escrow.mjs) + same failure (no deadline gate; poster-vs-keeper race decides). Carriers differ (#5500 conditional vs #5525) — unioned. |

## Reconciliation arithmetic

- Total in: 1,556 extract rows (EX-A 691 + EX-B 533 + EX-C 332).
- Absorbed in merges: 21 rows (EX-A 1 · EX-B 7 · EX-C 13).
- Ledger rows from extracts: 1,556 − 21 = 1,535. Plus 1 standalone row (PR #5537 data-half, added under the coordinator pre-set because no extract row carries #5537) = **1536 ledger rows**.
- Per-extract accounting (extract rows = ledger rows whose kept member is from that extract + absorbed rows from that extract): EX-A 691 = 690 kept + 1 absorbed · EX-B 533 = 526 kept + 7 absorbed · EX-C 332 = 319 kept + 13 absorbed. Each extract closes exactly.

## Pre-set dispositions applied

- HYG-5 → FIXED-STAGED (carrier rewritten per directive): 1
- HYG-6 → DELETED (journal jrn-000251): 1
- HYG-1..HYG-4 → owner "W4 lanes (resolution programme)": 4
- REGISTER closed-by-executed-retest rows (17, 18, 19, 20, 31, 32, 53, 61, 67, 68, 69, 85, 121) → RESOLVED-NOT-REPRODUCED: 13
- Sole-carrier PR #5517 rows → BLOCKED-WITH-NAMED-OWNER (Root hold, seq 24801): 2 (includes F-Q05-2, which is also one of the 8 UNPARSED rows; the carrier hold was applied over the UNPARSED default disposition because the steering names #5517 rows explicitly)
- Standalone PR #5537 row added at the end of the FIX block → BLOCKED-WITH-NAMED-OWNER: 1
- Sole-carrier PR #5524 row (X12-2) → BLOCKED-WITH-NAMED-OWNER (Root composition review): 1
- PR #4900 row (MI-504) → DELETED with the Thu 2026-11-05 close-act owner note: 1
- PR #4951 own-account rows (MI-402, MI-437) → BLOCKED-WITH-NAMED-OWNER (Jill PARK ruling): 2. CP row C-20 (merge-queue cluster) was considered under this pre-set and left a GATE row owned by John: its subject is the change-programme cluster act, and unlike MI-402/MI-437 it carries no "subject #4951" marker.
- PR #5125 own-account row (MI-536) → BLOCKED-WITH-NAMED-OWNER (bound, ledger row only): 1
- T2-L04c-C3 → DELETED (probe-settlement strike): 1
- Probe-settlement kill flags appended to location (T2-L04b-C6, T2-L09c-C7, T2-L10c-C2): 3
- EX-C UNPARSED rows carried through as their own ledger rows with the UNPARSED pointer kept: 8
- DEEPER §6 unaudited-venue GATE-DEPENDENT rows (DEEPER-§6a, DEEPER-§6b, DEEPER-§6d, and K03-C2, into which the §6 herdr item was collapsed inside EX-C) → owner "John (venue/scope decision)": 4
- GATE rows → owner John: 128 · owner Codex (L08-C3, T2-L10b-C10): 2

## Considered and NOT merged (auditable under-merges)

- C02-1 (EX-C) vs L05-C1: "extends" — load-path projection adoption is a distinct mechanism from the checksum blindness; kept separate.
- R07-C1 (EX-C) vs L01-C1: "extension" — wrong-attribution face of history() lot grouping vs the fee-omission face; distinct failures, kept separate.
- T3-L10f-C5 / EA-002 (EX-B) vs MI-532: MI-532 is the SIMPLIFY build-set bundle row, not the journal-duplication or catalog-drift defect itself (the F-02 "DUPLICATE-OF MI-532" label is flagged as a label conflict inside the extract itself); kept separate.
- L05-C6 and T2-L05b-C1 (EX-B) vs MI-066 / MI-514: write-side mechanism and consumer-side completion of the mirror-drift family; MI-066 (page gate) and MI-514 (settled-lot read) are distinct defects; kept separate.
- Q03-#5501 vs EA-011 and Q06 named risks vs T2-L04a-C5 / L08-C5: wave-7 queue rows grade landing risk on PRs; they are not restatements of the defects; kept separate.
- REG F-S3a-3 / F-S3b-3 aliases "HELP-UT C04-F4" / "HELP-UT C08-F3": HELP-UT numbering collides with wave-7 chaos ids C04-F4 / C08-F3 but the statements describe different defects (redeem claim path; invite code-in-URL) — NOT merged with the EX-C chaos rows.
- 12 of the 15 AP1 pass-through duplicate rows name no target inside the extracts (only L04-C1→EA-006, L04-C2→EA-007, T2-L02b-C4→EA-011 name theirs and were merged); the unnamed 12, including EA2-006, are carried as their own ledger rows.
- Archived-freeze family (PR #5502) and journal-duplication family (PR #5432) rows: each row is a distinct surface/file; family membership is not identity; kept separate.
- Integrity sibling comparators T3-L10d-C8 (compareRoomHomes), T2-L05b-C2 (messages-parity), T2-L05d-C5 (replay snapshot digest): distinct comparators from L05-C1's store checksum; kept separate.
- T2-L10g-C2/C3/C4 vs MI-503 (re-filed): three distinct opportunities-feed defects overlapping one programme item; kept separate.
- L05-C3 vs EA-001 / EA2-002: family statement vs two specific archived-room surfaces (Board claim; bounty create/fund); kept separate.
