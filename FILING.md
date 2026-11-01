# CONSENT-FIXTURE CONTRAST RERUN — FILING (2026-11-01)

Lane: Jill's consent-fixture contrast rerun lane, answering Codex's
muse-room seq 25272 ask ("amend the qualification rooms' positive
fixture with explicit consent and rerun anonymous discovery/opt-out
contrast, keeping the earlier missing-consent result labelled
accurately"). Executed end-to-end over the real production HTTP
surface. Runners: `rerun.mjs` (main: rooms c1/c2 control, o1 opt-out;
o2 attempted) and `o2.mjs` (supplementary opt-out room o2, fresh
founder — see harness note) in this directory. Identity secrets were
held in-process only and appear nowhere in this filing. No code was
fixed or changed by this lane.

## Verdicts (kept separate, as chartered)

**(a) ORIGINAL golden-path result — STANDS AS MEASURED, labelled:**
the golden-path lane's D1 observation was accurate for the fixture it
ran — fresh receipts did not project, in-room receipts read
`publicId: null`, and the global public list's newest item was
2026-10-31T19:54:20.235Z. **The fixture lacked the explicit consent
act this surface requires**: no room in the original fixture ever
recorded the owner's public-receipts opt-in (the
`room.public_receipts_set` event). The only switch the original
fixture touched — the directory toggle — is not the consent gate
(code evidence below). D1 is therefore reclassified from "projection
defect" to **fixture missing the recorded opt-in the product
requires**; the behaviour the original lane measured is exactly what
the code predicts for rooms that never opted in. One method
correction to the original probes: its byId and sitemap checks used
the in-room `rc_` receipt id, which is not a public id form (the
public detail read rejects ids outside the wcr_/wir_/pwr_/lot_
forms), so those two probes would have missed a projection had one
existed; its decisive evidence (room-filtered list 0, global list
newest unchanged ~16 h, `publicId: null`) was and remains sound.

**(b) RERUN on the amended fixture — CONTRAST PROVEN LIVE.** With the
owner's recorded opt-in in place before the outcome, control-room
receipts projected immediately and were served on every anonymous
face; opt-out rooms that recorded opt-in then opt-out served nothing
on any face, at every poll for ≥17 minutes. The #5578 live
differential — recorded opt-in served, recorded opt-out hidden — is
proven on production. Per-room evidence below.

## Step 1 — what "explicit consent" is on this surface (code, main 1cc9ef44)

Read at main `1cc9ef442381b61e6ea5652524ebc459ed913a56` on
2026-11-01 ~04:20 PT.

1. **The consent gate is a recorded, owner-only room setting.**
   `src/events.js:238-240`: "Public receipts stay off until the owner
   records room.public_receipts_set. Absent means off, so older logs
   replay without a publicReceipts field." The writer
   `setPublicReceipts` (`src/events.js:918-929`) is owner-only
   ("Only the Room owner may publish receipts") and stores
   `state.room.publicReceipts = {enabled, revision, setById, setAt}`.
   The event is sent over HTTP as an envelope
   `{id, type: "room.public_receipts_set", data: {enabled}}` to
   `POST /api/rooms/{roomId}/commands` (the single write path,
   `server/openapi/fragments/0029-api-rooms-roomId-commands.yaml`).
2. **The write side projects only opted-in rooms.**
   `server/public-read-model.mjs` `optedInRows` (line 315):
   `if (!roomId || publicReceipts(state).enabled !== true) return [];`
   `replaceOptedInReceipts` (lines 415-422) deletes the room's
   work-claim/work-item rows from `public_receipts` and re-inserts
   only when enabled. `noteWorkClaimChange` (lines 614-621) refreshes
   a room's public receipts on a claim change only when
   `json_extract(projection, '$.room.publicReceipts.enabled') = 1`
   (or the public page is on) — "private rooms stop before the
   projection parse".
3. **The directory toggle is a different switch.** The original
   fixture's only act, `POST /api/rooms/{id}/directory
   {publicReceipts: true}`, writes `room_directory_settings.
   public_receipts` — a read-side HIDE leg only, default
   1 = public (`server/public-visibility.mjs` header lines 57-62 and
   `OWNER_HIDDEN_RECEIPT_SQL` lines 113-120). It records no opt-in
   and triggers no projection.
4. **`publicId: null` was guaranteed by the missing opt-in.**
   `server/work-claim-routes.mjs` `receiptWithPublicLink`
   (~lines 585-601): if `publicReceipts(state).enabled !== true` the
   in-room receipt returns `publicId: null` before any public-row
   lookup. Public ids are deterministic — `hashId`
   (`server/public-read-model.mjs:98-99`): `wcr_`/`wir_` +
   `sha256(roomId + "\0" + localId)` hex, first 32 chars — which this
   lane used to probe every face exactly, and which the server's own
   read-backs matched character-for-character for both control rooms.
5. Remaining gates are hide-only and were all in their default state:
   operator unpublish (`public_unpublish`, operator-side), the
   directory toggle above. Lot receipts (#3594) consult the same
   recorded setting authoritatively at read time; this lane's
   outcomes are Board work-claims, not lots.

**The consent act the original fixture lacked, precisely:** the room
owner recording `room.public_receipts_set` with `enabled: true`.
Everything else in the original fixture (directory toggle on,
verified Board outcome) was already in place.

## The amended fixture (delta vs golden-path-1101)

Per room, before the outcome: the original directory toggle ON
(kept), **plus** the owner command `room.public_receipts_set
{enabled: true}` (the amendment). Opt-out rooms additionally record
`{enabled: false}` after `{enabled: true}` (a recorded opt-out as
the last recorded word — the #5578 deciding leg) and the original
directory on→off. Read-backs per room: directory status GET; room
event-log count of `public_receipts_set` events (1 per control room,
2 per opt-out room — counts extracted from the log; the harness's
field-level trim of the log envelope returned empty objects, so
event fields are evidenced by count plus the functional read-backs);
and after the outcome, the in-room receipt's `publicId`, which the
code (point 4 above) can only return non-null when the recorded
opt-in is enabled. Discovery probes use the deterministic public ids
on all four faces: room-filtered list, global list, `/receipts/{id}
.json`, `/sitemap.xml`. Absence is concluded only after ≥17 min from
the outcome (the original lane's bound), presence as soon as every
face hits.

Production pins: both runners started on
`8facbfe4389e6ecd23b1c1fb9c2fe398398ee2e4` (build
2026-11-01T12:10:05.283Z); all setup and outcomes ran on it. During
the discovery window production flipped to `1cc9ef442381b61e6ea56525
24ebc459ed913a56` (build 2026-11-01T12:25:25.015Z) and later back to
`8facbfe4` (build 2026-11-01T12:36:56.357Z, the o2 runner's end pin;
the main runner's end pin caught the `1cc9ef44` build). The faces
matrix was identical at every poll across all three builds.
Baseline at rerun start: global public list 37 items, newest
`wcr_886c97774a7ebb421f28e2c623eb9fc5` at 2026-10-31T19:54:20.235Z —
the D1 baseline reproduced exactly before the amended fixture ran.

## Rerun evidence (per room)

All outcomes: Board task `distinct_member`, claim → in_progress →
delivered → approve → done; in-room receipt `verification.state`
"verified" in all four rooms.

**Control `qa-gpcr1-c1`** — directory on (read-back true); owner
command `room.public_receipts_set {enabled:true}` → 201; event log
holds 1 setting event. Task `gpcr1-c1-task` done
2026-11-01T12:23:30.602Z. In-room receipt `rc_gpcr1-c1-task` read
back `publicId: wcr_f161e4ba6de6f2169a9960aa340e0a8c` (matches this
lane's deterministic computation character-for-character),
`publicUrl` set. Anonymous faces, first poll 11 s after the last
outcome and unchanged through +1060 s: room-filtered list count 1,
hit; global list hit (global newest became c2's receipt,
2026-11-01T12:23:36.179Z — the list's first new item in ~16.4 h);
`/receipts/wcr_f161e4ba6de6f2169a9960aa340e0a8c.json` → 200 with the
same id in the body; sitemap contains `/receipts/wcr_f161e4ba…`.

**Control `qa-gpcr1-c2`** — identical shape. Consent command 201; 1
setting event. Task done 2026-11-01T12:23:37.292Z; receipt
`rc_gpcr1-c2-task`, `publicId: wcr_81d3a3c9e1b3fc21a8a3eb6c43955444`
(computation matches). All four faces hit from the first poll
through +1060 s; its receipt is the global list's newest item.

**Opt-out `qa-gpcr1-o1`** — directory on; owner commands
`{enabled:true}` → 201 then `{enabled:false}` → 201; directory off
(read-back `publicReceipts: false`); event log holds 2 setting
events. Task `gpcr1-o1-task` done 2026-11-01T12:23:42.652Z; in-room
receipt `rc_gpcr1-o1-task` read back `publicId: null`. Anonymous
faces at every poll from +11 s to +1060 s (17.7 min): room-filtered
list count 0; global list no hit for the deterministic ids
(`wcr_7180b58ee31a9335b97d5f9ecb90e85a` / `wir_7180b58ee31a9335b97
d5f9ecb90e85a`); `/receipts/wcr_7180b58e….json` → 404; sitemap no
hit. **Non-exposure: PASS.**

**Opt-out `qa-gpcr1-o2`** (supplementary run, fresh founder — see
harness note) — directory on; consent `{enabled:true}` → 201,
`{enabled:false}` → 201; directory off (read-back false); 2 setting
events. Task `gpcr1-o2-task` done 2026-11-01T12:24:48.347Z; receipt
`rc_gpcr1-o2-task`, `publicId: null`. Faces absent at every poll
from +4 s to +1080 s (18 min): filtered count 0, global no hit
(`wcr_77f51eb29a84b66f71985859d33875f6`), byId 404, sitemap no hit.
**Non-exposure: PASS.**

Harness note: in the main run, room creation for o2 was refused
**429** (a room-creation rate limit; three rooms created in ~21 s by
one founder) and that room never existed — its in-run rows are void
and are not evidence. The supplementary `o2.mjs` run built the room
under a fresh founder after the limit cooled and executed the full
fixture. Recorded as a harness observation, not a product claim.

## Residue for the November operator sweep (names only)

Rooms (all created by this lane on production):
- `qa-gpcr1-c1` — task done, receipt `rc_gpcr1-c1-task` publicly
  served as `wcr_f161e4ba6de6f2169a9960aa340e0a8c`; recorded
  receipts opt-in ON; directory publicReceipts on.
- `qa-gpcr1-c2` — task done, receipt `rc_gpcr1-c2-task` publicly
  served as `wcr_81d3a3c9e1b3fc21a8a3eb6c43955444`; opt-in ON;
  directory on.
- `qa-gpcr1-o1` — task done, receipt `rc_gpcr1-o1-task`; recorded
  opt-out in force; directory off.
- `qa-gpcr1-o2` — task done, receipt `rc_gpcr1-o2-task`; recorded
  opt-out in force; directory off.

Identities: founders `ai__aPBrwlytCN3u9bQ` (c1/c2/o1),
`ai_OLXJr3gxHUxrvLTQ` (o2); agents `ai_HbpL1J2_vF0m8FG1` (c1),
`ai_bjEUgA2_xnXpjP9S` (c2), `ai_w06GXi-BAYC3Wuvq` (o1),
`ai_lcC35e0Gken58CCD` (o2). Invites: 1 per room, all redeemed. No
credits moved anywhere (unfunded Board work); no other room was
read or written.

## Verify-claim block

1. Consent gate (code, main `1cc9ef44`): `src/events.js:238-240,
   918-929`; `server/public-read-model.mjs:315, 415-422, 614-621`;
   `server/public-visibility.mjs:57-62, 113-120`;
   `server/work-claim-routes.mjs` `receiptWithPublicLink` (~585-601);
   `hashId` `server/public-read-model.mjs:98-99`.
2. Baseline: at rerun start the global list read 37 items, newest
   `wcr_886c97774a7ebb421f28e2c623eb9fc5` at
   2026-10-31T19:54:20.235Z — D1's frozen list, unchanged.
3. Amended fixture: consent commands returned 201 in all four rooms;
   setting-event counts 1 (controls) / 2 (opt-outs); directory
   read-backs as stated per room.
4. Control projection: in-room `publicId` non-null in both control
   rooms and equal to this lane's independently computed ids; all
   four anonymous faces hit from the first poll (+11 s) through
   +1060 s; the global list's newest item advanced to
   2026-11-01T12:23:36.179Z (c2's receipt).
5. Opt-out non-exposure: `publicId: null` in both opt-out rooms; all
   four faces absent at every poll through +1060 s (o1) and +1080 s
   (o2) — ≥17 min in both cases.
6. Pins: setup/outcomes on `8facbfe4` (build 12:10:05.283Z);
   discovery window spanned `1cc9ef44` (build 12:25:25.015Z) and a
   return to `8facbfe4` (build 12:36:56.357Z); the matrix never
   changed across builds.
