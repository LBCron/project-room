# Read-only account-state discriminator

Exact source00888c52110d36250d3e07629036701b72926d09. Fo acknowledged prior combined lifecycle evidence at26142 and narrowed the production blocker to account state or deployed divergence. This packet makes the next operator inspection concrete. It does not establish the actual deployed account state or clear the production blocker.

Two disposable actual Native July workerd/SQLite states were built through normal model operations: magic-only; and password legitimately disabled while a verified magic method remains enabled. Each survives cold reopen and produces exactly the symptom class: password login401 invalid_credentials, reset request200 sent followed by newly issued reset consume401 invalid_password_reset, duplicate signup202/notice. Each signs in successfully via its enabled magic method201, preserving the account. Six HTTP steps per state, two cold reopens, six intercepted mail requests, zero external network calls. No real account operations or email.

This is expected nonenumerating behavior when no eligible password method exists. A reset challenge is sent with no password-account target; its freshness does not make it a valid password reset. It is a local discriminator, not a diagnosis of fo's specific account. Production method state remains for Root/operator/fo to determine. If a consenting account owner already has access to an enabled email-link method, the existing magic sign-in path can discriminate further without deleting the account or weakening verification; production QA remains with its owner.

## Operator tool

`account_state_diagnostic.mjs` reads an already-authorized local SQLite file/snapshot. It adds no endpoint, credential, production connection or access. Source checkout must be pinned to00888. It imports the pinned normalization/hash helper and reads method/account metadata in one read transaction with DatabaseSync readOnly:true and PRAGMA query_only=ON. It reads no reset code, code hash or verifier value. Address and account IDs are used internally for bounded lookups and never emitted. Each account gets an anonymous candidate label. Output includes active/method-enabled/verified flags, password-reset eligibility, password-reset-required state, and whether the latest live reset challenge targets an eligible account. Eligibility alone does not validate a password or reset proof. Snapshot freshness is external to this tool.

```
LOCAL_LAB_GIT=/path/to/git node account_state_diagnostic.mjs \
  /path/to/clean00888 /path/to/authorized-local-snapshot.sqlite \
  --email-file /path/to/private-target-input
```

Keep the input file private; the target address is intentionally not a command-line argument. No sensitive data is needed in Room. Missing input/source/schema is refused with a static error and no account output.

Five real local SQLite fixtures pass: active unverified password, magic-only, disabled-password+magic, inactive password account and unknown address. Each checks secret canaries, actual CLI output, a refused write on a plain fixture table, and byte-identical snapshot before/after. The active unverified password is correctly eligible; verification alone is not reported as blocking reset. Invalid input refuses without leaking its canary. The same diagnostic succeeds on both actual closed Native SQLite files, with refused writes and unchanged bytes. The first write-refusal probe against an application table hit an unregistered application writer trigger before SQLite read-only checking; qualification now isolates the database guard using a plain fixture table. No trigger or application guard was changed.

## Reproduce local qualification

```
LOCAL_LAB_GIT=/path/to/git node account_state_diagnostic.check.mjs /path/to/clean00888
LOCAL_LAB_GIT=/path/to/git MINIFLARE_WORKERD_PATH=/path/to/matching-july-workerd \
  node account_method_states_native.mjs /path/to/clean00888 /path/to/checkout-with-cloudflare-dependencies
```

All three .mjs files stay adjacent. Existing dependencies only. Native persistence and private input files are removed after the experiment. Published receipts contain only synthetic de-identified metadata; no database, backup, email body, credentials or proofs. Source runtime remains unchanged. No full-suite, release, merge, deployment, second-laptop execution or live-account conclusion.
