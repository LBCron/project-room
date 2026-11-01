# Production release c1c92c5

Main and both production doors: c1c92c5b65fb6c4fbe87e78cddced8496f0ab51c.
Canonical Worker buildId: 2026-11-01T05:50:46.811Z.
Entry Worker buildId: 2026-11-01T05:50:57.181Z.
Shared Durable Object adopted the release at approximately 05:56:12Z.

## Qualification and provenance

The composed overhaul landed through #5568 at 9d448ec4d4338df794d418ce2415b50d108f3661, with Git tree 294ec34105afe6510499ad4ef7d59967a2241287 identical to fully unit-qualified source 2007b2a3fe43c6be3276d787ed5c630d2ddd3c79. Repository receipt verifier accepted all 1659 files across three source/run/attempt-matched shards: 13276 passed, zero failed, 33 skipped. Other-host raw shard receipts: commit 63696370a2b86680c9ba040bd16a7fd67fe92152, docs/research/2026-11-01-member2-final-unit-2007/.

Test-only #5575 corrected two first-use expectations around independent review and final approval; four real desktop/touch cases passed. Main c1c92 has tree 51f1d906df25f8d74a1c38143560e033a9434ad3, identical to its qualified head bb99b872bba3e62f000e4f5b640ad025d7f215cf. Only scripts/first-use-check.mjs differs from source 2007; production runtime bytes are unchanged.

Hosted run 41277539821 passed Workers, contract, lint, friend-agent and five browser shards. Shard four had only the two corrected first-use expectations; its remaining scripts passed. Unfinished hosted unit/coverage jobs were cancelled after preserving evidence, not relabelled green. Exact-main schema gate 41278127485 succeeded before deployment.

## Deployment and actual recovery

Deployment workflow 41278393865 uploaded both Workers, then failed strict smoke because the integrity heartbeat was already stale. Its failure remains on record. Recovery required roll-forward because schema 44 cannot safely roll back to the old schema-42 build. No rollback, health reset, baseline reset, threshold change or schedule change occurred. Public live smoke and runtime publication were skipped in that workflow and completed separately after recovery.

The real scheduled integrity job completed at 2026-11-01T06:00:38.852Z, advancing both lastRunAt and lastSuccessAt. Job health returned HTTP 200/status ok at 06:01:07Z. A brief preceding overall job-health failure was observed while integrity itself was already ok; its cause is not asserted here. The historical noncurrent error and one quarantined event remain visible. A second hourly success is still required for sustained recovery acceptance.

Recovered strict smoke passed 16/16 across both doors, signed cards converged, email verification remained enforced. Public browser smoke returned ok with p95 646 ms and one known warning: advertised work-receipt extension spec URI returns 404. Independent production adoption/readiness/job health readbacks are at ab9e033851f00ddce61f582c4b8d11073558abd9, docs/research/2026-11-01-member2-production-adoption/.

## Authenticated native work qualification

A fresh separate qa-release-c1c92-1101 room used the existing Codex identity. Actual native work actions without expectedRevision accepted, started and completed a task; reissuing the original accept after progress and completion returned the same event without another sequence effect. Changed input under the same request ID was rejected. The exact saved text and completed state were read back. This tests reissued requests after progress, not physical network loss, independent human review, host execution or background wake. No persistent user automation was revoked.

## Node runtime publication

The skipped runtime publication was executed manually using the existing deploy workflow procedure after successful recovered smoke. Release runtime-2026-11-01-c1c92c5 targets the exact live commit. The remotely downloaded asset verified against the expected 660-file package; archive SHA-256 aaccae1593e6d323a890f2e66d7715f31bed0162246fd9a3873770eb2a1083c6, 3492406 bytes. The attached immutable verifier receipt precedes latest promotion and correctly records publicationPromoted=false. A subsequent GitHub latest-release readback confirmed the tag after promotion. This is a Node runtime release, not public Dot plugin approval or installability proof.

## Still open

Canonical production message conversion remains OFF: the engine landed, but Cloudflare still uses messageEntityProjection=false and messageProjectionWindow=null. No claim that live JSON history blobs are removed is justified. Bounded activation, verified eligibility, production representation/count readback and real restart qualification remain required.

Other explicit holds include durable pairing recovery #5517 and dependent #5537, privacy-transform #5524, anonymous credential design #5558, freeze-class changes requiring John's call, own-post reply attention, public Dot plugin package/listing/review/disclosures, fresh consenting Android account qualification, and actual Codex Room-only host wake/restart. Global integrity work still grows with history. This release is a verified operational checkpoint, not completion of the MVP.

Private backups, SQL databases, provider logs and credential files are deliberately excluded.

Subsequent sanitized tail extraction records one fast-jobs RPC failure near the recovered tick and a later successful scheduled invocation. The specific RPC cause and relationship to the brief health transient remain unproven; see live-c1c92-cron-observation.json. The full private tail is excluded.

Source refinement: canonical authority is a separate per-room marker activated by migrateMessageAuthority; it does not require turning on the rolling entity/window flags. Production has not undergone this explicit conversion. Blindly enabling the rolling window would disable the currently qualified targeted canonical edit path.
