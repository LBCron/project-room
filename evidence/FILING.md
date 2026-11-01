# SA-D4 FILING — Fresh-Android qualification readiness

- Record: `t-20261101-151-sa-d4-fresh-android-qualification-readin`
- Claim: muse-room seq 24693, messageId `25005b11-167a-4c62-b842-98f9cc945a0a` (read back byte-verified in the room tail)
- Source: Dot seq 24683 item 4; Jill ownership reply seq 24686 item 5; John's 2026-10-31 21:01 PT connection-flow order
- Consumer: Dot (and Jill, for the eventual qualification run)
- Deliverable: `TESTER-PACKET.md` in this lane directory, pushed to evidence branch `evidence/sa-d4-android-readiness` (branch, commit SHA, and file sha256 stated in the finish post in muse-room)

## What was produced

1. **Tester packet (Part 1):** Steps 0–10 covering the full flow in order — install the plugin on a fresh Android account → approve the invitation → connect the intended Dot → do useful work → save a result → close the app → receive a request solely through Room → save a reply → reconnect → duplicate delivery handled (no double effect). Each step names its actor (tester / Dot / Jill fleet / Codex / operator), the exact action, the expected observable result, the evidence to capture (named form: screenshot of a named screen, Room-side identifier, receipt identifier where one is issued, run-note line), and the failure signature that stops the run. Written to be executed by a consenting tester without fleet help (a Jill observer only records Room-side evidence).
2. **Revocation steps R1–R4 (Part 2):** revoked invitation, revoked connection, scope reduction, expired invitation — specified only for a separate qualification setup B, never the main run and never John's persistent automation.
3. **Disposable-fixture plan (Part 3):** throwaway account (created and retired by the tester themselves; credentials never shared), device, `qa-android-qual-<date>` room, tester member identity, Dot connection identity, invitation (with the owner-equivalent minting rule named), Work Items 1–2 with nonce strings, and the evidence set — each with creator, creation method, and retirement. Room and identity retirement are named as operator acts for the November operator sweep (precedent: SA-S4 residue, seq 24680). Setup B fixtures are listed separately.
4. **Gate table (Part 4):** 13 gates — CODE C1–C6, BROWSER B1–B2, HUMAN/fresh-account H1–H5 — each with owner and current status cited to a room seq or a wave filing.

## Headline verdict

**CODE gate C1 binds first:** the genuine friend-install route from SA-D1 (Dot item 1 / John item 3). SA-D1 is still IN-FLIGHT (record `t-20261101-148-sa-d1-distribution-packet-gap-closure-in`); until it establishes the route or names the precise missing publisher/account step (gate H2), Step 1 cannot begin for any tester. H1 (a consenting account owner; a named blocker to John if it becomes binding, per seq 24686 item 5) is co-binding immediately behind C1. Owner of C1: SA-D1 lane (Jill fleet), Codex as release owner, H2 publisher/account owner not yet named by SA-D1.

## Grounding and UNVERIFIED items

- Grounded at source in this run: Dot's list (seq 24683, read in full), Jill's ownership reply (seq 24686, read in full), Dot's reproduction source (seq 24687 — request-ID redemption replay, lost-response defect, graceful-stop connection preservation, and her security boundary against installing a global identity secret as a room-scoped credential), SA-D1/SA-D2 STATE.md files, SA-C2's ask to Fo (seq 24694), SA-S4's operator-sweep precedent (seq 24680).
- Marked TO-VERIFY / UNVERIFIED in the packet rather than invented: all Android screens, listing names, and consent prompts; closed-app push/background delivery (C6); work-item duplicate-delivery idempotency on the Android route (C5); the TOML fix's applicability to the Android route (C2); the publisher/account steps (H2, awaiting SA-D1); whether an owner-equivalent invitation is needed (H3); Dot's preflight seq 24646 itself — the room reader available to this lane could not page back to seq 24646 (before-mode reads returned invalid_arguments), so its content is UNVERIFIED here and SA-D1 remains its reviewer of record.
- Hard limits observed: no qualification step was run; no friend enrolled; no account, identity, invitation, or room created; John's persistent automation untouched; no credentials in any file or post; no merges, deploys, closes, or external sends.

## Falsifier self-check

Packet falsifier: "leaves any flow step without an actor, an expected observable result, and a named evidence form, or any prerequisite without a gate class and owner." Check run against the filed packet: 15 step sections (Steps 0–10, R1–R4), every one carrying Actor / Exact action / Expected observable result / Evidence / Failure signature; 13 gates, every one carrying a class (CODE/BROWSER/HUMAN), an owner, and a status with a source or an explicit UNVERIFIED mark. Falsifier not triggered.
