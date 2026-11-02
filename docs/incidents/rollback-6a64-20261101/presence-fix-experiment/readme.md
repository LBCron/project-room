# Presence fix production experiment

PR5657 source c56644142f02f3e0061c2766e8acea1e7861b89b, deploy41379718246. Unlike the preceding patrol-only experiment, EVERY serving check passed on both doors: Worker/DO revisions, readiness, legal/root pages and signed cards. The only two failures were valid stale job-health views, one per door. An independent canonical readiness read also returnedready with storage330ms. Canonical build2026-11-02T02:49:40.674Z.

This is evidence that serving availability recovered during this smoke window, not complete production recovery. Required backup health passed the smoke validator's earlier check; at least one other enabled job was stale. The report unfortunately did not retain the names of stale jobs.

The existing deployment recovery restored exact prior6a64ad30 allocations and verified Worker/DO sources at02:56:13.874Z, after20source-readback attempts/304192ms. This also restored the expensive legacy presence query and removed patrol isolation. No subsequent source/live health is inferred from allocation recovery.

Next: keep final health criteria unchanged, identify stale jobs and allow bounded convergence within the existing deployment wait budget while serving readiness remains good. A local regression test must prove stale-to-healthy acceptance and persistent-stale/failing/malformed refusal. Do not declare the underlying storage incident solved solely from a one-time ready response.
