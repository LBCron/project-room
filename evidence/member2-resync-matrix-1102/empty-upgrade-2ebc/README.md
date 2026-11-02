# Independent unused-format5 upgrade qualification

Root26033, accepted26034. Exact2ebce68b3c556f313476716afdae84f2a2b33e6d.
Node24.22.1, Miniflare4.20260730.0, esbuild0.28.2, workerd2026-07-30.
Existing local Darwin July binary matching default dependency selected, noOctober.
No runtime/test edits, deploy, reset or staging storage mutation.

Commands unchanged:
- repository: node --test tests/current-empty-format-upgrade.test.mjs
- cloudflare: node --test current-empty-format-upgrade.check.mjs

Independent Node5/5 and Native1/1 pass, zero failures/cancellations/skips.
Both ran concurrently in isolated temporary fixtures. Native existing120stimeout
unchanged. Wrapper wall-until-observed is1.6405s/1.6394s, not independent isolated
latency; actual test-runner durations are1581.15ms/1362.80ms in raw logs.

Node uses a real archived8e65a6e73ae191ffa7fc89c2e88fa382ad2ac000 RoomStore to
create the old file-backed state. It preserves legacy room/account/session/
credentials; refuses populated normalized state; refuses altered old guard SQL;
rolls back interrupted trigger installation, then resumes idempotently; refuses
pending restore while preserving continuation/catalog. Native constructs an old
marker/stamp state synthetically and verifies production constructor cold reopening
with retained account and legacy credential. Native is not a full genuine-old
runtime-to-new-runtime transfer: that distinction stays explicit.

Independent code review: exact reviewed old5 table/guard definitions required;
normalized head/record/proof/scratch must all be empty; clear restore and closed
permit required; changes are transaction-bound and verified. This is NOT a
populated native5 data migration or arbitrary historical guard admission.

Important confidence limit: same-source staging run41415262669 is completed
FAILURE per independent GitHub read. These local passes do not establish staging
recovery, production readiness, full-suite clearance or preserved live accounts.
Root retains runtime/release; exact hosted constructor cause remains its live-tail
investigation. No existing production data or credentials were used here.

These upgrade fixtures seed a retained room key/account/session, not a complete
preexisting OAuth/agent-connection population. Those broader auth contracts have
separate qualification and are not newly proven across old5-to6 by these cases.
