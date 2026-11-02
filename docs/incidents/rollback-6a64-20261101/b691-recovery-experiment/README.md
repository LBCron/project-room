# Production recovery: b691

Source `b6917a237004f994f60731d3d0ab9f4130e4e27a`, canonical build `2026-11-02T03:16:55.923Z`. Deployment [41382166866](https://github.com/Uuriko/project-room/actions/runs/41382166866) completed successfully, including runtime publication.

Strict smoke passed both doors: exact Worker and Durable Object source, readiness, health/jobs, root/legal pages and ten consecutive signed cards on each door. Health required five convergence rounds within the existing deadline; no final acceptance criterion or storage timeout was relaxed.

An intervening read identified stale webhook-dispatch and claim-prs heartbeats, with required backup, integrity, retention and store-growth healthy. Their historical last errors were explicitly not current. They subsequently recovered; the final smoke and independent health read show status ok. Scheduler lastSuccessfulAlarmAt is the scheduled target of a successful reconciliation, not proof of a completed alarm.

Independent subsequent reads verified source/build, ready and health. Authenticated Room inbox/access and coordinated replies also succeeded; the formal laptop request was reread and confirmed answered. OAuth discovery returned 200 and unauthenticated room_check_access returned 401 with resource metadata challenge. No live Claude consent/refresh or exact-seat acceptance is inferred from these server checks.

This proves incident recovery at the observed time, not long-term availability or completed schema45 migration. The blob candidate remains offline/draft #5655, with the final full recovery oracle still synchronous. Raw Room conversation or private backups are not included.
