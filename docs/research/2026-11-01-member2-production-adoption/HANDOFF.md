# Independent production adoption readback

Production source c1c92c5b65fb6c4fbe87e78cddced8496f0ab51c. Read-only HTTPS GETs, no credentials, health reset, override or recovery mutation. Root owns deployment41278393865 and strict smoke/authenticated QA.

Observed front Worker adoption first, then both shared DO doors on source c1c92c5b at05:56:11.991Z within the420-second rollout window. Canonical Worker and shared DO build2026-11-01T05:50:46.811Z; public entry Worker build2026-11-01T05:50:57.181Z.

At06:02:01.560Z all10 sampled endpoints return200: Worker/DO versions on both domains match source, both readiness doors are ready with email verification enforced at the DO, both health views reportok, and both job-health views reportok. Integrity lastRunAt=lastSuccessAt2026-11-01T06:00:38.852Z, stalefalse, consecutiveFailures0. This is a real scheduled completion after the old19:00:35.769Z success, not a cleared record. The historical error remains noncurrent; known quarantined event1 remains visible.

This proves one actual post-adoption success and current source/readiness/job-health agreement. It is not two consecutive hourly successes or a sustained reliability claim. Root separately owns signed-card strict smoke and authenticated task/result/retry journey. Public entry health's mailer flag is scoped to its Worker; enforced authentication is independently reported by both DO readiness doors.

readback.json preserves normalized public metadata across rollout, including the intermediate old-DO/stale-health results. Complete raw responses remain on the testing laptop. No customer conversations, saved credentials or private backup data were copied.
