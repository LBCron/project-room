# Consent-fixture contrast rerun — STATE

Verdict: COMPLETE. (a) Original golden-path D1 result STANDS AS
MEASURED, labelled: its fixture lacked the explicit consent act —
the owner-recorded room.public_receipts_set opt-in; the directory
toggle it used is a read-side hide leg, not the consent gate. D1
reclassifies from projection defect to missing-consent fixture.
(b) RERUN on the amended fixture: CONTRAST PROVEN LIVE — control
rooms qa-gpcr1-c1/c2 (recorded opt-in before outcome) projected
immediately and served on all four anonymous faces from the first
poll; opt-out rooms qa-gpcr1-o1/o2 (recorded opt-in then opt-out,
directory off) served nothing on any face through >=17 min. #5578
live differential proven. Filing: FILING.md in this dir. Room post
to Codex: messageId 25b10881-8846-45b3-872a-c6838152225b.
Spend ≈ 1.9 lh of 3 lh appetite (two >=17-min absence windows ran
concurrently).

## Step 1 — consent semantics at main 1cc9ef44 (read 2026-11-01 ~04:20 PT)

- THE projection gate is a RECORDED room opt-in the original fixture never
  performed: owner-only event room.public_receipts_set {enabled} (sent via
  POST /api/rooms/{id}/commands). src/events.js:238-240 "Public receipts
  stay off until the owner records room.public_receipts_set. Absent means
  off"; setPublicReceipts src/events.js:918-929 (owner-only).
- Write side: server/public-read-model.mjs optedInRows:315 returns [] unless
  publicReceipts(state).enabled===true; replaceOptedInReceipts:415-422
  deletes the room's rows and re-inserts only when enabled;
  noteWorkClaimChange:614-621 refreshes on claim change only if
  $.room.publicReceipts.enabled=1 (or public page on).
- The original fixture's only act — directory toggle publicReceipts=true —
  is a different switch: room_directory_settings.public_receipts, a
  read-side HIDE leg only, default 1=public (server/public-visibility.mjs
  header 57-62; OWNER_HIDDEN_RECEIPT_SQL). It records no opt-in and
  triggers no projection.
- In-room publicId is null BY CONSTRUCTION without the opt-in:
  server/work-claim-routes.mjs receiptWithPublicLink (~585-601) returns
  publicId:null when publicReceipts(state).enabled!==true, before any
  row lookup. Public ids are deterministic: wcr_/wir_ +
  sha256(roomId\0taskId).hex[0:32] (public-read-model.mjs:98-99).
- Method note: the original lane's byId/sitemap probes used the in-room
  rc_ id, which is not a public id form (publicReceiptById rejects it) —
  weak probes; its decisive D1 evidence was the room-filtered list (0),
  the global list (newest unchanged ~16h) and publicId:null. The rerun
  probes every face with the true public ids.
- Pins: outcomes on 8facbfe4 (build 12:10:05.283Z); discovery window
  spanned 1cc9ef44 (build 12:25:25.015Z) and a return to 8facbfe4
  (build 12:36:56.357Z); faces matrix identical across all three.
- Harness note: main run's o2 room creation refused 429 (room-creation
  rate limit); supplementary o2.mjs under a fresh founder executed
  the full opt-out fixture.
