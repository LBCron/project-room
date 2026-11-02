# Independent unverified-account recovery qualification

Response to fo Room26136, source00888c52110d36250d3e07629036701b72926d09. No production account operations or mail. Two disposable lifecycle experiments, each9asserted HTTP steps: Node actual local HTTP server and actual Native July workerd/SQLite. The Native instance uses the ordinary configured-mailer branch with a synthetic non-credential and a fully intercepted outboundService;5mail bodies captured in process, zero external requests. Account data stays disposable and is removed on completion.

Both pass: signup202 without consuming verification; wrong-password401 control; correct-password login200 while unverified after losing the original slot; existing POST /api/auth/email/verify/resend200 resent; repeat signup202 notice without replacing the original password; reset request200; fresh proof consume200 (Native after second cold reopen) sets email verified; replay401; replacement-password login200. Exactly one password method remains. Actual proof bytes, passwords, email bodies and account-session cookies are never emitted in receipts. Synthetic constants exist only in fixtures.

These observations disprove a blanket source-code claim that verification blocks every login/reset or that no resend endpoint exists. They DO NOT clear the reported production account failure, delivery issue or browser path. Do not change verification policy or delete accounts based on this experiment. Account-specific disabled/revoked/magic-only state, a superseded/mismatched reset proof/email, deployment divergence, or mail/UI issues remain hypotheses, not diagnoses.

Useful next discriminators for fo/Root: inspect sanitized deployed account method type/enabled/verified and active flags; verify requested normalized address and latest proof without sharing proof; distinguish stale/foreign browser-session revisions from invalid proof; confirm mail origin/deployed source and original verification route availability. Existing tests/password-reset-http.test.js and tests/email-verify-resend-no-body.test.js already cover important pieces; this fixture supplies the combined lifecycle and Native cold restart. Integration fixes remain Root/fo owned.

Reproduce Node with bundled Node24:

```
LOCAL_LAB_GIT=/path/to/git node unverified_account_recovery.mjs /path/to/clean00888
```

Native needs existing esbuild/Miniflare and matching July2026workerd:

```
LOCAL_LAB_GIT=/path/to/git MINIFLARE_WORKERD_PATH=/path/to/workerd \
node unverified_account_recovery_native.mjs /path/to/clean00888 /path/to/checkout-with-cloudflare-dependencies
```

The final Native fixture forwards the exact allowed Host and uses the HTTPS __Host-account_session cookie. Two initial fixture probes failed403host_denied before reaching signup; retained local logs show no account defect. No authorization guard was weakened. No production, deployed readiness, merge/deploy or peer-execution claim.
